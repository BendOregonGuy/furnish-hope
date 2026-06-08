/**
 * Vendor directory — suppliers, trades-people (plumber/electrician/etc),
 * service providers, professionals. Operational records only:
 *   - Who they are (contact info, business name, specialty)
 *   - Compliance flags (W-9 received, COI expiry)
 *   - Notes + service history + attached documents
 *
 * Bills / payments / 1099s stay in QuickBooks (the books of record).
 * We do NOT mirror invoices here; that would create a dual-write
 * problem with QBO. See docs/ARCHITECTURE notes for the boundary.
 *
 *   GET    /api/vendors                 list with search + filters
 *   GET    /api/vendors/:id             detail (vendor + contact + prev/next)
 *   POST   /api/vendors                 atomic create (contact + vendor)
 *   PUT    /api/vendors/:id             update
 *   DELETE /api/vendors/:id             delete (vendor row; contact stays)
 */

import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditCreate, auditDelete, auditUpdate } from '../auth/audit.js';

export const vendorsRouter = Router();

/* ----------------------------------------------------------------- */
/*  Shared shapes                                                     */
/* ----------------------------------------------------------------- */

interface ContactWrite {
  first_name: string;
  last_name: string;
  email?: string | null;
  mobile_phone?: string | null;
  home_phone?: string | null;
  other_phone?: string | null;
  address_id?: number | null;
}

