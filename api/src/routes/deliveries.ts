import { Router } from 'express';
import { query, queryOne, pool, withTransaction } from '../db/pool.js';
import { auditCreate, auditDelete, auditUpdate } from '../auth/audit.js';

export const deliveriesRouter = Router();

/* ----------------------------------------------------------------- */
/*  Shared shapes                                                     */
/* ----------------------------------------------------------------- */

interface CrewMember {
  delivery_staff_id?: number | null;
  facility_staff_id: number;
  is_team_lead: boolean;
}

interface DeliveryItem {
  delivery_items_id?: number | null;
  corp_facility_inventory_item_id: number;
  loaded_at?: string | null;
}

interface VehicleAssignment {
  delivery_vehicle_id?: number | null;
  delivery_vehicle_type_id: number;
  vehicle_id?: number | null;
  rental_agency_id?: number | null;
  mileage_start?: number | null;
  mileage_end?: number | null;
  fuel_cost?: number | null;
}

interface ContainerAssignment {
  client_delivery_container_id?: number | null;
  storage_location_id: number;
}

interface DeliveryWritePayload {
  client_provisioning_request_id: number;
  facility_staff_id: number;
  delivery_status_id: number;
  delivery_date: string;
  time_arrival_earliest?: string | null;
  time_arrival_latest?: string | null;
  time_delivery_complete?: string | null;
  notes?: string | null;
  gate_code?: string | null;
  // Fulfillment method — Home delivery / Walkout / Container pickup.
  // Optional during edit so existing rows from before this column existed
  // still load and save cleanly.
  fulfillment_method_id?: number | null;
  pickup_deadline?: string | null;
  lock_code?: string | null;
  crew: CrewMember[];
  items: DeliveryItem[];
  vehicle: VehicleAssignment | null;
  containers?: ContainerAssignment[];
}

/* ----------------------------------------------------------------- */
/*  List (unchanged)                                                  */
/* ----------------------------------------------------------------- */

