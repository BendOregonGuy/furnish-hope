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
