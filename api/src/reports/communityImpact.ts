/**
 * Overview / community-impact report builders (2026-07-24).
 *
 * Powers three reports that mirror the ED's "Impact Data" workbook:
 *   - Impact Data (recipient reach) — trend modes live here; the single-window
 *     query stays inline in routes/reports.ts. This module adds the month/year
 *     trend series.
 *   - Landfill Diversion — lbs + cubic feet of furniture kept out of the
 *     landfill = delivered items × per-category avg weight/volume.
 *   - Value of Goods — economic value delivered = delivered items × the
 *     per-category standardized value for the delivery's year (rate card).
 *
 * Every report supports five period selections: daily / monthly / yearly
 * (single window) and monthly_trend / annual_trend (a bucketed series).
 */

import { query } from '../db/pool.js';

export type SinglePeriod = 'daily' | 'monthly' | 'yearly';
export type TrendMode = 'monthly_trend' | 'annual_trend';
export type ReportPeriod = SinglePeriod | TrendMode;

export const SINGLE_PERIODS: SinglePeriod[] = ['daily', 'monthly', 'yearly'];
export const TREND_MODES: TrendMode[] = ['monthly_trend', 'annual_trend'];

export function parseReportPeriod(raw: unknown): ReportPeriod {
  const p = String(raw ?? 'monthly').toLowerCase();
  return ([...SINGLE_PERIODS, ...TREND_MODES] as string[]).includes(p) ? (p as ReportPeriod) : 'monthly';
}
export function isTrend(p: ReportPeriod): p is TrendMode {
  return p === 'monthly_trend' || p === 'annual_trend';
}

/** Completed-delivery status set — matches routes/reports.ts. */
const COMPLETED = `('Delivered','Completed')`;

/** Inclusive window start expression for a single-window period. End is
 *  always CURRENT_DATE. */
export function windowStart(p: SinglePeriod): string {
  if (p === 'daily') return 'CURRENT_DATE';
  if (p === 'yearly') return "DATE_TRUNC('year', CURRENT_DATE)::date";
  return "DATE_TRUNC('month', CURRENT_DATE)::date";
}

/* ------------------------------------------------------------------ */
/*  Trend buckets                                                      */
/* ------------------------------------------------------------------ */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface Bucket { key: string; label: string; }

export function trendBuckets(mode: TrendMode): Bucket[] {
  const year = new Date().getFullYear();
  if (mode === 'monthly_trend') {
    return MONTHS.map((m, i) => ({ key: `${year}-${String(i + 1).padStart(2, '0')}`, label: m }));
  }
  // annual_trend — current year and the prior five.
  const out: Bucket[] = [];
  for (let y = year - 5; y <= year; y++) out.push({ key: String(y), label: String(y) });
  return out;
}

/** The SQL expression that produces a bucket key from a date column, matching
 *  the keys in {@link trendBuckets}. `col` is caller-controlled, never user input. */
function bucketExpr(mode: TrendMode, col: string): string {
  return mode === 'monthly_trend'
    ? `to_char(date_trunc('month', ${col}), 'YYYY-MM')`
    : `to_char(date_trunc('year', ${col}), 'YYYY')`;
}

/** The WHERE range for a trend window on a date column. */
function trendWhere(mode: TrendMode, col: string): string {
  return mode === 'monthly_trend'
    ? `${col} >= date_trunc('year', CURRENT_DATE)::date AND ${col} <= CURRENT_DATE`
    : `${col} >= make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int - 5, 1, 1) AND ${col} <= CURRENT_DATE`;
}

/** Run a grouped {bucket,value} query and return a lookup map. */
async function bucketMap(sql: string): Promise<Map<string, number>> {
  const rows = await query<{ bucket: string; value: number }>(sql);
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.bucket, Number(r.value) || 0);
  return m;
}

/* ------------------------------------------------------------------ */
/*  Delivered-items base (landfill + valuation)                        */
/* ------------------------------------------------------------------ */

// FROM + joins only — callers append any extra joins (e.g. the valuation
// rate-card) BEFORE adding the WHERE via COMPLETED_WHERE.
const DELIVERED_ITEMS_FROM = `
  FROM tbl_delivery_items di
  JOIN tbl_client_deliveries cd ON cd.client_deliveries_id = di.client_deliveries_id
  JOIN lkp_delivery_status ds   ON ds.delivery_status_id = cd.delivery_status_id
  LEFT JOIN tbl_corp_facility_inventory_item ii ON ii.corp_facility_inventory_item_id = di.corp_facility_inventory_item_id
  LEFT JOIN lkp_item_category ic ON ic.item_category_id = ii.item_category_id
`;
const COMPLETED_WHERE = `WHERE ds.delivery_status IN ${COMPLETED}`;