/** GET /api/deliveries — list with date and status filters */
deliveriesRouter.get('/', async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    const upcoming = req.query.upcoming === 'true';

    const conds: string[] = [];
    const params: any[] = [];

    if (status) {
      params.push(status);
      conds.push(`s.delivery_status = $${params.length}`);
    }
    if (upcoming) {
      conds.push(`d.delivery_date >= CURRENT_DATE`);
    }

    const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const rows = await query(`
      SELECT
        d.client_deliveries_id AS delivery_id,
        d.delivery_date,
        d.time_arrival_earliest,
        d.time_arrival_latest,
        d.time_delivery_complete,
        d.fulfillment_method_id,
        d.pickup_deadline,
        d.pickup_code_sent_at,
        s.delivery_status,
        fm.fulfillment_method,
        c.client_id,
        contact.first_name || ' ' || contact.last_name AS client_name,
        addr.address,
        city.city,
        (SELECT COUNT(*)::int FROM tbl_delivery_items di WHERE di.client_deliveries_id = d.client_deliveries_id) AS item_count,
        (SELECT COUNT(*)::int FROM tbl_client_delivery_container cdc WHERE cdc.client_deliveries_id = d.client_deliveries_id) AS container_count,
        lead.first_name || ' ' || lead.last_name AS team_lead,
        v.vehicle_license,
        EXISTS (SELECT 1 FROM tbl_delivery_receipt rec WHERE rec.client_deliveries_id = d.client_deliveries_id) AS has_receipt
      FROM tbl_client_deliveries d
      JOIN lkp_delivery_status s ON s.delivery_status_id = d.delivery_status_id
      JOIN tbl_client_provisioning_request r ON r.client_provisioning_request_id = d.client_provisioning_request_id
      JOIN tbl_client c ON c.client_id = r.client_id
      JOIN tbl_contact contact ON contact.contact_id = c.contact_id
      LEFT JOIN tbl_address addr ON addr.address_id = contact.address_id
      LEFT JOIN lkp_city city ON city.city_id = addr.city_id
      LEFT JOIN tbl_facility_staff lead_fs ON lead_fs.facility_staff_id = d.facility_staff_id
      LEFT JOIN tbl_contact lead ON lead.contact_id = lead_fs.contact_id
      LEFT JOIN tbl_delivery_vehicle dv ON dv.client_deliveries_id = d.client_deliveries_id
      LEFT JOIN tbl_vehicle v ON v.vehicle_id = dv.vehicle_id
      LEFT JOIN lkp_fulfillment_method fm ON fm.fulfillment_method_id = d.fulfillment_method_id
      ${whereSql}
      ORDER BY d.delivery_date DESC, d.time_arrival_earliest
      LIMIT 100
    `, params);

    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Container picker options                                          */
/*  Returns containers + lockboxes (lkp_storage_location flagged      */
/*  is_container_or_lockbox=true) with their facility for display.    */
/*  Declared BEFORE the /:id route so "container-options" doesn't     */
/*  get parsed as a numeric id.                                       */
/* ----------------------------------------------------------------- */

deliveriesRouter.get('/container-options', async (_req, res, next) => {
  try {
    const rows = await query(`
      SELECT
        sl.storage_location_id,
        sl.location_code,
        sl.container_type,
        sl.description,
        sl.corp_facility_id,
        cf.facility_name
      FROM lkp_storage_location sl
      LEFT JOIN tbl_corp_facility cf ON cf.corp_facility_id = sl.corp_facility_id
      WHERE sl.is_container_or_lockbox = true
        AND COALESCE(sl.is_active, true) = true
      ORDER BY cf.facility_name NULLS LAST, sl.container_type NULLS LAST, sl.location_code
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Read one                                                          */
/* ----------------------------------------------------------------- */

/** GET /api/deliveries/:id — full delivery detail + prev/next */
deliveriesRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const delivery = await queryOne(`
      SELECT
        d.client_deliveries_id AS delivery_id,
        d.client_provisioning_request_id,
        d.facility_staff_id,
        d.delivery_status_id,
        d.delivery_date,
        d.time_arrival_earliest,
        d.time_arrival_latest,
        d.time_delivery_complete,
        d.gate_code,
        d.notes,
        d.fulfillment_method_id,
        d.pickup_deadline,
        d.lock_code,
        d.pickup_code_sent_at,
        d.pickup_code_sent_via,
        d.pickup_code_sent_to,
        fm.fulfillment_method,
        s.delivery_status,
        c.client_id,
        contact.first_name || ' ' || contact.last_name AS client_name,
        contact.mobile_phone AS client_phone,
        addr.address,
        addr.address2,
        city.city,
        st.state,
        addr.postalcode,
        r.client_provisioning_request_id AS request_id,
        r.client_request_note,
        scheduler.first_name || ' ' || scheduler.last_name AS scheduler_name,
        dv.delivery_vehicle_id,
        dv.delivery_vehicle_type_id,
        dv.vehicle_id,
        dv.rental_agency_id,
        dv.mileage_start,
        dv.mileage_end,
        dv.fuel_cost,
        v.vehicle_license,
        vt.vehicle_type,
        ra.rental_agency,
        -- Fulfilling facility — manifests use this as the route's origin
        -- so the QR-code Google Maps URL starts from the right warehouse.
        fac.facility_name AS fulfill_facility_name,
        fac_addr.address  AS fulfill_facility_address,
        fac_city.city     AS fulfill_facility_city,
        fac_st.state      AS fulfill_facility_state,
        fac_addr.postalcode AS fulfill_facility_postalcode
      FROM tbl_client_deliveries d
      JOIN lkp_delivery_status s ON s.delivery_status_id = d.delivery_status_id
      JOIN tbl_client_provisioning_request r ON r.client_provisioning_request_id = d.client_provisioning_request_id
      JOIN tbl_client c ON c.client_id = r.client_id
      JOIN tbl_contact contact ON contact.contact_id = c.contact_id
      LEFT JOIN tbl_address addr ON addr.address_id = contact.address_id
      LEFT JOIN lkp_city city ON city.city_id = addr.city_id
      LEFT JOIN lkp_state st ON st.state_id = addr.state_id
      LEFT JOIN tbl_facility_staff scheduler_fs ON scheduler_fs.facility_staff_id = d.facility_staff_id
      LEFT JOIN tbl_contact scheduler ON scheduler.contact_id = scheduler_fs.contact_id
      LEFT JOIN tbl_delivery_vehicle dv ON dv.client_deliveries_id = d.client_deliveries_id
      LEFT JOIN tbl_vehicle v ON v.vehicle_id = dv.vehicle_id
      LEFT JOIN lkp_vehicle_type vt ON vt.vehicle_type_id = v.vehicle_type_id
      LEFT JOIN lkp_rental_agency ra ON ra.rental_agency_id = dv.rental_agency_id
      LEFT JOIN tbl_corp_facility fac ON fac.corp_facility_id = r.fulfillment_corp_facility_id
      LEFT JOIN tbl_address fac_addr ON fac_addr.address_id = fac.address_id
      LEFT JOIN lkp_city fac_city ON fac_city.city_id = fac_addr.city_id
      LEFT JOIN lkp_state fac_st ON fac_st.state_id = fac_addr.state_id
      LEFT JOIN lkp_fulfillment_method fm ON fm.fulfillment_method_id = d.fulfillment_method_id
      WHERE d.client_deliveries_id = $1
    `, [id]);

    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

    const crew = await query(`
      SELECT
        ds.delivery_staff_id,
        ds.is_team_lead,
        fs.facility_staff_id,
        contact.first_name || ' ' || contact.last_name AS name,
        contact.mobile_phone,
        fs.is_volunteer
      FROM tbl_delivery_staff ds
      JOIN tbl_facility_staff fs ON fs.facility_staff_id = ds.facility_staff_id
      JOIN tbl_contact contact ON contact.contact_id = fs.contact_id
      WHERE ds.client_deliveries_id = $1
      ORDER BY ds.is_team_lead DESC
    `, [id]);

    const items = await query(`
      SELECT
        di.delivery_items_id,
        di.corp_facility_inventory_item_id,
        di.loaded_at,
        inv.description,
        cat.item_category,
        sz.item_size,
        cond.item_condition,
        inv.donation_value_in
      FROM tbl_delivery_items di
      JOIN tbl_corp_facility_inventory_item inv ON inv.corp_facility_inventory_item_id = di.corp_facility_inventory_item_id
      JOIN lkp_item_category cat ON cat.item_category_id = inv.item_category_id
      LEFT JOIN lkp_item_size sz ON sz.item_size_id = inv.item_size_id
      LEFT JOIN lkp_item_condition cond ON cond.item_condition_id = inv.item_condition_id
      WHERE di.client_deliveries_id = $1
      ORDER BY di.delivery_items_id
    `, [id]);

    const receipt = await queryOne(`
      SELECT
        delivery_receipt_id,
        signature_photo_url,
        signed_at,
        all_items_received,
        condition_acceptable,
        photo_release_granted,
        recipient_notes
      FROM tbl_delivery_receipt
      WHERE client_deliveries_id = $1
    `, [id]);

    const containers = await query(`
      SELECT
        cdc.client_delivery_container_id,
        cdc.storage_location_id,
        cdc.notes,
        sl.location_code,
        sl.container_type,
        sl.description AS location_description,
        cf.facility_name
      FROM tbl_client_delivery_container cdc
      JOIN lkp_storage_location sl ON sl.storage_location_id = cdc.storage_location_id
      LEFT JOIN tbl_corp_facility cf ON cf.corp_facility_id = sl.corp_facility_id
      WHERE cdc.client_deliveries_id = $1
      ORDER BY cdc.client_delivery_container_id
    `, [id]);

    const cur = await queryOne<{ delivery_date: string }>(
      `SELECT delivery_date FROM tbl_client_deliveries WHERE client_deliveries_id = $1`, [id],
    );
    const prev = await queryOne<{ id: number }>(`
      SELECT client_deliveries_id AS id FROM tbl_client_deliveries
       WHERE delivery_date > $1 OR (delivery_date = $1 AND client_deliveries_id > $2)
       ORDER BY delivery_date ASC, client_deliveries_id ASC LIMIT 1
    `, [cur?.delivery_date, id]);
    const next = await queryOne<{ id: number }>(`
      SELECT client_deliveries_id AS id FROM tbl_client_deliveries
       WHERE delivery_date < $1 OR (delivery_date = $1 AND client_deliveries_id < $2)
       ORDER BY delivery_date DESC, client_deliveries_id DESC LIMIT 1
    `, [cur?.delivery_date, id]);

    res.json({ delivery, crew, items, receipt, containers, prevId: prev?.id ?? null, nextId: next?.id ?? null });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Create                                                            */
/* ----------------------------------------------------------------- */

deliveriesRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body as DeliveryWritePayload;
    const errs = validateWritePayload(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    const newId = await withTransaction(async (tx) => {
      const d = await tx.queryOne<Record<string, any>>(`
        INSERT INTO tbl_client_deliveries
          (client_provisioning_request_id, facility_staff_id, delivery_status_id,
           delivery_date, time_arrival_earliest, time_arrival_latest, time_delivery_complete,
           notes, gate_code, fulfillment_method_id, pickup_deadline, lock_code)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        body.client_provisioning_request_id, body.facility_staff_id, body.delivery_status_id,
        body.delivery_date, body.time_arrival_earliest ?? null, body.time_arrival_latest ?? null,
        body.time_delivery_complete ?? null, body.notes ?? null, body.gate_code ?? null,
        body.fulfillment_method_id ?? null, body.pickup_deadline ?? null, body.lock_code?.trim() || null,
      ]);
      const delId = d!.client_deliveries_id;

      for (const c of body.crew ?? []) {
        await tx.query(`
          INSERT INTO tbl_delivery_staff (client_deliveries_id, facility_staff_id, is_team_lead)
          VALUES ($1, $2, $3)
        `, [delId, c.facility_staff_id, c.is_team_lead ?? false]);
      }
      for (const it of body.items ?? []) {
        await tx.query(`
          INSERT INTO tbl_delivery_items (client_deliveries_id, corp_facility_inventory_item_id, loaded_at)
          VALUES ($1, $2, $3)
        `, [delId, it.corp_facility_inventory_item_id, it.loaded_at ?? null]);
      }
      if (body.vehicle) {
        await tx.query(`
          INSERT INTO tbl_delivery_vehicle
            (client_deliveries_id, delivery_vehicle_type_id, vehicle_id, rental_agency_id,
             mileage_start, mileage_end, fuel_cost)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [delId, body.vehicle.delivery_vehicle_type_id, body.vehicle.vehicle_id ?? null,
            body.vehicle.rental_agency_id ?? null, body.vehicle.mileage_start ?? null,
            body.vehicle.mileage_end ?? null, body.vehicle.fuel_cost ?? null]);
      }
      for (const ct of body.containers ?? []) {
        if (!ct.storage_location_id) continue;
        await tx.query(`
          INSERT INTO tbl_client_delivery_container (client_deliveries_id, storage_location_id)
          VALUES ($1, $2)
          ON CONFLICT (client_deliveries_id, storage_location_id) DO NOTHING
        `, [delId, ct.storage_location_id]);
      }
      await auditCreate(req, 'tbl_client_deliveries', delId, d!, tx);
      return delId;
    });

    res.status(201).json({ delivery_id: newId });
  } catch (err) { next(translatePgError(err)); }
});

/* ----------------------------------------------------------------- */
/*  Update                                                            */
/* ----------------------------------------------------------------- */

deliveriesRouter.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const body = req.body as DeliveryWritePayload;
    const errs = validateWritePayload(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    await withTransaction(async (tx) => {
      const before = await tx.queryOne<Record<string, any>>(
        `SELECT * FROM tbl_client_deliveries WHERE client_deliveries_id = $1`, [id],
      );
      if (!before) throw withStatus(404, 'Delivery not found');

      const after = await tx.queryOne<Record<string, any>>(`
        UPDATE tbl_client_deliveries
           SET client_provisioning_request_id = $1, facility_staff_id = $2, delivery_status_id = $3,
               delivery_date = $4, time_arrival_earliest = $5, time_arrival_latest = $6,
               time_delivery_complete = $7, notes = $8, gate_code = $9,
               fulfillment_method_id = $10, pickup_deadline = $11, lock_code = $12
         WHERE client_deliveries_id = $13
         RETURNING *
      `, [
        body.client_provisioning_request_id, body.facility_staff_id, body.delivery_status_id,
        body.delivery_date, body.time_arrival_earliest ?? null, body.time_arrival_latest ?? null,
        body.time_delivery_complete ?? null, body.notes ?? null, body.gate_code ?? null,
        body.fulfillment_method_id ?? null, body.pickup_deadline ?? null, body.lock_code?.trim() || null,
        id,
      ]);
      if (after) await auditUpdate(req, 'tbl_client_deliveries', id, before, after, tx);

      // Diff containers — replace incoming list, removing rows no longer present.
      const incomingContainerIds = new Set(
        (body.containers ?? []).map(c => c.client_delivery_container_id).filter(Boolean) as number[],
      );
      const existingContainers = await tx.query<{ client_delivery_container_id: number }>(
        `SELECT client_delivery_container_id FROM tbl_client_delivery_container WHERE client_deliveries_id = $1`,
        [id],
      );
      for (const ec of existingContainers) {
        if (!incomingContainerIds.has(ec.client_delivery_container_id)) {
          await tx.query(
            `DELETE FROM tbl_client_delivery_container WHERE client_delivery_container_id = $1`,
            [ec.client_delivery_container_id],
          );
        }
      }
      for (const ct of body.containers ?? []) {
        if (!ct.storage_location_id) continue;
        if (ct.client_delivery_container_id) {
          await tx.query(`
            UPDATE tbl_client_delivery_container
               SET storage_location_id = $1
             WHERE client_delivery_container_id = $2
          `, [ct.storage_location_id, ct.client_delivery_container_id]);
        } else {
          await tx.query(`
            INSERT INTO tbl_client_delivery_container (client_deliveries_id, storage_location_id)
            VALUES ($1, $2)
            ON CONFLICT (client_deliveries_id, storage_location_id) DO NOTHING
          `, [id, ct.storage_location_id]);
        }
      }

      // Diff crew
      const incomingCrewIds = new Set((body.crew ?? []).map(c => c.delivery_staff_id).filter(Boolean) as number[]);
      const existingCrew = await tx.query<{ delivery_staff_id: number }>(
        `SELECT delivery_staff_id FROM tbl_delivery_staff WHERE client_deliveries_id = $1`, [id],
      );
      for (const c of existingCrew) {
        if (!incomingCrewIds.has(c.delivery_staff_id)) {
          await tx.query(`DELETE FROM tbl_delivery_staff WHERE delivery_staff_id = $1`, [c.delivery_staff_id]);
        }
      }
      for (const c of body.crew ?? []) {
        if (c.delivery_staff_id) {
          await tx.query(`
            UPDATE tbl_delivery_staff
               SET facility_staff_id = $1, is_team_lead = $2
             WHERE delivery_staff_id = $3
          `, [c.facility_staff_id, c.is_team_lead ?? false, c.delivery_staff_id]);
        } else {
          await tx.query(`
            INSERT INTO tbl_delivery_staff (client_deliveries_id, facility_staff_id, is_team_lead)
            VALUES ($1, $2, $3)
          `, [id, c.facility_staff_id, c.is_team_lead ?? false]);
        }
      }

      // Diff items
      const incomingItemIds = new Set((body.items ?? []).map(i => i.delivery_items_id).filter(Boolean) as number[]);
      const existingItems = await tx.query<{ delivery_items_id: number }>(
        `SELECT delivery_items_id FROM tbl_delivery_items WHERE client_deliveries_id = $1`, [id],
      );
      for (const r of existingItems) {
        if (!incomingItemIds.has(r.delivery_items_id)) {
          await tx.query(`DELETE FROM tbl_delivery_items WHERE delivery_items_id = $1`, [r.delivery_items_id]);
        }
      }
      for (const it of body.items ?? []) {
        if (it.delivery_items_id) {
          await tx.query(`
            UPDATE tbl_delivery_items
               SET corp_facility_inventory_item_id = $1, loaded_at = $2
             WHERE delivery_items_id = $3
          `, [it.corp_facility_inventory_item_id, it.loaded_at ?? null, it.delivery_items_id]);
        } else {
          await tx.query(`
            INSERT INTO tbl_delivery_items (client_deliveries_id, corp_facility_inventory_item_id, loaded_at)
            VALUES ($1, $2, $3)
          `, [id, it.corp_facility_inventory_item_id, it.loaded_at ?? null]);
        }
      }

      // Vehicle (1:1) — upsert or unlink
      const existingVeh = await tx.queryOne<{ delivery_vehicle_id: number }>(
        `SELECT delivery_vehicle_id FROM tbl_delivery_vehicle WHERE client_deliveries_id = $1`, [id],
      );
      if (body.vehicle === null) {
        if (existingVeh) await tx.query(`DELETE FROM tbl_delivery_vehicle WHERE delivery_vehicle_id = $1`, [existingVeh.delivery_vehicle_id]);
      } else if (body.vehicle) {
        if (existingVeh) {
          await tx.query(`
            UPDATE tbl_delivery_vehicle
               SET delivery_vehicle_type_id = $1, vehicle_id = $2, rental_agency_id = $3,
                   mileage_start = $4, mileage_end = $5, fuel_cost = $6
             WHERE delivery_vehicle_id = $7
          `, [body.vehicle.delivery_vehicle_type_id, body.vehicle.vehicle_id ?? null,
              body.vehicle.rental_agency_id ?? null, body.vehicle.mileage_start ?? null,
              body.vehicle.mileage_end ?? null, body.vehicle.fuel_cost ?? null,
              existingVeh.delivery_vehicle_id]);
        } else {
          await tx.query(`
            INSERT INTO tbl_delivery_vehicle
              (client_deliveries_id, delivery_vehicle_type_id, vehicle_id, rental_agency_id,
               mileage_start, mileage_end, fuel_cost)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [id, body.vehicle.delivery_vehicle_type_id, body.vehicle.vehicle_id ?? null,
              body.vehicle.rental_agency_id ?? null, body.vehicle.mileage_start ?? null,
              body.vehicle.mileage_end ?? null, body.vehicle.fuel_cost ?? null]);
        }
      }
    });

    res.json({ delivery_id: id });
  } catch (err) { next(translatePgError(err)); }
});

