/**
 * ExportBundle — a format-agnostic representation of a report page that
 * the PDF / XLSX / DOCX writers all consume. Adding a new report is just
 * a query + a builder that maps the rows into this shape.
 *
 * Design: a bundle is a title, subtitle, some header key/values, then
 * an ordered list of sections. Each section is either a table of rows
 * (columns declared explicitly so the writers can align + format each
 * column consistently) or a simple key/value list (for KPI blocks).
 */

import { query, queryOne } from '../db/pool.js';

export type Period = 'daily' | 'monthly' | 'yearly';

export interface Column {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  format?: 'number' | 'money' | 'text' | 'date';
}

export interface TableSection {
  kind: 'table';
  title: string;
  subtitle?: string;
  columns: Column[];
  rows: Array<Record<string, string | number | null>>;
  /** Optional footer row displayed as a total. Same shape as rows. */
  totalRow?: Record<string, string | number | null>;
}

export interface KpiSection {
  kind: 'kpi';
  title: string;
  subtitle?: string;
  items: Array<{ label: string; value: string | number; hint?: string }>;
}

export type Section = TableSection | KpiSection;

export interface ExportBundle {
  title: string;
  subtitle: string;
  headerMeta: Array<{ label: string; value: string }>;
  sections: Section[];
  /** File-safe base name, no extension. */
  filenameBase: string;
}

/* ----------------------------------------------------------------- */
/*  Period → SQL window                                                */
/* ----------------------------------------------------------------- */

export function periodStartSql(period: Period): string {
  switch (period) {
    case 'daily':   return "CURRENT_DATE";
    case 'yearly':  return "DATE_TRUNC('year',  CURRENT_DATE)::date";
    case 'monthly':
    default:        return "DATE_TRUNC('month', CURRENT_DATE)::date";
  }
}