/* ------------------------------------------------------------------ */
/*  Landfill Diversion                                                 */
/* ------------------------------------------------------------------ */

export interface LandfillSingle {
  mode: 'single';
  period: SinglePeriod;
  totals: { items: number; lbs: number; cuft: number };
  byCategory: Array<{ category: string; items: number; lbs: number; cuft: number }>;
}
export interface LandfillTrend {
  mode: TrendMode;
  buckets: Array<{ label: string; items: number; lbs: number; cuft: number }>;
}

export async function getLandfill(period: ReportPeriod): Promise<LandfillSingle | LandfillTrend> {
  if (isTrend(period)) {
    const bexpr = bucketExpr(period, 'cd.delivery_date');
    const rows = await query<{ bucket: string; items: number; lbs: number; cuft: number }>(`
      SELECT ${bexpr} AS bucket,
             COUNT(*)::int AS items,
             COALESCE(SUM(ic.avg_weight_lbs), 0)::float8  AS lbs,
             COALESCE(SUM(ic.avg_volume_cuft), 0)::float8 AS cuft
      ${DELIVERED_ITEMS_FROM}
      ${COMPLETED_WHERE} AND ${trendWhere(period, 'cd.delivery_date')}
      GROUP BY bucket
    `);
    const byKey = new Map(rows.map(r => [r.bucket, r]));
    const buckets = trendBuckets(period).map(b => {
      const r = byKey.get(b.key);
      return { label: b.label, items: r?.items ?? 0, lbs: Number(r?.lbs ?? 0), cuft: Number(r?.cuft ?? 0) };
    });
    return { mode: period, buckets };
  }

  const START = windowStart(period);
  const byCategory = await query<{ category: string; items: number; lbs: number; cuft: number }>(`
    SELECT COALESCE(ic.item_category, 'Uncategorized') AS category,
           COUNT(*)::int AS items,
           COALESCE(SUM(ic.avg_weight_lbs), 0)::float8  AS lbs,
           COALESCE(SUM(ic.avg_volume_cuft), 0)::float8 AS cuft
    ${DELIVERED_ITEMS_FROM}
    ${COMPLETED_WHERE} AND cd.delivery_date >= ${START} AND cd.delivery_date <= CURRENT_DATE
    GROUP BY ic.item_category
    ORDER BY lbs DESC, category
  `);
  const totals = byCategory.reduce(
    (t, r) => ({ items: t.items + r.items, lbs: t.lbs + Number(r.lbs), cuft: t.cuft + Number(r.cuft) }),
    { items: 0, lbs: 0, cuft: 0 },
  );
  return { mode: 'single', period, totals, byCategory: byCategory.map(r => ({ ...r, lbs: Number(r.lbs), cuft: Number(r.cuft) })) };
}

/* ------------------------------------------------------------------ */
/*  Value of Goods (rate card)                                         */
/* ------------------------------------------------------------------ */

// Value per delivered item = the standardized unit value for that item's
// category in the delivery's calendar year (tbl_item_category_value).
const VALUATION_JOIN = `
  LEFT JOIN tbl_item_category_value icv
    ON icv.item_category_id = ic.item_category_id
   AND icv.year = EXTRACT(YEAR FROM cd.delivery_date)::int
`;

export interface ValuationSingle {
  mode: 'single';
  period: SinglePeriod;
  year: number;
  total_value: number;
  items: number;
  byCategory: Array<{ category: string; items: number; value: number }>;
}
export interface ValuationTrend {
  mode: TrendMode;
  buckets: Array<{ label: string; items: number; value: number }>;
}

