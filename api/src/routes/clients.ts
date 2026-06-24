import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditCreate, auditDelete, auditUpdate } from '../auth/audit.js';
import { buildScoringSql } from '../dedup/scoring.js';

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
  /** Multi-select replacement for client_type_id. When present, the first
   *  entry is also stored as tbl_client.client_type_id for backward compat;
   *  the full set is written to tbl_client_client_type. */
  client_type_ids?: number[];
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

    // The LEFT JOIN against tbl_referral can produce duplicate rows when a
    // household has multiple referrals (multi-agency). Wrap in DISTINCT ON
    // to keep one row per client, picking the most recent referral's agency.
    const rows = await query(`
      SELECT DISTINCT ON (c.client_id)
        c.client_id,
        contact.first_name,
        contact.last_name,
        contact.mobile_phone,
        ct.client_type,
        (SELECT COALESCE(JSON_AGG(ct2.client_type ORDER BY ct2.client_type), '[]'::json)
           FROM tbl_client_client_type cct
           JOIN lkp_client_type ct2 ON ct2.client_type_id = cct.client_type_id
          WHERE cct.client_id = c.client_id) AS client_types,
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
      ORDER BY c.client_id DESC, ref.referral_date DESC NULLS LAST
      LIMIT 200
    `, params);
    // Re-sort by the user-visible order (start_date DESC NULLS LAST, client_id DESC)
    // after DISTINCT ON's required ordering. start_date arrives from pg as a
    // Date object (not a string), so coerce to a numeric timestamp before
    // comparing — .localeCompare doesn't exist on Date.
    rows.sort((a: any, b: any) => {
      const av = a.start_date ? new Date(a.start_date).getTime() : -Infinity;
      const bv = b.start_date ? new Date(b.start_date).getTime() : -Infinity;
      if (av !== bv) return bv - av;
      return b.client_id - a.client_id;
    });
    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Dedup search — "do you mean ...?" for the referral / client form  */
/* ----------------------------------------------------------------- */

/** GET /api/clients/search — top candidate matches above a 30% score.
 *
 *  Used by ReferralForm + ClientForm to prevent staff from accidentally
 *  creating a duplicate when an existing household is sitting in the DB.
 *  Returns at most 5 hits ordered by score desc.
 *
 *  All params optional, but at least first_name + last_name must be set
 *  (otherwise scoring is meaningless). Other params are signal boosters.
 */
