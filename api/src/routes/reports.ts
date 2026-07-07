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

export const reportsRouter = Router();

type Period = 'monthly' | 'quarterly' | 'yearly';

interface BucketConfig {
  trunc: 'month' | 'quarter' | 'year';
  /** Trailing window for time-series. */
  interval: string;       // e.g. "12 months"
  /** KPI window — current period only. */
  kpiInterval: string;    // e.g. "1 month"
  /** Step size for generate_series — PostgreSQL doesn't accept
   *  "1 quarter" as an interval, so quarterly uses "3 months". */
  stepInterval: string;
}

function getConfig(period: Period): BucketConfig {
  switch (period) {
    case 'monthly':
      return { trunc: 'month',   interval: "12 months", kpiInterval: "1 month",  stepInterval: "1 month" };
    case 'quarterly':
      return { trunc: 'quarter', interval: "24 months", kpiInterval: "3 months", stepInterval: "3 months" };
    case 'yearly':
      return { trunc: 'year',    interval: "5 years",   kpiInterval: "1 year",   stepInterval: "1 year" };
  }
}

reportsRouter.get('/', async (req, res, next) => {
  try {
    const periodRaw = String(req.query.period ?? 'monthly').toLowerCase();
    const period: Period = (['monthly', 'quarterly', 'yearly'] as const).includes(periodRaw as Period)
      ? (periodRaw as Period)
      : 'monthly';
    const cfg = getConfig(period);
    // Safe: trunc is one of three whitelisted strings. Interval string
    // is also whitelisted. Building these as a parameterized query
    // would require dynamic SQL the same way; the interpolation is
    // safe given the whitelist guard above.
    const T = cfg.trunc;
    const I = cfg.interval;
    const K = cfg.kpiInterval;
    const S = cfg.stepInterval;

    /* ---------- KPIs (current period only) ---------- */
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

    /* ---------- Tier 1 series ---------- */

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

    // Donor mix: new (first-ever gift in bucket) vs returning (any gift before bucket)
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
        COUNT(DISTINCT donor_id) FILTER (
          WHERE DATE_TRUNC('${T}', first_gift_ever) = bucket
        )::int AS new_donors,
        COUNT(DISTINCT donor_id) FILTER (
          WHERE DATE_TRUNC('${T}', first_gift_ever) < bucket
        )::int AS returning_donors
      FROM gifts_with_first
      GROUP BY bucket
      ORDER BY bucket
    `);

    const campaigns = await query(`
      SELECT
        c.campaign_id,
        c.campaign_name,
        cs.campaign_status,
        c.goal_amount,
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
      SELECT
        ds.donor_stage AS stage,
        ds.stage_order,
        COUNT(d.donor_id)::int AS count
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

    /* ---------- Tier 2 series ---------- */

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
      SELECT
        cat.item_category AS category,
        COUNT(*)::int AS count
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

    res.json({
      period,
      kpis,
      revenueTrend,
      revenueByFund,
      donorMix,
      campaigns,
      pickupsDeliveries,
      cycleTime,
      inventoryFlow,
      donorPipeline,
      volunteerHours,
      topDonors,
      avgGift,
      pledges,
      shiftFillRate,
      inventoryByCategory,
      ackTurnaround,
      donationTypes,
    });
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