export async function getValuation(period: ReportPeriod): Promise<ValuationSingle | ValuationTrend> {
  if (isTrend(period)) {
    const bexpr = bucketExpr(period, 'cd.delivery_date');
    const rows = await query<{ bucket: string; items: number; value: number }>(`
      SELECT ${bexpr} AS bucket,
             COUNT(*)::int AS items,
             COALESCE(SUM(icv.unit_value), 0)::float8 AS value
      ${DELIVERED_ITEMS_FROM}
      ${VALUATION_JOIN}
      ${COMPLETED_WHERE} AND ${trendWhere(period, 'cd.delivery_date')}
      GROUP BY bucket
    `);
    const byKey = new Map(rows.map(r => [r.bucket, r]));
    const buckets = trendBuckets(period).map(b => {
      const r = byKey.get(b.key);
      return { label: b.label, items: r?.items ?? 0, value: Number(r?.value ?? 0) };
    });
    return { mode: period, buckets };
  }

  const START = windowStart(period);
  const byCategory = await query<{ category: string; items: number; value: number }>(`
    SELECT COALESCE(ic.item_category, 'Uncategorized') AS category,
           COUNT(*)::int AS items,
           COALESCE(SUM(icv.unit_value), 0)::float8 AS value
    ${DELIVERED_ITEMS_FROM}
    ${VALUATION_JOIN}
    ${COMPLETED_WHERE} AND cd.delivery_date >= ${START} AND cd.delivery_date <= CURRENT_DATE
    GROUP BY ic.item_category
    ORDER BY value DESC, category
  `);
  const total_value = byCategory.reduce((s, r) => s + Number(r.value), 0);
  const items = byCategory.reduce((s, r) => s + r.items, 0);
  return {
    mode: 'single',
    period,
    year: new Date().getFullYear(),
    total_value,
    items,
    byCategory: byCategory.map(r => ({ ...r, value: Number(r.value) })),
  };
}

/* ------------------------------------------------------------------ */
/*  Impact Data — trend series                                         */
/* ------------------------------------------------------------------ */

export interface ImpactTrendBucket {
  label: string;
  households: number;
  deliveries: number;
  warehouse_pickups: number;
  guest_selection_appointments: number;
  partnering_agency_requests: number;
  children: number;
  female_adults: number;
  male_adults: number;
  total_individuals: number;
  volunteer_hours: number;
}
export interface ImpactTrend {
  mode: TrendMode;
  buckets: ImpactTrendBucket[];
}

export async function getImpactTrend(mode: TrendMode): Promise<ImpactTrend> {
  const dEx = bucketExpr(mode, 'd.delivery_date');
  const cdEx = bucketExpr(mode, 'cd.delivery_date');

  // Deliveries / households / warehouse pickups, per bucket.
  const delivery = await query<{ bucket: string; households: number; deliveries: number; warehouse_pickups: number }>(`
    WITH cds AS (
      SELECT d.client_deliveries_id, d.delivery_date, d.fulfillment_method_id, pr.client_id
      FROM tbl_client_deliveries d
      JOIN tbl_client_provisioning_request pr ON pr.client_provisioning_request_id = d.client_provisioning_request_id
      JOIN lkp_delivery_status ds ON ds.delivery_status_id = d.delivery_status_id
      WHERE ds.delivery_status IN ${COMPLETED} AND ${trendWhere(mode, 'd.delivery_date')}
    )
    SELECT ${dEx} AS bucket,
           COUNT(DISTINCT client_id)::int AS households,
           COUNT(*) FILTER (WHERE fm.fulfillment_method ILIKE 'Home delivery')::int AS deliveries,
           COUNT(*) FILTER (WHERE fm.fulfillment_method IN ('Container pickup','Walkout'))::int AS warehouse_pickups
    FROM cds d
    JOIN lkp_fulfillment_method fm ON fm.fulfillment_method_id = d.fulfillment_method_id
    GROUP BY bucket
  `);
  const dByKey = new Map(delivery.map(r => [r.bucket, r]));

  // Demographics from distinct delivered requests, per bucket.
  const demo = await query<{ bucket: string; children: number; female_adults: number; male_adults: number }>(`
    SELECT bucket,
           COALESCE(SUM(child_count), 0)::int        AS children,
           COALESCE(SUM(adult_female_count), 0)::int AS female_adults,
           COALESCE(SUM(adult_male_count), 0)::int   AS male_adults
    FROM (
      SELECT DISTINCT pr.client_provisioning_request_id,
             ${cdEx} AS bucket, pr.child_count, pr.adult_female_count, pr.adult_male_count
      FROM tbl_client_deliveries cd
      JOIN tbl_client_provisioning_request pr ON pr.client_provisioning_request_id = cd.client_provisioning_request_id
      JOIN lkp_delivery_status ds ON ds.delivery_status_id = cd.delivery_status_id
      WHERE ds.delivery_status IN ${COMPLETED} AND ${trendWhere(mode, 'cd.delivery_date')}
    ) t
    GROUP BY bucket
  `);
  const demoByKey = new Map(demo.map(r => [r.bucket, r]));

  const visits = await bucketMap(`
    SELECT ${bucketExpr(mode, 'visit_date')} AS bucket, COUNT(*)::int AS value
    FROM tbl_client_visit WHERE ${trendWhere(mode, 'visit_date')} GROUP BY bucket
  `);
  const referrals = await bucketMap(`
    SELECT ${bucketExpr(mode, 'referral_date')} AS bucket, COUNT(*)::int AS value
    FROM tbl_referral WHERE ${trendWhere(mode, 'referral_date')} GROUP BY bucket
  `);
  const hours = await bucketMap(`
    SELECT ${bucketExpr(mode, 'activity_date')} AS bucket, COALESCE(SUM(hours_logged), 0)::float8 AS value
    FROM tbl_volunteer_hours WHERE ${trendWhere(mode, 'activity_date')} GROUP BY bucket
  `);

  const buckets: ImpactTrendBucket[] = trendBuckets(mode).map(b => {
    const d = dByKey.get(b.key);
    const dm = demoByKey.get(b.key);
    const children = dm?.children ?? 0;
    const female = dm?.female_adults ?? 0;
    const male = dm?.male_adults ?? 0;
    return {
      label: b.label,
      households: d?.households ?? 0,
      deliveries: d?.deliveries ?? 0,
      warehouse_pickups: d?.warehouse_pickups ?? 0,
      guest_selection_appointments: visits.get(b.key) ?? 0,
      partnering_agency_requests: referrals.get(b.key) ?? 0,
      children,
      female_adults: female,
      male_adults: male,
      total_individuals: children + female + male,
      volunteer_hours: hours.get(b.key) ?? 0,
    };
  });
  return { mode, buckets };
}

