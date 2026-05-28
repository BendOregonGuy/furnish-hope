import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditCreate, auditDelete, auditUpdate } from '../auth/audit.js';

export const clientsRouter = Router();

/* ----------------------------------------------------------------- */
/*  Shared shapes                                                     */
/* ----------------------------------------------------------------- */

interface ContactPayload {
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  birth_date?: string | null;
  gender_id?: number | null;
  ethnicity_id?: number | null;
  citizen_status_id?: number | null;
  mobile_phone?: string | null;
  home_phone?: string | null;
  other_phone?: string | null;
  email?: string | null;
}

interface AddressPayload {
  address_name: string;
  address_type_id: number;
  address: string;
  address2?: string | null;
  city_id: number;
  county_id: number;
  state_id: number;
  postalcode: string;
}

interface ClientPayload {
  client_type_id: number;
  client_status_id: number;
  start_date?: string | null;
  description?: string | null;
}

interface ClientWritePayload {
  contact: ContactPayload;
  address?: AddressPayload | null;   // null/omitted = no address; PUT also accepts "remove"
  client: ClientPayload;
}

/* ----------------------------------------------------------------- */
/*  List                                                              */
/* ----------------------------------------------------------------- */

/** GET /api/clients — list with filters */
clientsRouter.get('/', async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    const type = req.query.type as string | undefined;
    const search = req.query.search as string | undefined;

    const conds: string[] = [];
    const params: any[] = [];
    if (status) {
      params.push(status);
      conds.push(`s.client_status = $${params.length}`);
    }
    if (type) {
      params.push(type);
      conds.push(`ct.client_type = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conds.push(`(contact.first_name ILIKE $${params.length} OR contact.last_name ILIKE $${params.length})`);
    }
    const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const rows = await query(`
      SELECT
        c.client_id,
        contact.first_name,
        contact.last_name,
        contact.mobile_phone,
        ct.client_type,
        s.client_status,
        c.start_date,
        ag.agency_name AS referring_agency
      FROM tbl_client c
      JOIN tbl_contact contact ON contact.contact_id = c.contact_id
      JOIN lkp_client_type ct ON ct.client_type_id = c.client_type_id
      JOIN lkp_client_status s ON s.client_status_id = c.client_status_id
      LEFT JOIN tbl_referral ref ON ref.client_id = c.client_id
      LEFT JOIN tbl_agency_contact acn ON acn.agency_contact_id = ref.agency_contact_id
      LEFT JOIN tbl_agency ag ON ag.agency_id = acn.agency_id
      ${whereSql}
      ORDER BY c.start_date DESC NULLS LAST, c.client_id DESC
      LIMIT 200
    `, params);
    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Read one (with neighbors for prev/next nav)                       */
/* ----------------------------------------------------------------- */

/** GET /api/clients/:id — full detail */
clientsRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const client = await queryOne(`
      SELECT
        c.client_id,
        contact.contact_id,
        contact.first_name,
        contact.middle_name,
        contact.last_name,
        contact.birth_date,
        contact.mobile_phone,
        contact.home_phone,
        contact.other_phone,
        contact.email,
        contact.gender_id,
        contact.ethnicity_id,
        contact.citizen_status_id,
        g.gender,
        e.ethnicity,
        cs.citizen_status,
        c.client_type_id,
        c.client_status_id,
        ct.client_type,
        s.client_status,
        c.start_date,
        c.description,
        addr.address_id,
        addr.address_name,
        addr.address_type_id,
        addr.address,
        addr.address2,
        addr.city_id,
        addr.county_id,
        addr.state_id,
        addr.postalcode,
        city.city,
        county.county,
        st.state,
        ag.agency_name AS referring_agency,
        ref_contact.first_name || ' ' || ref_contact.last_name AS referring_caseworker
      FROM tbl_client c
      JOIN tbl_contact contact ON contact.contact_id = c.contact_id
      LEFT JOIN lkp_gender g ON g.gender_id = contact.gender_id
      LEFT JOIN lkp_ethnicity e ON e.ethnicity_id = contact.ethnicity_id
      LEFT JOIN lkp_citizen_status cs ON cs.citizen_status_id = contact.citizen_status_id
      JOIN lkp_client_type ct ON ct.client_type_id = c.client_type_id
      JOIN lkp_client_status s ON s.client_status_id = c.client_status_id
      LEFT JOIN tbl_address addr ON addr.address_id = contact.address_id
      LEFT JOIN lkp_city city ON city.city_id = addr.city_id
      LEFT JOIN lkp_county county ON county.county_id = addr.county_id
      LEFT JOIN lkp_state st ON st.state_id = addr.state_id
      LEFT JOIN tbl_referral ref ON ref.client_id = c.client_id
      LEFT JOIN tbl_agency_contact acn ON acn.agency_contact_id = ref.agency_contact_id
      LEFT JOIN tbl_agency ag ON ag.agency_id = acn.agency_id
      LEFT JOIN tbl_contact ref_contact ON ref_contact.contact_id = acn.contact_id
      WHERE c.client_id = $1
    `, [id]);

    if (!client) return res.status(404).json({ error: 'Client not found' });

    const requests = await query(`
      SELECT
        r.client_provisioning_request_id AS request_id,
        r.request_at,
        r.client_request_note,
        (SELECT COUNT(*)::int FROM tbl_client_request_items i WHERE i.client_provisioning_request_id = r.client_provisioning_request_id) AS item_count,
        (SELECT COUNT(*)::int FROM tbl_inventory_reservation res WHERE res.client_provisioning_request_id = r.client_provisioning_request_id) AS matched_count
      FROM tbl_client_provisioning_request r
      WHERE r.client_id = $1
      ORDER BY r.request_at DESC
    `, [id]);

    const { prevId, nextId } = await neighborIds(id);

    res.json({ client, requests, prevId, nextId });
  } catch (err) { next(err); }
});

/** Prev/next client_id in the default list sort (start_date DESC, client_id DESC). */
async function neighborIds(currentId: number): Promise<{ prevId: number | null; nextId: number | null }> {
  // We use the same sort as the list view: start_date DESC, client_id DESC.
  // "Previous" in that order means a row that appears above the current —
  // i.e. a higher start_date (or same date but higher client_id).
  const cur = await queryOne<{ start_date: string | null; client_id: number }>(
    `SELECT start_date, client_id FROM tbl_client WHERE client_id = $1`,
    [currentId],
  );
  if (!cur) return { prevId: null, nextId: null };

  const prev = await queryOne<{ id: number }>(`
    SELECT client_id AS id FROM tbl_client
     WHERE (COALESCE(start_date, '0001-01-01') > COALESCE($1::date, '0001-01-01'))
        OR (COALESCE(start_date, '0001-01-01') = COALESCE($1::date, '0001-01-01') AND client_id > $2)
     ORDER BY COALESCE(start_date, '0001-01-01') ASC, client_id ASC
     LIMIT 1
  `, [cur.start_date, cur.client_id]);

  const next = await queryOne<{ id: number }>(`
    SELECT client_id AS id FROM tbl_client
     WHERE (COALESCE(start_date, '0001-01-01') < COALESCE($1::date, '0001-01-01'))
        OR (COALESCE(start_date, '0001-01-01') = COALESCE($1::date, '0001-01-01') AND client_id < $2)
     ORDER BY COALESCE(start_date, '0001-01-01') DESC, client_id DESC
     LIMIT 1
  `, [cur.start_date, cur.client_id]);

  return { prevId: prev?.id ?? null, nextId: next?.id ?? null };
}

/* ----------------------------------------------------------------- */
/*  Create                                                            */
/* ----------------------------------------------------------------- */

/** POST /api/clients — create a new client (contact + optional address + client row). */
clientsRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body as ClientWritePayload;
    const errs = validateWritePayload(body, /*isCreate*/ true);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    const newId = await withTransaction(async (tx) => {
      // 1. Address (optional)
      let addressId: number | null = null;
      if (body.address) {
        const a = await tx.queryOne<{ address_id: number }>(`
          INSERT INTO tbl_address (address_name, address_type_id, address, address2, city_id, county_id, state_id, postalcode)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING address_id
        `, [
          body.address.address_name, body.address.address_type_id,
          body.address.address, body.address.address2 ?? null,
          body.address.city_id, body.address.county_id, body.address.state_id, body.address.postalcode,
        ]);
        addressId = a!.address_id;
      }

      // 2. Contact (contact_type_id = 1 = "Client" per seed)
      const contact = await tx.queryOne<{ contact_id: number }>(`
        INSERT INTO tbl_contact
          (contact_type_id, first_name, middle_name, last_name, gender_id, ethnicity_id,
           birth_date, citizen_status_id, address_id, mobile_phone, home_phone, other_phone, email)
        VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING contact_id
      `, [
        body.contact.first_name, body.contact.middle_name ?? null, body.contact.last_name,
        body.contact.gender_id ?? null, body.contact.ethnicity_id ?? null,
        body.contact.birth_date ?? null, body.contact.citizen_status_id ?? null,
        addressId,
        body.contact.mobile_phone ?? null, body.contact.home_phone ?? null,
        body.contact.other_phone ?? null, body.contact.email ?? null,
      ]);

      // 3. Client
      const client = await tx.queryOne<Record<string, any>>(`
        INSERT INTO tbl_client (client_type_id, contact_id, start_date, client_status_id, description)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [
        body.client.client_type_id, contact!.contact_id,
        body.client.start_date ?? null, body.client.client_status_id,
        body.client.description ?? null,
      ]);

      await auditCreate(req, 'tbl_client', client!.client_id, client!, tx);
      return client!.client_id;
    });

    res.status(201).json({ client_id: newId });
  } catch (err) {
    next(translatePgError(err));
  }
});