/* ----------------------------------------------------------------- */
/*  Delete                                                            */
/* ----------------------------------------------------------------- */

deliveriesRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    await withTransaction(async (tx) => {
      const before = await tx.queryOne<Record<string, any>>(
        `SELECT * FROM tbl_client_deliveries WHERE client_deliveries_id = $1`, [id],
      );
      await tx.query(`DELETE FROM tbl_delivery_staff   WHERE client_deliveries_id = $1`, [id]);
      await tx.query(`DELETE FROM tbl_delivery_items   WHERE client_deliveries_id = $1`, [id]);
      await tx.query(`DELETE FROM tbl_delivery_vehicle WHERE client_deliveries_id = $1`, [id]);
      await tx.query(`DELETE FROM tbl_delivery_receipt WHERE client_deliveries_id = $1`, [id]);
      await tx.query(`DELETE FROM tbl_client_deliveries WHERE client_deliveries_id = $1`, [id]);
      if (before) await auditDelete(req, 'tbl_client_deliveries', id, before, tx);
    });

    res.status(204).end();
  } catch (err) { next(translatePgError(err)); }
});

/* ----------------------------------------------------------------- */
/*  Send container pickup code                                        */
/*  Records that staff notified the client with the shared lock code  */
/*  (via email or phone). For v1 we don't actually call Twilio — we   */
/*  just stamp the audit fields so there's a record of "code shared". */
/* ----------------------------------------------------------------- */

