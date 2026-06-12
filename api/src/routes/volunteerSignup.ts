/**
 * Volunteer signup — public application form at /volunteer + admin
 * review at /admin/volunteer-signups.
 *
 * Two routers:
 *  - publicSubmitRouter — mounted BEFORE the requireUser middleware.
 *    Single POST /api/volunteer-signup; honeypot field + IP capture
 *    + status='pending'.
 *  - adminRouter — admin-only list / detail / approve / reject.
 *    Approve creates tbl_contact + tbl_facility_staff (is_volunteer=true).
 */

import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditCreate, auditUpdate } from '../auth/audit.js';

export const volunteerSignupPublicRouter = Router();
export const volunteerSignupsAdminRouter = Router();

interface SignupBody {
  // honeypot — bots fill it, humans don't see it
  website?: string;
  // contact
  first_name: string;
  last_name: string;
  email: string;
  mobile_phone: string;
  city?: string | null;
  state_id?: number | null;
  postalcode?: string | null;
  date_of_birth?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  // preferences
  frequency: 'one_time' | 'recurring' | 'on_call';
  start_date?: string | null;
  end_date?: string | null;
  // availability
  avail_mon?: boolean; avail_tue?: boolean; avail_wed?: boolean;
  avail_thu?: boolean; avail_fri?: boolean; avail_sat?: boolean; avail_sun?: boolean;
  time_morning?: boolean; time_afternoon?: boolean; time_evening?: boolean;
  // activities
  act_pickups?: boolean; act_deliveries?: boolean; act_warehouse?: boolean;
  act_events?: boolean;  act_admin?: boolean;       act_photography?: boolean;
  act_trades?: boolean;  act_anywhere?: boolean;
  // capability
  can_lift: 'under_25' | '25_50' | '50_plus' | 'cannot';
  has_drivers_license?: boolean;
  has_vehicle?: boolean;
  special_skills?: string | null;
  // qualitative
  heard_from_id?: number | null;
  why_interested?: string | null;
  needs_verified_hours?: boolean;
  // agreement
  agreed_to_waiver: boolean;
  agreed_to_emails?: boolean;
}

/* ----------------------------------------------------------------- */
/*  Public submission                                                 */
/* ----------------------------------------------------------------- */

volunteerSignupPublicRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body as SignupBody;

    // Honeypot: if any value at all is present in `website`, silently
    // drop the submission with a 200 so bots don't learn we're filtering.
    if (body.website && body.website.trim().length > 0) {
      return res.status(200).json({ ok: true });
    }

    // Server-side required validation. Mirrors the client form but is
    // authoritative — anyone can hit this endpoint without going through
    // the React app, so trust nothing.
    const missing: string[] = [];
    if (!body.first_name?.trim())   missing.push('first_name');
    if (!body.last_name?.trim())    missing.push('last_name');
    if (!body.email?.trim())        missing.push('email');
    if (!body.mobile_phone?.trim()) missing.push('mobile_phone');
    if (!body.frequency)            missing.push('frequency');
    if (!body.can_lift)             missing.push('can_lift');
    if (body.agreed_to_waiver !== true) missing.push('agreed_to_waiver');
    if (missing.length) return res.status(400).json({ error: `Missing required: ${missing.join(', ')}` });

    if (!['one_time', 'recurring', 'on_call'].includes(body.frequency)) {
      return res.status(400).json({ error: 'Invalid frequency' });
    }
    if (!['under_25', '25_50', '50_plus', 'cannot'].includes(body.can_lift)) {
      return res.status(400).json({ error: 'Invalid can_lift' });
    }

    // Best-effort email format check. Browsers already validate via
    // type="email", but enforce server-side too.
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email.trim())) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim()
              || req.socket.remoteAddress
              || null;

    const row = await queryOne<{ signup_id: number }>(`
      INSERT INTO tbl_volunteer_signup
        (first_name, last_name, email, mobile_phone,
         city, state_id, postalcode, date_of_birth,
         emergency_contact_name, emergency_contact_phone,
         frequency, start_date, end_date,
         avail_mon, avail_tue, avail_wed, avail_thu, avail_fri, avail_sat, avail_sun,
         time_morning, time_afternoon, time_evening,
         act_pickups, act_deliveries, act_warehouse, act_events,
         act_admin, act_photography, act_trades, act_anywhere,
         can_lift, has_drivers_license, has_vehicle, special_skills,
         heard_from_id, why_interested, needs_verified_hours,
         agreed_to_waiver, agreed_to_emails,
         submitted_ip)
      VALUES
        ($1, $2, $3, $4,
         $5, $6, $7, $8,
         $9, $10,
         $11, $12, $13,
         $14, $15, $16, $17, $18, $19, $20,
         $21, $22, $23,
         $24, $25, $26, $27,
         $28, $29, $30, $31,
         $32, $33, $34, $35,
         $36, $37, $38,
         $39, $40,
         $41)
      RETURNING signup_id
    `, [
      body.first_name.trim(), body.last_name.trim(),
      body.email.trim().toLowerCase(), body.mobile_phone.trim(),
      body.city?.trim() || null, body.state_id ?? null, body.postalcode?.trim() || null, body.date_of_birth || null,
      body.emergency_contact_name?.trim() || null, body.emergency_contact_phone?.trim() || null,
      body.frequency, body.start_date || null, body.end_date || null,
      !!body.avail_mon, !!body.avail_tue, !!body.avail_wed, !!body.avail_thu,
      !!body.avail_fri, !!body.avail_sat, !!body.avail_sun,
      !!body.time_morning, !!body.time_afternoon, !!body.time_evening,
      !!body.act_pickups, !!body.act_deliveries, !!body.act_warehouse, !!body.act_events,
      !!body.act_admin, !!body.act_photography, !!body.act_trades, !!body.act_anywhere,
      body.can_lift, !!body.has_drivers_license, !!body.has_vehicle, body.special_skills?.trim() || null,
      body.heard_from_id ?? null, body.why_interested?.trim() || null, !!body.needs_verified_hours,
      true, !!body.agreed_to_emails,
      ip,
    ]);
    res.status(201).json({ signup_id: row!.signup_id });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Admin list                                                        */
/* ----------------------------------------------------------------- */

