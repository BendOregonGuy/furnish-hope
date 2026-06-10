/**
 * Vendor service log — operational journal of what each vendor did,
 * when, where, and what we authorized them to charge. Pre-accounting:
 * cost_estimate here is an authorization/expectation, not a bill.
 * Actual bills + payments are tracked in QuickBooks.
 *
 * Use cases:
 *   - "Have we called this plumber before? What did they fix?"
 *   - "What's the electrician doing tomorrow?" → scheduled entries
 *   - "How much have we authorized for HVAC repairs this year?"
 *   - Cross-check incoming QBO bills against what we authorized
 *
 *   GET    /api/vendor-services                list (filter by vendor / status / date)
 *   POST   /api/vendor-services                create
 *   PUT    /api/vendor-services/:id            update
 *   DELETE /api/vendor-services/:id            delete
 */

import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditCreate, auditDelete, auditUpdate } from '../auth/audit.js';

export const vendorServicesRouter = Router();

interface WritePayload {
  vendor_id: number;
  service_date: string;
  start_time?: string | null;
  end_time?: string | null;
  location_text?: string | null;
  corp_facility_id?: number | null;
  description: string;
  cost_estimate?: number | string | null;
  vendor_service_status_id: number;
  notes?: string | null;
}

/* ----------------------------------------------------------------- */
/*  List                                                              */
/*                                                                    */
/*  Filters:                                                          */
/*    vendor_id=<int>      — only entries for one vendor              */
/*    status_id=<int>      — only entries in that status              */
/*    from=YYYY-MM-DD      — service_date >= from                     */
/*    to=YYYY-MM-DD        — service_date <= to                       */
/*    limit (default 50, max 500)                                     */
/* ----------------------------------------------------------------- */

vendorServicesRouter.get('/', async (req, res, next) => {
  try {
    const conds: string[] = [];
    const params: any[] = [];
    const vendorId = req.query.vendor_id ? Number(req.query.vendor_id) : null;
    const statusId = req.query.status_id ? Number(req.query.status_id) : null;
    const from = (req.query.from as string | undefined)?.trim() || null;
    const to   = (req.query.to   as string | undefined)?.trim() || null;
    const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 50)));

    if (vendorId) { params.push(vendorId); conds.push(`s.vendor_id = $${params.length}`); }
    if (statusId) { params.push(statusId); conds.push(`s.vendor_service_status_id = $${params.length}`); }
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) { params.push(from); conds.push(`s.service_date >= $${params.length}::date`); }
    if (to   && /^\d{4}-\d{2}-\d{2}$/.test(to))   { params.push(to);   conds.push(`s.service_date <= $${params.length}::date`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    params.push(limit);
    const rows = await query(`
      SELECT
        s.vendor_service_id,
        s.vendor_id,
        s.service_date,
        s.start_time,
        s.end_time,
        s.location_text,
        s.corp_facility_id,
        s.description,
        s.cost_estimate,
        s.vendor_service_status_id,
        s.notes,
        s.created_at,
        s.updated_at,
        ss.vendor_service_status AS status,
        v.business_name,
        v.vendor_specialty_id,
        vs.vendor_specialty,
        c.first_name || ' ' || c.last_name AS contact_name,
        cf.facility_name AS facility_name,
        u.username AS logged_by
      FROM tbl_vendor_service s
      JOIN lkp_vendor_service_status ss ON ss.vendor_service_status_id = s.vendor_service_status_id
      JOIN tbl_vendor v       ON v.vendor_id = s.vendor_id
      JOIN tbl_contact c      ON c.contact_id = v.contact_id
      LEFT JOIN lkp_vendor_specialty vs ON vs.vendor_specialty_id = v.vendor_specialty_id
      LEFT JOIN tbl_corp_facility cf    ON cf.corp_facility_id = s.corp_facility_id
      LEFT JOIN tbl_user_account u      ON u.user_account_id = s.created_by_user_account_id
      ${where}
      ORDER BY s.service_date DESC, s.vendor_service_id DESC
      LIMIT $${params.length}
    `, params);

    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Create                                                            */
/* ----------------------------------------------------------------- */

vendorServicesRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body as WritePayload;
    const errs = validate(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    const newId = await withTransaction(async (tx) => {
      const r = await tx.queryOne<{ vendor_service_id: number }>(`
        INSERT INTO tbl_vendor_service
          (vendor_id, service_date, start_time, end_time,
           location_text, corp_facility_id, description,
           cost_estimate, vendor_service_status_id, notes,
           created_by_user_account_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING vendor_service_id
      `, [
        body.vendor_id,
        body.service_date,
        body.start_time || null,
        body.end_time || null,
        body.location_text?.trim() || null,
        body.corp_facility_id ?? null,
        body.description.trim(),
        body.cost_estimate || null,
        body.vendor_service_status_id,
        body.notes?.trim() || null,
        req.user!.user_account_id,
      ]);
      await auditCreate(req, 'tbl_vendor_service', r!.vendor_service_id, body, tx);
      return r!.vendor_service_id;
    });
    res.status(201).json({ vendor_service_id: newId });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Update                                                            */
/* ----------------------------------------------------------------- */

vendorServicesRouter.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const body = req.body as WritePayload;
    const errs = validate(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    await withTransaction(async (tx) => {
      const before = await tx.queryOne<any>(
        `SELECT * FROM tbl_vendor_service WHERE vendor_service_id = $1`,
        [id],
      );
      if (!before) { const e: any = new Error('Service log entry not found'); e.status = 404; throw e; }

      const after = await tx.queryOne<any>(`
        UPDATE tbl_vendor_service
           SET vendor_id                = $1,
               service_date             = $2,
               start_time               = $3,
               end_time                 = $4,
               location_text            = $5,
               corp_facility_id         = $6,
               description              = $7,
               cost_estimate            = $8,
               vendor_service_status_id = $9,
               notes                    = $10,
               updated_at               = NOW()
         WHERE vendor_service_id = $11
         RETURNING *
      `, [
        body.vendor_id,
        body.service_date,
        body.start_time || null,
        body.end_time || null,
        body.location_text?.trim() || null,
        body.corp_facility_id ?? null,
        body.description.trim(),
        body.cost_estimate || null,
        body.vendor_service_status_id,
        body.notes?.trim() || null,
        id,
      ]);
      if (after) await auditUpdate(req, 'tbl_vendor_service', id, before, after, tx);
    });
    res.json({ vendor_service_id: id });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Delete                                                            */
/* ----------------------------------------------------------------- */

vendorServicesRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    await withTransaction(async (tx) => {
      const before = await tx.queryOne<any>(`SELECT * FROM tbl_vendor_service WHERE vendor_service_id = $1`, [id]);
      if (!before) { const e: any = new Error('Service log entry not found'); e.status = 404; throw e; }
      await tx.query(`DELETE FROM tbl_vendor_service WHERE vendor_service_id = $1`, [id]);
      await auditDelete(req, 'tbl_vendor_service', id, before, tx);
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

function validate(b: WritePayload): string[] {
  const errs: string[] = [];
  if (!b?.vendor_id) errs.push('vendor_id required');
  if (!b?.service_date || !/^\d{4}-\d{2}-\d{2}$/.test(b.service_date)) errs.push('service_date (YYYY-MM-DD) required');
  if (!b?.description?.trim()) errs.push('description required');
  if (!b?.vendor_service_status_id) errs.push('vendor_service_status_id required');
  return errs;
}
