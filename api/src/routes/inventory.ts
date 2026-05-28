import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditCreate, auditDelete, auditUpdate } from '../auth/audit.js';

export const inventoryRouter = Router();

/** GET /api/inventory — filterable list */
inventoryRouter.get('/', async (req, res, next) => {
  try {
    const category = req.query.category as string | undefined;
    const condition = req.query.condition as string | undefined;
    const facility = req.query.facility as string | undefined;
    const status = (req.query.status as string | undefined) ?? 'available';
    const search = req.query.search as string | undefined;

    const conds: string[] = [];
    const params: any[] = [];

    // Status filtering: available = not reserved, not delivered
    // reserved = has an active reservation
    // out = dispositioned (delivered, sold, etc.)
    if (status === 'available') {
      conds.push(`inv.date_dispositioned IS NULL`);
      conds.push(`NOT EXISTS (
        SELECT 1 FROM tbl_inventory_reservation res
         JOIN lkp_reservation_status rs ON rs.reservation_status_id = res.reservation_status_id
        WHERE res.corp_facility_inventory_item_id = inv.corp_facility_inventory_item_id
          AND rs.reservation_status = 'Active')`);
    } else if (status === 'reserved') {
      conds.push(`inv.date_dispositioned IS NULL`);
      conds.push(`EXISTS (
        SELECT 1 FROM tbl_inventory_reservation res
         JOIN lkp_reservation_status rs ON rs.reservation_status_id = res.reservation_status_id
        WHERE res.corp_facility_inventory_item_id = inv.corp_facility_inventory_item_id
          AND rs.reservation_status = 'Active')`);
    } else if (status === 'out') {
      conds.push(`inv.date_dispositioned IS NOT NULL`);
    }

    if (category) {
      params.push(category);
      conds.push(`cat.item_category = $${params.length}`);
    }
    if (condition) {
      params.push(condition);
      conds.push(`cond.item_condition = $${params.length}`);
    }
    if (facility) {
      params.push(facility);
      conds.push(`f.facility_name = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conds.push(`(inv.description ILIKE $${params.length} OR cat.item_category ILIKE $${params.length})`);
    }

    const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const rows = await query(`
      SELECT
        inv.corp_facility_inventory_item_id AS inv_id,
        inv.description,
        cat.item_category,
        sz.item_size,
        cond.item_condition,
        inv.donation_value_in AS value,
        f.facility_name,
        loc.location_code,
        inv.date_added_to_inventory,
        inv.date_dispositioned,
        CASE
          WHEN inv.date_dispositioned IS NOT NULL THEN 'Out'
          WHEN EXISTS (SELECT 1 FROM tbl_inventory_reservation res
                        JOIN lkp_reservation_status rs ON rs.reservation_status_id = res.reservation_status_id
                       WHERE res.corp_facility_inventory_item_id = inv.corp_facility_inventory_item_id
                         AND rs.reservation_status = 'Active') THEN 'Reserved'
          ELSE 'Available'
        END AS status
      FROM tbl_corp_facility_inventory_item inv
      JOIN lkp_item_category cat ON cat.item_category_id = inv.item_category_id
      LEFT JOIN lkp_item_size sz ON sz.item_size_id = inv.item_size_id
      LEFT JOIN lkp_item_condition cond ON cond.item_condition_id = inv.item_condition_id
      JOIN tbl_corp_facility f ON f.corp_facility_id = inv.corp_facility_id
      LEFT JOIN lkp_storage_location loc ON loc.storage_location_id = inv.storage_location_id
      ${whereSql}
      ORDER BY inv.date_added_to_inventory DESC
      LIMIT 200
    `, params);

    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Read one                                                          */
/* ----------------------------------------------------------------- */

/** GET /api/inventory/:id — full detail with prev/next */
inventoryRouter.get('/:id(\\d+)', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const item = await queryOne(`
      SELECT
        inv.corp_facility_inventory_item_id AS inv_id,
        inv.corp_facility_id,
        inv.donation_item_id,
        inv.storage_location_id,
        inv.item_category_id,
        inv.item_size_id,
        inv.item_weight_id,
        inv.item_condition_id,
        inv.date_added_to_inventory,
        inv.date_dispositioned,
        inv.disposition_reason_id,
        inv.donation_value_in,
        inv.donation_value_out,
        inv.description,
        cat.item_category,
        sz.item_size,
        wt.item_weight,
        cond.item_condition,
        f.facility_name,
        loc.location_code,
        dr.disposition_reason
      FROM tbl_corp_facility_inventory_item inv
      JOIN lkp_item_category cat ON cat.item_category_id = inv.item_category_id
      LEFT JOIN lkp_item_size sz ON sz.item_size_id = inv.item_size_id
      LEFT JOIN lkp_item_weight wt ON wt.item_weight_id = inv.item_weight_id
      LEFT JOIN lkp_item_condition cond ON cond.item_condition_id = inv.item_condition_id
      JOIN tbl_corp_facility f ON f.corp_facility_id = inv.corp_facility_id
      LEFT JOIN lkp_storage_location loc ON loc.storage_location_id = inv.storage_location_id
      LEFT JOIN lkp_disposition_reason dr ON dr.disposition_reason_id = inv.disposition_reason_id
      WHERE inv.corp_facility_inventory_item_id = $1
    `, [id]);

    if (!item) return res.status(404).json({ error: 'Inventory item not found' });

    const reservations = await query(`
      SELECT res.inventory_reservation_id, res.reserved_at, res.expires_at,
             rs.reservation_status,
             contact.first_name || ' ' || contact.last_name AS client_name,
             r.client_provisioning_request_id AS request_id
        FROM tbl_inventory_reservation res
        JOIN lkp_reservation_status rs ON rs.reservation_status_id = res.reservation_status_id
        JOIN tbl_client_provisioning_request r ON r.client_provisioning_request_id = res.client_provisioning_request_id
        JOIN tbl_client c ON c.client_id = r.client_id
        JOIN tbl_contact contact ON contact.contact_id = c.contact_id
       WHERE res.corp_facility_inventory_item_id = $1
       ORDER BY res.reserved_at DESC
    `, [id]);

    const cur = await queryOne<{ date_added_to_inventory: string }>(
      `SELECT date_added_to_inventory FROM tbl_corp_facility_inventory_item WHERE corp_facility_inventory_item_id = $1`, [id],
    );
    const prev = await queryOne<{ id: number }>(`
      SELECT corp_facility_inventory_item_id AS id FROM tbl_corp_facility_inventory_item
       WHERE date_added_to_inventory > $1 OR (date_added_to_inventory = $1 AND corp_facility_inventory_item_id > $2)
       ORDER BY date_added_to_inventory ASC, corp_facility_inventory_item_id ASC LIMIT 1
    `, [cur?.date_added_to_inventory, id]);
    const next = await queryOne<{ id: number }>(`
      SELECT corp_facility_inventory_item_id AS id FROM tbl_corp_facility_inventory_item
       WHERE date_added_to_inventory < $1 OR (date_added_to_inventory = $1 AND corp_facility_inventory_item_id < $2)
       ORDER BY date_added_to_inventory DESC, corp_facility_inventory_item_id DESC LIMIT 1
    `, [cur?.date_added_to_inventory, id]);

    res.json({ item, reservations, prevId: prev?.id ?? null, nextId: next?.id ?? null });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Create / Update / Delete                                          */
/* ----------------------------------------------------------------- */

interface InventoryPayload {
  corp_facility_id: number;
  donation_item_id?: number | null;
  storage_location_id?: number | null;
  item_category_id: number;
  item_size_id: number;
  item_weight_id: number;
  item_condition_id: number;
  date_added_to_inventory: string;
  date_dispositioned?: string | null;
  disposition_reason_id?: number | null;
  donation_value_in: number;
  donation_value_out?: number | null;
  description?: string | null;
}

function validatePayload(b: InventoryPayload): string[] {
  const errs: string[] = [];
  for (const k of ['corp_facility_id','item_category_id','item_size_id','item_weight_id','item_condition_id'] as const) {
    if (!Number.isInteger(b?.[k]) || (b as any)[k] <= 0) errs.push(`${k} required`);
  }
  if (!b?.date_added_to_inventory) errs.push('date_added_to_inventory required');
  if (b?.donation_value_in === undefined || b?.donation_value_in === null || Number.isNaN(Number(b.donation_value_in))) {
    errs.push('donation_value_in required');
  }
  return errs;
}

inventoryRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body as InventoryPayload;
    const errs = validatePayload(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    const r = await queryOne<Record<string, any>>(`
      INSERT INTO tbl_corp_facility_inventory_item
        (corp_facility_id, donation_item_id, storage_location_id,
         item_category_id, item_size_id, item_weight_id, item_condition_id,
         date_added_to_inventory, date_dispositioned, disposition_reason_id,
         donation_value_in, donation_value_out, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      body.corp_facility_id, body.donation_item_id ?? null, body.storage_location_id ?? null,
      body.item_category_id, body.item_size_id, body.item_weight_id, body.item_condition_id,
      body.date_added_to_inventory, body.date_dispositioned ?? null, body.disposition_reason_id ?? null,
      body.donation_value_in, body.donation_value_out ?? null, body.description ?? null,
    ]);
    await auditCreate(req, 'tbl_corp_facility_inventory_item', r!.corp_facility_inventory_item_id, r!);
    res.status(201).json({ inv_id: r!.corp_facility_inventory_item_id });
  } catch (err) { next(translatePgError(err)); }
});

inventoryRouter.put('/:id(\\d+)', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = req.body as InventoryPayload;
    const errs = validatePayload(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    await withTransaction(async (tx) => {
      const before = await tx.queryOne<Record<string, any>>(
        `SELECT * FROM tbl_corp_facility_inventory_item WHERE corp_facility_inventory_item_id = $1`, [id],
      );
      if (!before) throw withStatus(404, 'Inventory item not found');

      const after = await tx.queryOne<Record<string, any>>(`
        UPDATE tbl_corp_facility_inventory_item
           SET corp_facility_id = $1, donation_item_id = $2, storage_location_id = $3,
               item_category_id = $4, item_size_id = $5, item_weight_id = $6, item_condition_id = $7,
               date_added_to_inventory = $8, date_dispositioned = $9, disposition_reason_id = $10,
               donation_value_in = $11, donation_value_out = $12, description = $13
         WHERE corp_facility_inventory_item_id = $14
         RETURNING *
      `, [
        body.corp_facility_id, body.donation_item_id ?? null, body.storage_location_id ?? null,
        body.item_category_id, body.item_size_id, body.item_weight_id, body.item_condition_id,
        body.date_added_to_inventory, body.date_dispositioned ?? null, body.disposition_reason_id ?? null,
        body.donation_value_in, body.donation_value_out ?? null, body.description ?? null,
        id,
      ]);
      if (after) await auditUpdate(req, 'tbl_corp_facility_inventory_item', id, before, after, tx);
    });
    res.json({ inv_id: id });
  } catch (err) { next(translatePgError(err)); }
});

