import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditCreate, auditDelete, auditUpdate } from '../auth/audit.js';

export const volunteersRouter = Router();

/* ----------------------------------------------------------------- */
/*  Shared shapes                                                     */
/* ----------------------------------------------------------------- */

interface ContactPayload {
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  mobile_phone?: string | null;
  home_phone?: string | null;
  other_phone?: string | null;
  email?: string | null;
  birth_date?: string | null;
  gender_id?: number | null;
  ethnicity_id?: number | null;
}

interface StaffPayload {
  corp_facility_id: number;
  hire_date?: string | null;
}

interface ProfilePayload {
  waiver_signed: boolean;
  waiver_signed_date?: string | null;
  waiver_version?: string | null;
  background_check_status?: string | null;
  background_check_expiration?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  t_shirt_size?: string | null;
}

interface VolunteerWritePayload {
  contact: ContactPayload;
  staff: StaffPayload;
  profile: ProfilePayload;
  skill_ids: number[];
}

/* ----------------------------------------------------------------- */
/*  List                                                              */
/* ----------------------------------------------------------------- */

volunteersRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await query(`
      SELECT
        fs.facility_staff_id,
        contact.first_name || ' ' || contact.last_name AS name,
        contact.mobile_phone,
        contact.email,
        fs.hire_date,
        vp.waiver_signed,
        vp.background_check_status,
        vp.background_check_expiration,
        st.staff_type,
        s.facility_staff_status AS status,
        COALESCE((
          SELECT SUM(hours_logged)::numeric(7,2) FROM tbl_volunteer_hours h
           WHERE h.facility_staff_id = fs.facility_staff_id
             AND EXTRACT(YEAR FROM h.activity_date) = EXTRACT(YEAR FROM CURRENT_DATE)
        ), 0) AS hours_ytd,
        (SELECT array_agg(sk.skill ORDER BY sk.skill)
           FROM tbl_volunteer_skill vsk
           JOIN lkp_skill sk ON sk.skill_id = vsk.skill_id
          WHERE vsk.facility_staff_id = fs.facility_staff_id) AS skills
      FROM tbl_facility_staff fs
      JOIN tbl_contact contact ON contact.contact_id = fs.contact_id
      LEFT JOIN tbl_volunteer_profile vp ON vp.facility_staff_id = fs.facility_staff_id
      LEFT JOIN LATERAL (
        SELECT st.staff_type FROM tbl_staff_types stt
         JOIN tbl_staff_type st ON st.staff_type_id = stt.staff_type_id
        WHERE stt.facility_staff_id = fs.facility_staff_id AND stt.is_active = true
        ORDER BY stt.date_effective DESC LIMIT 1
      ) st ON true
      LEFT JOIN LATERAL (
        SELECT s.facility_staff_status FROM tbl_facility_staff_statuses ss
         JOIN lkp_facility_staff_status s ON s.facility_staff_status_id = ss.facility_staff_status_id
        WHERE ss.facility_staff_id = fs.facility_staff_id
        ORDER BY ss.status_date_changed DESC LIMIT 1
      ) s ON true
      WHERE fs.is_volunteer = true
      ORDER BY contact.last_name
    `);

    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Read one                                                          */
/* ----------------------------------------------------------------- */

volunteersRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const volunteer = await queryOne(`
      SELECT
        fs.facility_staff_id,
        fs.contact_id,
        fs.corp_facility_id,
        fs.hire_date,
        f.facility_name,
        contact.first_name,
        contact.middle_name,
        contact.last_name,
        contact.mobile_phone,
        contact.home_phone,
        contact.other_phone,
        contact.email,
        contact.birth_date,
        contact.gender_id,
        contact.ethnicity_id,
        g.gender,
        e.ethnicity,
        vp.waiver_signed,
        vp.waiver_signed_date,
        vp.waiver_version,
        vp.background_check_status,
        vp.background_check_expiration,
        vp.emergency_contact_name,
        vp.emergency_contact_phone,
        vp.t_shirt_size
      FROM tbl_facility_staff fs
      JOIN tbl_contact contact ON contact.contact_id = fs.contact_id
      JOIN tbl_corp_facility f ON f.corp_facility_id = fs.corp_facility_id
      LEFT JOIN lkp_gender g ON g.gender_id = contact.gender_id
      LEFT JOIN lkp_ethnicity e ON e.ethnicity_id = contact.ethnicity_id
      LEFT JOIN tbl_volunteer_profile vp ON vp.facility_staff_id = fs.facility_staff_id
      WHERE fs.facility_staff_id = $1 AND fs.is_volunteer = true
    `, [id]);

    if (!volunteer) return res.status(404).json({ error: 'Volunteer not found' });

    const skills = await query(`
      SELECT sk.skill_id, sk.skill
        FROM tbl_volunteer_skill vsk
        JOIN lkp_skill sk ON sk.skill_id = vsk.skill_id
       WHERE vsk.facility_staff_id = $1
       ORDER BY sk.skill
    `, [id]);

    const hours = await query(`
      SELECT
        h.volunteer_hours_id,
        h.activity_date,
        h.hours_logged,
        at.volunteer_activity_type,
        h.notes,
        verifier.first_name || ' ' || verifier.last_name AS verified_by
      FROM tbl_volunteer_hours h
      JOIN lkp_volunteer_activity_type at ON at.volunteer_activity_type_id = h.volunteer_activity_type_id
      LEFT JOIN tbl_facility_staff vfs ON vfs.facility_staff_id = h.verified_by_facility_staff_id
      LEFT JOIN tbl_contact verifier ON verifier.contact_id = vfs.contact_id
      WHERE h.facility_staff_id = $1
      ORDER BY h.activity_date DESC
      LIMIT 50
    `, [id]);

    const totals = await queryOne<{ hours_ytd: number; hours_lifetime: number; deliveries: number }>(`
      SELECT
        COALESCE(SUM(CASE WHEN EXTRACT(YEAR FROM activity_date) = EXTRACT(YEAR FROM CURRENT_DATE)
                          THEN hours_logged ELSE 0 END), 0)::numeric(7,2) AS hours_ytd,
        COALESCE(SUM(hours_logged), 0)::numeric(7,2) AS hours_lifetime,
        (SELECT COUNT(*)::int FROM tbl_delivery_staff ds WHERE ds.facility_staff_id = $1) AS deliveries
      FROM tbl_volunteer_hours
      WHERE facility_staff_id = $1
    `, [id]);

    // Neighbors — by last name (matches list sort).
    const cur = await queryOne<{ last_name: string }>(
      `SELECT contact.last_name FROM tbl_facility_staff fs
        JOIN tbl_contact contact ON contact.contact_id = fs.contact_id
       WHERE fs.facility_staff_id = $1`, [id]);
    const prev = await queryOne<{ id: number }>(`
      SELECT fs.facility_staff_id AS id
        FROM tbl_facility_staff fs
        JOIN tbl_contact contact ON contact.contact_id = fs.contact_id
       WHERE fs.is_volunteer = true
         AND (contact.last_name < $1 OR (contact.last_name = $1 AND fs.facility_staff_id < $2))
       ORDER BY contact.last_name DESC, fs.facility_staff_id DESC LIMIT 1
    `, [cur?.last_name, id]);
    const next = await queryOne<{ id: number }>(`
      SELECT fs.facility_staff_id AS id
        FROM tbl_facility_staff fs
        JOIN tbl_contact contact ON contact.contact_id = fs.contact_id
       WHERE fs.is_volunteer = true
         AND (contact.last_name > $1 OR (contact.last_name = $1 AND fs.facility_staff_id > $2))
       ORDER BY contact.last_name ASC, fs.facility_staff_id ASC LIMIT 1
    `, [cur?.last_name, id]);

    res.json({ volunteer, skills, hours, totals, prevId: prev?.id ?? null, nextId: next?.id ?? null });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Create                                                            */
/* ----------------------------------------------------------------- */

volunteersRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body as VolunteerWritePayload;
    const errs = validateWritePayload(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    const newId = await withTransaction(async (tx) => {
      // contact_type_id 4 = "Volunteer" per seed (verified at runtime in case order changes)
      const contact = await tx.queryOne<{ contact_id: number }>(`
        INSERT INTO tbl_contact
          (contact_type_id, first_name, middle_name, last_name, gender_id, ethnicity_id,
           birth_date, mobile_phone, home_phone, other_phone, email)
        VALUES (
          (SELECT contact_type_id FROM lkp_contact_type WHERE contact_type = 'Volunteer' LIMIT 1),
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING contact_id
      `, [
        body.contact.first_name, body.contact.middle_name ?? null, body.contact.last_name,
        body.contact.gender_id ?? null, body.contact.ethnicity_id ?? null,
        body.contact.birth_date ?? null,
        body.contact.mobile_phone ?? null, body.contact.home_phone ?? null,
        body.contact.other_phone ?? null, body.contact.email ?? null,
      ]);

      const fs = await tx.queryOne<Record<string, any>>(`
        INSERT INTO tbl_facility_staff (corp_facility_id, contact_id, is_volunteer, hire_date)
        VALUES ($1, $2, true, $3)
        RETURNING *
      `, [body.staff.corp_facility_id, contact!.contact_id, body.staff.hire_date ?? null]);

      await tx.query(`
        INSERT INTO tbl_volunteer_profile
          (facility_staff_id, waiver_signed, waiver_signed_date, waiver_version,
           background_check_status, background_check_expiration,
           emergency_contact_name, emergency_contact_phone, t_shirt_size)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        fs!.facility_staff_id,
        body.profile.waiver_signed ?? false,
        body.profile.waiver_signed_date ?? null,
        body.profile.waiver_version ?? null,
        body.profile.background_check_status ?? null,
        body.profile.background_check_expiration ?? null,
        body.profile.emergency_contact_name ?? null,
        body.profile.emergency_contact_phone ?? null,
        body.profile.t_shirt_size ?? null,
      ]);

      for (const skill_id of body.skill_ids ?? []) {
        await tx.query(`INSERT INTO tbl_volunteer_skill (facility_staff_id, skill_id) VALUES ($1, $2)`,
          [fs!.facility_staff_id, skill_id]);
      }

      await auditCreate(req, 'tbl_facility_staff', fs!.facility_staff_id, fs!, tx);
      return fs!.facility_staff_id;
    });

    res.status(201).json({ facility_staff_id: newId });
  } catch (err) { next(translatePgError(err)); }
});

/* ----------------------------------------------------------------- */
/*  Update                                                            */
/* ----------------------------------------------------------------- */

volunteersRouter.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const body = req.body as VolunteerWritePayload;
    const errs = validateWritePayload(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    await withTransaction(async (tx) => {
      const existing = await tx.queryOne<{ contact_id: number }>(
        `SELECT contact_id FROM tbl_facility_staff WHERE facility_staff_id = $1 AND is_volunteer = true`, [id],
      );
      if (!existing) throw withStatus(404, 'Volunteer not found');

      const beforeFs = await tx.queryOne<Record<string, any>>(`SELECT * FROM tbl_facility_staff WHERE facility_staff_id = $1`, [id]);

      await tx.query(`
        UPDATE tbl_contact
           SET first_name = $1, middle_name = $2, last_name = $3,
               gender_id = $4, ethnicity_id = $5, birth_date = $6,
               mobile_phone = $7, home_phone = $8, other_phone = $9, email = $10
         WHERE contact_id = $11
      `, [
        body.contact.first_name, body.contact.middle_name ?? null, body.contact.last_name,
        body.contact.gender_id ?? null, body.contact.ethnicity_id ?? null,
        body.contact.birth_date ?? null,
        body.contact.mobile_phone ?? null, body.contact.home_phone ?? null,
        body.contact.other_phone ?? null, body.contact.email ?? null,
        existing.contact_id,
      ]);

      const afterFs = await tx.queryOne<Record<string, any>>(`
        UPDATE tbl_facility_staff
           SET corp_facility_id = $1, hire_date = $2
         WHERE facility_staff_id = $3
         RETURNING *
      `, [body.staff.corp_facility_id, body.staff.hire_date ?? null, id]);
      if (beforeFs && afterFs) await auditUpdate(req, 'tbl_facility_staff', id, beforeFs, afterFs, tx);

      // Upsert volunteer profile.
      const hasProfile = await tx.queryOne<{ id: number }>(
        `SELECT volunteer_profile_id AS id FROM tbl_volunteer_profile WHERE facility_staff_id = $1`, [id],
      );
      if (hasProfile) {
        await tx.query(`
          UPDATE tbl_volunteer_profile
             SET waiver_signed = $1, waiver_signed_date = $2, waiver_version = $3,
                 background_check_status = $4, background_check_expiration = $5,
                 emergency_contact_name = $6, emergency_contact_phone = $7, t_shirt_size = $8
           WHERE facility_staff_id = $9
        `, [
          body.profile.waiver_signed ?? false,
          body.profile.waiver_signed_date ?? null,
          body.profile.waiver_version ?? null,
          body.profile.background_check_status ?? null,
          body.profile.background_check_expiration ?? null,
          body.profile.emergency_contact_name ?? null,
          body.profile.emergency_contact_phone ?? null,
          body.profile.t_shirt_size ?? null,
          id,
        ]);
      } else {
        await tx.query(`
          INSERT INTO tbl_volunteer_profile
            (facility_staff_id, waiver_signed, waiver_signed_date, waiver_version,
             background_check_status, background_check_expiration,
             emergency_contact_name, emergency_contact_phone, t_shirt_size)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          id,
          body.profile.waiver_signed ?? false,
          body.profile.waiver_signed_date ?? null,
          body.profile.waiver_version ?? null,
          body.profile.background_check_status ?? null,
          body.profile.background_check_expiration ?? null,
          body.profile.emergency_contact_name ?? null,
          body.profile.emergency_contact_phone ?? null,
          body.profile.t_shirt_size ?? null,
        ]);
      }

      // Diff skills.
      const incoming = new Set(body.skill_ids ?? []);
      const existingSkills = await tx.query<{ skill_id: number }>(
        `SELECT skill_id FROM tbl_volunteer_skill WHERE facility_staff_id = $1`, [id],
      );
      for (const row of existingSkills) {
        if (!incoming.has(row.skill_id)) {
          await tx.query(`DELETE FROM tbl_volunteer_skill WHERE facility_staff_id = $1 AND skill_id = $2`, [id, row.skill_id]);
        }
      }
      const existingSet = new Set(existingSkills.map(r => r.skill_id));
      for (const skill_id of incoming) {
        if (!existingSet.has(skill_id)) {
          await tx.query(`INSERT INTO tbl_volunteer_skill (facility_staff_id, skill_id) VALUES ($1, $2)`, [id, skill_id]);
        }
      }
    });

    res.json({ facility_staff_id: id });
  } catch (err) { next(translatePgError(err)); }
});

