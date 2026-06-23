/**
 * Agency-caseworker API. A trimmed-down allowlist for partner-agency
 * users who refer households to Furnish Hope. Strictly scoped to the
 * caseworker's OWN agency_id — no cross-agency reads, no internal
 * Furnish Hope data (donors, inventory, financials, audit log).
 *
 * Every endpoint here re-verifies the caseworker's identity from the
 * session and filters every SQL query by their agency_id so even a
 * crafted parameter can't escape the scope.
 *
 *   GET  /api/agency/me                 caseworker profile + agency
 *   GET  /api/agency/dashboard          counts + recent activity
 *   GET  /api/agency/referrals          clients they've referred
 *   POST /api/agency/referrals          create new client + referral
 *   GET  /api/agency/referrals/:id      detail (client + their requests)
 */

import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditCreate } from '../auth/audit.js';
import { requireAgency } from '../auth/middleware.js';
import { buildScoringSql } from '../dedup/scoring.js';

export const agencyRouter = Router();

// Every endpoint in this router requires the agency role. Belt and
// suspenders: index.ts ALSO mounts this behind requireAgency.
agencyRouter.use(requireAgency);

/* ----------------------------------------------------------------- */
/*  /me — caseworker profile + their agency                            */
/* ----------------------------------------------------------------- */

agencyRouter.get('/me', (req, res) => {
  res.json({
    user_account_id: req.user!.user_account_id,
    username:        req.user!.username,
    display_name:    req.user!.display_name,
    agency_id:       req.user!.agency_id,
    agency_name:     req.user!.agency_name,
    role:            req.user!.role,
  });
});

/* ----------------------------------------------------------------- */
/*  /dashboard — counts the caseworker sees on their landing page     */
/* ----------------------------------------------------------------- */

