/**
 * Reports — one batch endpoint that returns every dataset the /reports
 * page needs for a given time period (monthly, quarterly, or yearly).
 *
 *   GET /api/reports?period=monthly|quarterly|yearly
 *
 * Returning everything in one shot trades a tiny bit of latency for a
 * much simpler frontend (one query hook instead of 16) and a coherent
 * data snapshot — every chart on the page reflects the same DB state
 * at the same instant. Queries are individually fast (<50ms each with
 * the existing indexes) so total response is well under a second.
 *
 * Every time-series chart buckets via DATE_TRUNC and filters to the
 * trailing window for the chosen period. KPIs use a separate
 * "period-to-date" window so the headline number matches whatever
 * the user selected.
 */

import { Router } from 'express';
import { query, queryOne } from '../db/pool.js';
import {
  buildImpactBundle, buildInventoryBundle,
  buildReportsBundle, fetchReportsData,
  type Period as ExportPeriod, type InventoryStatus, type InventoryQuery,
  type ReportsPeriod,
} from '../reports/bundle.js';
import { toPdf, toXlsx, toDocx } from '../reports/exporters.js';

export const reportsRouter = Router();

reportsRouter.get('/', async (req, res, next) => {
  try {
    const periodRaw = String(req.query.period ?? 'monthly').toLowerCase();
    const period: ReportsPeriod = (['monthly', 'quarterly', 'yearly'] as const).includes(periodRaw as ReportsPeriod)
      ? (periodRaw as ReportsPeriod)
      : 'monthly';
    // Every dataset lives in `fetchReportsData` so the endpoint and
    // the export builder can't drift on SQL. Whitespace-heavy inline
    // queries used to live here; see reports/bundle.ts.
    const data = await fetchReportsData(period);
    res.json(data);
  } catch (err) { next(err); }
});


/* ------------------------------------------------------------------ */
/*  GET /api/reports/impact — recipient / community-impact snapshot    */
/*                                                                    */
/*  Mirrors the "Monthly Impact Data" spreadsheet the ED sends out:    */
/*  admin KPIs, city breakdown, situation (client type) breakdown,     */
/*  agency breakdown, item-category summary, bedding roll-up. Every    */
/*  section is filtered to the same period window so the numbers       */
/*  cross-tie.                                                         */
/*                                                                    */
/*  ?period=daily → today                                              */
/*  ?period=monthly → current calendar month (default)                 */
/*  ?period=yearly → current calendar year                             */
/* ------------------------------------------------------------------ */

type ImpactPeriod = 'daily' | 'monthly' | 'yearly';

function impactWindowSql(period: ImpactPeriod): string {
  switch (period) {
    case 'daily':   return "CURRENT_DATE";
    case 'yearly':  return "DATE_TRUNC('year',  CURRENT_DATE)::date";
    case 'monthly':
    default:        return "DATE_TRUNC('month', CURRENT_DATE)::date";
  }
}