/* ----------------------------------------------------------------- */
/*  Update                                                            */
/* ----------------------------------------------------------------- */

/**
 * PUT /api/clients/:id — update an existing client. Updates contact in place;
 * for the address, behaves as follows:
 *   - body.address present + contact already has an address_id → UPDATE that row
 *   - body.address present + contact has no address yet         → INSERT new
 *   - body.address === null and contact has address_id          → unlink (set
 *     contact.address_id = null; leaves the old row in place since it may
 *     be referenced elsewhere)
 *   - body.address omitted                                      → leave alone
 */
clientsRouter.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const body = req.body as ClientWritePayload;
    const errs = validateWritePayload(body, /*isCreate*/ false);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    await withTransaction(async (tx) => {
      const existing = await tx.queryOne<{ contact_id: number; address_id: number | null }>(`
        SELECT c.contact_id, contact.address_id
          FROM tbl_client c
          JOIN tbl_contact contact ON contact.contact_id = c.contact_id
         WHERE c.client_id = $1
      `, [id]);
      if (!existing) throw withStatus(404, 'Client not found');

      const before = await tx.queryOne<Record<string, any>>(`SELECT * FROM tbl_client WHERE client_id = $1`, [id]);

      // 1. Address branches
      let nextAddressId: number | null = existing.address_id;
      const addressIncluded = Object.prototype.hasOwnProperty.call(body, 'address');
      if (addressIncluded) {
        if (body.address === null) {
          // Unlink address from contact; leave the row in place.
          nextAddressId = null;
        } else if (body.address) {
          if (existing.address_id) {
            await tx.query(`
              UPDATE tbl_address
                 SET address_name = $1, address_type_id = $2, address = $3, address2 = $4,
                     city_id = $5, county_id = $6, state_id = $7, postalcode = $8
               WHERE address_id = $9
            `, [
              body.address.address_name, body.address.address_type_id,
              body.address.address, body.address.address2 ?? null,
              body.address.city_id, body.address.county_id, body.address.state_id, body.address.postalcode,
              existing.address_id,
            ]);
          } else {
            const a = await tx.queryOne<{ address_id: number }>(`
              INSERT INTO tbl_address (address_name, address_type_id, address, address2, city_id, county_id, state_id, postalcode)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              RETURNING address_id
            `, [
              body.address.address_name, body.address.address_type_id,
              body.address.address, body.address.address2 ?? null,
              body.address.city_id, body.address.county_id, body.address.state_id, body.address.postalcode,
            ]);
            nextAddressId = a!.address_id;
          }
        }
      }

      // 2. Contact
      await tx.query(`
        UPDATE tbl_contact
           SET first_name = $1, middle_name = $2, last_name = $3,
               gender_id = $4, ethnicity_id = $5,
               birth_date = $6, citizen_status_id = $7,
               address_id = $8,
               mobile_phone = $9, home_phone = $10, other_phone = $11, email = $12
         WHERE contact_id = $13
      `, [
        body.contact.first_name, body.contact.middle_name ?? null, body.contact.last_name,
        body.contact.gender_id ?? null, body.contact.ethnicity_id ?? null,
        body.contact.birth_date ?? null, body.contact.citizen_status_id ?? null,
        nextAddressId,
        body.contact.mobile_phone ?? null, body.contact.home_phone ?? null,
        body.contact.other_phone ?? null, body.contact.email ?? null,
        existing.contact_id,
      ]);

      // 3. Client
      const after = await tx.queryOne<Record<string, any>>(`
        UPDATE tbl_client
           SET client_type_id = $1, start_date = $2, client_status_id = $3, description = $4
         WHERE client_id = $5
         RETURNING *
      `, [
        body.client.client_type_id, body.client.start_date ?? null,
        body.client.client_status_id, body.client.description ?? null,
        id,
      ]);
      if (before && after) await auditUpdate(req, 'tbl_client', id, before, after, tx);
    });

    res.json({ client_id: id });
  } catch (err) {
    next(translatePgError(err));
  }
});

