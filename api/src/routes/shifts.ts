/**
 * Volunteer shifts — scheduled time blocks staff sign up for.
 *
 *   GET    /api/shifts                         filtered list
 *   POST   /api/shifts                         create
 *   GET    /api/shifts/:id                     detail + signups
 *   PUT    /api/shifts/:id                     update
 *   DELETE /api/shifts/:id                     delete (CASCADE removes signups)
 *
 *   POST   /api/shifts/:id/signup              { facility_staff_id, notes? }
 *   POST   /api/shifts/:id/signup/:sid/cancel  mark a signup cancelled
 *   PUT    /api/shifts/:id/attendance          [{ signup_id, status, hours }]
 */

import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditCreate, auditUpdate, auditDelete } from '../auth/audit.js';

export const shiftsRouter = Router();

interface ShiftPayload {
  shift_type_id: number;
  shift_status_id: number;
  corp_facility_id?: number | null;
  shift_name?: string | null;
  shift_date: string;
  start_time?: string | null;
  end_time?: string | null;
  capacity_needed: number;
  notes?: string | null;
}

function validateShift(b: ShiftPayload): string[] {
  const errs: string[] = [];
  if (!b.shift_type_id) errs.push('Shift type is required');
  if (!b.shift_status_id) errs.push('Status is required');
  if (!b.shift_date) errs.push('Date is required');
  if (!Number.isInteger(b.capacity_needed) || b.capacity_needed < 1) errs.push('Capacity must be at least 1');
  return errs;
}

/* ----------------------------------------------------------------- */
/*  List                                                              */
/* ----------------------------------------------------------------- */