volunteerSignupsAdminRouter.get('/', async (req, res, next) => {
  try {
    const status = String(req.query.status || 'pending').toLowerCase();
    const valid = ['all', 'pending', 'approved', 'rejected', 'archived'];
    const where = valid.includes(status) && status !== 'all' ? 'WHERE status = $1' : '';
    const params = where ? [status] : [];
    const rows = await query<any>(`
      SELECT
        signup_id, first_name, last_name, email, mobile_phone,
        city, frequency, status, submitted_at, reviewed_at,
        (act_pickups OR act_deliveries OR act_warehouse OR act_events OR
         act_admin OR act_photography OR act_trades OR act_anywhere) AS any_activity
      FROM tbl_volunteer_signup
      ${where}
      ORDER BY submitted_at DESC
      LIMIT 500
    `, params);
    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Admin detail                                                      */
/* ----------------------------------------------------------------- */

volunteerSignupsAdminRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const row = await queryOne<any>(`
      SELECT s.*,
             st.state    AS state_name,
             h.howtheyfoundus AS heard_from_label,
             (rb.first_name || ' ' || rb.last_name) AS reviewer_name
      FROM tbl_volunteer_signup s
      LEFT JOIN lkp_state           st ON st.state_id = s.state_id
      LEFT JOIN lkp_howtheyfoundus  h  ON h.howtheyfoundus_id = s.heard_from_id
      LEFT JOIN tbl_user_account    rb_u ON rb_u.user_account_id = s.reviewed_by_user_account_id
      LEFT JOIN tbl_facility_staff  rb_fs ON rb_fs.facility_staff_id = rb_u.facility_staff_id
      LEFT JOIN tbl_contact         rb ON rb.contact_id = rb_fs.contact_id
      WHERE s.signup_id = $1
    `, [id]);
    if (!row) return res.status(404).json({ error: 'Signup not found' });
    res.json(row);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Admin approve                                                     */
/*                                                                    */
/*  Atomic: create tbl_contact + tbl_facility_staff (is_volunteer=    */
/*  true) records and link them back via approved_facility_staff_id.  */
/*  The applicant becomes a real volunteer in the operational system. */
/* ----------------------------------------------------------------- */

volunteerSignupsAdminRouter.post('/:id/approve', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const { review_notes } = (req.body ?? {}) as { review_notes?: string };

    const result = await withTransaction(async (tx) => {
      const s = await tx.queryOne<any>(
        `SELECT * FROM tbl_volunteer_signup WHERE signup_id = $1`, [id],
      );
      if (!s) throw withStatus(404, 'Signup not found');
      if (s.status === 'approved') {
        throw withStatus(409, `Already approved as facility_staff_id ${s.approved_facility_staff_id}`);
      }

      // tbl_contact needs a contact_type_id — Volunteer is the
      // appropriate seeded value. Fall back to first row if not seeded.
      const ct = await tx.queryOne<{ contact_type_id: number }>(`
        SELECT contact_type_id FROM lkp_contact_type
         ORDER BY (LOWER(contact_type) = 'volunteer') DESC, contact_type_id ASC LIMIT 1
      `);
      if (!ct) throw withStatus(500, 'lkp_contact_type is empty — admin must seed it before approving signups');

      const contact = await tx.queryOne<{ contact_id: number }>(`
        INSERT INTO tbl_contact (contact_type_id, first_name, last_name, email, mobile_phone)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING contact_id
      `, [ct.contact_type_id, s.first_name, s.last_name, s.email, s.mobile_phone]);

      // tbl_facility_staff requires corp_facility_id (NOT NULL).
      // Pick the FIRST corp facility — for nonprofits with multiple
      // locations the admin can re-assign post-approval.
      const facility = await tx.queryOne<{ corp_facility_id: number }>(`
        SELECT corp_facility_id FROM tbl_corp_facility ORDER BY corp_facility_id LIMIT 1
      `);
      if (!facility) {
        throw withStatus(500, 'No corporate facility exists — admin must create one before approving volunteer signups');
      }

      const fs = await tx.queryOne<{ facility_staff_id: number }>(`
        INSERT INTO tbl_facility_staff
          (contact_id, corp_facility_id, is_volunteer, hire_date, description)
        VALUES ($1, $2, true, CURRENT_DATE, $3)
        RETURNING facility_staff_id
      `, [
        contact!.contact_id,
        facility.corp_facility_id,
        `Approved from volunteer signup #${id}`,
      ]);

      const userId = req.user!.user_account_id;
      const after = await tx.queryOne<any>(`
        UPDATE tbl_volunteer_signup
           SET status = 'approved',
               reviewed_at = NOW(),
               reviewed_by_user_account_id = $1,
               review_notes = $2,
               approved_facility_staff_id = $3
         WHERE signup_id = $4
         RETURNING *
      `, [userId, review_notes ?? null, fs!.facility_staff_id, id]);

      await auditUpdate(req, 'tbl_volunteer_signup', id, s, after, tx);
      await auditCreate(req, 'tbl_contact', contact!.contact_id, contact!, tx);
      await auditCreate(req, 'tbl_facility_staff', fs!.facility_staff_id, fs!, tx);
      return { facility_staff_id: fs!.facility_staff_id, contact_id: contact!.contact_id };
    });

    res.json(result);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Admin reject                                                      */
/* ----------------------------------------------------------------- */

volunteerSignupsAdminRouter.post('/:id/reject', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const { review_notes } = (req.body ?? {}) as { review_notes?: string };

    const before = await queryOne<any>(`SELECT * FROM tbl_volunteer_signup WHERE signup_id = $1`, [id]);
    if (!before) return res.status(404).json({ error: 'Signup not found' });
    if (before.status === 'rejected') return res.status(409).json({ error: 'Already rejected' });

    const userId = req.user!.user_account_id;
    const after = await queryOne<any>(`
      UPDATE tbl_volunteer_signup
         SET status = 'rejected',
             reviewed_at = NOW(),
             reviewed_by_user_account_id = $1,
             review_notes = $2
       WHERE signup_id = $3
       RETURNING *
    `, [userId, review_notes ?? null, id]);

    if (after) await auditUpdate(req, 'tbl_volunteer_signup', id, before, after);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

function withStatus(status: number, message: string): Error {
  const e: any = new Error(message);
  e.status = status;
  return e;
}