clientsRouter.get('/search', async (req, res, next) => {
  try {
    const first  = String(req.query.first_name   ?? '').trim();
    const last   = String(req.query.last_name    ?? '').trim();
    const dob    = String(req.query.birth_date   ?? '').trim();   // 'YYYY-MM-DD' or ''
    const phone  = String(req.query.mobile_phone ?? '').trim();
    const email  = String(req.query.email        ?? '').trim();
    const addrId = req.query.address_id ? Number(req.query.address_id) : null;

    if (first.length < 2 || last.length < 2) {
      return res.json([]);
    }

    const sql = buildScoringSql() + `
      WHERE (sig_exact_name OR sig_trgm_name OR sig_dob OR sig_phone OR sig_email OR sig_address)
      ORDER BY match_score DESC, s.client_id DESC
      LIMIT 5
    `;
    const rows = await query(sql, [first, last, dob || null, phone || null, email || null, addrId]);
    res.json(rows.filter((r: any) => r.match_score >= 30));
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Referral history — all referrals for one client                   */
/* ----------------------------------------------------------------- */

/** GET /api/clients/:id/referrals — every referral row for this client,
 *  joined to its agency + caseworker + the requests it spawned.
 *  Drives the "Referral history" panel on the client detail page. */
clientsRouter.get('/:id/referrals', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const rows = await query(`
      SELECT
        r.referral_id,
        r.referral_date,
        r.description AS referral_note,
        ag.agency_id,
        ag.agency_name,
        ac.agency_contact_id,
        rc.first_name || ' ' || rc.last_name AS caseworker_name,
        rc.email                              AS caseworker_email,
        rc.mobile_phone                       AS caseworker_phone,
        COALESCE(
          (SELECT JSON_AGG(JSON_BUILD_OBJECT(
              'request_id',    pr.client_provisioning_request_id,
              'request_at',    pr.request_at,
              'review_status', pr.review_status,
              'item_count',
                (SELECT COUNT(*)::int FROM tbl_client_request_items i
                  WHERE i.client_provisioning_request_id = pr.client_provisioning_request_id)
           ) ORDER BY pr.request_at DESC)
             FROM tbl_client_provisioning_request pr
            WHERE pr.referral_id = r.referral_id),
          '[]'::json
        ) AS requests
      FROM tbl_referral r
      JOIN tbl_agency_contact ac ON ac.agency_contact_id = r.agency_contact_id
      JOIN tbl_agency ag         ON ag.agency_id         = ac.agency_id
      JOIN tbl_contact rc        ON rc.contact_id        = ac.contact_id
      WHERE r.client_id = $1
      ORDER BY r.referral_date DESC, r.referral_id DESC
    `, [id]);
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

    // Multi-type support: a household can be Veteran + Disaster + Domestic
    // Violence simultaneously. The legacy c.client_type column above is the
    // primary; this array carries the full set.
    const typeRows = await query<{ client_type_id: number; client_type: string }>(`
      SELECT t.client_type_id, ct.client_type
        FROM tbl_client_client_type t
        JOIN lkp_client_type ct ON ct.client_type_id = t.client_type_id
       WHERE t.client_id = $1
       ORDER BY ct.client_type
    `, [id]);
    (client as any).client_type_ids = typeRows.map(r => r.client_type_id);
    (client as any).client_types    = typeRows.map(r => r.client_type);

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

      // 3. Client. The primary client_type_id is the first checkbox (or the
      //    legacy single FK if no array was sent). The join table gets ALL
      //    chosen types — that's the source of truth going forward.
      const typeIds = pickTypeIds(body.client);
      const primaryTypeId = typeIds[0];
      const client = await tx.queryOne<Record<string, any>>(`
        INSERT INTO tbl_client (client_type_id, contact_id, start_date, client_status_id, description)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [
        primaryTypeId, contact!.contact_id,
        body.client.start_date ?? null, body.client.client_status_id,
        body.client.description ?? null,
      ]);

      for (const t of typeIds) {
        await tx.query(
          `INSERT INTO tbl_client_client_type (client_id, client_type_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [client!.client_id, t],
        );
      }

      await auditCreate(req, 'tbl_client', client!.client_id, { ...client!, client_type_ids: typeIds }, tx);
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

      // 3. Client. Same primary+join-table treatment as POST. On update we
      //    delete-and-reinsert the join rows so the set matches the incoming
      //    array exactly (no stale checkboxes lingering after staff unchecks
      //    a type).
      const typeIds = pickTypeIds(body.client);
      const primaryTypeId = typeIds[0];
      const after = await tx.queryOne<Record<string, any>>(`
        UPDATE tbl_client
           SET client_type_id = $1, start_date = $2, client_status_id = $3, description = $4
         WHERE client_id = $5
         RETURNING *
      `, [
        primaryTypeId, body.client.start_date ?? null,
        body.client.client_status_id, body.client.description ?? null,
        id,
      ]);
      await tx.query(`DELETE FROM tbl_client_client_type WHERE client_id = $1`, [id]);
      for (const t of typeIds) {
        await tx.query(
          `INSERT INTO tbl_client_client_type (client_id, client_type_id) VALUES ($1, $2)`,
          [id, t],
        );
      }

      if (before && after) {
        await auditUpdate(req, 'tbl_client', id,
          { ...before },
          { ...after, client_type_ids: typeIds },
          tx);
      }
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
    const typeIds = pickTypeIds(body.client);
    if (typeIds.length === 0) {
      errs.push('client.client_type_ids must include at least one household type');
    } else if (typeIds.some(t => !Number.isInteger(t) || t <= 0)) {
      errs.push('client.client_type_ids contains an invalid id');
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

/** Coalesce the legacy single client_type_id with the new array. Returns a
 *  de-duped list with the FIRST id treated as primary (so unchecking the
 *  primary checkbox naturally promotes the next one). */
function pickTypeIds(c: ClientPayload): number[] {
  const arr = Array.isArray(c.client_type_ids) ? c.client_type_ids.filter(n => Number.isInteger(n) && n > 0) : [];
  if (arr.length > 0) return Array.from(new Set(arr));
  if (Number.isInteger(c.client_type_id) && c.client_type_id > 0) return [c.client_type_id];
  return [];
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
