/**
 * Donor-centric views — list and detail. Edit/create still flow through
 * the generic admin tool at /admin/tbl_donor for now (no need to duplicate
 * the donor form when admin gets it for free).
 *
 *   GET  /api/donors          list with lifetime + YTD giving totals
 *   GET  /api/donors/:id      detail: contact + address + totals +
 *                             designation breakdown + outstanding pledges +
 *                             gift history
 */

import { Router } from 'express';
import { query, queryOne } from '../db/pool.js';

export const donorsRouter = Router();

/* ----------------------------------------------------------------- */
/*  List                                                              */
/* ----------------------------------------------------------------- */

donorsRouter.get('/', async (req, res, next) => {
  try {
    const search = (req.query.search as string | undefined) || null;
    const stageId = req.query.stage_id ? Number(req.query.stage_id) : null;
    const typeId  = req.query.type_id  ? Number(req.query.type_id)  : null;
    const conds: string[] = [];
    const params: any[] = [];
    if (search) {
      params.push(`%${search}%`);
      conds.push(`(contact.first_name ILIKE $${params.length}
                  OR contact.last_name ILIKE $${params.length}
                  OR contact.email ILIKE $${params.length})`);
    }
    if (stageId) { params.push(stageId); conds.push(`donor.donor_stage_id = $${params.length}`); }
    if (typeId)  { params.push(typeId);  conds.push(`donor.donor_type_id = $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const rows = await query(`
      SELECT
        donor.donor_id,
        contact.first_name || ' ' || contact.last_name AS donor_name,
        contact.mobile_phone,
        contact.email,
        dt.donor_type,
        donor.is_recurring,
        donor.do_not_contact,
        donor.donor_stage_id,
        ds.donor_stage,
        COALESCE(SUM(d.total_value), 0)::numeric(12,2) AS lifetime_giving,
        COALESCE(SUM(CASE WHEN EXTRACT(YEAR FROM d.donation_date) = EXTRACT(YEAR FROM CURRENT_DATE)
                          THEN d.total_value ELSE 0 END), 0)::numeric(12,2) AS ytd_giving,
        MAX(d.donation_date) AS last_gift_date,
        COUNT(d.donation_id)::int AS gift_count
      FROM tbl_donor donor
      JOIN tbl_contact contact ON contact.contact_id = donor.contact_id
      JOIN lkp_donor_type dt ON dt.donor_type_id = donor.donor_type_id
      LEFT JOIN lkp_donor_stage ds ON ds.donor_stage_id = donor.donor_stage_id
      LEFT JOIN tbl_donation d ON d.donor_id = donor.donor_id
      ${where}
      GROUP BY donor.donor_id, contact.first_name, contact.last_name,
               contact.mobile_phone, contact.email, dt.donor_type,
               donor.is_recurring, donor.do_not_contact,
               donor.donor_stage_id, ds.donor_stage
      ORDER BY lifetime_giving DESC NULLS LAST, contact.last_name
      LIMIT 500
    `, params);

    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Read one                                                          */
/* ----------------------------------------------------------------- */

donorsRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const donor = await queryOne(`
      SELECT
        donor.donor_id,
        donor.donor_type_id,
        donor.contact_id,
        donor.address_id,
        donor.howtheyfoundus_id,
        donor.is_recurring,
        donor.donor_advised_fund_name,
        donor.employer_match_eligible,
        donor.do_not_contact,
        donor.preferred_contact_method_id,
        donor.donor_stage_id,
        donor.stage_notes,
        donor.stage_updated_at,
        ds.donor_stage,
        contact.first_name,
        contact.middle_name,
        contact.last_name,
        contact.mobile_phone,
        contact.home_phone,
        contact.other_phone,
        contact.email,
        contact.birth_date,
        dt.donor_type,
        addr.address,
        addr.address2,
        city.city,
        st.state,
        addr.postalcode,
        howtheyfoundus.howtheyfoundus AS how_they_found_us,
        cm.communication_method AS preferred_contact_method
      FROM tbl_donor donor
      JOIN tbl_contact contact ON contact.contact_id = donor.contact_id
      JOIN lkp_donor_type dt ON dt.donor_type_id = donor.donor_type_id
      LEFT JOIN tbl_address addr ON addr.address_id = donor.address_id
      LEFT JOIN lkp_city city ON city.city_id = addr.city_id
      LEFT JOIN lkp_state st ON st.state_id = addr.state_id
      LEFT JOIN lkp_howtheyfoundus howtheyfoundus ON howtheyfoundus.howtheyfoundus_id = donor.howtheyfoundus_id
      LEFT JOIN lkp_communication_method cm ON cm.communication_method_id = donor.preferred_contact_method_id
      LEFT JOIN lkp_donor_stage ds ON ds.donor_stage_id = donor.donor_stage_id
      WHERE donor.donor_id = $1
    `, [id]);

    if (!donor) return res.status(404).json({ error: 'Donor not found' });

    const totals = await queryOne(`
      SELECT
        COALESCE(SUM(total_value), 0)::numeric(12,2) AS lifetime_giving,
        COALESCE(SUM(tax_deductible_amount), 0)::numeric(12,2) AS lifetime_tax_deductible,
        COALESCE(SUM(CASE WHEN EXTRACT(YEAR FROM donation_date) = EXTRACT(YEAR FROM CURRENT_DATE)
                          THEN total_value ELSE 0 END), 0)::numeric(12,2) AS ytd_giving,
        COUNT(*)::int AS gift_count,
        MAX(donation_date) AS last_gift_date,
        MIN(donation_date) AS first_gift_date
      FROM tbl_donation
      WHERE donor_id = $1
    `, [id]);

    const byFund = await query(`
      SELECT
        COALESCE(f.fund_name, 'Undesignated') AS fund_name,
        SUM(dd.amount)::numeric(12,2) AS total
      FROM tbl_donation d
      LEFT JOIN tbl_donation_designation dd ON dd.donation_id = d.donation_id
      LEFT JOIN lkp_fund f ON f.fund_id = dd.fund_id
      WHERE d.donor_id = $1 AND dd.donation_designation_id IS NOT NULL
      GROUP BY f.fund_name
      ORDER BY total DESC
    `, [id]);

    const pledges = await query(`
      SELECT
        p.pledge_id,
        p.total_pledged_amount,
        p.amount_fulfilled,
        (p.total_pledged_amount - p.amount_fulfilled) AS amount_outstanding,
        p.pledge_date,
        p.expected_fulfillment_date,
        ps.pledge_status,
        f.fund_name
      FROM tbl_pledge p
      JOIN lkp_pledge_status ps ON ps.pledge_status_id = p.pledge_status_id
      LEFT JOIN lkp_fund f ON f.fund_id = p.fund_id
      WHERE p.donor_id = $1
      ORDER BY p.pledge_date DESC
    `, [id]);

    const recentGifts = await query(`
      SELECT
        d.donation_id,
        d.donation_date,
        d.total_value,
        d.tax_deductible_amount,
        d.receipt_number,
        dt.donation_type,
        pm.payment_method,
        ackst.acknowledgement_status,
        (
          SELECT STRING_AGG(f.fund_name, ', ' ORDER BY dd.amount DESC)
            FROM tbl_donation_designation dd
            JOIN lkp_fund f ON f.fund_id = dd.fund_id
           WHERE dd.donation_id = d.donation_id
        ) AS funds
      FROM tbl_donation d
      JOIN lkp_donation_type dt ON dt.donation_type_id = d.donation_type_id
      LEFT JOIN lkp_payment_method pm ON pm.payment_method_id = d.payment_method_id
      LEFT JOIN lkp_acknowledgement_status ackst ON ackst.acknowledgement_status_id = d.acknowledgement_status_id
      WHERE d.donor_id = $1
      ORDER BY d.donation_date DESC, d.donation_id DESC
      LIMIT 50
    `, [id]);

    res.json({ donor, totals, byFund, pledges, recentGifts });
  } catch (err) { next(err); }
});
