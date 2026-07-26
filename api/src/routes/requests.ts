import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditCreate, auditDelete, auditUpdate } from '../auth/audit.js';

export const requestsRouter = Router();

/* ----------------------------------------------------------------- */
/*  Shared shapes                                                     */
/* ----------------------------------------------------------------- */

interface RequestItemPayload {
  client_request_items_id?: number | null;
  item_name: string;                       // Packing List: free-text item label (required)
  item_category_id?: number | null;        // Optional link to a rate-card category (for valuation)
  item_notes?: string | null;
  quantity: number;                        // Qty requested
  qty_given?: number | null;               // Qty actually pulled/given
  priority?: string | null;
  room?: string | null;                    // Free-text room grouping ("Primary Bedroom", …)
  pulled?: boolean | null;                 // Checked when the item has been pulled from the warehouse
  is_na?: boolean | null;                  // Marked N/A for this household
  is_declined?: boolean | null;            // Household declined this item
  sort_order?: number | null;              // Ordering within its room
}

interface ChildPayload {
  request_child_id?: number | null;
  gender?: string | null;
  age?: number | null;
  notes?: string | null;
}

interface RequestWritePayload {
  client_id: number;
  fulfillment_corp_facility_id: number;
  request_receipt_origin_id: number;
  client_request_creator_facility_staff_id: number;
  client_request_note?: string | null;
  request_at: string; // ISO datetime
  // Recipient demographics (optional) — power the Impact Data "individuals served" report.
  child_count?: number | null;
  adult_female_count?: number | null;
  adult_male_count?: number | null;
  // Packing List extensions (all optional).
  fulfillment_type?: string | null;        // 'delivery' | 'pickup'
  appointment_at?: string | null;          // scheduled delivery/pickup datetime
  trailer_size?: string | null;
  crew_size?: number | null;
  loading_notes?: string | null;
  residence_type?: string | null;
  delivery_logistics_notes?: string | null;
  situation_notes?: string | null;
  situation_tags?: string | null;          // comma-separated situation chips
  internal_notes?: string | null;          // staff-only
  household_type?: string | null;          // 'individual' | 'family'
  referral_id?: number | null;             // links this list to an approved agency referral
  children?: ChildPayload[];
  items: RequestItemPayload[];
}

/* ----------------------------------------------------------------- */
/*  List                                                              */
/* ----------------------------------------------------------------- */

/* ----------------------------------------------------------------- */
/*  Triage queue — agency-submitted requests awaiting staff review    */
/* ----------------------------------------------------------------- */

/** GET /api/requests/review-queue — all requests awaiting staff review,
 *  ordered oldest first so nothing sits forgotten. */