agencyRouter.get('/dashboard', async (req, res, next) => {
  try {
    const agencyId = req.user!.agency_id!;
    // Count my referrals (this caseworker's agency only) and broadly
    // bucket their request statuses for at-a-glance comprehension.
    const counts = await queryOne<{
      total_referrals: string;
      open_requests: string;
      delivered_requests: string;
    }>(`
      WITH my_clients AS (
        SELECT DISTINCT r.client_id
        FROM tbl_referral r
        JOIN tbl_agency_contact ac ON ac.agency_contact_id = r.agency_contact_id
        WHERE ac.agency_id = $1
      )
      SELECT
        (SELECT COUNT(*)::text FROM my_clients) AS total_referrals,
        (SELECT COUNT(*)::text
           FROM tbl_client_provisioning_request pr
           JOIN my_clients mc ON mc.client_id = pr.client_id
           WHERE NOT EXISTS (
             SELECT 1 FROM tbl_client_deliveries d
             WHERE d.client_provisioning_request_id = pr.client_provisioning_request_id
               AND d.delivery_status_id IN (SELECT delivery_status_id FROM lkp_delivery_status WHERE delivery_status ILIKE 'Completed')
           )) AS open_requests,
        (SELECT COUNT(DISTINCT pr.client_provisioning_request_id)::text
           FROM tbl_client_provisioning_request pr
           JOIN my_clients mc ON mc.client_id = pr.client_id
           JOIN tbl_client_deliveries d ON d.client_provisioning_request_id = pr.client_provisioning_request_id
           JOIN lkp_delivery_status ds ON ds.delivery_status_id = d.delivery_status_id
           WHERE ds.delivery_status ILIKE 'Completed') AS delivered_requests
    `, [agencyId]);

    const recent = await query<any>(`
      SELECT
        r.client_id,
        r.referral_date,
        contact.first_name || ' ' || contact.last_name AS client_name,
        ct.client_type
      FROM tbl_referral r
      JOIN tbl_client c ON c.client_id = r.client_id
      JOIN tbl_contact contact ON contact.contact_id = c.contact_id
      JOIN lkp_client_type ct ON ct.client_type_id = c.client_type_id
      JOIN tbl_agency_contact ac ON ac.agency_contact_id = r.agency_contact_id
      WHERE ac.agency_id = $1
      ORDER BY r.referral_date DESC
      LIMIT 5
    `, [agencyId]);

    res.json({
      total_referrals:    Number(counts?.total_referrals ?? 0),
      open_requests:      Number(counts?.open_requests ?? 0),
      delivered_requests: Number(counts?.delivered_requests ?? 0),
      recent_referrals:   recent,
    });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  /lookups/:table — narrow allowlist of reference data agencies     */
/*  need to fill out a referral. Reference data, not sensitive.       */
/* ----------------------------------------------------------------- */

const AGENCY_LOOKUP_ALLOWLIST = new Set([
  'lkp_city', 'lkp_county', 'lkp_state', 'lkp_client_type', 'lkp_item_category',
]);

agencyRouter.get('/lookups/:table', async (req, res, next) => {
  try {
    const table = req.params.table;
    if (!AGENCY_LOOKUP_ALLOWLIST.has(table)) {
      return res.status(404).json({ error: 'Lookup not available' });
    }
    // Whitelist + identifier-safe — only [a-z_] is allowed in the
    // table name. The Set check above ensures we never see anything
    // dangerous here, but keep the regex for defense in depth.
    if (!/^[a-z_]+$/.test(table)) return res.status(400).json({ error: 'Invalid table name' });
    const rows = await query(`SELECT * FROM ${table} ORDER BY 1`);
    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  /clients/search — "do you mean ...?" for the new-referral form    */
/*                                                                    */
/*  Scoped to clients THIS AGENCY has previously referred. Privacy:   */
/*  agencies must not be able to enumerate the full client database   */
/*  by trying name guesses.                                           */
/* ----------------------------------------------------------------- */

agencyRouter.get('/clients/search', async (req, res, next) => {
  try {
    const agencyId = req.user!.agency_id!;
    const first  = String(req.query.first_name   ?? '').trim();
    const last   = String(req.query.last_name    ?? '').trim();
    const dob    = String(req.query.birth_date   ?? '').trim();
    const phone  = String(req.query.mobile_phone ?? '').trim();
    const email  = String(req.query.email        ?? '').trim();
    const addrId = req.query.address_id ? Number(req.query.address_id) : null;

    if (first.length < 2 || last.length < 2) {
      return res.json([]);
    }

    // Scope by joining tbl_referral filtered to this agency's contacts.
    // EXISTS, not JOIN, to avoid duplicate scored rows for clients with
    // multiple referrals from the same agency.
    const extraWhere = `
      WHERE EXISTS (
        SELECT 1
          FROM tbl_referral r
          JOIN tbl_agency_contact ac ON ac.agency_contact_id = r.agency_contact_id
         WHERE r.client_id = c.client_id AND ac.agency_id = $7
      )
    `;
    const sql = buildScoringSql('', extraWhere) + `
      WHERE (sig_exact_name OR sig_trgm_name OR sig_dob OR sig_phone OR sig_email OR sig_address)
      ORDER BY match_score DESC, s.client_id DESC
      LIMIT 5
    `;
    const rows = await query(sql, [first, last, dob || null, phone || null, email || null, addrId, agencyId]);
    res.json(rows.filter((r: any) => r.match_score >= 30));
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  /referrals — list this caseworker's agency referrals              */
/* ----------------------------------------------------------------- */

agencyRouter.get('/referrals', async (req, res, next) => {
  try {
    const agencyId = req.user!.agency_id!;
    const search = (req.query.search as string | undefined)?.trim() || null;

    const conds: string[] = ['ac.agency_id = $1'];
    const params: any[] = [agencyId];
    if (search) {
      params.push(`%${search}%`);
      conds.push(`(
        contact.first_name ILIKE $${params.length}
        OR contact.last_name ILIKE $${params.length}
        OR contact.email ILIKE $${params.length}
      )`);
    }

    const rows = await query(`
      SELECT
        c.client_id,
        contact.first_name || ' ' || contact.last_name AS client_name,
        ct.client_type,
        cs.client_status,
        r.referral_date,
        addr.address,
        city.city,
        (SELECT COUNT(*)::int FROM tbl_client_provisioning_request pr WHERE pr.client_id = c.client_id) AS request_count
      FROM tbl_referral r
      JOIN tbl_agency_contact ac ON ac.agency_contact_id = r.agency_contact_id
      JOIN tbl_client c          ON c.client_id = r.client_id
      JOIN tbl_contact contact   ON contact.contact_id = c.contact_id
      JOIN lkp_client_type ct    ON ct.client_type_id = c.client_type_id
      JOIN lkp_client_status cs  ON cs.client_status_id = c.client_status_id
      LEFT JOIN tbl_address addr ON addr.address_id = contact.address_id
      LEFT JOIN lkp_city city    ON city.city_id    = addr.city_id
      WHERE ${conds.join(' AND ')}
      ORDER BY r.referral_date DESC
    `, params);
    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  POST /referrals — create a new client + referral atomically       */
/* ----------------------------------------------------------------- */

interface ReferralCreatePayload {
  contact: {
    first_name: string;
    last_name: string;
    email?: string | null;
    mobile_phone?: string | null;
    birth_date?: string | null;
  };
  address: {
    address: string;
    address2?: string | null;
    city_id: number;
    county_id: number;
    state_id: number;
    postalcode: string;
    address_type_id?: number | null;
  };
  client_type_id: number;
  family_size?: number | null;
  notes?: string | null;
  /** Optional needs the agency wants Furnish Hope to provision. When
   *  provided, an awaiting_review tbl_client_provisioning_request is
   *  created in the same transaction alongside its tbl_client_request_items. */
  items?: Array<{
    item_category_id: number;
    quantity: number;
    priority?: 'low' | 'medium' | 'high' | null;
    item_notes?: string | null;
  }>;
}

agencyRouter.post('/referrals', async (req, res, next) => {
  try {
    const body = req.body as ReferralCreatePayload;
    const errs = validateReferral(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    const newClientId = await withTransaction(async (tx) => {
      // 1) Address
      const addr = await tx.queryOne<{ address_id: number }>(`
        INSERT INTO tbl_address (address_type_id, address, address2, city_id, county_id, state_id, postalcode, address_name)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING address_id
      `, [
        body.address.address_type_id ?? 1,
        body.address.address.trim(),
        body.address.address2?.trim() || null,
        body.address.city_id,
        body.address.county_id,
        body.address.state_id,
        body.address.postalcode.trim(),
        'Home',
      ]);

      // 2) Contact
      const contactTypeId = await tx.queryOne<{ contact_type_id: number }>(
        `SELECT contact_type_id FROM lkp_contact_type WHERE contact_type ILIKE 'Client' LIMIT 1`,
      );
      if (!contactTypeId) {
        const e: any = new Error('Internal: lkp_contact_type lacks a Client row'); e.status = 500; throw e;
      }
      const contact = await tx.queryOne<{ contact_id: number }>(`
        INSERT INTO tbl_contact (contact_type_id, first_name, last_name, email, mobile_phone, address_id, birth_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING contact_id
      `, [
        contactTypeId.contact_type_id,
        body.contact.first_name.trim(),
        body.contact.last_name.trim(),
        body.contact.email?.trim() || null,
        body.contact.mobile_phone?.trim() || null,
        addr!.address_id,
        body.contact.birth_date?.trim() || null,
      ]);

      // 3) Client — default to status='New' (or first available row)
      const statusRow = await tx.queryOne<{ client_status_id: number }>(`
        SELECT client_status_id FROM lkp_client_status
        ORDER BY CASE WHEN client_status ILIKE 'New' THEN 0 ELSE 1 END, client_status_id
        LIMIT 1
      `);
      const client = await tx.queryOne<{ client_id: number }>(`
        INSERT INTO tbl_client (client_type_id, contact_id, client_status_id, description, start_date)
        VALUES ($1, $2, $3, $4, CURRENT_DATE)
        RETURNING client_id
      `, [
        body.client_type_id,
        contact!.contact_id,
        statusRow!.client_status_id,
        body.notes?.trim() || null,
      ]);

      // 4) Referral linking the caseworker to the new client
      const referral = await tx.queryOne<{ referral_id: number }>(`
        INSERT INTO tbl_referral (agency_contact_id, client_id, referral_date, description)
        VALUES ($1, $2, CURRENT_DATE, $3)
        RETURNING referral_id
      `, [
        req.user!.agency_contact_id,
        client!.client_id,
        body.notes?.trim() || null,
      ]);

      await auditCreate(req, 'tbl_client', client!.client_id, {
        referred_by_agency_id: req.user!.agency_id,
        referred_by_agency_contact_id: req.user!.agency_contact_id,
        ...body.contact,
      }, tx);

      // 5) Provisioning request — agency-submitted requests land in
      //    awaiting_review so staff triage them before matching starts.
      //    The agency may submit zero items if they just want to flag
      //    the household; in that case we still create the request shell
      //    so staff can pencil in needs during the visit.
      if (body.items && body.items.length > 0) {
        // Sensible defaults so the existing requests pipeline accepts the row.
        // Pick the first available facility + origin lookup; staff edit later.
        const defaults = await tx.queryOne<{
          fulfillment_corp_facility_id: number;
          request_receipt_origin_id: number;
          client_request_creator_facility_staff_id: number;
        }>(`
          SELECT
            (SELECT corp_facility_id FROM tbl_corp_facility ORDER BY corp_facility_id LIMIT 1) AS fulfillment_corp_facility_id,
            (SELECT request_receipt_origin_id FROM lkp_request_receipt_origin
              ORDER BY CASE WHEN request_receipt_origin ILIKE '%agency%' THEN 0 ELSE 1 END,
                       request_receipt_origin_id LIMIT 1)        AS request_receipt_origin_id,
            (SELECT facility_staff_id FROM tbl_facility_staff ORDER BY facility_staff_id LIMIT 1) AS client_request_creator_facility_staff_id
        `);
        if (!defaults?.fulfillment_corp_facility_id || !defaults?.request_receipt_origin_id || !defaults?.client_request_creator_facility_staff_id) {
          const e: any = new Error(
            'System is not configured to accept agency-submitted requests (missing facility, origin, or staff). Contact Furnish Hope.',
          ); e.status = 500; throw e;
        }

        const request = await tx.queryOne<{ client_provisioning_request_id: number }>(`
          INSERT INTO tbl_client_provisioning_request
            (client_id, fulfillment_corp_facility_id, request_receipt_origin_id,
             client_request_creator_facility_staff_id, request_at, client_request_note,
             review_status, referral_id)
          VALUES ($1, $2, $3, $4, NOW(), $5, 'awaiting_review', $6)
          RETURNING client_provisioning_request_id
        `, [
          client!.client_id,
          defaults.fulfillment_corp_facility_id,
          defaults.request_receipt_origin_id,
          defaults.client_request_creator_facility_staff_id,
          body.notes?.trim() || null,
          referral!.referral_id,
        ]);

        for (const item of body.items) {
          await tx.query(`
            INSERT INTO tbl_client_request_items
              (client_provisioning_request_id, item_category_id, item_notes, quantity, priority, time_stamp)
            VALUES ($1, $2, $3, $4, $5, NOW())
          `, [
            request!.client_provisioning_request_id,
            item.item_category_id,
            item.item_notes?.trim() || null,
            item.quantity,
            item.priority ?? null,
          ]);
        }

        await auditCreate(
          req,
          'tbl_client_provisioning_request',
          request!.client_provisioning_request_id,
          {
            review_status: 'awaiting_review',
            referral_id: referral!.referral_id,
            item_count: body.items.length,
            submitted_by_agency_contact_id: req.user!.agency_contact_id,
          },
          tx,
        );
      }

      return client!.client_id;
    });

    res.status(201).json({ client_id: newClientId });
  } catch (err) { next(err); }
});

function validateReferral(b: ReferralCreatePayload): string[] {
  const errs: string[] = [];
  if (!b?.contact?.first_name?.trim()) errs.push('First name required');
  if (!b?.contact?.last_name?.trim())  errs.push('Last name required');
  if (!b?.address?.address?.trim())    errs.push('Street address required');
  if (!b?.address?.city_id)            errs.push('City required');
  if (!b?.address?.county_id)          errs.push('County required');
  if (!b?.address?.state_id)           errs.push('State required');
  if (!b?.address?.postalcode?.trim()) errs.push('Postal code required');
  if (!b?.client_type_id)              errs.push('Client type required');
  if (b?.items?.length) {
    b.items.forEach((it, i) => {
      if (!it.item_category_id)             errs.push(`Item ${i + 1}: category required`);
      if (!Number.isInteger(it.quantity) || it.quantity < 1) errs.push(`Item ${i + 1}: quantity must be a positive whole number`);
      if (it.priority && !['low','medium','high'].includes(it.priority)) errs.push(`Item ${i + 1}: invalid priority`);
    });
  }
  return errs;
}

/* ----------------------------------------------------------------- */
/*  /referrals/:id — detail of one of THIS caseworker's referrals     */
/*                                                                    */
/*  Re-verifies the agency_id against the join so a guessed client_id */
/*  belonging to another agency returns 404 (not 200).                */
/* ----------------------------------------------------------------- */

agencyRouter.get('/referrals/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const agencyId = req.user!.agency_id!;

    const client = await queryOne(`
      SELECT
        c.client_id,
        contact.first_name || ' ' || contact.last_name AS client_name,
        contact.email,
        contact.mobile_phone,
        ct.client_type,
        cs.client_status,
        addr.address, addr.address2,
        city.city,
        st.state,
        addr.postalcode,
        r.referral_date,
        c.description AS notes
      FROM tbl_referral r
      JOIN tbl_agency_contact ac ON ac.agency_contact_id = r.agency_contact_id
      JOIN tbl_client c          ON c.client_id = r.client_id
      JOIN tbl_contact contact   ON contact.contact_id = c.contact_id
      JOIN lkp_client_type ct    ON ct.client_type_id = c.client_type_id
      JOIN lkp_client_status cs  ON cs.client_status_id = c.client_status_id
      LEFT JOIN tbl_address addr ON addr.address_id = contact.address_id
      LEFT JOIN lkp_city city    ON city.city_id    = addr.city_id
      LEFT JOIN lkp_state st     ON st.state_id     = addr.state_id
      WHERE ac.agency_id = $1 AND c.client_id = $2
      LIMIT 1
    `, [agencyId, id]);
    if (!client) return res.status(404).json({ error: 'Referral not found' });

    // Their requests + delivery status — at-a-glance progress view.
    // Intentionally minimal: just status + counts. No internal notes,
    // staff names, vehicle info, etc.
    const requests = await query(`
      SELECT
        pr.client_provisioning_request_id AS request_id,
        pr.request_at,
        pr.client_request_note AS note,
        pr.review_status,
        (SELECT COUNT(*)::int FROM tbl_client_request_items i WHERE i.client_provisioning_request_id = pr.client_provisioning_request_id) AS item_count,
        (SELECT COUNT(*)::int FROM tbl_inventory_reservation res WHERE res.client_provisioning_request_id = pr.client_provisioning_request_id) AS matched_count,
        (SELECT d.delivery_date::text
           FROM tbl_client_deliveries d
           WHERE d.client_provisioning_request_id = pr.client_provisioning_request_id
           ORDER BY d.delivery_date DESC LIMIT 1) AS latest_delivery_date,
        (SELECT ds.delivery_status
           FROM tbl_client_deliveries d
           JOIN lkp_delivery_status ds ON ds.delivery_status_id = d.delivery_status_id
           WHERE d.client_provisioning_request_id = pr.client_provisioning_request_id
           ORDER BY d.delivery_date DESC LIMIT 1) AS latest_delivery_status
      FROM tbl_client_provisioning_request pr
      WHERE pr.client_id = $1
      ORDER BY pr.request_at DESC
    `, [id]);

    res.json({ client, requests });
  } catch (err) { next(err); }
});