export function periodLabel(period: Period): string {
  const d = new Date();
  switch (period) {
    case 'daily':   return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    case 'yearly':  return d.getFullYear().toString();
    case 'monthly':
    default:        return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
}

/* ================================================================= */
/*  Impact bundle — mirrors the /reports/impact JSON payload           */
/* ================================================================= */

export async function buildImpactBundle(period: Period): Promise<ExportBundle> {
  const START = periodStartSql(period);

  const kpis = await queryOne<any>(`
    WITH completed_deliveries AS (
      SELECT d.client_deliveries_id, d.delivery_date, d.fulfillment_method_id,
             pr.client_id
      FROM tbl_client_deliveries d
      JOIN tbl_client_provisioning_request pr
        ON pr.client_provisioning_request_id = d.client_provisioning_request_id
      JOIN lkp_delivery_status ds ON ds.delivery_status_id = d.delivery_status_id
      WHERE d.delivery_date >= ${START} AND d.delivery_date <= CURRENT_DATE
        AND ds.delivery_status IN ('Delivered','Completed')
    )
    SELECT
      (SELECT COUNT(DISTINCT client_id)  FROM completed_deliveries)::int AS households,
      (SELECT COUNT(*) FROM completed_deliveries cd
         JOIN lkp_fulfillment_method fm ON fm.fulfillment_method_id = cd.fulfillment_method_id
        WHERE fm.fulfillment_method ILIKE 'Home delivery')::int         AS deliveries,
      (SELECT COUNT(*) FROM completed_deliveries cd
         JOIN lkp_fulfillment_method fm ON fm.fulfillment_method_id = cd.fulfillment_method_id
        WHERE fm.fulfillment_method IN ('Container pickup','Walkout'))::int AS warehouse_pickups,
      (SELECT COUNT(*) FROM tbl_client_visit
        WHERE visit_date >= ${START} AND visit_date <= CURRENT_DATE)::int AS guest_selection_appointments,
      (SELECT COUNT(*) FROM tbl_referral
        WHERE referral_date >= ${START} AND referral_date <= CURRENT_DATE)::int AS partnering_agency_requests
  `);

  const byCity = await query<{ city: string | null; households: number }>(`
    SELECT city.city AS city, COUNT(DISTINCT pr.client_id)::int AS households
    FROM tbl_client_deliveries d
    JOIN tbl_client_provisioning_request pr
      ON pr.client_provisioning_request_id = d.client_provisioning_request_id
    JOIN lkp_delivery_status ds ON ds.delivery_status_id = d.delivery_status_id
    JOIN tbl_client c        ON c.client_id = pr.client_id
    JOIN tbl_contact ct      ON ct.contact_id = c.contact_id
    LEFT JOIN tbl_address a  ON a.address_id = ct.address_id
    LEFT JOIN lkp_city city  ON city.city_id = a.city_id
    WHERE d.delivery_date >= ${START} AND d.delivery_date <= CURRENT_DATE
      AND ds.delivery_status IN ('Delivered','Completed')
    GROUP BY city.city
    ORDER BY households DESC, city.city
  `);

  const situations = await query<{ situation: string; households: number }>(`
    SELECT ct.client_type AS situation, COUNT(DISTINCT pr.client_id)::int AS households
    FROM tbl_client_deliveries d
    JOIN tbl_client_provisioning_request pr
      ON pr.client_provisioning_request_id = d.client_provisioning_request_id
    JOIN lkp_delivery_status ds ON ds.delivery_status_id = d.delivery_status_id
    JOIN tbl_client_client_type cct ON cct.client_id = pr.client_id
    JOIN lkp_client_type ct         ON ct.client_type_id = cct.client_type_id
    WHERE d.delivery_date >= ${START} AND d.delivery_date <= CURRENT_DATE
      AND ds.delivery_status IN ('Delivered','Completed')
    GROUP BY ct.client_type
    ORDER BY households DESC, ct.client_type
  `);

  const byAgency = await query<{ agency_name: string; households: number }>(`
    SELECT COALESCE(a.agency_name, 'Direct / walk-in') AS agency_name,
           COUNT(DISTINCT pr.client_id)::int AS households
    FROM tbl_client_deliveries d
    JOIN tbl_client_provisioning_request pr
      ON pr.client_provisioning_request_id = d.client_provisioning_request_id
    JOIN lkp_delivery_status ds ON ds.delivery_status_id = d.delivery_status_id
    LEFT JOIN tbl_referral r        ON r.client_id = pr.client_id
    LEFT JOIN tbl_agency_contact ac ON ac.agency_contact_id = r.agency_contact_id
    LEFT JOIN tbl_agency a          ON a.agency_id = ac.agency_id
    WHERE d.delivery_date >= ${START} AND d.delivery_date <= CURRENT_DATE
      AND ds.delivery_status IN ('Delivered','Completed')
    GROUP BY a.agency_name
    ORDER BY households DESC, agency_name
  `);

  const itemCategories = await query<{ category: string; count: number }>(`
    SELECT COALESCE(ic.item_category, 'Uncategorized') AS category,
           COUNT(*)::int                                AS count
    FROM tbl_delivery_items di
    JOIN tbl_client_deliveries cd ON cd.client_deliveries_id = di.client_deliveries_id
    JOIN lkp_delivery_status ds   ON ds.delivery_status_id = cd.delivery_status_id
    LEFT JOIN tbl_corp_facility_inventory_item ii
           ON ii.corp_facility_inventory_item_id = di.corp_facility_inventory_item_id
    LEFT JOIN lkp_item_category ic ON ic.item_category_id = ii.item_category_id
    WHERE cd.delivery_date >= ${START} AND cd.delivery_date <= CURRENT_DATE
      AND ds.delivery_status IN ('Delivered','Completed')
    GROUP BY ic.item_category
    ORDER BY count DESC, category
  `);

  const label = periodLabel(period);
  const totalHouseholdsCity   = byCity.reduce((s, r) => s + r.households, 0);
  const totalHouseholdsSit    = situations.reduce((s, r) => s + r.households, 0);
  const totalHouseholdsAgency = byAgency.reduce((s, r) => s + r.households, 0);
  const totalItems            = itemCategories.reduce((s, r) => s + r.count, 0);

  return {
    title: 'Impact Data',
    subtitle: `Recipient reach — ${label}`,
    filenameBase: `impact-${period}-${new Date().toISOString().slice(0,10)}`,
    headerMeta: [
      { label: 'Period', value: period[0].toUpperCase() + period.slice(1) },
      { label: 'Window', value: label },
    ],
    sections: [
      {
        kind: 'kpi',
        title: 'Admin summary',
        items: [
          { label: 'Households',                    value: kpis?.households ?? 0 },
          { label: 'Deliveries',                    value: kpis?.deliveries ?? 0 },
          { label: 'Warehouse pickups',             value: kpis?.warehouse_pickups ?? 0 },
          { label: 'Guest selection appointments',  value: kpis?.guest_selection_appointments ?? 0 },
          { label: 'Partnering agency requests',    value: kpis?.partnering_agency_requests ?? 0 },
        ],
      },
      {
        kind: 'table',
        title: 'Households by city',
        columns: [
          { key: 'city', label: 'City' },
          { key: 'households', label: 'Households', align: 'right', format: 'number' },
        ],
        rows: byCity.map(r => ({ city: r.city ?? '(no city recorded)', households: r.households })),
        totalRow: { city: 'Total', households: totalHouseholdsCity },
      },
      {
        kind: 'table',
        title: 'Situation',
        subtitle: 'A household can appear in multiple rows if it is multi-typed',
        columns: [
          { key: 'situation', label: 'Situation' },
          { key: 'households', label: 'Households', align: 'right', format: 'number' },
        ],
        rows: situations.map(r => ({ situation: r.situation, households: r.households })),
        totalRow: { situation: 'Total', households: totalHouseholdsSit },
      },
      {
        kind: 'table',
        title: 'Households by referring agency',
        subtitle: 'Direct / walk-in = no referral on file',
        columns: [
          { key: 'agency', label: 'Agency' },
          { key: 'households', label: 'Households', align: 'right', format: 'number' },
        ],
        rows: byAgency.map(r => ({ agency: r.agency_name, households: r.households })),
        totalRow: { agency: 'Total', households: totalHouseholdsAgency },
      },
      {
        kind: 'table',
        title: 'Items delivered',
        subtitle: 'Total quantity per item category',
        columns: [
          { key: 'category', label: 'Category' },
          { key: 'count', label: 'Count', align: 'right', format: 'number' },
        ],
        rows: itemCategories.map(r => ({ category: r.category, count: r.count })),
        totalRow: { category: 'Total', count: totalItems },
      },
    ],
  };
}

/* ================================================================= */
/*  Inventory bundle — mirrors the /reports/inventory JSON payload     */
/* ================================================================= */

export type InventoryStatus = 'all' | 'in_stock' | 'delivered' | 'received' | 'other';

export interface InventoryQuery {
  period: Period;
  status: InventoryStatus;
  /** Sort options for the per-item table. */
  sort:   'category' | 'warehouse' | 'value' | 'date_added' | 'condition' | 'size';
  dir:    'asc' | 'desc';
}

/**
 * Status derivation, expressed once and reused across every SQL that
 * needs to project a per-item status:
 *
 *   in_stock  = date_dispositioned IS NULL
 *   delivered = date_dispositioned IS NOT NULL AND row exists in
 *               tbl_delivery_items joined to a completed delivery
 *   other     = date_dispositioned IS NOT NULL AND no such delivery row
 *   received  = joined-in for date_added-in-period roll-up (NOT a
 *               mutually-exclusive per-item classification — every
 *               item that's in-stock or dispositioned was received
 *               at some point).
 *
 * The status filter is applied by JOINing the classifier CTE and then
 * WHERE'ing on the projected status, so callers don't repeat the logic.
 */
const STATUS_CTE = `
  item_status AS (
    SELECT
      ii.corp_facility_inventory_item_id AS item_id,
      CASE
        WHEN ii.date_dispositioned IS NULL THEN 'in_stock'
        WHEN EXISTS (
          SELECT 1 FROM tbl_delivery_items di
          JOIN tbl_client_deliveries d ON d.client_deliveries_id = di.client_deliveries_id
          JOIN lkp_delivery_status ds  ON ds.delivery_status_id = d.delivery_status_id
          WHERE di.corp_facility_inventory_item_id = ii.corp_facility_inventory_item_id
            AND ds.delivery_status IN ('Delivered','Completed')
        ) THEN 'delivered'
        ELSE 'other'
      END::text AS status
    FROM tbl_corp_facility_inventory_item ii
  )
`;

function statusWhere(status: InventoryStatus): string {
  switch (status) {
    case 'in_stock':  return "s.status = 'in_stock'";
    case 'delivered': return "s.status = 'delivered'";
    case 'other':     return "s.status = 'other'";
    case 'received':  return "ii.date_added_to_inventory >= " + periodStartSql('daily'); // filled at call site
    case 'all':
    default:          return "TRUE";
  }
}

function sortOrderBy(q: InventoryQuery): string {
  const dir = q.dir === 'asc' ? 'ASC' : 'DESC';
  switch (q.sort) {
    case 'warehouse':  return `warehouse ${dir} NULLS LAST, category ASC`;
    case 'value':      return `value ${dir} NULLS LAST, category ASC`;
    case 'date_added': return `date_added ${dir} NULLS LAST, category ASC`;
    case 'condition':  return `condition ${dir} NULLS LAST, category ASC`;
    case 'size':       return `size ${dir} NULLS LAST, category ASC`;
    case 'category':
    default:           return `category ${dir}, warehouse ASC`;
  }
}

export async function buildInventoryBundle(q: InventoryQuery): Promise<ExportBundle> {
  const START = periodStartSql(q.period);
  const sw = q.status === 'received'
    ? `ii.date_added_to_inventory >= ${START} AND ii.date_added_to_inventory <= CURRENT_DATE`
    : statusWhere(q.status);

  // KPIs — the four buckets are independent counts, not filtered by the
  // status toggle. That lets the user see the current picture at a
  // glance regardless of which slice they're drilling into below.
  const kpis = await queryOne<any>(`
    WITH ${STATUS_CTE}
    SELECT
      (SELECT COUNT(*) FROM tbl_corp_facility_inventory_item
        WHERE date_added_to_inventory >= ${START} AND date_added_to_inventory <= CURRENT_DATE)::int AS received,
      (SELECT COUNT(*) FROM item_status WHERE status = 'in_stock')::int  AS in_stock,
      (SELECT COUNT(*) FROM item_status WHERE status = 'delivered')::int AS delivered,
      (SELECT COUNT(*) FROM item_status WHERE status = 'other')::int     AS other,
      COALESCE((SELECT SUM(donation_value_in) FROM tbl_corp_facility_inventory_item
                WHERE date_dispositioned IS NULL), 0)::numeric(12,2)     AS in_stock_value
  `);

  // By-warehouse and by-category roll-ups always respect the status
  // filter so they cross-tie to the per-item table below.
  const byWarehouse = await query<any>(`
    WITH ${STATUS_CTE}
    SELECT
      COALESCE(cf.facility_name, '(no warehouse)') AS warehouse,
      COUNT(ii.corp_facility_inventory_item_id)::int    AS items,
      COALESCE(SUM(ii.donation_value_in), 0)::numeric(12,2) AS value
    FROM tbl_corp_facility_inventory_item ii
    JOIN item_status s ON s.item_id = ii.corp_facility_inventory_item_id
    LEFT JOIN tbl_corp_facility cf ON cf.corp_facility_id = ii.corp_facility_id
    WHERE ${sw}
    GROUP BY cf.facility_name
    ORDER BY items DESC, warehouse
  `);

  const byCategory = await query<any>(`
    WITH ${STATUS_CTE}
    SELECT
      COALESCE(ic.item_category, 'Uncategorized')       AS category,
      COUNT(ii.corp_facility_inventory_item_id)::int    AS items,
      COALESCE(SUM(ii.donation_value_in), 0)::numeric(12,2) AS value
    FROM tbl_corp_facility_inventory_item ii
    JOIN item_status s ON s.item_id = ii.corp_facility_inventory_item_id
    LEFT JOIN lkp_item_category ic ON ic.item_category_id = ii.item_category_id
    WHERE ${sw}
    GROUP BY ic.item_category
    ORDER BY items DESC, category
  `);

  // Per-item detail. Capped at 500 rows so a truly enormous warehouse
  // doesn't blow up the exports; if the user needs a bigger dump they
  // can narrow with the status filter.
  const items = await query<any>(`
    WITH ${STATUS_CTE}
    SELECT
      COALESCE(ic.item_category, 'Uncategorized')       AS category,
      COALESCE(cf.facility_name, '(no warehouse)') AS warehouse,
      COALESCE(sz.item_size,        '')                 AS size,
      COALESCE(cond.item_condition, '')                 AS condition,
      s.status                                          AS status,
      ii.donation_value_in::numeric(12,2)               AS value,
      ii.date_added_to_inventory::text                  AS date_added
    FROM tbl_corp_facility_inventory_item ii
    JOIN item_status s ON s.item_id = ii.corp_facility_inventory_item_id
    LEFT JOIN tbl_corp_facility cf ON cf.corp_facility_id  = ii.corp_facility_id
    LEFT JOIN lkp_item_category ic ON ic.item_category_id  = ii.item_category_id
    LEFT JOIN lkp_item_size sz     ON sz.item_size_id      = ii.item_size_id
    LEFT JOIN lkp_item_condition cond ON cond.item_condition_id = ii.item_condition_id
    WHERE ${sw}
    ORDER BY ${sortOrderBy(q)}
    LIMIT 500
  `);

  const label = periodLabel(q.period);
  const statusLabel: Record<InventoryStatus, string> = {
    all: 'All statuses',
    in_stock: 'In stock',
    delivered: 'Delivered',
    received: `Received in ${label.toLowerCase()}`,
    other: 'Dispositioned (other)',
  };
  const totalWarehouseItems = byWarehouse.reduce((s: number, r: any) => s + r.items, 0);
  const totalCategoryItems  = byCategory.reduce((s: number, r: any) => s + r.items, 0);
  const totalWarehouseValue = byWarehouse.reduce((s: number, r: any) => s + Number(r.value ?? 0), 0);
  const totalCategoryValue  = byCategory.reduce((s: number, r: any) => s + Number(r.value ?? 0), 0);

  return {
    title: 'Inventory Report',
    subtitle: `${statusLabel[q.status]} — ${label}`,
    filenameBase: `inventory-${q.status}-${q.period}-${new Date().toISOString().slice(0,10)}`,
    headerMeta: [
      { label: 'Period',       value: q.period[0].toUpperCase() + q.period.slice(1) },
      { label: 'Window',       value: label },
      { label: 'Status',       value: statusLabel[q.status] },
      { label: 'Sorted by',    value: `${q.sort} ${q.dir}` },
    ],
    sections: [
      {
        kind: 'kpi',
        title: 'Snapshot',
        items: [
          { label: 'Received in period', value: kpis?.received ?? 0 },
          { label: 'In stock now',       value: kpis?.in_stock ?? 0 },
          { label: 'Delivered (all-time)', value: kpis?.delivered ?? 0 },
          { label: 'Other disposition',  value: kpis?.other ?? 0 },
          { label: 'In-stock value',     value: `$${Number(kpis?.in_stock_value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        ],
      },
      {
        kind: 'table',
        title: 'By warehouse',
        columns: [
          { key: 'warehouse', label: 'Warehouse' },
          { key: 'items',     label: 'Items', align: 'right', format: 'number' },
          { key: 'value',     label: 'Value', align: 'right', format: 'money' },
        ],
        rows: byWarehouse,
        totalRow: { warehouse: 'Total', items: totalWarehouseItems, value: totalWarehouseValue },
      },
      {
        kind: 'table',
        title: 'By category',
        columns: [
          { key: 'category', label: 'Category' },
          { key: 'items',    label: 'Items', align: 'right', format: 'number' },
          { key: 'value',    label: 'Value', align: 'right', format: 'money' },
        ],
        rows: byCategory,
        totalRow: { category: 'Total', items: totalCategoryItems, value: totalCategoryValue },
      },
      {
        kind: 'table',
        title: `Line items (${items.length}${items.length === 500 ? ', capped' : ''})`,
        subtitle: `Sorted by ${q.sort} ${q.dir}`,
        columns: [
          { key: 'category',   label: 'Category' },
          { key: 'warehouse',  label: 'Warehouse' },
          { key: 'size',       label: 'Size' },
          { key: 'condition',  label: 'Condition' },
          { key: 'status',     label: 'Status' },
          { key: 'value',      label: 'Value', align: 'right', format: 'money' },
          { key: 'date_added', label: 'Received', format: 'date' },
        ],
        rows: items,
      },
    ],
  };
}

/* ================================================================= */
/*  Reports & Insights bundle — mirrors the /reports JSON payload      */
/*                                                                    */
/*  Uses a different bucketing model from Impact + Inventory: the      */
/*  Reports page runs on monthly / quarterly / yearly trailing         */
/*  windows via DATE_TRUNC + INTERVAL, not the current-calendar-       */
/*  period model. Every dataset is expressed once here; the endpoint   */
/*  and the export both call fetchReportsData so they can't drift.     */
/* ================================================================= */

export type ReportsPeriod = 'monthly' | 'quarterly' | 'yearly';

interface ReportsBucketConfig {
  trunc: 'month' | 'quarter' | 'year';
  interval: string;
  kpiInterval: string;
  /** Step size for generate_series — Postgres won't take "1 quarter"
   *  as an interval, so quarterly uses "3 months". */
  stepInterval: string;
}

function reportsConfig(period: ReportsPeriod): ReportsBucketConfig {
  switch (period) {
    case 'quarterly':
      return { trunc: 'quarter', interval: '24 months', kpiInterval: '3 months', stepInterval: '3 months' };
    case 'yearly':
      return { trunc: 'year',    interval: '5 years',   kpiInterval: '1 year',   stepInterval: '1 year' };
    case 'monthly':
    default:
      return { trunc: 'month',   interval: '12 months', kpiInterval: '1 month',  stepInterval: '1 month' };
  }
}

export interface ReportsDataset {
  period: ReportsPeriod;
  kpis: any;
  revenueTrend: any[];
  revenueByFund: any[];
  donorMix: any[];
  campaigns: any[];
  pickupsDeliveries: any[];
  cycleTime: any[];
  inventoryFlow: any[];
  donorPipeline: any[];
  volunteerHours: any[];
  topDonors: any[];
  avgGift: any[];
  pledges: any[];
  shiftFillRate: any[];
  inventoryByCategory: any[];
  ackTurnaround: any[];
  donationTypes: any[];
}

/**
 * fetchReportsData — the single source of truth for the /api/reports
 * payload. The endpoint returns this verbatim; the bundle builder
 * maps it into ExportBundle sections.
 */
export async function fetchReportsData(period: ReportsPeriod): Promise<ReportsDataset> {
  const cfg = reportsConfig(period);
  // Safe: trunc / interval / step come from a fixed whitelist above.
  const T = cfg.trunc;
  const I = cfg.interval;
  const S = cfg.stepInterval;

  const kpis = await queryOne<any>(`
    SELECT
      COALESCE((SELECT SUM(total_value) FROM tbl_donation
                 WHERE donation_date >= DATE_TRUNC('${T}', NOW())), 0)::numeric(12,2) AS revenue,
      (SELECT COUNT(DISTINCT donor_id) FROM tbl_donation
        WHERE donation_date >= DATE_TRUNC('${T}', NOW()))::int AS active_donors,
      (SELECT COUNT(*) FROM (
          SELECT donor_id, MIN(donation_date) AS first_gift
            FROM tbl_donation GROUP BY donor_id
        ) g WHERE g.first_gift >= DATE_TRUNC('${T}', NOW()))::int AS new_donors,
      (SELECT COUNT(DISTINCT r.client_id) FROM tbl_client_deliveries d
          JOIN tbl_client_provisioning_request r ON r.client_provisioning_request_id = d.client_provisioning_request_id
        WHERE d.delivery_date >= DATE_TRUNC('${T}', NOW()))::int AS households_served,
      (SELECT COUNT(*) FROM tbl_donation_pickup
        WHERE scheduled_date >= DATE_TRUNC('${T}', NOW())
          AND pickup_status_id IN (SELECT pickup_status_id FROM lkp_pickup_status WHERE pickup_status IN ('Completed','Picked up')))::int AS pickups_completed,
      (SELECT COUNT(*) FROM tbl_client_deliveries
        WHERE delivery_date >= DATE_TRUNC('${T}', NOW())
          AND delivery_status_id IN (SELECT delivery_status_id FROM lkp_delivery_status WHERE delivery_status IN ('Delivered','Completed')))::int AS deliveries_completed,
      COALESCE((SELECT SUM(hours_logged) FROM tbl_volunteer_hours
                 WHERE activity_date >= DATE_TRUNC('${T}', NOW())), 0)::numeric(10,2) AS volunteer_hours,
      (SELECT COUNT(*) FROM tbl_donation_item di
          JOIN tbl_donation d ON d.donation_id = di.donation_id
        WHERE d.donation_date >= DATE_TRUNC('${T}', NOW()))::int AS items_in,
      (SELECT COUNT(*) FROM tbl_delivery_items di
          JOIN tbl_client_deliveries cd ON cd.client_deliveries_id = di.client_deliveries_id
        WHERE cd.delivery_date >= DATE_TRUNC('${T}', NOW()))::int AS items_out
  `);

  const revenueTrend = await query(`
    SELECT DATE_TRUNC('${T}', donation_date) AS bucket,
           COALESCE(SUM(total_value), 0)::numeric(12,2) AS revenue
    FROM tbl_donation
    WHERE donation_date >= NOW() - INTERVAL '${I}'
    GROUP BY bucket
    ORDER BY bucket
  `);

  const revenueByFund = await query(`
    SELECT
      DATE_TRUNC('${T}', d.donation_date) AS bucket,
      COALESCE(f.fund_name, 'Undesignated') AS fund_name,
      SUM(COALESCE(dd.amount, d.total_value))::numeric(12,2) AS revenue
    FROM tbl_donation d
    LEFT JOIN tbl_donation_designation dd ON dd.donation_id = d.donation_id
    LEFT JOIN lkp_fund f ON f.fund_id = dd.fund_id
    WHERE d.donation_date >= NOW() - INTERVAL '${I}'
    GROUP BY bucket, fund_name
    ORDER BY bucket, fund_name
  `);

  const donorMix = await query(`
    WITH gifts_with_first AS (
      SELECT
        d.donor_id,
        DATE_TRUNC('${T}', d.donation_date) AS bucket,
        MIN(d.donation_date) OVER (PARTITION BY d.donor_id) AS first_gift_ever
      FROM tbl_donation d
      WHERE d.donation_date >= NOW() - INTERVAL '${I}'
    )
    SELECT
      bucket,
      COUNT(DISTINCT donor_id) FILTER (WHERE DATE_TRUNC('${T}', first_gift_ever) = bucket)::int AS new_donors,
      COUNT(DISTINCT donor_id) FILTER (WHERE DATE_TRUNC('${T}', first_gift_ever) < bucket)::int AS returning_donors
    FROM gifts_with_first
    GROUP BY bucket
    ORDER BY bucket
  `);

  const campaigns = await query(`
    SELECT
      c.campaign_id, c.campaign_name, cs.campaign_status, c.goal_amount,
      COALESCE((SELECT SUM(total_value) FROM tbl_donation WHERE campaign_id = c.campaign_id), 0)::numeric(12,2) AS raised
    FROM tbl_campaign c
    JOIN lkp_campaign_status cs ON cs.campaign_status_id = c.campaign_status_id
    WHERE cs.campaign_status IN ('Active','Planning')
    ORDER BY c.start_date NULLS LAST
    LIMIT 8
  `);

  const pickupsDeliveries = await query(`
    WITH buckets AS (
      SELECT DATE_TRUNC('${T}', dd::date) AS bucket
      FROM generate_series(
        DATE_TRUNC('${T}', NOW() - INTERVAL '${I}'),
        DATE_TRUNC('${T}', NOW()),
        INTERVAL '${S}'
      ) AS dd
    )
    SELECT b.bucket,
      (SELECT COUNT(*) FROM tbl_donation_pickup p
        WHERE DATE_TRUNC('${T}', p.scheduled_date) = b.bucket)::int AS pickups,
      (SELECT COUNT(*) FROM tbl_client_deliveries d
        WHERE DATE_TRUNC('${T}', d.delivery_date) = b.bucket)::int AS deliveries
    FROM buckets b
    ORDER BY b.bucket
  `);

  const cycleTime = await query(`
    SELECT
      DATE_TRUNC('${T}', d.delivery_date) AS bucket,
      ROUND(AVG(d.delivery_date - r.request_at::date)::numeric, 1) AS avg_days
    FROM tbl_client_deliveries d
    JOIN tbl_client_provisioning_request r ON r.client_provisioning_request_id = d.client_provisioning_request_id
    WHERE d.delivery_date >= NOW() - INTERVAL '${I}'
    GROUP BY bucket
    ORDER BY bucket
  `);

  const inventoryFlow = await query(`
    WITH buckets AS (
      SELECT DATE_TRUNC('${T}', dd::date) AS bucket
      FROM generate_series(
        DATE_TRUNC('${T}', NOW() - INTERVAL '${I}'),
        DATE_TRUNC('${T}', NOW()),
        INTERVAL '${S}'
      ) AS dd
    )
    SELECT b.bucket,
      (SELECT COUNT(*) FROM tbl_donation_item di
          JOIN tbl_donation d ON d.donation_id = di.donation_id
        WHERE DATE_TRUNC('${T}', d.donation_date) = b.bucket)::int AS received,
      (SELECT COUNT(*) FROM tbl_delivery_items dti
          JOIN tbl_client_deliveries cd ON cd.client_deliveries_id = dti.client_deliveries_id
        WHERE DATE_TRUNC('${T}', cd.delivery_date) = b.bucket)::int AS distributed
    FROM buckets b
    ORDER BY b.bucket
  `);

  const donorPipeline = await query(`
    SELECT ds.donor_stage AS stage, ds.stage_order, COUNT(d.donor_id)::int AS count
    FROM lkp_donor_stage ds
    LEFT JOIN tbl_donor d ON d.donor_stage_id = ds.donor_stage_id
    GROUP BY ds.donor_stage, ds.stage_order
    ORDER BY ds.stage_order
  `);

  const volunteerHours = await query(`
    SELECT DATE_TRUNC('${T}', activity_date) AS bucket,
           COALESCE(SUM(hours_logged), 0)::numeric(10,2) AS hours
    FROM tbl_volunteer_hours
    WHERE activity_date >= NOW() - INTERVAL '${I}'
    GROUP BY bucket
    ORDER BY bucket
  `);

  const topDonors = await query(`
    SELECT
      donor.donor_id,
      contact.first_name || ' ' || contact.last_name AS donor_name,
      donor.is_anonymous,
      SUM(d.total_value)::numeric(12,2) AS total,
      COUNT(d.donation_id)::int AS gift_count,
      MAX(d.donation_date) AS last_gift_date
    FROM tbl_donation d
    JOIN tbl_donor donor ON donor.donor_id = d.donor_id
    JOIN tbl_contact contact ON contact.contact_id = donor.contact_id
    WHERE d.donation_date >= NOW() - INTERVAL '${I}'
    GROUP BY donor.donor_id, contact.first_name, contact.last_name, donor.is_anonymous
    ORDER BY total DESC
    LIMIT 10
  `);

  const avgGift = await query(`
    SELECT DATE_TRUNC('${T}', donation_date) AS bucket,
           ROUND(AVG(total_value)::numeric, 2) AS avg_gift,
           COUNT(*)::int AS gift_count
    FROM tbl_donation
    WHERE donation_date >= NOW() - INTERVAL '${I}'
    GROUP BY bucket
    ORDER BY bucket
  `);

  const pledges = await query(`
    SELECT DATE_TRUNC('${T}', p.pledge_date) AS bucket,
           SUM(p.total_pledged_amount)::numeric(12,2) AS pledged,
           SUM(p.amount_fulfilled)::numeric(12,2) AS fulfilled,
           SUM(p.total_pledged_amount - p.amount_fulfilled)::numeric(12,2) AS outstanding
    FROM tbl_pledge p
    WHERE p.pledge_date >= NOW() - INTERVAL '${I}'
    GROUP BY bucket
    ORDER BY bucket
  `);

  const shiftFillRate = await query(`
    WITH per_shift AS (
      SELECT
        DATE_TRUNC('${T}', s.shift_date) AS bucket,
        s.capacity_needed,
        (SELECT COUNT(*) FROM tbl_volunteer_shift_signup su
          WHERE su.shift_id = s.shift_id
            AND su.signup_status IN ('signed_up','attended'))::int AS filled
      FROM tbl_volunteer_shift s
      WHERE s.shift_date >= NOW() - INTERVAL '${I}'
    )
    SELECT bucket,
           SUM(capacity_needed)::int AS capacity_needed,
           SUM(LEAST(filled, capacity_needed))::int AS filled,
           CASE WHEN SUM(capacity_needed) > 0
                THEN ROUND(100.0 * SUM(LEAST(filled, capacity_needed))::numeric / SUM(capacity_needed)::numeric, 1)
                ELSE 0 END AS fill_rate_pct
    FROM per_shift
    GROUP BY bucket
    ORDER BY bucket
  `);

  const inventoryByCategory = await query(`
    SELECT cat.item_category AS category, COUNT(*)::int AS count
    FROM tbl_corp_facility_inventory_item inv
    JOIN lkp_item_category cat ON cat.item_category_id = inv.item_category_id
    GROUP BY cat.item_category
    ORDER BY count DESC
    LIMIT 12
  `);

  const ackTurnaround = await query(`
    SELECT DATE_TRUNC('${T}', donation_date) AS bucket,
           ROUND(AVG(acknowledgement_sent_date - donation_date)::numeric, 1) AS avg_days
    FROM tbl_donation
    WHERE donation_date >= NOW() - INTERVAL '${I}'
      AND acknowledgement_sent_date IS NOT NULL
    GROUP BY bucket
    ORDER BY bucket
  `);

  const donationTypes = await query(`
    SELECT
      dt.donation_type AS type,
      COUNT(*)::int AS count,
      SUM(d.total_value)::numeric(12,2) AS total
    FROM tbl_donation d
    JOIN lkp_donation_type dt ON dt.donation_type_id = d.donation_type_id
    WHERE d.donation_date >= NOW() - INTERVAL '${I}'
    GROUP BY dt.donation_type
    ORDER BY total DESC
  `);

  return {
    period, kpis,
    revenueTrend, revenueByFund, donorMix, campaigns,
    pickupsDeliveries, cycleTime, inventoryFlow, donorPipeline,
    volunteerHours, topDonors, avgGift, pledges,
    shiftFillRate, inventoryByCategory, ackTurnaround, donationTypes,
  };
}

/**
 * buildReportsBundle — turns the reports dataset into one KPI section
 * plus one TableSection per time-series / breakdown. Each dataset ends
 * up on its own sheet (XLSX) or its own section (PDF, DOCX).
 */
export async function buildReportsBundle(period: ReportsPeriod): Promise<ExportBundle> {
  const d = await fetchReportsData(period);
  const label = period[0].toUpperCase() + period.slice(1);

  const dateStr = (raw: any): string => {
    if (!raw) return '';
    const dd = new Date(String(raw));
    return isNaN(dd.getTime()) ? String(raw) : dd.toISOString().slice(0, 10);
  };

  return {
    title: 'Reports & Insights',
    subtitle: `${label} view — fundraising, operations, community engagement`,
    filenameBase: `reports-${period}-${new Date().toISOString().slice(0,10)}`,
    headerMeta: [{ label: 'Period', value: label }],
    sections: [
      {
        kind: 'kpi',
        title: 'Headline KPIs',
        items: [
          { label: 'Revenue',              value: `$${Number(d.kpis?.revenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
          { label: 'Active donors',        value: d.kpis?.active_donors ?? 0 },
          { label: 'New donors',           value: d.kpis?.new_donors ?? 0 },
          { label: 'Households served',    value: d.kpis?.households_served ?? 0 },
          { label: 'Pickups completed',    value: d.kpis?.pickups_completed ?? 0 },
          { label: 'Deliveries completed', value: d.kpis?.deliveries_completed ?? 0 },
          { label: 'Volunteer hours',      value: Number(d.kpis?.volunteer_hours ?? 0) },
          { label: 'Items received',       value: d.kpis?.items_in ?? 0 },
          { label: 'Items distributed',    value: d.kpis?.items_out ?? 0 },
        ],
      },
      {
        kind: 'table',
        title: 'Revenue trend',
        columns: [
          { key: 'bucket', label: 'Period', format: 'date' },
          { key: 'revenue', label: 'Revenue', align: 'right', format: 'money' },
        ],
        rows: d.revenueTrend.map((r: any) => ({ bucket: dateStr(r.bucket), revenue: Number(r.revenue) })),
      },
      {
        kind: 'table',
        title: 'Revenue by fund',
        columns: [
          { key: 'bucket', label: 'Period', format: 'date' },
          { key: 'fund_name', label: 'Fund' },
          { key: 'revenue', label: 'Revenue', align: 'right', format: 'money' },
        ],
        rows: d.revenueByFund.map((r: any) => ({ bucket: dateStr(r.bucket), fund_name: r.fund_name, revenue: Number(r.revenue) })),
      },
      {
        kind: 'table',
        title: 'Donor mix',
        subtitle: 'New (first-ever gift in bucket) vs returning',
        columns: [
          { key: 'bucket', label: 'Period', format: 'date' },
          { key: 'new_donors', label: 'New', align: 'right', format: 'number' },
          { key: 'returning_donors', label: 'Returning', align: 'right', format: 'number' },
        ],
        rows: d.donorMix.map((r: any) => ({ bucket: dateStr(r.bucket), new_donors: r.new_donors, returning_donors: r.returning_donors })),
      },
      {
        kind: 'table',
        title: 'Active + planning campaigns',
        columns: [
          { key: 'campaign_name', label: 'Campaign' },
          { key: 'campaign_status', label: 'Status' },
          { key: 'goal_amount', label: 'Goal', align: 'right', format: 'money' },
          { key: 'raised', label: 'Raised', align: 'right', format: 'money' },
        ],
        rows: d.campaigns.map((r: any) => ({
          campaign_name: r.campaign_name,
          campaign_status: r.campaign_status,
          goal_amount: r.goal_amount === null ? null : Number(r.goal_amount),
          raised: Number(r.raised),
        })),
      },
      {
        kind: 'table',
        title: 'Pickups vs deliveries',
        columns: [
          { key: 'bucket', label: 'Period', format: 'date' },
          { key: 'pickups',    label: 'Pickups',    align: 'right', format: 'number' },
          { key: 'deliveries', label: 'Deliveries', align: 'right', format: 'number' },
        ],
        rows: d.pickupsDeliveries.map((r: any) => ({ bucket: dateStr(r.bucket), pickups: r.pickups, deliveries: r.deliveries })),
      },
      {
        kind: 'table',
        title: 'Cycle time',
        subtitle: 'Average days from request to delivery',
        columns: [
          { key: 'bucket', label: 'Period', format: 'date' },
          { key: 'avg_days', label: 'Avg days', align: 'right', format: 'number' },
        ],
        rows: d.cycleTime.map((r: any) => ({ bucket: dateStr(r.bucket), avg_days: r.avg_days === null ? null : Number(r.avg_days) })),
      },
      {
        kind: 'table',
        title: 'Inventory flow',
        columns: [
          { key: 'bucket', label: 'Period', format: 'date' },
          { key: 'received',    label: 'Received',    align: 'right', format: 'number' },
          { key: 'distributed', label: 'Distributed', align: 'right', format: 'number' },
        ],
        rows: d.inventoryFlow.map((r: any) => ({ bucket: dateStr(r.bucket), received: r.received, distributed: r.distributed })),
      },
      {
        kind: 'table',
        title: 'Donor pipeline',
        columns: [
          { key: 'stage', label: 'Stage' },
          { key: 'count', label: 'Donors', align: 'right', format: 'number' },
        ],
        rows: d.donorPipeline.map((r: any) => ({ stage: r.stage, count: r.count })),
      },
      {
        kind: 'table',
        title: 'Volunteer hours',
        columns: [
          { key: 'bucket', label: 'Period', format: 'date' },
          { key: 'hours', label: 'Hours', align: 'right', format: 'number' },
        ],
        rows: d.volunteerHours.map((r: any) => ({ bucket: dateStr(r.bucket), hours: Number(r.hours) })),
      },
      {
        kind: 'table',
        title: 'Top donors',
        columns: [
          { key: 'donor_name', label: 'Donor' },
          { key: 'total',      label: 'Total',       align: 'right', format: 'money' },
          { key: 'gift_count', label: 'Gifts',       align: 'right', format: 'number' },
          { key: 'last_gift_date', label: 'Last gift', format: 'date' },
        ],
        rows: d.topDonors.map((r: any) => ({
          donor_name: r.is_anonymous ? 'Anonymous' : r.donor_name,
          total: Number(r.total),
          gift_count: r.gift_count,
          last_gift_date: dateStr(r.last_gift_date),
        })),
      },
      {
        kind: 'table',
        title: 'Average gift',
        columns: [
          { key: 'bucket', label: 'Period', format: 'date' },
          { key: 'avg_gift',   label: 'Avg gift',  align: 'right', format: 'money' },
          { key: 'gift_count', label: 'Gifts',     align: 'right', format: 'number' },
        ],
        rows: d.avgGift.map((r: any) => ({ bucket: dateStr(r.bucket), avg_gift: Number(r.avg_gift), gift_count: r.gift_count })),
      },
      {
        kind: 'table',
        title: 'Pledges',
        columns: [
          { key: 'bucket', label: 'Period', format: 'date' },
          { key: 'pledged',     label: 'Pledged',     align: 'right', format: 'money' },
          { key: 'fulfilled',   label: 'Fulfilled',   align: 'right', format: 'money' },
          { key: 'outstanding', label: 'Outstanding', align: 'right', format: 'money' },
        ],
        rows: d.pledges.map((r: any) => ({
          bucket: dateStr(r.bucket),
          pledged: Number(r.pledged),
          fulfilled: Number(r.fulfilled),
          outstanding: Number(r.outstanding),
        })),
      },
      {
        kind: 'table',
        title: 'Shift fill rate',
        columns: [
          { key: 'bucket', label: 'Period', format: 'date' },
          { key: 'capacity_needed', label: 'Needed', align: 'right', format: 'number' },
          { key: 'filled',          label: 'Filled', align: 'right', format: 'number' },
          { key: 'fill_rate_pct',   label: 'Fill %', align: 'right', format: 'number' },
        ],
        rows: d.shiftFillRate.map((r: any) => ({
          bucket: dateStr(r.bucket),
          capacity_needed: r.capacity_needed,
          filled: r.filled,
          fill_rate_pct: Number(r.fill_rate_pct),
        })),
      },
      {
        kind: 'table',
        title: 'Inventory by category',
        columns: [
          { key: 'category', label: 'Category' },
          { key: 'count', label: 'Items', align: 'right', format: 'number' },
        ],
        rows: d.inventoryByCategory.map((r: any) => ({ category: r.category, count: r.count })),
      },
      {
        kind: 'table',
        title: 'Acknowledgement turnaround',
        subtitle: 'Average days from gift date to acknowledgement sent',
        columns: [
          { key: 'bucket', label: 'Period', format: 'date' },
          { key: 'avg_days', label: 'Avg days', align: 'right', format: 'number' },
        ],
        rows: d.ackTurnaround.map((r: any) => ({ bucket: dateStr(r.bucket), avg_days: r.avg_days === null ? null : Number(r.avg_days) })),
      },
      {
        kind: 'table',
        title: 'Donation types',
        columns: [
          { key: 'type',  label: 'Type' },
          { key: 'count', label: 'Gifts', align: 'right', format: 'number' },
          { key: 'total', label: 'Total', align: 'right', format: 'money' },
        ],
        rows: d.donationTypes.map((r: any) => ({ type: r.type, count: r.count, total: Number(r.total) })),
      },
    ],
  };
}
