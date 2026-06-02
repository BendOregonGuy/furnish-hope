import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditCreate, auditDelete, auditUpdate } from '../auth/audit.js';

export const pickupsRouter = Router();

interface PickupPayload {
  donor_id: number;
  pickup_address_id: number;
  pickup_status_id: number;
  scheduled_date: string;
  time_window_start?: string | null;
  time_window_end?: string | null;
  assigned_vehicle_id?: number | null;
  assigned_lead_facility_staff_id?: number | null;
  access_notes?: string | null;
}

/* ----------------------------------------------------------------- */
/*  List                                                              */
/* ----------------------------------------------------------------- */

/** GET /api/pickups — list */
pickupsRouter.get('/', async (req, res, next) => {
  try {
    const upcoming = req.query.upcoming === 'true';
    const conds: string[] = [];
    if (upcoming) conds.push(`p.scheduled_date >= CURRENT_DATE`);
    const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const rows = await query(`
      SELECT
        p.donation_pickup_id AS pickup_id,
        p.scheduled_date,
        p.time_window_start,
        p.time_window_end,
        ps.pickup_status,
        ct.first_name || ' ' || ct.last_name AS donor_name,
        donor.is_anonymous,
        dtype.donor_type,
        addr.address,
        city.city,
        p.access_notes,
        v.vehicle_license,
        lead.first_name || ' ' || lead.last_name AS team_lead
      FROM tbl_donation_pickup p
      JOIN lkp_pickup_status ps ON ps.pickup_status_id = p.pickup_status_id
      JOIN tbl_donor donor ON donor.donor_id = p.donor_id
      JOIN tbl_contact ct ON ct.contact_id = donor.contact_id
      JOIN lkp_donor_type dtype ON dtype.donor_type_id = donor.donor_type_id
      JOIN tbl_address addr ON addr.address_id = p.pickup_address_id
      LEFT JOIN lkp_city city ON city.city_id = addr.city_id
      LEFT JOIN tbl_vehicle v ON v.vehicle_id = p.assigned_vehicle_id
      LEFT JOIN tbl_facility_staff lead_fs ON lead_fs.facility_staff_id = p.assigned_lead_facility_staff_id
      LEFT JOIN tbl_contact lead ON lead.contact_id = lead_fs.contact_id
      ${whereSql}
      ORDER BY p.scheduled_date, p.time_window_start
    `);

    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Read one                                                          */
/* ----------------------------------------------------------------- */

/** GET /api/pickups/:id — detail with prev/next */
pickupsRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const pickup = await queryOne(`
      SELECT
        p.donation_pickup_id AS pickup_id,
        p.donor_id,
        p.pickup_address_id,
        p.pickup_status_id,
        p.scheduled_date,
        p.time_window_start,
        p.time_window_end,
        p.access_notes,
        p.assigned_vehicle_id,
        p.assigned_lead_facility_staff_id,
        ps.pickup_status,
        ct.first_name || ' ' || ct.last_name AS donor_name,
        ct.mobile_phone AS donor_phone,
        ct.email AS donor_email,
        addr.address,
        addr.address2,
        city.city,
        addr.postalcode,
        v.vehicle_license,
        lead.first_name || ' ' || lead.last_name AS team_lead
      FROM tbl_donation_pickup p
      JOIN lkp_pickup_status ps ON ps.pickup_status_id = p.pickup_status_id
      JOIN tbl_donor donor ON donor.donor_id = p.donor_id
      JOIN tbl_contact ct ON ct.contact_id = donor.contact_id
      JOIN tbl_address addr ON addr.address_id = p.pickup_address_id
      LEFT JOIN lkp_city city ON city.city_id = addr.city_id
      LEFT JOIN tbl_vehicle v ON v.vehicle_id = p.assigned_vehicle_id
      LEFT JOIN tbl_facility_staff lead_fs ON lead_fs.facility_staff_id = p.assigned_lead_facility_staff_id
      LEFT JOIN tbl_contact lead ON lead.contact_id = lead_fs.contact_id
      WHERE p.donation_pickup_id = $1
    `, [id]);

    if (!pickup) return res.status(404).json({ error: 'Pickup not found' });

    const cur = await queryOne<{ scheduled_date: string }>(
      `SELECT scheduled_date FROM tbl_donation_pickup WHERE donation_pickup_id = $1`, [id],
    );
    const prev = await queryOne<{ id: number }>(`
      SELECT donation_pickup_id AS id FROM tbl_donation_pickup
       WHERE scheduled_date < $1 OR (scheduled_date = $1 AND donation_pickup_id < $2)
       ORDER BY scheduled_date DESC, donation_pickup_id DESC LIMIT 1
    `, [cur?.scheduled_date, id]);
    const next = await queryOne<{ id: number }>(`
      SELECT donation_pickup_id AS id FROM tbl_donation_pickup
       WHERE scheduled_date > $1 OR (scheduled_date = $1 AND donation_pickup_id > $2)
       ORDER BY scheduled_date ASC, donation_pickup_id ASC LIMIT 1
    `, [cur?.scheduled_date, id]);

    res.json({ pickup, prevId: prev?.id ?? null, nextId: next?.id ?? null });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Create                                                            */
/* ----------------------------------------------------------------- */

pickupsRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body as PickupPayload;
    const errs = validatePayload(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    const result = await queryOne<Record<string, any>>(`
      INSERT INTO tbl_donation_pickup
        (donor_id, pickup_address_id, pickup_status_id, scheduled_date,
         time_window_start, time_window_end, assigned_vehicle_id,
         assigned_lead_facility_staff_id, access_notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [body.donor_id, body.pickup_address_id, body.pickup_status_id, body.scheduled_date,
        body.time_window_start ?? null, body.time_window_end ?? null,
        body.assigned_vehicle_id ?? null, body.assigned_lead_facility_staff_id ?? null,
        body.access_notes ?? null]);

    await auditCreate(req, 'tbl_donation_pickup', result!.donation_pickup_id, result!);
    res.status(201).json({ pickup_id: result!.donation_pickup_id });
  } catch (err) { next(translatePgError(err)); }
});

/* ----------------------------------------------------------------- */
/*  Update                                                            */
/* ----------------------------------------------------------------- */

pickupsRouter.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = req.body as PickupPayload;
    const errs = validatePayload(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    await withTransaction(async (tx) => {
      const before = await tx.queryOne<Record<string, any>>(
        `SELECT * FROM tbl_donation_pickup WHERE donation_pickup_id = $1`, [id],
      );
      if (!before) throw withStatus(404, 'Pickup not found');

      const after = await tx.queryOne<Record<string, any>>(`
        UPDATE tbl_donation_pickup
           SET donor_id = $1, pickup_address_id = $2, pickup_status_id = $3,
               scheduled_date = $4, time_window_start = $5, time_window_end = $6,
               assigned_vehicle_id = $7, assigned_lead_facility_staff_id = $8,
               access_notes = $9
         WHERE donation_pickup_id = $10
         RETURNING *
      `, [body.donor_id, body.pickup_address_id, body.pickup_status_id, body.scheduled_date,
          body.time_window_start ?? null, body.time_window_end ?? null,
          body.assigned_vehicle_id ?? null, body.assigned_lead_facility_staff_id ?? null,
          body.access_notes ?? null, id]);
      if (after) await auditUpdate(req, 'tbl_donation_pickup', id, before, after, tx);
    });

    res.json({ pickup_id: id });
  } catch (err) { next(translatePgError(err)); }
});

/* ----------------------------------------------------------------- */
/*  Delete                                                            */
/* ----------------------------------------------------------------- */

pickupsRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const before = await queryOne<Record<string, any>>(
      `SELECT * FROM tbl_donation_pickup WHERE donation_pickup_id = $1`, [id],
    );
    await query(`DELETE FROM tbl_donation_pickup WHERE donation_pickup_id = $1`, [id]);
    if (before) await auditDelete(req, 'tbl_donation_pickup', id, before);
    res.status(204).end();
  } catch (err) { next(translatePgError(err)); }
});

/* ================================================================= */

function validatePayload(b: PickupPayload): string[] {
  const errs: string[] = [];
  if (!Number.isInteger(b?.donor_id) || b.donor_id <= 0) errs.push('donor_id required');
  if (!Number.isInteger(b?.pickup_address_id) || b.pickup_address_id <= 0) errs.push('pickup_address_id required');
  if (!Number.isInteger(b?.pickup_status_id) || b.pickup_status_id <= 0) errs.push('pickup_status_id required');
  if (!b?.scheduled_date) errs.push('scheduled_date required');
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