inventoryRouter.delete('/:id(\\d+)', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const before = await queryOne<Record<string, any>>(
      `SELECT * FROM tbl_corp_facility_inventory_item WHERE corp_facility_inventory_item_id = $1`, [id],
    );
    await query(`DELETE FROM tbl_corp_facility_inventory_item WHERE corp_facility_inventory_item_id = $1`, [id]);
    if (before) await auditDelete(req, 'tbl_corp_facility_inventory_item', id, before);
    res.status(204).end();
  } catch (err) { next(translatePgError(err)); }
});

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
      e.message = err.detail ? `This item is referenced elsewhere: ${err.detail.replace(/^Key /, '')}` : 'Referenced by other rows.';
      e.status = 409;
      return e;
    case '23505': e.message = err.detail ?? 'Unique constraint violated.'; e.status = 409; return e;
    case '23502': e.message = `Missing required field: ${err.column ?? 'unknown'}`; e.status = 400; return e;
    default: return err;
  }
}

/** GET /api/inventory/suggestions?category=Bed%20frame — items matching a request category */
inventoryRouter.get('/suggestions', async (req, res, next) => {
  try {
    const category = req.query.category as string;
    if (!category) return res.status(400).json({ error: 'category query required' });

    const rows = await query(`
      SELECT
        inv.corp_facility_inventory_item_id AS inv_id,
        inv.description,
        cat.item_category,
        sz.item_size,
        cond.item_condition,
        inv.donation_value_in AS value,
        f.facility_name,
        loc.location_code
      FROM tbl_corp_facility_inventory_item inv
      JOIN lkp_item_category cat ON cat.item_category_id = inv.item_category_id
      LEFT JOIN lkp_item_size sz ON sz.item_size_id = inv.item_size_id
      LEFT JOIN lkp_item_condition cond ON cond.item_condition_id = inv.item_condition_id
      JOIN tbl_corp_facility f ON f.corp_facility_id = inv.corp_facility_id
      LEFT JOIN lkp_storage_location loc ON loc.storage_location_id = inv.storage_location_id
      WHERE cat.item_category = $1
        AND inv.date_dispositioned IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM tbl_inventory_reservation res
           JOIN lkp_reservation_status rs ON rs.reservation_status_id = res.reservation_status_id
          WHERE res.corp_facility_inventory_item_id = inv.corp_facility_inventory_item_id
            AND rs.reservation_status = 'Active')
      ORDER BY cond.item_condition_id, inv.date_added_to_inventory
      LIMIT 12
    `, [category]);

    res.json(rows);
  } catch (err) { next(err); }
});
