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
  interval: string;       // 'INTERVAL '12 months''
  /** KPI window — current period only. */
  kpiInterval: string;    // 'INTERVAL '1 month'' etc.
}

function getConfig(period: Period): BucketConfig {
  switch (period) {
    case 'monthly':
      return { trunc: 'month',   interval: "12 months", kpiInterval: "1 month" };
    case 'quarterly':
      return { trunc: 'quarter', interval: "24 months", kpiInterval: "3 months" };
    case 'yearly':
      return { trunc: 'year',    interval: "5 years",   kpiInterval: "1 year" };
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
                   WHERE work_date >= DATE_TRUNC('${T}', NOW())), 0)::numeric(10,2) AS volunteer_hours,
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
          INTERVAL '1 ${T}'
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
        ROUND(AVG(EXTRACT(EPOCH FROM (d.delivery_date - r.request_at::date)) / 86400.0)::numeric, 1) AS avg_days
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
          INTERVAL '1 ${T}'
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
      SELECT DATE_TRUNC('${T}', work_date) AS bucket,
             COALESCE(SUM(hours_logged), 0)::numeric(10,2) AS hours
      FROM tbl_volunteer_hours
      WHERE work_date >= NOW() - INTERVAL '${I}'
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
             ROUND(AVG(EXTRACT(EPOCH FROM (acknowledgement_sent_date - donation_date)) / 86400.0)::numeric, 1) AS avg_days
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