requestsRouter.get('/review-queue', async (req, res, next) => {
  try {
    const rows = await query(`
      SELECT
        r.client_provisioning_request_id AS request_id,
        r.request_at,
        r.client_request_note,
        r.client_id,
        contact.first_name || ' ' || contact.last_name AS client_name,
        ag.agency_name,
        rc.first_name || ' ' || rc.last_name AS caseworker_name,
        ref.referral_date,
        (SELECT COUNT(*)::int FROM tbl_client_request_items i WHERE i.client_provisioning_request_id = r.client_provisioning_request_id) AS item_count
      FROM tbl_client_provisioning_request r
      JOIN tbl_client c          ON c.client_id = r.client_id
      JOIN tbl_contact contact   ON contact.contact_id = c.contact_id
      LEFT JOIN tbl_referral ref ON ref.referral_id = r.referral_id
      LEFT JOIN tbl_agency_contact ac ON ac.agency_contact_id = ref.agency_contact_id
      LEFT JOIN tbl_agency ag    ON ag.agency_id = ac.agency_id
      LEFT JOIN tbl_contact rc   ON rc.contact_id = ac.contact_id
      WHERE r.review_status = 'awaiting_review'
      ORDER BY r.request_at ASC
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

/** POST /api/requests/:id/approve — flip a request from awaiting_review to approved. */
requestsRouter.post('/:id/approve', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    await withTransaction(async (tx) => {
      const before = await tx.queryOne<Record<string, any>>(
        `SELECT * FROM tbl_client_provisioning_request WHERE client_provisioning_request_id = $1`, [id],
      );
      if (!before) throw withStatus(404, 'Request not found');
      if (before.review_status !== 'awaiting_review') {
        throw withStatus(409, `Cannot approve — current status is "${before.review_status}"`);
      }
      const after = await tx.queryOne<Record<string, any>>(`
        UPDATE tbl_client_provisioning_request
           SET review_status = 'approved'
         WHERE client_provisioning_request_id = $1
         RETURNING *
      `, [id]);
      if (after) await auditUpdate(req, 'tbl_client_provisioning_request', id, before, after, tx);
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/** POST /api/requests/:id/reject — flip to rejected; appends optional note. */
requestsRouter.post('/:id/reject', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const note = String(req.body?.note ?? '').trim();

    await withTransaction(async (tx) => {
      const before = await tx.queryOne<Record<string, any>>(
        `SELECT * FROM tbl_client_provisioning_request WHERE client_provisioning_request_id = $1`, [id],
      );
      if (!before) throw withStatus(404, 'Request not found');
      if (before.review_status !== 'awaiting_review') {
        throw withStatus(409, `Cannot reject — current status is "${before.review_status}"`);
      }
      const stamped = note
        ? `[Rejected ${new Date().toISOString().slice(0, 10)}] ${note}\n\n${before.client_request_note ?? ''}`.trim()
        : before.client_request_note;
      const after = await tx.queryOne<Record<string, any>>(`
        UPDATE tbl_client_provisioning_request
           SET review_status = 'rejected',
               client_request_note = $2
         WHERE client_provisioning_request_id = $1
         RETURNING *
      `, [id, stamped]);
      if (after) await auditUpdate(req, 'tbl_client_provisioning_request', id, before, after, tx);
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/** GET /api/requests — list, optionally filtered to one client */
requestsRouter.get('/', async (req, res, next) => {
  try {
    const params: any[] = [];
    let where = '';
    const clientId = req.query.client_id ? Number(req.query.client_id) : null;
    if (clientId && Number.isInteger(clientId) && clientId > 0) {
      params.push(clientId);
      where = `WHERE r.client_id = $${params.length}`;
    }
    const rows = await query(`
      SELECT
        r.client_provisioning_request_id AS request_id,
        r.reference_code,
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
      ${where}
      ORDER BY r.request_at DESC
    `, params);
    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Packing-list template — default rooms + items for a new list      */
/* ----------------------------------------------------------------- */

/** GET /api/requests/template — the standard 3-bed / 3-bath checklist,
 *  grouped by room, used to pre-populate a new Packing List. */
requestsRouter.get('/template', async (_req, res, next) => {
  try {
    const rooms = await query<{ packing_template_room_id: number; room_name: string; sort_order: number }>(`
      SELECT packing_template_room_id, room_name, sort_order
        FROM tbl_packing_template_room
       WHERE is_active
       ORDER BY sort_order, room_name
    `);
    const items = await query<{
      packing_template_item_id: number; packing_template_room_id: number;
      item_name: string; default_qty: number | null; item_category_id: number | null; sort_order: number;
    }>(`
      SELECT packing_template_item_id, packing_template_room_id, item_name,
             default_qty, item_category_id, sort_order
        FROM tbl_packing_template_item
       WHERE is_active
       ORDER BY sort_order, item_name
    `);
    const byRoom = rooms.map(room => ({
      room_name: room.room_name,
      sort_order: room.sort_order,
      items: items
        .filter(i => i.packing_template_room_id === room.packing_template_room_id)
        .map(i => ({
          item_name: i.item_name,
          default_qty: i.default_qty ?? 1,
          item_category_id: i.item_category_id,
          sort_order: i.sort_order,
        })),
    }));
    res.json({ rooms: byRoom });
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
        r.reference_code,
        r.client_id,
        r.referral_id,
        r.client_request_note,
        r.request_at,
        r.fulfillment_corp_facility_id,
        r.request_receipt_origin_id,
        r.client_request_creator_facility_staff_id,
        r.child_count,
        r.adult_female_count,
        r.adult_male_count,
        r.fulfillment_type,
        r.appointment_at,
        r.trailer_size,
        r.crew_size,
        r.loading_notes,
        r.residence_type,
        r.delivery_logistics_notes,
        r.situation_notes,
        r.situation_tags,
        r.internal_notes,
        r.household_type,
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
        i.item_name,
        i.item_category_id,
        i.item_notes,
        i.quantity,
        i.qty_given,
        i.priority,
        i.room,
        i.pulled,
        i.is_na,
        i.is_declined,
        i.sort_order,
        cat.item_category,
        (SELECT COUNT(*)::int FROM tbl_inventory_reservation res
           JOIN tbl_corp_facility_inventory_item inv
             ON inv.corp_facility_inventory_item_id = res.corp_facility_inventory_item_id
          WHERE res.client_provisioning_request_id = i.client_provisioning_request_id
            AND i.item_category_id IS NOT NULL
            AND inv.item_category_id = i.item_category_id) AS matched_qty
      FROM tbl_client_request_items i
      LEFT JOIN lkp_item_category cat ON cat.item_category_id = i.item_category_id
      WHERE i.client_provisioning_request_id = $1
      ORDER BY i.sort_order NULLS LAST, i.client_request_items_id
    `, [id]);

    const children = await query(`
      SELECT request_child_id, gender, age, notes
        FROM tbl_request_child
       WHERE client_provisioning_request_id = $1
       ORDER BY request_child_id
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
    res.json({ request, items, children, matches, prevId, nextId });
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
           request_receipt_origin_id, client_request_creator_facility_staff_id, request_at,
           child_count, adult_female_count, adult_male_count,
           fulfillment_type, appointment_at, trailer_size, crew_size, loading_notes,
           residence_type, delivery_logistics_notes, situation_notes, situation_tags,
           internal_notes, household_type, referral_id,
           reference_code)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
                $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
                'FH-' || LPAD(nextval('seq_packing_list_ref')::text, 6, '0'))
        RETURNING *
      `, [
        body.client_id, body.client_request_note ?? null, body.fulfillment_corp_facility_id,
        body.request_receipt_origin_id, body.client_request_creator_facility_staff_id, body.request_at,
        intOrNull(body.child_count), intOrNull(body.adult_female_count), intOrNull(body.adult_male_count),
        body.fulfillment_type ?? null, body.appointment_at ?? null, body.trailer_size ?? null,
        intOrNull(body.crew_size), body.loading_notes ?? null, body.residence_type ?? null,
        body.delivery_logistics_notes ?? null, body.situation_notes ?? null, body.situation_tags ?? null,
        body.internal_notes ?? null, body.household_type ?? null, intOrNull(body.referral_id),
      ]);

      await insertChildren(tx, r!.client_provisioning_request_id, body.children);
      await insertItems(tx, r!.client_provisioning_request_id, body.items, body.request_at);

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
               request_at = $6, child_count = $7, adult_female_count = $8, adult_male_count = $9,
               fulfillment_type = $10, appointment_at = $11, trailer_size = $12, crew_size = $13,
               loading_notes = $14, residence_type = $15, delivery_logistics_notes = $16,
               situation_notes = $17, situation_tags = $18, internal_notes = $19, household_type = $20,
               referral_id = $21
         WHERE client_provisioning_request_id = $22
         RETURNING *
      `, [
        body.client_id, body.client_request_note ?? null, body.fulfillment_corp_facility_id,
        body.request_receipt_origin_id, body.client_request_creator_facility_staff_id, body.request_at,
        intOrNull(body.child_count), intOrNull(body.adult_female_count), intOrNull(body.adult_male_count),
        body.fulfillment_type ?? null, body.appointment_at ?? null, body.trailer_size ?? null,
        intOrNull(body.crew_size), body.loading_notes ?? null, body.residence_type ?? null,
        body.delivery_logistics_notes ?? null, body.situation_notes ?? null, body.situation_tags ?? null,
        body.internal_notes ?? null, body.household_type ?? null, intOrNull(body.referral_id), id,
      ]);
      if (after) await auditUpdate(req, 'tbl_client_provisioning_request', id, before, after, tx);

      // Children: replace-all (small list, no stable client-side identity needed).
      await tx.query(`DELETE FROM tbl_request_child WHERE client_provisioning_request_id = $1`, [id]);
      await insertChildren(tx, id, body.children);

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
      let order = 0;
      for (const item of body.items ?? []) {
        const sort = item.sort_order ?? order++;
        if (item.client_request_items_id) {
          await tx.query(`
            UPDATE tbl_client_request_items
               SET item_name = $1, item_category_id = $2, item_notes = $3, quantity = $4,
                   qty_given = $5, priority = $6, room = $7, pulled = $8,
                   is_na = $9, is_declined = $10, sort_order = $11
             WHERE client_request_items_id = $12
          `, [item.item_name, intOrNull(item.item_category_id), item.item_notes ?? null, item.quantity,
              intOrNull(item.qty_given), item.priority ?? null, item.room ?? null, !!item.pulled,
              !!item.is_na, !!item.is_declined, sort, item.client_request_items_id]);
        } else {
          await tx.query(`
            INSERT INTO tbl_client_request_items
              (client_provisioning_request_id, item_name, item_category_id, item_notes, quantity,
               qty_given, priority, room, pulled, is_na, is_declined, sort_order, time_stamp)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          `, [id, item.item_name, intOrNull(item.item_category_id), item.item_notes ?? null, item.quantity,
              intOrNull(item.qty_given), item.priority ?? null, item.room ?? null, !!item.pulled,
              !!item.is_na, !!item.is_declined, sort, body.request_at]);
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

/** Insert per-child demographic rows for a request. */
async function insertChildren(tx: any, requestId: number, children?: ChildPayload[]): Promise<void> {
  for (const child of children ?? []) {
    await tx.query(`
      INSERT INTO tbl_request_child (client_provisioning_request_id, gender, age, notes)
      VALUES ($1, $2, $3, $4)
    `, [requestId, child.gender ?? null, intOrNull(child.age), child.notes ?? null]);
  }
}

/** Insert packing-list line items (used by create; update diffs inline). */
async function insertItems(tx: any, requestId: number, items: RequestItemPayload[] | undefined, requestAt: string): Promise<void> {
  let order = 0;
  for (const item of items ?? []) {
    const sort = item.sort_order ?? order++;
    await tx.query(`
      INSERT INTO tbl_client_request_items
        (client_provisioning_request_id, item_name, item_category_id, item_notes, quantity,
         qty_given, priority, room, pulled, is_na, is_declined, sort_order, time_stamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [requestId, item.item_name, intOrNull(item.item_category_id), item.item_notes ?? null, item.quantity,
        intOrNull(item.qty_given), item.priority ?? null, item.room ?? null, !!item.pulled,
        !!item.is_na, !!item.is_declined, sort, requestAt]);
  }
}

/** Coerce an optional numeric-ish demographic field to an integer or null. */
function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
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
    if (!item.item_name || typeof item.item_name !== 'string' || !item.item_name.trim()) {
      errs.push('every item needs an item name');
      break;
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 0) {
      errs.push('every item needs a non-negative quantity');
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