reportsRouter.get('/impact', async (req, res, next) => {
  try {
    const raw = String(req.query.period ?? 'monthly').toLowerCase();
    const period: ImpactPeriod = (['daily','monthly','yearly'] as const).includes(raw as ImpactPeriod)
      ? (raw as ImpactPeriod) : 'monthly';
    // Start of the window (inclusive). End is always CURRENT_DATE (inclusive) so
    // "today" for daily means CURRENT_DATE = CURRENT_DATE, and "this month" for
    // monthly runs from the 1st through today.
    const START = impactWindowSql(period);

    // ---- Admin KPIs ------------------------------------------------
    // Households = distinct clients that had a completed delivery in the window.
    // Deliveries = completed deliveries with fulfillment method = "Home delivery".
    // Warehouse pickups = completed deliveries with fulfillment method IN
    //   ("Container pickup", "Walkout") — the two "we didn't drive to them" flows.
    // Guest Selection Appointments = visits in the window (any status).
    // Partnering Agency Requests = referrals in the window (unique referral rows).
    const kpis = await queryOne<any>(`
      WITH completed_deliveries AS (
        SELECT d.client_deliveries_id, d.delivery_date, d.fulfillment_method_id,
               pr.client_id
        FROM tbl_client_deliveries d
        JOIN tbl_client_provisioning_request pr
          ON pr.client_provisioning_request_id = d.client_provisioning_request_id
        JOIN lkp_delivery_status ds ON ds.delivery_status_id = d.delivery_status_id
        WHERE d.delivery_date >= ${START}
          AND d.delivery_date <= CURRENT_DATE
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

    // ---- Households by city ---------------------------------------
    // Client → primary contact → address → lkp_city. Only counts a client
    // once even if they have multiple deliveries in the period.
    const byCity = await query<{ city: string; households: number }>(`
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

    // ---- Situation (client type breakdown) ------------------------
    // Uses tbl_client_client_type so multi-typed households count in every
    // bucket they belong to. Matches the "check every situation that applies"
    // model on the intake form.
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

    // ---- Households by referring agency ---------------------------
    // Client → tbl_referral → tbl_agency_contact → tbl_agency
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

    // ---- Item categories (delivered items) ------------------------
    // Each row in tbl_delivery_items is one physical item that went out
    // the door, so COUNT(*) is the right aggregate. Category lives on
    // the inventory item, not on the delivery_items row.
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

    // ---- Bedding roll-up ------------------------------------------
    // Matches the spreadsheet's "TOTAL BEDDING COUNT" block. Buckets by
    // simple category-name substring so any Twin/Full/Queen/King variant
    // rolls up correctly.
    const bedding = await queryOne<any>(`
      SELECT
        COUNT(*) FILTER (WHERE ic.item_category ILIKE '%Bedding%')::int   AS bedding,
        COUNT(*) FILTER (WHERE ic.item_category ILIKE '%Frame%')::int     AS frame,
        COUNT(*) FILTER (WHERE ic.item_category ILIKE '%Mattress%')::int  AS mattress,
        COUNT(*) FILTER (WHERE ic.item_category ILIKE '%Boxspring%')::int AS boxspring
      FROM tbl_delivery_items di
      JOIN tbl_client_deliveries cd ON cd.client_deliveries_id = di.client_deliveries_id
      JOIN lkp_delivery_status ds   ON ds.delivery_status_id = cd.delivery_status_id
      LEFT JOIN tbl_corp_facility_inventory_item ii
             ON ii.corp_facility_inventory_item_id = di.corp_facility_inventory_item_id
      LEFT JOIN lkp_item_category ic ON ic.item_category_id = ii.item_category_id
      WHERE cd.delivery_date >= ${START} AND cd.delivery_date <= CURRENT_DATE
        AND ds.delivery_status IN ('Delivered','Completed')
    `);

    res.json({
      period,
      kpis: {
        households:                      kpis?.households ?? 0,
        deliveries:                      kpis?.deliveries ?? 0,
        warehouse_pickups:               kpis?.warehouse_pickups ?? 0,
        guest_selection_appointments:    kpis?.guest_selection_appointments ?? 0,
        partnering_agency_requests:      kpis?.partnering_agency_requests ?? 0,
        // These four demographic KPIs mirror the ED's spreadsheet but the
        // schema doesn't track head-of-household demographics yet. Surface
        // them as null so the UI can render an inline "not tracked" hint
        // rather than a misleading zero.
        children:                        null,
        female_adults:                   null,
        male_adults:                     null,
        total_individuals:               null,
      },
      byCity,
      situations,
      byAgency,
      itemCategories,
      bedding: {
        bedding:   bedding?.bedding   ?? 0,
        frame:     bedding?.frame     ?? 0,
        mattress:  bedding?.mattress  ?? 0,
        boxspring: bedding?.boxspring ?? 0,
      },
    });
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------ */
/*  GET /api/reports/inventory — warehouse snapshot                    */
/*                                                                    */
/*  ?period=daily|monthly|yearly (default monthly)                    */
/*  ?status=all|in_stock|delivered|received|other (default all)       */
/*  ?sort=category|warehouse|value|date_added|condition|size          */
/*  ?dir=asc|desc                                                     */
/*                                                                    */
/*  Returns the same ExportBundle shape the PDF/XLSX/DOCX writers      */
/*  consume — the frontend renders it directly, no shape adaptation.  */
/* ------------------------------------------------------------------ */

const INV_STATUSES: InventoryStatus[] = ['all','in_stock','delivered','received','other'];
const INV_SORTS: InventoryQuery['sort'][] = ['category','warehouse','value','date_added','condition','size'];

function parseInventoryQuery(qs: any): InventoryQuery {
  const period = (['daily','monthly','yearly'] as const).includes(String(qs.period).toLowerCase() as any)
    ? String(qs.period).toLowerCase() as ExportPeriod
    : 'monthly';
  const status = INV_STATUSES.includes(String(qs.status).toLowerCase() as any)
    ? String(qs.status).toLowerCase() as InventoryStatus
    : 'all';
  const sort = INV_SORTS.includes(String(qs.sort).toLowerCase() as any)
    ? String(qs.sort).toLowerCase() as InventoryQuery['sort']
    : 'category';
  const dir: 'asc' | 'desc' = String(qs.dir).toLowerCase() === 'asc' ? 'asc' : 'desc';
  return { period, status, sort, dir };
}

reportsRouter.get('/inventory', async (req, res, next) => {
  try {
    const bundle = await buildInventoryBundle(parseInventoryQuery(req.query));
    res.json(bundle);
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------ */
/*  GET /api/reports/export/:report.:format — file download            */
/*                                                                    */
/*  :report ∈ {impact, inventory}                                     */
/*  :format ∈ {pdf, xlsx, docx}                                        */
/*                                                                    */
/*  Passes through the same query params the /impact and /inventory   */
/*  endpoints accept, builds the bundle, hands to the format writer,  */
/*  and streams the buffer with a friendly filename.                  */
/* ------------------------------------------------------------------ */

reportsRouter.get('/export/:report.:format', async (req, res, next) => {
  try {
    const report = req.params.report;
    const format = req.params.format;

    // Build the bundle
    let bundle;
    if (report === 'impact') {
      const period = (['daily','monthly','yearly'] as const).includes(String(req.query.period).toLowerCase() as any)
        ? String(req.query.period).toLowerCase() as ExportPeriod
        : 'monthly';
      bundle = await buildImpactBundle(period);
    } else if (report === 'inventory') {
      bundle = await buildInventoryBundle(parseInventoryQuery(req.query));
    } else if (report === 'reports') {
      const period = (['monthly','quarterly','yearly'] as const).includes(String(req.query.period).toLowerCase() as any)
        ? String(req.query.period).toLowerCase() as ReportsPeriod
        : 'monthly';
      bundle = await buildReportsBundle(period);
    } else {
      return res.status(404).json({ error: 'Unknown report' });
    }

    // Render to the requested format
    let file;
    if      (format === 'pdf')  file = await toPdf(bundle);
    else if (format === 'xlsx') file = await toXlsx(bundle);
    else if (format === 'docx') file = await toDocx(bundle);
    else return res.status(400).json({ error: 'Format must be pdf, xlsx, or docx' });

    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Disposition',
      `attachment; filename="${bundle.filenameBase}.${file.ext}"`);
    res.send(file.buffer);
  } catch (err) { next(err); }
});
