/**
 * Client visits — the scheduled step where a client picks out their
 * furniture. May be in-person at the showroom, on the phone, on Zoom,
 * or asynchronous over email. Soft requirement before a delivery; the
 * client can also skip the visit entirely if staff makes the choices
 * on their behalf.
 *
 *   GET    /api/visits                list (filter by client / status / date)
 *   GET    /api/visits/:id            detail + prev/next ids
 *   POST   /api/visits                create
 *   PUT    /api/visits/:id            update
 *   DELETE /api/visits/:id            delete
 */

import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditCreate, auditDelete, auditUpdate } from '../auth/audit.js';

export const visitsRouter = Router();

interface WritePayload {
  client_id: number;
  visit_date: string;
  start_time?: string | null;
  end_time?: string | null;
  visit_mode_id: number;
  visit_status_id: number;
  host_facility_staff_id?: number | null;
  corp_facility_id?: number | null;
  client_provisioning_request_id?: number | null;
  notes?: string | null;
  visit_type?: string | null;      // Delivery | Donation Center Pick Up | Selection of Items
  selection_type?: string | null;  // only when visit_type = 'Selection of Items'
}

const VISIT_TYPES = ['Delivery', 'Donation Center Pick Up', 'Selection of Items'] as const;
const SELECTION_TYPES = ['Guest Selection Appointment', 'Video Call Appointment', 'Volunteer Selection'] as const;
const SELECTION_VISIT_TYPE = 'Selection of Items';

/** Normalize the type pair: selection_type only survives when visit_type is
 *  'Selection of Items' — mirrors the form's enable/disable rule so the data
 *  can never carry a selection_type for a non-selection visit. */
function normalizeTypes(b: WritePayload): { visit_type: string | null; selection_type: string | null } {
  const visit_type = b.visit_type && (VISIT_TYPES as readonly string[]).includes(b.visit_type) ? b.visit_type : null;
  let selection_type: string | null = null;
  if (visit_type === SELECTION_VISIT_TYPE
      && b.selection_type
      && (SELECTION_TYPES as readonly string[]).includes(b.selection_type)) {
    selection_type = b.selection_type;
  }
  return { visit_type, selection_type };
}

/* ----------------------------------------------------------------- */
/*  List                                                              */
/* ----------------------------------------------------------------- */

visitsRouter.get('/', async (req, res, next) => {
  try {
    const conds: string[] = [];
    const params: any[] = [];
    const clientId = req.query.client_id ? Number(req.query.client_id) : null;
    const statusId = req.query.status_id ? Number(req.query.status_id) : null;
    const from = (req.query.from as string | undefined)?.trim() || null;
    const to   = (req.query.to   as string | undefined)?.trim() || null;
    const upcoming = req.query.upcoming === 'true';
    const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 100)));

    if (clientId) { params.push(clientId); conds.push(`v.client_id = $${params.length}`); }
    if (statusId) { params.push(statusId); conds.push(`v.visit_status_id = $${params.length}`); }
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) { params.push(from); conds.push(`v.visit_date >= $${params.length}::date`); }
    if (to   && /^\d{4}-\d{2}-\d{2}$/.test(to))   { params.push(to);   conds.push(`v.visit_date <= $${params.length}::date`); }
    if (upcoming) conds.push(`v.visit_date >= CURRENT_DATE`);
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    params.push(limit);
    const rows = await query(`
      SELECT
        v.client_visit_id,
        v.client_id,
        v.visit_date,
        v.start_time,
        v.end_time,
        v.visit_mode_id,
        v.visit_status_id,
        v.host_facility_staff_id,
        v.corp_facility_id,
        v.client_provisioning_request_id,
        v.notes,
        v.visit_type,
        v.selection_type,
        v.created_at,
        contact.first_name || ' ' || contact.last_name AS client_name,
        vm.visit_mode,
        vs.visit_status,
        cf.facility_name,
        host_contact.first_name || ' ' || host_contact.last_name AS host_name
      FROM tbl_client_visit v
      JOIN tbl_client c ON c.client_id = v.client_id
      JOIN tbl_contact contact ON contact.contact_id = c.contact_id
      JOIN lkp_visit_mode vm   ON vm.visit_mode_id   = v.visit_mode_id
      JOIN lkp_visit_status vs ON vs.visit_status_id = v.visit_status_id
      LEFT JOIN tbl_corp_facility cf ON cf.corp_facility_id = v.corp_facility_id
      LEFT JOIN tbl_facility_staff host_fs ON host_fs.facility_staff_id = v.host_facility_staff_id
      LEFT JOIN tbl_contact host_contact ON host_contact.contact_id = host_fs.contact_id
      ${where}
      ORDER BY v.visit_date DESC, v.start_time DESC NULLS LAST, v.client_visit_id DESC
      LIMIT $${params.length}
    `, params);

    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Read one                                                          */
/* ----------------------------------------------------------------- */

visitsRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const visit = await queryOne(`
      SELECT
        v.client_visit_id,
        v.client_id,
        v.visit_date,
        v.start_time,
        v.end_time,
        v.visit_mode_id,
        v.visit_status_id,
        v.host_facility_staff_id,
        v.corp_facility_id,
        v.client_provisioning_request_id,
        v.notes,
        v.visit_type,
        v.selection_type,
        v.created_at,
        v.updated_at,
        contact.first_name || ' ' || contact.last_name AS client_name,
        contact.mobile_phone AS client_phone,
        contact.email AS client_email,
        vm.visit_mode,
        vs.visit_status,
        cf.facility_name,
        host_contact.first_name || ' ' || host_contact.last_name AS host_name
      FROM tbl_client_visit v
      JOIN tbl_client c ON c.client_id = v.client_id
      JOIN tbl_contact contact ON contact.contact_id = c.contact_id
      JOIN lkp_visit_mode vm   ON vm.visit_mode_id   = v.visit_mode_id
      JOIN lkp_visit_status vs ON vs.visit_status_id = v.visit_status_id
      LEFT JOIN tbl_corp_facility cf ON cf.corp_facility_id = v.corp_facility_id
      LEFT JOIN tbl_facility_staff host_fs ON host_fs.facility_staff_id = v.host_facility_staff_id
      LEFT JOIN tbl_contact host_contact ON host_contact.contact_id = host_fs.contact_id
      WHERE v.client_visit_id = $1
    `, [id]);

    if (!visit) return res.status(404).json({ error: 'Visit not found' });

    const cur = await queryOne<{ visit_date: string }>(
      `SELECT visit_date FROM tbl_client_visit WHERE client_visit_id = $1`, [id],
    );
    const prev = await queryOne<{ id: number }>(`
      SELECT client_visit_id AS id FROM tbl_client_visit
       WHERE visit_date > $1 OR (visit_date = $1 AND client_visit_id > $2)
       ORDER BY visit_date ASC, client_visit_id ASC LIMIT 1
    `, [cur?.visit_date, id]);
    const next = await queryOne<{ id: number }>(`
      SELECT client_visit_id AS id FROM tbl_client_visit
       WHERE visit_date < $1 OR (visit_date = $1 AND client_visit_id < $2)
       ORDER BY visit_date DESC, client_visit_id DESC LIMIT 1
    `, [cur?.visit_date, id]);

    res.json({ visit, prevId: prev?.id ?? null, nextId: next?.id ?? null });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Create                                                            */
/* ----------------------------------------------------------------- */

visitsRouter.post('/', async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as WritePayload;
    const errs = validate(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    const types = normalizeTypes(body);
    const newId = await withTransaction(async (tx) => {
      const r = await tx.queryOne<Record<string, any>>(`
        INSERT INTO tbl_client_visit
          (client_id, visit_date, start_time, end_time,
           visit_mode_id, visit_status_id, host_facility_staff_id,
           corp_facility_id, client_provisioning_request_id, notes,
           visit_type, selection_type,
           created_by_user_account_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        body.client_id,
        body.visit_date,
        body.start_time || null,
        body.end_time || null,
        body.visit_mode_id,
        body.visit_status_id,
        body.host_facility_staff_id ?? null,
        body.corp_facility_id ?? null,
        body.client_provisioning_request_id ?? null,
        body.notes?.trim() || null,
        types.visit_type,
        types.selection_type,
        req.user!.user_account_id,
      ]);
      await auditCreate(req, 'tbl_client_visit', r!.client_visit_id, r!, tx);
      return r!.client_visit_id as number;
    });
    res.status(201).json({ client_visit_id: newId });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Update                                                            */
/* ----------------------------------------------------------------- */

visitsRouter.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const body = (req.body ?? {}) as WritePayload;
    const errs = validate(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    await withTransaction(async (tx) => {
      const before = await tx.queryOne<Record<string, any>>(
        `SELECT * FROM tbl_client_visit WHERE client_visit_id = $1`, [id],
      );
      if (!before) { const e: any = new Error('Visit not found'); e.status = 404; throw e; }

      const types = normalizeTypes(body);
      const after = await tx.queryOne<Record<string, any>>(`
        UPDATE tbl_client_visit
           SET client_id                      = $1,
               visit_date                     = $2,
               start_time                     = $3,
               end_time                       = $4,
               visit_mode_id                  = $5,
               visit_status_id                = $6,
               host_facility_staff_id         = $7,
               corp_facility_id               = $8,
               client_provisioning_request_id = $9,
               notes                          = $10,
               visit_type                     = $11,
               selection_type                 = $12,
               updated_at                     = NOW()
         WHERE client_visit_id = $13
         RETURNING *
      `, [
        body.client_id,
        body.visit_date,
        body.start_time || null,
        body.end_time || null,
        body.visit_mode_id,
        body.visit_status_id,
        body.host_facility_staff_id ?? null,
        body.corp_facility_id ?? null,
        body.client_provisioning_request_id ?? null,
        body.notes?.trim() || null,
        types.visit_type,
        types.selection_type,
        id,
      ]);
      if (after) await auditUpdate(req, 'tbl_client_visit', id, before, after, tx);
    });
    res.json({ client_visit_id: id });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Delete                                                            */
/* ----------------------------------------------------------------- */

visitsRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    await withTransaction(async (tx) => {
      const before = await tx.queryOne<Record<string, any>>(`SELECT * FROM tbl_client_visit WHERE client_visit_id = $1`, [id]);
      if (!before) { const e: any = new Error('Visit not found'); e.status = 404; throw e; }
      await tx.query(`DELETE FROM tbl_client_visit WHERE client_visit_id = $1`, [id]);
      await auditDelete(req, 'tbl_client_visit', id, before, tx);
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

function validate(b: WritePayload): string[] {
  const errs: string[] = [];
  if (!b?.client_id) errs.push('client_id required');
  if (!b?.visit_date || !/^\d{4}-\d{2}-\d{2}$/.test(b.visit_date)) errs.push('visit_date (YYYY-MM-DD) required');
  if (!b?.visit_mode_id) errs.push('visit_mode_id required');
  if (!b?.visit_status_id) errs.push('visit_status_id required');
  return errs;
}