/* ----------------------------------------------------------------- */
/*  Delete                                                            */
/* ----------------------------------------------------------------- */

/**
 * DELETE /api/clients/:id — removes the client row and (if no longer used)
 * the linked contact + address. Postgres FK errors surface as 409 with a
 * helpful message.
 */
clientsRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    await withTransaction(async (tx) => {
      const existing = await tx.queryOne<{ contact_id: number; address_id: number | null }>(`
        SELECT c.contact_id, contact.address_id
          FROM tbl_client c
          JOIN tbl_contact contact ON contact.contact_id = c.contact_id
         WHERE c.client_id = $1
      `, [id]);
      if (!existing) throw withStatus(404, 'Client not found');

      const before = await tx.queryOne<Record<string, any>>(`SELECT * FROM tbl_client WHERE client_id = $1`, [id]);

      // Delete the client row first. Will throw 23503 if any FK references
      // it (provisioning requests, referrals, etc.) — translatePgError turns
      // that into a friendly 409.
      await tx.query(`DELETE FROM tbl_client WHERE client_id = $1`, [id]);
      await auditDelete(req, 'tbl_client', id, before, tx);

      // Try to clean up the contact + address if they're not referenced
      // elsewhere. We swallow FK violations on these because the user said
      // "delete the client", not "force-delete everything connected".
      try {
        await tx.query(`DELETE FROM tbl_contact WHERE contact_id = $1`, [existing.contact_id]);
        if (existing.address_id) {
          await tx.query(`DELETE FROM tbl_address WHERE address_id = $1`, [existing.address_id]);
        }
      } catch (e: any) {
        if (e?.code !== '23503') throw e;
        // Otherwise: contact/address is shared with something else; leave it.
      }
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

/** Lightweight server-side validation. The client validates too, but this
 *  is the defense-in-depth layer. */
function validateWritePayload(body: ClientWritePayload, _isCreate: boolean): string[] {
  const errs: string[] = [];
  if (!body || typeof body !== 'object') return ['Missing body'];
  if (!body.contact) errs.push('contact required');
  if (!body.client) errs.push('client required');
  if (body.contact) {
    if (!body.contact.first_name?.trim()) errs.push('contact.first_name required');
    if (!body.contact.last_name?.trim()) errs.push('contact.last_name required');
  }
  if (body.client) {
    if (!Number.isInteger(body.client.client_type_id) || body.client.client_type_id <= 0) {
      errs.push('client.client_type_id required');
    }
    if (!Number.isInteger(body.client.client_status_id) || body.client.client_status_id <= 0) {
      errs.push('client.client_status_id required');
    }
  }
  if (body.address) {
    if (!body.address.address?.trim()) errs.push('address.address required');
    if (!body.address.address_name?.trim()) errs.push('address.address_name required');
    if (!Number.isInteger(body.address.city_id) || body.address.city_id <= 0) errs.push('address.city_id required');
    if (!Number.isInteger(body.address.county_id) || body.address.county_id <= 0) errs.push('address.county_id required');
    if (!Number.isInteger(body.address.state_id) || body.address.state_id <= 0) errs.push('address.state_id required');
    if (!Number.isInteger(body.address.address_type_id) || body.address.address_type_id <= 0) errs.push('address.address_type_id required');
    if (!body.address.postalcode?.trim()) errs.push('address.postalcode required');
  }
  return errs;
}

function translatePgError(err: any): any {
  if (!err || !err.code) return err;
  const e: any = new Error(err.message);
  switch (err.code) {
    case '23503':
      e.message = err.detail
        ? `This client can't be deleted because it's referenced elsewhere: ${err.detail.replace(/^Key /, '')}`
        : 'This client is referenced by other rows and cannot be deleted.';
      e.status = 409;
      return e;
    case '23505':
      e.message = err.detail ?? 'A unique constraint was violated.';
      e.status = 409;
      return e;
    case '23502':
      e.message = `Missing required field: ${err.column ?? 'unknown'}`;
      e.status = 400;
      return e;
    case '22P02':
      e.message = 'One of the values is not valid for its field type.';
      e.status = 400;
      return e;
    default:
      return err;
  }
}
