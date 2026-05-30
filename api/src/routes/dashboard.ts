import { Router } from 'express';
import { query, queryOne } from '../db/pool.js';

export const dashboardRouter = Router();

/**
 * GET /api/dashboard
 *
 * Returns headline metrics, pending requests, recent activity, and recent
 * donations — everything the Operations Coordinator dashboard needs in one
 * call. Cheaper than firing 5 separate requests from the frontend.
 */
dashboardRouter.get('/', async (_req, res, next) => {
  try {
    const metrics = await queryOne<{
      active_clients: number;
      open_requests: number;
      inventory_value: number;
      inventory_count: number;
      homes_furnished_ytd: number;
    }>(`
      SELECT
        (SELECT COUNT(*)::int FROM tbl_client c
           JOIN lkp_client_status s ON s.client_status_id = c.client_status_id
           WHERE s.client_status NOT IN ('Closed', 'Served')) AS active_clients,
        (SELECT COUNT(*)::int FROM tbl_client_provisioning_request r
           WHERE NOT EXISTS (
             SELECT 1 FROM tbl_client_deliveries d
              WHERE d.client_provisioning_request_id = r.client_provisioning_request_id
                AND d.delivery_status_id IN (
                  SELECT delivery_status_id FROM lkp_delivery_status
                   WHERE delivery_status = 'Delivered'
                ))) AS open_requests,
        COALESCE((SELECT SUM(donation_value_in)
                    FROM tbl_corp_facility_inventory_item
                   WHERE date_dispositioned IS NULL), 0)::int AS inventory_value,
        (SELECT COUNT(*)::int FROM tbl_corp_facility_inventory_item
           WHERE date_dispositioned IS NULL) AS inventory_count,
        (SELECT COUNT(*)::int FROM tbl_client_deliveries d
           JOIN lkp_delivery_status s ON s.delivery_status_id = d.delivery_status_id
           WHERE s.delivery_status = 'Delivered'
             AND EXTRACT(YEAR FROM d.delivery_date) = EXTRACT(YEAR FROM CURRENT_DATE)
         ) AS homes_furnished_ytd
    `);

    const pendingRequests = await query(`
      SELECT
        r.client_provisioning_request_id AS request_id,
        c.client_id,
        ct.first_name || ' ' || ct.last_name AS client_name,
        ct_type.client_type AS client_type,
        ag.agency_name,
        r.request_at::date AS request_date,
        CASE
          WHEN EXISTS (SELECT 1 FROM tbl_client_deliveries d
                        WHERE d.client_provisioning_request_id = r.client_provisioning_request_id)
            THEN 'Scheduled'
          WHEN (SELECT COUNT(*) FROM tbl_inventory_reservation res
                 WHERE res.client_provisioning_request_id = r.client_provisioning_request_id) >
               (SELECT COUNT(*) FROM tbl_client_request_items i
                 WHERE i.client_provisioning_request_id = r.client_provisioning_request_id) * 0.8
            THEN 'Ready to schedule'
          WHEN (SELECT COUNT(*) FROM tbl_inventory_reservation res
                 WHERE res.client_provisioning_request_id = r.client_provisioning_request_id) > 0
            THEN 'Matching'
          ELSE 'New'
        END AS status
      FROM tbl_client_provisioning_request r
      JOIN tbl_client c ON c.client_id = r.client_id
      JOIN tbl_contact ct ON ct.contact_id = c.contact_id
      JOIN lkp_client_type ct_type ON ct_type.client_type_id = c.client_type_id
      LEFT JOIN tbl_referral ref ON ref.client_id = c.client_id
      LEFT JOIN tbl_agency_contact acn ON acn.agency_contact_id = ref.agency_contact_id
      LEFT JOIN tbl_agency ag ON ag.agency_id = acn.agency_id
      ORDER BY r.request_at DESC
      LIMIT 10
    `);

    const recentDonations = await query(`
      SELECT
        d.donation_id,
        d.donation_date,
        d.total_value,
        dt.donation_type,
        ct.first_name || ' ' || ct.last_name AS donor_name,
        dtype.donor_type,
        (SELECT COUNT(*)::int FROM tbl_donation_item di WHERE di.donation_id = d.donation_id) AS item_count
      FROM tbl_donation d
      JOIN tbl_donor donor ON donor.donor_id = d.donor_id
      JOIN tbl_contact ct ON ct.contact_id = donor.contact_id
      JOIN lkp_donor_type dtype ON dtype.donor_type_id = donor.donor_type_id
      JOIN lkp_donation_type dt ON dt.donation_type_id = d.donation_type_id
      ORDER BY d.donation_date DESC
      LIMIT 8
    `);

    // Giving snapshot: YTD revenue, by-fund split, top donors, outstanding pledges.
    const giving = await queryOne<{
      ytd_giving: number;
      ytd_gift_count: number;
      ytd_tax_deductible: number;
      outstanding_pledges: number;
    }>(`
      SELECT
        COALESCE((SELECT SUM(total_value)
                    FROM tbl_donation
                   WHERE EXTRACT(YEAR FROM donation_date) = EXTRACT(YEAR FROM CURRENT_DATE)
                ), 0)::numeric(12,2) AS ytd_giving,
        COALESCE((SELECT COUNT(*)::int
                    FROM tbl_donation
                   WHERE EXTRACT(YEAR FROM donation_date) = EXTRACT(YEAR FROM CURRENT_DATE)
                ), 0) AS ytd_gift_count,
        COALESCE((SELECT SUM(tax_deductible_amount)
                    FROM tbl_donation
                   WHERE EXTRACT(YEAR FROM donation_date) = EXTRACT(YEAR FROM CURRENT_DATE)
                ), 0)::numeric(12,2) AS ytd_tax_deductible,
        COALESCE((SELECT SUM(total_pledged_amount - amount_fulfilled)
                    FROM tbl_pledge p
                    JOIN lkp_pledge_status ps ON ps.pledge_status_id = p.pledge_status_id
                   WHERE ps.pledge_status NOT IN ('Fulfilled', 'Cancelled')
                ), 0)::numeric(12,2) AS outstanding_pledges
    `);

    const byFundYtd = await query(`
      SELECT
        COALESCE(f.fund_name, 'Undesignated') AS fund_name,
        SUM(dd.amount)::numeric(12,2) AS total
      FROM tbl_donation d
      JOIN tbl_donation_designation dd ON dd.donation_id = d.donation_id
      LEFT JOIN lkp_fund f ON f.fund_id = dd.fund_id
      WHERE EXTRACT(YEAR FROM d.donation_date) = EXTRACT(YEAR FROM CURRENT_DATE)
      GROUP BY f.fund_name
      ORDER BY total DESC
      LIMIT 6
    `);

    const topDonorsYtd = await query(`
      SELECT
        donor.donor_id,
        contact.first_name || ' ' || contact.last_name AS donor_name,
        SUM(d.total_value)::numeric(12,2) AS ytd_total,
        COUNT(d.donation_id)::int AS gift_count
      FROM tbl_donation d
      JOIN tbl_donor donor ON donor.donor_id = d.donor_id
      JOIN tbl_contact contact ON contact.contact_id = donor.contact_id
      WHERE EXTRACT(YEAR FROM d.donation_date) = EXTRACT(YEAR FROM CURRENT_DATE)
      GROUP BY donor.donor_id, contact.first_name, contact.last_name
      ORDER BY ytd_total DESC
      LIMIT 6
    `);

    res.json({
      metrics,
      pendingRequests,
      recentDonations,
      giving,
      byFundYtd,
      topDonorsYtd,
    });
  } catch (err) {
    next(err);
  }
});