/* ----------------------------------------------------------------- */
/*  Delete                                                            */
/* ----------------------------------------------------------------- */

volunteersRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    await withTransaction(async (tx) => {
      const existing = await tx.queryOne<{ contact_id: number }>(
        `SELECT contact_id FROM tbl_facility_staff WHERE facility_staff_id = $1`, [id],
      );
      if (!existing) throw withStatus(404, 'Volunteer not found');

      const before = await tx.queryOne<Record<string, any>>(`SELECT * FROM tbl_facility_staff WHERE facility_staff_id = $1`, [id]);

      await tx.query(`DELETE FROM tbl_volunteer_skill WHERE facility_staff_id = $1`, [id]);
      await tx.query(`DELETE FROM tbl_volunteer_profile WHERE facility_staff_id = $1`, [id]);
      await tx.query(`DELETE FROM tbl_facility_staff WHERE facility_staff_id = $1`, [id]);
      try {
        await tx.query(`DELETE FROM tbl_contact WHERE contact_id = $1`, [existing.contact_id]);
      } catch (e: any) {
        if (e?.code !== '23503') throw e;
      }
      if (before) await auditDelete(req, 'tbl_facility_staff', id, before, tx);
    });

    res.status(204).end();
  } catch (err) { next(translatePgError(err)); }
});

/* ----------------------------------------------------------------- */
/*  Hours endpoint (preserved)                                        */
/* ----------------------------------------------------------------- */

/** POST /api/volunteers/:id/hours — log volunteer hours */
volunteersRouter.post('/:id/hours', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const {
      volunteer_activity_type_id,
      activity_date,
      hours_logged,
      verified_by_facility_staff_id = null,
      notes = null,
    } = req.body ?? {};

    if (!volunteer_activity_type_id || !activity_date || !hours_logged) {
      return res.status(400).json({
        error: 'volunteer_activity_type_id, activity_date, hours_logged are required',
      });
    }

    const result = await queryOne<{ volunteer_hours_id: number }>(`
      INSERT INTO tbl_volunteer_hours
        (facility_staff_id, volunteer_activity_type_id, activity_date, hours_logged,
         verified_by_facility_staff_id, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING volunteer_hours_id
    `, [id, volunteer_activity_type_id, activity_date, hours_logged,
        verified_by_facility_staff_id, notes]);

    res.status(201).json(result);
  } catch (err) { next(err); }
});

/* ================================================================= */

function validateWritePayload(body: VolunteerWritePayload): string[] {
  const errs: string[] = [];
  if (!body || typeof body !== 'object') return ['Missing body'];
  if (!body.contact) errs.push('contact required');
  if (!body.staff) errs.push('staff required');
  if (!body.profile) errs.push('profile required');
  if (body.contact) {
    if (!body.contact.first_name?.trim()) errs.push('contact.first_name required');
    if (!body.contact.last_name?.trim()) errs.push('contact.last_name required');
  }
  if (body.staff) {
    if (!Number.isInteger(body.staff.corp_facility_id) || body.staff.corp_facility_id <= 0) errs.push('staff.corp_facility_id required');
  }
  if (body.skill_ids && !Array.isArray(body.skill_ids)) errs.push('skill_ids must be an array');
  return errs;
}

function withStatus(status: number, message: string): Error {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

function translatePgError(err: any): any {
  if (!err || !err.code) return err;
  const e: any = new Error(err.message);
  switch (err.code) {
    case '23503':
      e.message = err.detail ? `Referenced elsewhere: ${err.detail.replace(/^Key /, '')}` : 'Referenced by other rows.';
      e.status = 409;
      return e;
    case '23505': e.message = err.detail ?? 'Unique constraint violated.'; e.status = 409; return e;
    case '23502': e.message = `Missing required field: ${err.column ?? 'unknown'}`; e.status = 400; return e;
    default: return err;
  }
}
