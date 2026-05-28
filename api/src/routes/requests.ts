import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditCreate, auditDelete, auditUpdate } from '../auth/audit.js';

export const requestsRouter = Router();

/* ----------------------------------------------------------------- */
/*  Shared shapes                                                     */
/* ----------------------------------------------------------------- */

interface RequestItemPayload {
  client_request_items_id?: number | null;
  item_category_id: number;
  item_notes?: string | null;
  quantity: number;
  priority?: string | null;
}

interface RequestWritePayload {
  client_id: number;
  fulfillment_corp_facility_id: number;
  request_receipt_origin_id: number;
  client_request_creator_facility_staff_id: number;
  client_request_note?: string | null;
  request_at: string; // ISO datetime
  items: RequestItemPayload[];
}

/* ----------------------------------------------------------------- */
/*  List                                                              */
/* ----------------------------------------------------------------- */

/** GET /api/requests — list */
requestsRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await query(`
      SELECT
        r.client_provisioning_request_id AS request_id,
        r.request_at,
        c.client_id,
        contact.first_name || ' ' || contact.last_name AS client_name,
        ct.client_type,
        (SELECT COUNT(*)::int FROM tbl_client_request_items i WHERE i.client_provisioning_request_id = r.client_provisioning_request_id) AS item_count,
        (SELECT COUNT(*)::int FROM tbl_inventory_reservation res WHERE res.client_provisioning_request_id = r.client_provisioning_request_id) AS matched_count
      FROM tbl_client_provisioning_request r
      JOIN tbl_client c ON c.client_id = r.client_id
      JOIN tbl_contact contact ON contact.contact_id = c.contact_id
      JOIN lkp_client_type ct ON ct.client_type_id = c.client_type_id
      ORDER BY r.request_at DESC
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Read one                                                          */
/* ----------------------------------------------------------------- */

/** GET /api/requests/:id — detail with items + matches + prev/next */
requestsRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const request = await queryOne(`
      SELECT
        r.client_provisioning_request_id AS request_id,
        r.client_id,
        r.client_request_note,
        r.request_at,
        r.fulfillment_corp_facility_id,
        r.request_receipt_origin_id,
        r.client_request_creator_facility_staff_id,
        contact.first_name || ' ' || contact.last_name AS client_name,
        ct.client_type,
        addr.address,
        city.city,
        ag.agency_name,
        f.facility_name AS fulfillment_facility,
        (SELECT COALESCE(SUM(inv.donation_value_in), 0)::int
           FROM tbl_inventory_reservation res
           JOIN tbl_corp_facility_inventory_item inv
             ON inv.corp_facility_inventory_item_id = res.corp_facility_inventory_item_id
          WHERE res.client_provisioning_request_id = r.client_provisioning_request_id) AS reserved_value
      FROM tbl_client_provisioning_request r
      JOIN tbl_client c ON c.client_id = r.client_id
      JOIN tbl_contact contact ON contact.contact_id = c.contact_id
      JOIN lkp_client_type ct ON ct.client_type_id = c.client_type_id
      LEFT JOIN tbl_address addr ON addr.address_id = contact.address_id
      LEFT JOIN lkp_city city ON city.city_id = addr.city_id
      LEFT JOIN tbl_referral ref ON ref.client_id = c.client_id
      LEFT JOIN tbl_agency_contact acn ON acn.agency_contact_id = ref.agency_contact_id
      LEFT JOIN tbl_agency ag ON ag.agency_id = acn.agency_id
      JOIN tbl_corp_facility f ON f.corp_facility_id = r.fulfillment_corp_facility_id
      WHERE r.client_provisioning_request_id = $1
    `, [id]);

    if (!request) return res.status(404).json({ error: 'Request not found' });

    const items = await query(`
      SELECT
        i.client_request_items_id,
        i.client_provisioning_request_id,
        i.item_category_id,
        i.item_notes,
        i.quantity,
        i.priority,
        cat.item_category,
        (SELECT COUNT(*)::int FROM tbl_inventory_reservation res
           JOIN tbl_corp_facility_inventory_item inv
             ON inv.corp_facility_inventory_item_id = res.corp_facility_inventory_item_id
          WHERE res.client_provisioning_request_id = i.client_provisioning_request_id
            AND inv.item_category_id = i.item_category_id) AS matched_qty
      FROM tbl_client_request_items i
      JOIN lkp_item_category cat ON cat.item_category_id = i.item_category_id
      WHERE i.client_provisioning_request_id = $1
      ORDER BY i.client_request_items_id
    `, [id]);

    const matches = await query(`
      SELECT
        res.inventory_reservation_id,
        inv.corp_facility_inventory_item_id AS inv_item_id,
        inv.description,
        cat.item_category,
        cond.item_condition,
        inv.donation_value_in,
        f.facility_name,
        loc.location_code,
        rs.reservation_status,
        res.reserved_at
      FROM tbl_inventory_reservation res
      JOIN tbl_corp_facility_inventory_item inv ON inv.corp_facility_inventory_item_id = res.corp_facility_inventory_item_id
      JOIN lkp_item_category cat ON cat.item_category_id = inv.item_category_id
      LEFT JOIN lkp_item_condition cond ON cond.item_condition_id = inv.item_condition_id
      JOIN tbl_corp_facility f ON f.corp_facility_id = inv.corp_facility_id
      LEFT JOIN lkp_storage_location loc ON loc.storage_location_id = inv.storage_location_id
      JOIN lkp_reservation_status rs ON rs.reservation_status_id = res.reservation_status_id
      WHERE res.client_provisioning_request_id = $1
      ORDER BY res.reserved_at
    `, [id]);

    const { prevId, nextId } = await neighborIds(id);
    res.json({ request, items, matches, prevId, nextId });
  } catch (err) { next(err); }
});

/** Prev/next by request_at DESC (matches list order). */
async function neighborIds(currentId: number): Promise<{ prevId: number | null; nextId: number | null }> {
  const cur = await queryOne<{ request_at: string }>(
    `SELECT request_at FROM tbl_client_provisioning_request WHERE client_provisioning_request_id = $1`, [currentId],
  );
  if (!cur) return { prevId: null, nextId: null };

  const prev = await queryOne<{ id: number }>(`
    SELECT client_provisioning_request_id AS id FROM tbl_client_provisioning_request
     WHERE request_at > $1 OR (request_at = $1 AND client_provisioning_request_id > $2)
     ORDER BY request_at ASC, client_provisioning_request_id ASC LIMIT 1
  `, [cur.request_at, currentId]);
  const next = await queryOne<{ id: number }>(`
    SELECT client_provisioning_request_id AS id FROM tbl_client_provisioning_request
     WHERE request_at < $1 OR (request_at = $1 AND client_provisioning_request_id < $2)
     ORDER BY request_at DESC, client_provisioning_request_id DESC LIMIT 1
  `, [cur.request_at, currentId]);

  return { prevId: prev?.id ?? null, nextId: next?.id ?? null };
}

/* ----------------------------------------------------------------- */
/*  Create                                                            */
/* ----------------------------------------------------------------- */

/** POST /api/requests — create a provisioning request + its items. */
requestsRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body as RequestWritePayload;
    const errs = validateWritePayload(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    const newId = await withTransaction(async (tx) => {
      const r = await tx.queryOne<Record<string, any>>(`
        INSERT INTO tbl_client_provisioning_request
          (client_id, client_request_note, fulfillment_corp_facility_id,
           request_receipt_origin_id, client_request_creator_facility_staff_id, request_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        body.client_id, body.client_request_note ?? null, body.fulfillment_corp_facility_id,
        body.request_receipt_origin_id, body.client_request_creator_facility_staff_id, body.request_at,
      ]);

      for (const item of body.items ?? []) {
        await tx.query(`
          INSERT INTO tbl_client_request_items
            (client_provisioning_request_id, item_category_id, item_notes, quantity, priority, time_stamp)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [r!.client_provisioning_request_id, item.item_category_id, item.item_notes ?? null,
            item.quantity, item.priority ?? null, body.request_at]);
      }
      await auditCreate(req, 'tbl_client_provisioning_request', r!.client_provisioning_request_id, r!, tx);
      return r!.client_provisioning_request_id;
    });

    res.status(201).json({ request_id: newId });
  } catch (err) {
    next(translatePgError(err));
  }
});

/* ----------------------------------------------------------------- */
/*  Update                                                            */
/* ----------------------------------------------------------------- */

/** PUT /api/requests/:id — update request + diff its items (insert new,
 *  update existing, delete missing). */
requestsRouter.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const body = req.body as RequestWritePayload;
    const errs = validateWritePayload(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    await withTransaction(async (tx) => {
      const before = await tx.queryOne<Record<string, any>>(
        `SELECT * FROM tbl_client_provisioning_request WHERE client_provisioning_request_id = $1`, [id],
      );
      if (!before) throw withStatus(404, 'Request not found');

      const after = await tx.queryOne<Record<string, any>>(`
        UPDATE tbl_client_provisioning_request
           SET client_id = $1, client_request_note = $2, fulfillment_corp_facility_id = $3,
               request_receipt_origin_id = $4, client_request_creator_facility_staff_id = $5,
               request_at = $6
         WHERE client_provisioning_request_id = $7
         RETURNING *
      `, [
        body.client_id, body.client_request_note ?? null, body.fulfillment_corp_facility_id,
        body.request_receipt_origin_id, body.client_request_creator_facility_staff_id, body.request_at, id,
      ]);
      if (after) await auditUpdate(req, 'tbl_client_provisioning_request', id, before, after, tx);

      // Items diff: collect incoming IDs; delete rows whose ID isn't in the
      // incoming set; update existing; insert new.
      const incomingIds = new Set<number>();
      for (const item of body.items ?? []) {
        if (item.client_request_items_id) incomingIds.add(item.client_request_items_id);
      }
      const existing = await tx.query<{ client_request_items_id: number }>(
        `SELECT client_request_items_id FROM tbl_client_request_items WHERE client_provisioning_request_id = $1`, [id],
      );
      for (const row of existing) {
        if (!incomingIds.has(row.client_request_items_id)) {
          await tx.query(`DELETE FROM tbl_client_request_items WHERE client_request_items_id = $1`, [row.client_request_items_id]);
        }
      }
      for (const item of body.items ?? []) {
        if (item.client_request_items_id) {
          await tx.query(`
            UPDATE tbl_client_request_items
               SET item_category_id = $1, item_notes = $2, quantity = $3, priority = $4
             WHERE client_request_items_id = $5
          `, [item.item_category_id, item.item_notes ?? null, item.quantity, item.priority ?? null, item.client_request_items_id]);
        } else {
          await tx.query(`
            INSERT INTO tbl_client_request_items
              (client_provisioning_request_id, item_category_id, item_notes, quantity, priority, time_stamp)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [id, item.item_category_id, item.item_notes ?? null, item.quantity, item.priority ?? null, body.request_at]);
        }
      }
    });

    res.json({ request_id: id });
  } catch (err) {
    next(translatePgError(err));
  }
});