deliveriesRouter.post('/:id/send-pickup-code', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const { via, sent_to } = (req.body ?? {}) as { via?: string; sent_to?: string };
    if (!via || !['email', 'phone', 'sms'].includes(via)) {
      return res.status(400).json({ error: 'via must be one of: email, phone, sms' });
    }
    if (!sent_to || typeof sent_to !== 'string' || sent_to.trim().length === 0) {
      return res.status(400).json({ error: 'sent_to is required (email address or phone number)' });
    }
    await withTransaction(async (tx) => {
      const before = await tx.queryOne<Record<string, any>>(
        `SELECT * FROM tbl_client_deliveries WHERE client_deliveries_id = $1`, [id],
      );
      if (!before) throw withStatus(404, 'Delivery not found');
      if (!before.lock_code) throw withStatus(400, 'No lock code set on this delivery yet.');
      const after = await tx.queryOne<Record<string, any>>(`
        UPDATE tbl_client_deliveries
           SET pickup_code_sent_at  = NOW(),
               pickup_code_sent_via = $1,
               pickup_code_sent_to  = $2
         WHERE client_deliveries_id = $3
         RETURNING *
      `, [via, sent_to.trim(), id]);
      if (after) await auditUpdate(req, 'tbl_client_deliveries', id, before, after, tx);
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Receipt sign-off (preserved)                                      */
/* ----------------------------------------------------------------- */

/**
 * POST /api/deliveries/:id/receipt — record recipient sign-off.
 *
 * In a transaction: insert the receipt, mark the delivery as 'Delivered',
 * fulfill the reservations, and mark inventory items as dispositioned.
 */
deliveriesRouter.post('/:id/receipt', async (req, res, next) => {
  const id = Number(req.params.id);
  const {
    signature_photo_url = null,
    all_items_received,
    condition_acceptable,
    photo_release_granted = false,
    recipient_notes = null,
  } = req.body ?? {};

  if (typeof all_items_received !== 'boolean' || typeof condition_acceptable !== 'boolean') {
    return res.status(400).json({ error: 'all_items_received and condition_acceptable are required booleans' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO tbl_delivery_receipt
        (client_deliveries_id, signature_photo_url, signed_at,
         all_items_received, condition_acceptable, photo_release_granted, recipient_notes)
      VALUES ($1, $2, NOW(), $3, $4, $5, $6)
    `, [id, signature_photo_url, all_items_received, condition_acceptable, photo_release_granted, recipient_notes]);

    await client.query(`
      UPDATE tbl_client_deliveries
         SET delivery_status_id = (SELECT delivery_status_id FROM lkp_delivery_status WHERE delivery_status = 'Delivered'),
             time_delivery_complete = NOW()::time
       WHERE client_deliveries_id = $1
    `, [id]);

    await client.query(`
      UPDATE tbl_corp_facility_inventory_item inv
         SET date_dispositioned = CURRENT_DATE,
             disposition_reason_id = (SELECT disposition_reason_id FROM lkp_disposition_reason WHERE disposition_reason = 'Delivered to client')
       WHERE corp_facility_inventory_item_id IN (
         SELECT corp_facility_inventory_item_id FROM tbl_delivery_items WHERE client_deliveries_id = $1
       )
    `, [id]);

    await client.query(`
      UPDATE tbl_inventory_reservation
         SET reservation_status_id = (SELECT reservation_status_id FROM lkp_reservation_status WHERE reservation_status = 'Fulfilled')
       WHERE corp_facility_inventory_item_id IN (
         SELECT corp_facility_inventory_item_id FROM tbl_delivery_items WHERE client_deliveries_id = $1
       )
    `, [id]);

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

/* ================================================================= */

function validateWritePayload(body: DeliveryWritePayload): string[] {
  const errs: string[] = [];
  if (!body || typeof body !== 'object') return ['Missing body'];
  if (!Number.isInteger(body.client_provisioning_request_id) || body.client_provisioning_request_id <= 0) errs.push('client_provisioning_request_id required');
  if (!Number.isInteger(body.facility_staff_id) || body.facility_staff_id <= 0) errs.push('facility_staff_id required');
  if (!Number.isInteger(body.delivery_status_id) || body.delivery_status_id <= 0) errs.push('delivery_status_id required');
  if (!body.delivery_date) errs.push('delivery_date required');
  if (body.crew && !Array.isArray(body.crew)) errs.push('crew must be an array');
  if (body.items && !Array.isArray(body.items)) errs.push('items must be an array');
  // Ensure at most one team lead
  if (Array.isArray(body.crew)) {
    const leads = body.crew.filter(c => c.is_team_lead).length;
    if (leads > 1) errs.push('only one crew member can be marked Team lead');
  }
  if (body.vehicle && !body.vehicle.delivery_vehicle_type_id) errs.push('vehicle.delivery_vehicle_type_id required');
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