interface VendorWrite {
  vendor_type_id: number;
  vendor_specialty_id?: number | null;
  business_name?: string | null;
  w9_received?: boolean;
  w9_received_date?: string | null;
  coi_received?: boolean;
  coi_expires_at?: string | null;
  default_hourly_rate?: number | string | null;
  payment_terms?: string | null;
  tax_id?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

interface VendorCreatePayload {
  contact: ContactWrite;
  vendor: VendorWrite;
}

interface VendorUpdatePayload {
  contact: Partial<ContactWrite> & { contact_id?: number };
  vendor: VendorWrite;
}

/* ----------------------------------------------------------------- */
/*  List                                                              */
/* ----------------------------------------------------------------- */

vendorsRouter.get('/', async (req, res, next) => {
  try {
    const search = (req.query.search as string | undefined) || null;
    const typeId = req.query.type_id ? Number(req.query.type_id) : null;
    const specialtyId = req.query.specialty_id ? Number(req.query.specialty_id) : null;
    const activeOnly = req.query.active_only === '1' || req.query.active_only === 'true';

    const conds: string[] = [];
    const params: any[] = [];
    if (search) {
      params.push(`%${search}%`);
      conds.push(`(
        c.first_name ILIKE $${params.length}
        OR c.last_name ILIKE $${params.length}
        OR c.email ILIKE $${params.length}
        OR v.business_name ILIKE $${params.length}
      )`);
    }
    if (typeId)      { params.push(typeId);      conds.push(`v.vendor_type_id = $${params.length}`); }
    if (specialtyId) { params.push(specialtyId); conds.push(`v.vendor_specialty_id = $${params.length}`); }
    if (activeOnly)  { conds.push(`v.is_active = true`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const rows = await query(`
      SELECT
        v.vendor_id,
        v.business_name,
        v.is_active,
        v.w9_received,
        v.w9_received_date,
        v.coi_received,
        v.coi_expires_at,
        v.payment_terms,
        v.default_hourly_rate,
        vt.vendor_type,
        vs.vendor_specialty,
        c.contact_id,
        c.first_name,
        c.last_name,
        c.email,
        c.mobile_phone,
        c.home_phone
      FROM tbl_vendor v
      JOIN tbl_contact c ON c.contact_id = v.contact_id
      JOIN lkp_vendor_type vt ON vt.vendor_type_id = v.vendor_type_id
      LEFT JOIN lkp_vendor_specialty vs ON vs.vendor_specialty_id = v.vendor_specialty_id
      ${where}
      ORDER BY v.is_active DESC, COALESCE(v.business_name, c.last_name || ', ' || c.first_name) ASC
    `, params);

    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Detail                                                            */
/* ----------------------------------------------------------------- */

vendorsRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const row = await queryOne(`
      SELECT
        v.*,
        vt.vendor_type,
        vs.vendor_specialty,
        c.first_name,
        c.middle_name,
        c.last_name,
        c.email,
        c.mobile_phone,
        c.home_phone,
        c.other_phone,
        c.address_id
      FROM tbl_vendor v
      JOIN tbl_contact c ON c.contact_id = v.contact_id
      JOIN lkp_vendor_type vt ON vt.vendor_type_id = v.vendor_type_id
      LEFT JOIN lkp_vendor_specialty vs ON vs.vendor_specialty_id = v.vendor_specialty_id
      WHERE v.vendor_id = $1
    `, [id]);
    if (!row) return res.status(404).json({ error: 'Vendor not found' });

    // prev / next within the same active-status grouping so paging
    // through the list-page order works naturally.
    const neighbors = await queryOne<{ prev_id: number | null; next_id: number | null }>(`
      WITH ordered AS (
        SELECT
          v.vendor_id,
          LAG(v.vendor_id)  OVER (ORDER BY v.is_active DESC, COALESCE(v.business_name, c.last_name || ', ' || c.first_name)) AS prev_id,
          LEAD(v.vendor_id) OVER (ORDER BY v.is_active DESC, COALESCE(v.business_name, c.last_name || ', ' || c.first_name)) AS next_id
        FROM tbl_vendor v
        JOIN tbl_contact c ON c.contact_id = v.contact_id
      )
      SELECT prev_id, next_id FROM ordered WHERE vendor_id = $1
    `, [id]);

    res.json({
      vendor: row,
      prevId: neighbors?.prev_id ?? null,
      nextId: neighbors?.next_id ?? null,
    });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Create — atomic contact + vendor                                  */
/* ----------------------------------------------------------------- */

vendorsRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body as VendorCreatePayload;
    const errs = validateCreate(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    const newId = await withTransaction(async (tx) => {
      // 1) Contact. Vendors use a generic contact_type — find or
      //    seed "Vendor" in lkp_contact_type.
      const ct = await tx.queryOne<{ contact_type_id: number }>(
        `SELECT contact_type_id FROM lkp_contact_type WHERE contact_type ILIKE 'Vendor' LIMIT 1`,
      ) ?? await tx.queryOne<{ contact_type_id: number }>(`
        INSERT INTO lkp_contact_type (contact_type, description)
        VALUES ('Vendor', 'Supplier, trades-person, or service provider.')
        RETURNING contact_type_id
      `);

      const c = await tx.queryOne<{ contact_id: number }>(`
        INSERT INTO tbl_contact
          (contact_type_id, first_name, last_name, email, mobile_phone, home_phone, other_phone, address_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING contact_id
      `, [
        ct!.contact_type_id,
        body.contact.first_name.trim(),
        body.contact.last_name.trim(),
        body.contact.email?.trim() || null,
        body.contact.mobile_phone?.trim() || null,
        body.contact.home_phone?.trim() || null,
        body.contact.other_phone?.trim() || null,
        body.contact.address_id ?? null,
      ]);

      // 2) Vendor
      const v = await tx.queryOne<{ vendor_id: number }>(`
        INSERT INTO tbl_vendor
          (contact_id, vendor_type_id, vendor_specialty_id, business_name,
           w9_received, w9_received_date, coi_received, coi_expires_at,
           default_hourly_rate, payment_terms, tax_id, notes, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING vendor_id
      `, [
        c!.contact_id,
        body.vendor.vendor_type_id,
        body.vendor.vendor_specialty_id ?? null,
        body.vendor.business_name?.trim() || null,
        body.vendor.w9_received ?? false,
        body.vendor.w9_received_date || null,
        body.vendor.coi_received ?? false,
        body.vendor.coi_expires_at || null,
        body.vendor.default_hourly_rate || null,
        body.vendor.payment_terms?.trim() || null,
        body.vendor.tax_id?.trim() || null,
        body.vendor.notes?.trim() || null,
        body.vendor.is_active ?? true,
      ]);

      await auditCreate(req, 'tbl_vendor', v!.vendor_id, { ...body.vendor, contact_id: c!.contact_id }, tx);
      return v!.vendor_id;
    });

    res.status(201).json({ vendor_id: newId });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Update                                                            */
/* ----------------------------------------------------------------- */

vendorsRouter.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const body = req.body as VendorUpdatePayload;

    await withTransaction(async (tx) => {
      const before = await tx.queryOne<any>(
        `SELECT v.*, c.first_name, c.last_name, c.email, c.mobile_phone
           FROM tbl_vendor v JOIN tbl_contact c ON c.contact_id = v.contact_id
          WHERE v.vendor_id = $1`,
        [id],
      );
      if (!before) {
        const e: any = new Error('Vendor not found'); e.status = 404; throw e;
      }

      // Update contact fields when caller passes them.
      if (body.contact) {
        await tx.query(`
          UPDATE tbl_contact
             SET first_name   = COALESCE($1, first_name),
                 last_name    = COALESCE($2, last_name),
                 email        = $3,
                 mobile_phone = $4,
                 home_phone   = $5,
                 other_phone  = $6
           WHERE contact_id = $7
        `, [
          body.contact.first_name?.trim() ?? null,
          body.contact.last_name?.trim() ?? null,
          body.contact.email?.trim() || null,
          body.contact.mobile_phone?.trim() || null,
          body.contact.home_phone?.trim() || null,
          body.contact.other_phone?.trim() || null,
          before.contact_id,
        ]);
      }

      const after = await tx.queryOne<any>(`
        UPDATE tbl_vendor
           SET vendor_type_id      = $1,
               vendor_specialty_id = $2,
               business_name       = $3,
               w9_received         = $4,
               w9_received_date    = $5,
               coi_received        = $6,
               coi_expires_at      = $7,
               default_hourly_rate = $8,
               payment_terms       = $9,
               tax_id              = $10,
               notes               = $11,
               is_active           = $12,
               updated_at          = NOW()
         WHERE vendor_id = $13
         RETURNING *
      `, [
        body.vendor.vendor_type_id,
        body.vendor.vendor_specialty_id ?? null,
        body.vendor.business_name?.trim() || null,
        body.vendor.w9_received ?? false,
        body.vendor.w9_received_date || null,
        body.vendor.coi_received ?? false,
        body.vendor.coi_expires_at || null,
        body.vendor.default_hourly_rate || null,
        body.vendor.payment_terms?.trim() || null,
        body.vendor.tax_id?.trim() || null,
        body.vendor.notes?.trim() || null,
        body.vendor.is_active ?? true,
        id,
      ]);
      if (after) await auditUpdate(req, 'tbl_vendor', id, before, after, tx);
    });

    res.json({ vendor_id: id });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Delete                                                            */
/*  Deletes the vendor row only; leaves the underlying contact in     */
/*  place since it might be referenced elsewhere.                     */
/* ----------------------------------------------------------------- */

vendorsRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    await withTransaction(async (tx) => {
      const before = await tx.queryOne<any>(`SELECT * FROM tbl_vendor WHERE vendor_id = $1`, [id]);
      if (!before) { const e: any = new Error('Vendor not found'); e.status = 404; throw e; }
      await tx.query(`DELETE FROM tbl_vendor WHERE vendor_id = $1`, [id]);
      await auditDelete(req, 'tbl_vendor', id, before, tx);
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Validation                                                        */
/* ----------------------------------------------------------------- */

function validateCreate(b: VendorCreatePayload): string[] {
  const errs: string[] = [];
  if (!b?.contact?.first_name?.trim()) errs.push('Contact first_name required');
  if (!b?.contact?.last_name?.trim())  errs.push('Contact last_name required');
  if (!b?.vendor?.vendor_type_id)      errs.push('Vendor type required');
  return errs;
}