/* ----------------------------------------------------------------- */
/*  Delete                                                            */
/* ----------------------------------------------------------------- */

/** DELETE /api/requests/:id — remove the request and its items. Fails 409
 *  if reservations/deliveries reference it. */
requestsRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    await withTransaction(async (tx) => {
      const before = await tx.queryOne<Record<string, any>>(
        `SELECT * FROM tbl_client_provisioning_request WHERE client_provisioning_request_id = $1`, [id],
      );
      await tx.query(`DELETE FROM tbl_client_request_items WHERE client_provisioning_request_id = $1`, [id]);
      await tx.query(`DELETE FROM tbl_client_provisioning_request WHERE client_provisioning_request_id = $1`, [id]);
      if (before) await auditDelete(req, 'tbl_client_provisioning_request', id, before, tx);
    });

    res.status(204).end();
  } catch (err) {
    next(translatePgError(err));
  }
});

/* ================================================================= */
/*  Helpers                                                           */
/* ================================================================= */

function withStatus(status: number, message: string): Error {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

function validateWritePayload(body: RequestWritePayload): string[] {
  const errs: string[] = [];
  if (!body || typeof body !== 'object') return ['Missing body'];
  if (!Number.isInteger(body.client_id) || body.client_id <= 0) errs.push('client_id required');
  if (!Number.isInteger(body.fulfillment_corp_facility_id) || body.fulfillment_corp_facility_id <= 0) errs.push('fulfillment_corp_facility_id required');
  if (!Number.isInteger(body.request_receipt_origin_id) || body.request_receipt_origin_id <= 0) errs.push('request_receipt_origin_id required');
  if (!Number.isInteger(body.client_request_creator_facility_staff_id) || body.client_request_creator_facility_staff_id <= 0) errs.push('client_request_creator_facility_staff_id required');
  if (!body.request_at) errs.push('request_at required');
  if (!Array.isArray(body.items)) errs.push('items must be an array');
  else for (const item of body.items) {
    if (!Number.isInteger(item.item_category_id) || item.item_category_id <= 0) {
      errs.push('every item needs item_category_id');
      break;
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      errs.push('every item needs a positive quantity');
      break;
    }
  }
  return errs;
}

function translatePgError(err: any): any {
  if (!err || !err.code) return err;
  const e: any = new Error(err.message);
  switch (err.code) {
    case '23503':
      e.message = err.detail
        ? `This request is referenced elsewhere: ${err.detail.replace(/^Key /, '')}`
        : 'This request is referenced by other rows and cannot be deleted.';
      e.status = 409;
      return e;
    case '23505':
      e.message = err.detail ?? 'Unique constraint violated.';
      e.status = 409;
      return e;
    case '23502':
      e.message = `Missing required field: ${err.column ?? 'unknown'}`;
      e.status = 400;
      return e;
    default:
      return err;
  }
}