shiftsRouter.get('/', async (req, res, next) => {
  try {
    const from = (req.query.from as string | undefined) ?? null;
    const to   = (req.query.to as string | undefined) ?? null;
    const statusId = req.query.status_id ? Number(req.query.status_id) : null;
    const typeId   = req.query.type_id   ? Number(req.query.type_id)   : null;
    const conds: string[] = [];
    const params: any[] = [];
    if (from) { params.push(from); conds.push(`s.shift_date >= $${params.length}::date`); }
    if (to)   { params.push(to);   conds.push(`s.shift_date <= $${params.length}::date`); }
    if (statusId) { params.push(statusId); conds.push(`s.shift_status_id = $${params.length}`); }
    if (typeId)   { params.push(typeId);   conds.push(`s.shift_type_id = $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const rows = await query(`
      SELECT
        s.shift_id,
        s.shift_name,
        s.shift_date,
        s.start_time,
        s.end_time,
        s.capacity_needed,
        st.shift_type,
        ss.shift_status,
        cf.facility_name,
        (SELECT COUNT(*)::int
           FROM tbl_volunteer_shift_signup
          WHERE shift_id = s.shift_id
            AND signup_status IN ('signed_up','attended')) AS filled_count
      FROM tbl_volunteer_shift s
      JOIN lkp_shift_type st   ON st.shift_type_id   = s.shift_type_id
      JOIN lkp_shift_status ss ON ss.shift_status_id = s.shift_status_id
      LEFT JOIN tbl_corp_facility cf ON cf.corp_facility_id = s.corp_facility_id
      ${where}
      ORDER BY s.shift_date DESC, s.start_time DESC, s.shift_id DESC
      LIMIT 500
    `, params);

    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Read one + signups                                                */
/* ----------------------------------------------------------------- */

shiftsRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const shift = await queryOne(`
      SELECT
        s.*,
        st.shift_type,
        ss.shift_status,
        cf.facility_name
      FROM tbl_volunteer_shift s
      JOIN lkp_shift_type st   ON st.shift_type_id   = s.shift_type_id
      JOIN lkp_shift_status ss ON ss.shift_status_id = s.shift_status_id
      LEFT JOIN tbl_corp_facility cf ON cf.corp_facility_id = s.corp_facility_id
      WHERE s.shift_id = $1
    `, [id]);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });

    const signups = await query(`
      SELECT
        u.signup_id,
        u.facility_staff_id,
        u.signup_status,
        u.hours_logged,
        u.notes,
        u.signed_up_at,
        contact.first_name || ' ' || contact.last_name AS volunteer_name,
        contact.mobile_phone,
        contact.email,
        fs.is_volunteer
      FROM tbl_volunteer_shift_signup u
      JOIN tbl_facility_staff fs ON fs.facility_staff_id = u.facility_staff_id
      JOIN tbl_contact contact ON contact.contact_id = fs.contact_id
      WHERE u.shift_id = $1
      ORDER BY u.signup_status, u.signed_up_at
    `, [id]);

    const cur = await queryOne<{ shift_date: string }>(
      `SELECT shift_date FROM tbl_volunteer_shift WHERE shift_id = $1`, [id]);
    const prev = await queryOne<{ id: number }>(`
      SELECT shift_id AS id FROM tbl_volunteer_shift
       WHERE shift_date < $1 OR (shift_date = $1 AND shift_id < $2)
       ORDER BY shift_date DESC, shift_id DESC LIMIT 1
    `, [cur?.shift_date, id]);
    const next = await queryOne<{ id: number }>(`
      SELECT shift_id AS id FROM tbl_volunteer_shift
       WHERE shift_date > $1 OR (shift_date = $1 AND shift_id > $2)
       ORDER BY shift_date ASC, shift_id ASC LIMIT 1
    `, [cur?.shift_date, id]);

    res.json({ shift, signups, prevId: prev?.id ?? null, nextId: next?.id ?? null });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Create                                                            */
/* ----------------------------------------------------------------- */

shiftsRouter.post('/', async (req, res, next) => {
  try {
    const b = req.body as ShiftPayload;
    const errs = validateShift(b);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    const row = await queryOne<Record<string, any>>(`
      INSERT INTO tbl_volunteer_shift
        (shift_type_id, shift_status_id, corp_facility_id, shift_name,
         shift_date, start_time, end_time, capacity_needed, notes,
         created_by_user_account_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      b.shift_type_id, b.shift_status_id, b.corp_facility_id ?? null,
      b.shift_name?.trim() || null, b.shift_date,
      b.start_time || null, b.end_time || null,
      b.capacity_needed, b.notes?.trim() || null,
      req.user!.user_account_id,
    ]);
    await auditCreate(req, 'tbl_volunteer_shift', row!.shift_id, row!);
    res.status(201).json({ shift_id: row!.shift_id });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Update                                                            */
/* ----------------------------------------------------------------- */

shiftsRouter.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const b = req.body as ShiftPayload;
    const errs = validateShift(b);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    const before = await queryOne<Record<string, any>>(`SELECT * FROM tbl_volunteer_shift WHERE shift_id = $1`, [id]);
    if (!before) return res.status(404).json({ error: 'Shift not found' });

    const after = await queryOne<Record<string, any>>(`
      UPDATE tbl_volunteer_shift
         SET shift_type_id = $1, shift_status_id = $2, corp_facility_id = $3,
             shift_name = $4, shift_date = $5,
             start_time = $6, end_time = $7,
             capacity_needed = $8, notes = $9
       WHERE shift_id = $10
       RETURNING *
    `, [
      b.shift_type_id, b.shift_status_id, b.corp_facility_id ?? null,
      b.shift_name?.trim() || null, b.shift_date,
      b.start_time || null, b.end_time || null,
      b.capacity_needed, b.notes?.trim() || null,
      id,
    ]);
    if (after) await auditUpdate(req, 'tbl_volunteer_shift', id, before, after);
    res.json({ shift_id: id });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Delete                                                            */
/* ----------------------------------------------------------------- */

shiftsRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const before = await queryOne<Record<string, any>>(`SELECT * FROM tbl_volunteer_shift WHERE shift_id = $1`, [id]);
    if (!before) return res.status(404).json({ error: 'Shift not found' });
    await query(`DELETE FROM tbl_volunteer_shift WHERE shift_id = $1`, [id]);
    await auditDelete(req, 'tbl_volunteer_shift', id, before);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Signup                                                            */
/* ----------------------------------------------------------------- */

shiftsRouter.post('/:id/signup', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const { facility_staff_id, notes } = req.body ?? {};
    if (!facility_staff_id) return res.status(400).json({ error: 'facility_staff_id is required' });

    // Refuse if shift is cancelled.
    const shift = await queryOne<{ shift_status: string; capacity_needed: number }>(`
      SELECT ss.shift_status, s.capacity_needed
        FROM tbl_volunteer_shift s
        JOIN lkp_shift_status ss ON ss.shift_status_id = s.shift_status_id
       WHERE s.shift_id = $1
    `, [id]);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    if (shift.shift_status === 'Cancelled') return res.status(400).json({ error: 'This shift has been cancelled.' });

    try {
      const row = await queryOne<{ signup_id: number }>(`
        INSERT INTO tbl_volunteer_shift_signup
          (shift_id, facility_staff_id, signup_status, notes, signed_up_by_user_account_id)
        VALUES ($1, $2, 'signed_up', $3, $4)
        RETURNING signup_id
      `, [id, facility_staff_id, notes ?? null, req.user!.user_account_id]);
      await auditCreate(req, 'tbl_volunteer_shift_signup', row!.signup_id, { shift_id: id, facility_staff_id });
      res.status(201).json({ signup_id: row!.signup_id });
    } catch (err: any) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'This volunteer is already signed up for this shift.' });
      }
      throw err;
    }
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Cancel signup                                                     */
/* ----------------------------------------------------------------- */

shiftsRouter.post('/:id/signup/:sid/cancel', async (req, res, next) => {
  try {
    const sid = Number(req.params.sid);
    if (!Number.isInteger(sid) || sid <= 0) return res.status(400).json({ error: 'Invalid id' });
    const before = await queryOne<Record<string, any>>(`SELECT * FROM tbl_volunteer_shift_signup WHERE signup_id = $1`, [sid]);
    if (!before) return res.status(404).json({ error: 'Signup not found' });
    await query(`UPDATE tbl_volunteer_shift_signup SET signup_status = 'cancelled' WHERE signup_id = $1`, [sid]);
    await auditUpdate(req, 'tbl_volunteer_shift_signup', sid, before, { ...before, signup_status: 'cancelled' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Bulk attendance — mark attended/no_show + log hours               */
/* ----------------------------------------------------------------- */

interface AttendancePayload {
  signup_id: number;
  signup_status: 'signed_up' | 'attended' | 'no_show' | 'cancelled';
  hours_logged?: number | null;
}

shiftsRouter.put('/:id/attendance', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const body = req.body?.rows as AttendancePayload[] | undefined;
    if (!Array.isArray(body)) return res.status(400).json({ error: 'rows array is required' });

    await withTransaction(async (tx) => {
      for (const r of body) {
        if (!r.signup_id) continue;
        await tx.query(`
          UPDATE tbl_volunteer_shift_signup
             SET signup_status = $1,
                 hours_logged  = $2
           WHERE signup_id = $3 AND shift_id = $4
        `, [
          r.signup_status,
          r.hours_logged ?? null,
          r.signup_id, id,
        ]);
      }
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
