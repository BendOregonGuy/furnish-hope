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
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditCreate } from '../auth/audit.js';

export const donorsRouter = Router();

/**
 * Payload for the atomic donor create. Mirrors the ClientForm shape:
 * one transaction creates address → contact → donor and links them.
 * Used by the "+ New Donor" modal on Pickup/Donation/Pledge forms so the
 * user doesn't have to navigate to /admin to create a donor mid-workflow.
 */
interface DonorCreatePayload {
  contact: {
    first_name: string;
    middle_name?: string | null;
    last_name: string;
    gender_id?: number | null;
    ethnicity_id?: number | null;
    birth_date?: string | null;
    mobile_phone?: string | null;
    home_phone?: string | null;
    other_phone?: string | null;
    email?: string | null;
  };
  address: {
    address_name: string;
    address_type_id: number;
    address: string;
    address2?: string | null;
    city_id: number;
    county_id: number;
    state_id: number;
    postalcode: string;
  };
  donor: {
    donor_type_id: number;
    howtheyfoundus_id: number;
    is_recurring?: boolean;
    donor_advised_fund_name?: string | null;
    description?: string | null;
  };
}

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

/* ----------------------------------------------------------------- */
/*  POST /api/donors — atomic create                                  */
/*                                                                    */
/*  Creates address → contact → donor in one transaction. Used by    */
/*  the in-form quick-create modal so the user can add a donor       */
/*  without leaving the Pickup/Donation/Pledge form they're on.      */
/* ----------------------------------------------------------------- */

donorsRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body as DonorCreatePayload;
    const errs = validateDonorCreate(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    const result = await withTransaction(async (tx) => {
      // 1. Address (required for donors — every donor must have one)
      const a = await tx.queryOne<{ address_id: number }>(`
        INSERT INTO tbl_address (address_name, address_type_id, address, address2, city_id, county_id, state_id, postalcode)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING address_id
      `, [
        body.address.address_name, body.address.address_type_id,
        body.address.address, body.address.address2 ?? null,
        body.address.city_id, body.address.county_id, body.address.state_id, body.address.postalcode,
      ]);

      // 2. Contact (contact_type_id = 2 = "Donor" per seed)
      const c = await tx.queryOne<{ contact_id: number }>(`
        INSERT INTO tbl_contact
          (contact_type_id, first_name, middle_name, last_name, gender_id, ethnicity_id,
           birth_date, address_id, mobile_phone, home_phone, other_phone, email)
        VALUES (2, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING contact_id
      `, [
        body.contact.first_name, body.contact.middle_name ?? null, body.contact.last_name,
        body.contact.gender_id ?? null, body.contact.ethnicity_id ?? null,
        body.contact.birth_date ?? null,
        a!.address_id,
        body.contact.mobile_phone ?? null, body.contact.home_phone ?? null,
        body.contact.other_phone ?? null, body.contact.email ?? null,
      ]);

      // 3. Donor
      const d = await tx.queryOne<Record<string, any>>(`
        INSERT INTO tbl_donor
          (donor_type_id, contact_id, address_id, howtheyfoundus_id, is_recurring,
           donor_advised_fund_name, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        body.donor.donor_type_id, c!.contact_id, a!.address_id,
        body.donor.howtheyfoundus_id, body.donor.is_recurring ?? false,
        body.donor.donor_advised_fund_name ?? null, body.donor.description ?? null,
      ]);

      await auditCreate(req, 'tbl_donor', d!.donor_id, d!, tx);

      // Return the donor + a friendly label so the caller (modal) can
      // immediately tell the parent FK dropdown what to display.
      const label = [body.contact.first_name, body.contact.last_name].filter(Boolean).join(' ').trim()
        || `Donor #${d!.donor_id}`;
      return { donor_id: d!.donor_id as number, label };
    });

    res.status(201).json(result);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Validation                                                        */
/* ----------------------------------------------------------------- */

function validateDonorCreate(body: DonorCreatePayload): string[] {
  const errs: string[] = [];
  if (!body || typeof body !== 'object') { errs.push('Missing request body'); return errs; }
  if (!body.contact || typeof body.contact !== 'object') errs.push('contact section is required');
  if (!body.address || typeof body.address !== 'object') errs.push('address section is required');
  if (!body.donor || typeof body.donor !== 'object') errs.push('donor section is required');
  if (errs.length) return errs;

  if (!body.contact.first_name?.trim()) errs.push('First name is required');
  if (!body.contact.last_name?.trim()) errs.push('Last name is required');

  if (!body.address.address_name?.trim()) errs.push('Address label is required');
  if (!body.address.address?.trim()) errs.push('Street address is required');
  if (!body.address.postalcode?.trim()) errs.push('ZIP / postal code is required');
  if (!body.address.address_type_id) errs.push('Address type is required');
  if (!body.address.city_id) errs.push('City is required');
  if (!body.address.county_id) errs.push('County is required');
  if (!body.address.state_id) errs.push('State is required');

  if (!body.donor.donor_type_id) errs.push('Donor type is required');
  if (!body.donor.howtheyfoundus_id) errs.push('"How they found us" is required');

  return errs;
}