/* ------------------------------------------------------------------ */
/*  Impact Data — single-window add-ons (hours + demographics)         */
/* ------------------------------------------------------------------ */

export interface VolunteerHoursSingle {
  total: number;
  byTeam: Array<{ team: string; hours: number }>;
}

export async function getVolunteerHours(period: SinglePeriod): Promise<VolunteerHoursSingle> {
  const START = windowStart(period);
  const rows = await query<{ team: string; hours: number }>(`
    SELECT COALESCE(vat.volunteer_activity_type, 'Unspecified') AS team,
           COALESCE(SUM(vh.hours_logged), 0)::float8 AS hours
    FROM tbl_volunteer_hours vh
    LEFT JOIN lkp_volunteer_activity_type vat ON vat.volunteer_activity_type_id = vh.volunteer_activity_type_id
    WHERE vh.activity_date >= ${START} AND vh.activity_date <= CURRENT_DATE
    GROUP BY vat.volunteer_activity_type
    ORDER BY hours DESC, team
  `);
  const byTeam = rows.map(r => ({ team: r.team, hours: Number(r.hours) })).filter(r => r.hours > 0);
  return { total: byTeam.reduce((s, r) => s + r.hours, 0), byTeam };
}

export interface DemographicsSingle {
  entered: number; // # delivered requests in window with any demographic value
  children: number;
  female_adults: number;
  male_adults: number;
  total_individuals: number;
}

export async function getDemographics(period: SinglePeriod): Promise<DemographicsSingle> {
  const START = windowStart(period);
  const row = await query<{ entered: number; children: number; female_adults: number; male_adults: number }>(`
    SELECT
      COUNT(*) FILTER (WHERE child_count IS NOT NULL OR adult_female_count IS NOT NULL OR adult_male_count IS NOT NULL)::int AS entered,
      COALESCE(SUM(child_count), 0)::int        AS children,
      COALESCE(SUM(adult_female_count), 0)::int AS female_adults,
      COALESCE(SUM(adult_male_count), 0)::int   AS male_adults
    FROM (
      SELECT DISTINCT pr.client_provisioning_request_id, pr.child_count, pr.adult_female_count, pr.adult_male_count
      FROM tbl_client_deliveries cd
      JOIN tbl_client_provisioning_request pr ON pr.client_provisioning_request_id = cd.client_provisioning_request_id
      JOIN lkp_delivery_status ds ON ds.delivery_status_id = cd.delivery_status_id
      WHERE ds.delivery_status IN ${COMPLETED}
        AND cd.delivery_date >= ${START} AND cd.delivery_date <= CURRENT_DATE
    ) t
  `);
  const r = row[0] ?? { entered: 0, children: 0, female_adults: 0, male_adults: 0 };
  return {
    entered: r.entered,
    children: r.children,
    female_adults: r.female_adults,
    male_adults: r.male_adults,
    total_individuals: r.children + r.female_adults + r.male_adults,
  };
}
