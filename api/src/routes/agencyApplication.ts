/**
 * Agency-partner application flow — both public submission and staff
 * review live here.
 *
 * Two routers:
 *  - publicAgencyApplicationRouter — mounted BEFORE requireUser.
 *      POST /api/public/agency-applications  — anonymous submission
 *      GET  /api/public/lookups/:name         — allowlisted reference data
 *                                                (client types, states)
 *  - agencyApplicationsReviewRouter — Program Manager (or Admin) only.
 *      GET  /api/agencies/applications           — pending queue
 *      GET  /api/agencies/applications/:id       — full detail w/ caseworkers
 *      POST /api/agencies/applications/:id/approve
 *          Atomic: address + agency (is_approved=true) + tbl_agency_client_type
 *          + per caseworker (contact, agency_contact, caseworker_invitation).
 *      POST /api/agencies/applications/:id/reject { note }
 *      GET  /api/agencies/applications/:id/invitation-preview/:cwId
 *          Returns the invitation email body (plaintext + HTML). Until an
 *          FH mailbox is connected in production, the Program Manager uses
 *          this to copy/paste into the Agency_Onboarding@Furnish-Hope.com
 *          Google group.
 *
 * The public endpoint is a DOS + spam target — rate-limited to 5 posts
 * per IP per 15 min, plus an invisible honeypot field ("company_slogan")
 * that human applicants won't touch.
 */

import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditCreate, auditUpdate } from '../auth/audit.js';
import { loadUser } from '../auth/middleware.js';

export const publicAgencyApplicationRouter = Router();

// ---------------------------------------------------------------------- //
//  Public lookups                                                        //
// ---------------------------------------------------------------------- //

/** Allowlisted read-only lookups the public forms need. Distinct from the
 *  authenticated /api/lookups router so we can't accidentally leak
 *  operational reference tables through a shared endpoint. Returns
 *  {id, label} rows sorted by label. */
const PUBLIC_LOOKUP_ALLOWLIST: Record<string, { table: string; id: string; label: string }> = {
  client_type:    { table: 'lkp_client_type',    id: 'client_type_id',    label: 'client_type' },
  state:          { table: 'lkp_state',          id: 'state_id',          label: 'state' },
  county:         { table: 'lkp_county',         id: 'county_id',         label: 'county' },
  city:           { table: 'lkp_city',           id: 'city_id',           label: 'city' },
  // Referenced by the public /volunteer signup form's "how did you hear
  // about us?" dropdown. Adding here rather than exposing the internal
  // lookups router to anonymous users.
  howtheyfoundus: { table: 'lkp_howtheyfoundus', id: 'howtheyfoundus_id', label: 'howtheyfoundus' },
};

/** GET /api/public/agencies — anonymous list of approved referring
 *  partners for the /referring-agencies marketing page. Only public-safe
 *  fields go out. EIN, main_email, executive_director_name, address
 *  detail, and applicant-only fields are deliberately not exposed. */
publicAgencyApplicationRouter.get('/agencies', async (_req, res, next) => {
  try {
    const rows = await query(`
      SELECT
        ag.agency_id,
        ag.agency_name,
        ag.public_description,
        ag.service_area,
        ag.website,
        (SELECT COALESCE(JSON_AGG(ct.client_type ORDER BY ct.client_type), '[]'::json)
           FROM tbl_agency_client_type acp
           JOIN lkp_client_type ct ON ct.client_type_id = acp.client_type_id
          WHERE acp.agency_id = ag.agency_id) AS client_types
      FROM tbl_agency ag
      WHERE ag.is_approved = true
      ORDER BY ag.agency_name ASC
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

/** GET /api/public/invitations/:token
 *  Returns { agency_name, first_name, last_name, email, expires_at, status }
 *  when the token is usable ('pending' or 'sent' AND not past expires_at).
 *  Anything else — including tokens the DB doesn't recognize — returns a
 *  404 with a friendly error the signup page can render. Deliberately
 *  vague on the failure reason so a scanner can't distinguish "unknown
 *  token" from "expired token." */
publicAgencyApplicationRouter.get('/invitations/:token', async (req, res, next) => {
  try {
    const token = String(req.params.token ?? '');
    if (token.length !== 64) {
      return res.status(404).json({ error: 'This invitation link is invalid or has expired.' });
    }
    const row = await queryOne<any>(`
      SELECT ci.status, ci.expires_at,
             ci.email,
             cnt.first_name, cnt.last_name,
             ag.agency_name
        FROM tbl_caseworker_invitation ci
        JOIN tbl_agency_contact ac ON ac.agency_contact_id = ci.agency_contact_id
        JOIN tbl_contact cnt       ON cnt.contact_id       = ac.contact_id
        JOIN tbl_agency ag         ON ag.agency_id         = ci.agency_id
       WHERE ci.token = $1
    `, [token]);
    if (!row) return res.status(404).json({ error: 'This invitation link is invalid or has expired.' });

    const usable = (row.status === 'pending' || row.status === 'sent') && new Date(row.expires_at) > new Date();
    if (!usable) {
      return res.status(404).json({
        error: row.status === 'accepted'
          ? 'This invitation was already used. Sign in from the login page.'
          : 'This invitation link is invalid or has expired.',
      });
    }
    res.json({
      agency_name: row.agency_name,
      first_name: row.first_name,
      last_name:  row.last_name,
      email:      row.email,
      expires_at: row.expires_at,
      status:     row.status,
    });
  } catch (err) { next(err); }
});

// The accept endpoint touches the session + creates an account, so it's
// worth throttling per-IP even though the token is 64 hex chars.
const acceptLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts from this IP. Please try again in a few minutes.' },
});

/** POST /api/public/invitations/:token/accept { username, password }
 *  Atomic: creates tbl_user_account with agency_contact_id, flips the
 *  invitation to 'accepted', and regenerates the session so the caseworker
 *  is signed in and can be redirected straight to /agency. */
publicAgencyApplicationRouter.post('/invitations/:token/accept', acceptLimiter, async (req, res, next) => {
  try {
    const token = String(req.params.token ?? '');
    if (token.length !== 64) {
      return res.status(404).json({ error: 'This invitation link is invalid or has expired.' });
    }
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ error: 'Please choose a username.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    if (!/^[a-zA-Z0-9_.-]{3,50}$/.test(username.trim())) {
      return res.status(400).json({
        error: 'Username can be 3–50 characters — letters, numbers, dot, dash, underscore.',
      });
    }
    const cleanUsername = username.trim();

    const userId = await withTransaction(async (tx) => {
      const invitation = await tx.queryOne<any>(`
        SELECT * FROM tbl_caseworker_invitation
         WHERE token = $1
         FOR UPDATE
      `, [token]);
      if (!invitation) { const e: any = new Error('This invitation link is invalid or has expired.'); e.status = 404; throw e; }
      const usable = (invitation.status === 'pending' || invitation.status === 'sent') && new Date(invitation.expires_at) > new Date();
      if (!usable) {
        const e: any = new Error(
          invitation.status === 'accepted'
            ? 'This invitation was already used. Sign in from the login page.'
            : 'This invitation link is invalid or has expired.',
        );
        e.status = 409; throw e;
      }

      // Username collision check — surfaced up front so the caseworker
      // can pick a different one instead of getting a generic 500.
      const clash = await tx.queryOne<{ user_account_id: number }>(
        `SELECT user_account_id FROM tbl_user_account WHERE LOWER(username) = LOWER($1)`,
        [cleanUsername],
      );
      if (clash) {
        const e: any = new Error('That username is already taken. Try another.');
        e.status = 409; throw e;
      }

      const hash = await bcrypt.hash(password, 10);
      const user = await tx.queryOne<{ user_account_id: number }>(`
        INSERT INTO tbl_user_account
          (username, password_hash, is_active, is_admin, agency_contact_id)
        VALUES ($1, $2, true, false, $3)
        RETURNING user_account_id
      `, [cleanUsername, hash, invitation.agency_contact_id]);

      await tx.query(`
        UPDATE tbl_caseworker_invitation
           SET status = 'accepted',
               accepted_at = NOW(),
               user_account_id = $2
         WHERE caseworker_invitation_id = $1
      `, [invitation.caseworker_invitation_id, user!.user_account_id]);

      return user!.user_account_id;
    });

    // Regenerate the session so any prior anonymous session id is
    // rotated — same protection as /api/auth/login uses. Then load the
    // user and return the same payload the login endpoint does so the
    // frontend can drop straight into /agency without a second call.
    req.session.regenerate(async (err) => {
      if (err) return next(err);
      req.session.userId = userId;
      await query(`UPDATE tbl_user_account SET last_login_at = NOW() WHERE user_account_id = $1`, [userId]);
      const user = await loadUser(userId);
      res.json({ user });
    });
  } catch (err) { next(err); }
});

publicAgencyApplicationRouter.get('/lookups/:name', async (req, res, next) => {
  try {
    const spec = PUBLIC_LOOKUP_ALLOWLIST[req.params.name];
    if (!spec) return res.status(404).json({ error: 'Unknown lookup' });
    // Safe: identifiers came from the allowlist, not user input.
    const rows = await query(
      `SELECT ${spec.id} AS id, ${spec.label} AS label FROM ${spec.table} ORDER BY ${spec.label}`,
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------- //
//  Application submission                                                 //
// ---------------------------------------------------------------------- //

const applicationLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions from this IP. Please try again in a few minutes.' },
});

interface ApplicationCaseworker {
  first_name: string;
  last_name: string;
  title?: string | null;
  email: string;
  phone?: string | null;
}

interface ApplicationBody {
  // Honeypot — bots fill it, humans never see it.
  company_slogan?: string;

  // Agency identity
  agency_name: string;
  legal_name?: string | null;
  ein?: string | null;
  website?: string | null;
  main_phone?: string | null;
  main_email: string;

  // Address
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string;
  postalcode: string;
  service_area?: string | null;

  // Program
  public_description?: string | null;
  needs_filled?: string | null;
  approx_clients_per_month?: number | null;
  executive_director_name?: string | null;
  other_info?: string | null;

  // Populations served — checkbox group from lkp_client_type
  client_type_ids: number[];

  // Caseworkers listed on the application (at least one required)
  caseworkers: ApplicationCaseworker[];
}

publicAgencyApplicationRouter.post('/agency-applications', applicationLimiter, async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as ApplicationBody;

    // Honeypot silently drops bot submissions with a 200 so bulk scanners
    // don't learn we're filtering.
    if (body.company_slogan && body.company_slogan.trim().length > 0) {
      return res.status(200).json({ ok: true });
    }

    // Server-side authoritative validation. The React form validates too,
    // but anyone can hit this endpoint directly.
    const errs = validateApplication(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    // Duplicate guard (backstop for the client-side agency-name dropdown):
    // reject if the normalized name or the EIN already belongs to an approved
    // partner. Steers a returning caseworker to request an invite instead.
    const einDigits = (body.ein ?? '').replace(/[^0-9]/g, '');
    const dupe = await queryOne<{ agency_name: string }>(`
      SELECT agency_name FROM tbl_agency
       WHERE is_approved = true
         AND (
           lower(btrim(agency_name)) = lower(btrim($1))
           OR ( length($2) >= 9 AND regexp_replace(coalesce(ein,''), '[^0-9]', '', 'g') = $2 )
         )
       LIMIT 1
    `, [body.agency_name, einDigits]);
    if (dupe) {
      return res.status(409).json({
        error: `"${dupe.agency_name}" is already a registered Furnish Hope partner. If you're a new caseworker there, ask your agency's admin (or Furnish Hope) to send you an invitation link — you don't need to submit a new application.`,
      });
    }

    const newId = await withTransaction(async (tx) => {
      const inserted = await tx.queryOne<{ agency_application_id: number }>(`
        INSERT INTO tbl_agency_application (
          agency_name, legal_name, ein, website, main_phone, main_email,
          address_line1, address_line2, city, state, postalcode,
          service_area, public_description, needs_filled,
          approx_clients_per_month, executive_director_name, other_info
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        RETURNING agency_application_id
      `, [
        body.agency_name.trim(),
        body.legal_name?.trim() || null,
        body.ein?.trim() || null,
        body.website?.trim() || null,
        body.main_phone?.trim() || null,
        body.main_email.trim(),
        body.address_line1.trim(),
        body.address_line2?.trim() || null,
        body.city.trim(),
        body.state.trim(),
        body.postalcode.trim(),
        body.service_area?.trim() || null,
        body.public_description?.trim() || null,
        body.needs_filled?.trim() || null,
        body.approx_clients_per_month ?? null,
        body.executive_director_name?.trim() || null,
        body.other_info?.trim() || null,
      ]);

      const appId = inserted!.agency_application_id;

      for (const cw of body.caseworkers) {
        await tx.query(`
          INSERT INTO tbl_agency_application_caseworker
            (agency_application_id, first_name, last_name, title, email, phone)
          VALUES ($1,$2,$3,$4,$5,$6)
        `, [
          appId,
          cw.first_name.trim(),
          cw.last_name.trim(),
          cw.title?.trim() || null,
          cw.email.trim(),
          cw.phone?.trim() || null,
        ]);
      }

      for (const ctId of dedupInts(body.client_type_ids)) {
        await tx.query(
          `INSERT INTO tbl_agency_application_client_type (agency_application_id, client_type_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [appId, ctId],
        );
      }

      return appId;
    });

    res.status(201).json({ agency_application_id: newId });
  } catch (err) { next(err); }
});

/* --- validation ------------------------------------------------------- */

function validateApplication(b: ApplicationBody): string[] {
  const errs: string[] = [];
  if (!b?.agency_name?.trim())    errs.push('Agency name is required');
  if (!b?.main_email?.trim())     errs.push('Main email is required');
  else if (!/.+@.+\..+/.test(b.main_email)) errs.push('Main email format looks wrong');
  if (!b?.address_line1?.trim())  errs.push('Street address is required');
  if (!b?.city?.trim())           errs.push('City is required');
  if (!b?.state?.trim())          errs.push('State is required');
  if (!b?.postalcode?.trim())     errs.push('ZIP / postal code is required');

  const cts = Array.isArray(b?.client_type_ids) ? b.client_type_ids : [];
  if (cts.filter(n => Number.isInteger(n) && n > 0).length === 0) {
    errs.push('Select at least one population you serve');
  }

  const cws = Array.isArray(b?.caseworkers) ? b.caseworkers : [];
  if (cws.length === 0) {
    errs.push('At least one caseworker is required');
  } else {
    cws.forEach((cw, i) => {
      if (!cw.first_name?.trim())  errs.push(`Caseworker ${i + 1}: first name required`);
      if (!cw.last_name?.trim())   errs.push(`Caseworker ${i + 1}: last name required`);
      if (!cw.email?.trim())       errs.push(`Caseworker ${i + 1}: email required`);
      else if (!/.+@.+\..+/.test(cw.email)) errs.push(`Caseworker ${i + 1}: email format looks wrong`);
    });
  }

  if (b?.approx_clients_per_month != null) {
    const n = Number(b.approx_clients_per_month);
    if (!Number.isFinite(n) || n < 0) errs.push('Approx clients per month must be a positive number');
  }

  return errs;
}

function dedupInts(arr: number[] | null | undefined): number[] {
  const seen = new Set<number>();
  for (const n of arr ?? []) {
    if (Number.isInteger(n) && n > 0) seen.add(n);
  }
  return Array.from(seen);
}

// ====================================================================== //
//  Program-Manager review queue (approve / reject / invite)              //
// ====================================================================== //

export const agencyApplicationsReviewRouter = Router();

/** GET /api/agencies/applications
 *  Pending queue by default; ?status=all|approved|rejected to see others.
 *  Each row includes counts + a compact summary; full detail comes from
 *  /:id. */
agencyApplicationsReviewRouter.get('/', async (req, res, next) => {
  try {
    const status = String(req.query.status ?? 'pending');
    const where = status === 'all' ? '' : `WHERE aa.status = $1`;
    const params = status === 'all' ? [] : [status];
    const rows = await query(`
      SELECT
        aa.agency_application_id,
        aa.agency_name,
        aa.legal_name,
        aa.main_email,
        aa.main_phone,
        aa.city, aa.state,
        aa.service_area,
        aa.public_description,
        aa.approx_clients_per_month,
        aa.status,
        aa.submitted_at,
        aa.reviewed_at,
        aa.rejection_note,
        aa.approved_agency_id,
        (SELECT COUNT(*)::int FROM tbl_agency_application_caseworker cw
          WHERE cw.agency_application_id = aa.agency_application_id) AS caseworker_count,
        (SELECT COUNT(*)::int FROM tbl_agency_application_client_type ct
          WHERE ct.agency_application_id = aa.agency_application_id) AS population_count
      FROM tbl_agency_application aa
      ${where}
      ORDER BY aa.submitted_at ASC
    `, params);
    res.json(rows);
  } catch (err) { next(err); }
});

/** GET /api/agencies/applications/:id
 *  Full detail — application row, its caseworkers, its populations
 *  (with lkp_client_type names hydrated), and any already-issued
 *  invitations (only present after approval). */
agencyApplicationsReviewRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const application = await queryOne(`
      SELECT * FROM tbl_agency_application WHERE agency_application_id = $1
    `, [id]);
    if (!application) return res.status(404).json({ error: 'Not found' });

    const caseworkers = await query(`
      SELECT * FROM tbl_agency_application_caseworker
       WHERE agency_application_id = $1
       ORDER BY agency_application_caseworker_id
    `, [id]);

    const populations = await query(`
      SELECT ct.client_type_id, ct.client_type
        FROM tbl_agency_application_client_type acp
        JOIN lkp_client_type ct ON ct.client_type_id = acp.client_type_id
       WHERE acp.agency_application_id = $1
       ORDER BY ct.client_type
    `, [id]);

    // Invitations only exist after approval; empty array for pending / rejected.
    const invitations = await query(`
      SELECT ci.caseworker_invitation_id, ci.email, ci.status,
             ci.issued_at, ci.expires_at, ci.sent_at, ci.accepted_at,
             ci.agency_contact_id, ci.user_account_id
        FROM tbl_caseworker_invitation ci
       WHERE ci.agency_id = (SELECT approved_agency_id FROM tbl_agency_application WHERE agency_application_id = $1)
       ORDER BY ci.issued_at DESC
    `, [id]);

    // Possible-duplicate detection for the reviewer: approved agencies that
    // match this application by normalized name, EIN, or main email; plus any
    // application caseworker whose email already belongs to a registered
    // caseworker. Read-only, authenticated context — safe to surface here
    // (unlike the public apply form, which must not confirm caseworker emails).
    const app: any = application;
    const einDigits = (app.ein ?? '').replace(/[^0-9]/g, '');
    const mainEmail = (app.main_email ?? '').trim();
    const dupAgencies = await query(`
      SELECT agency_id, agency_name, ein, main_email,
             (lower(btrim(agency_name)) = lower(btrim($1)))                                              AS name_exact,
             (length($2) >= 9 AND regexp_replace(coalesce(ein,''), '[^0-9]', '', 'g') = $2)              AS ein_match,
             ($3 <> '' AND lower(coalesce(main_email,'')) = lower($3))                                   AS email_match
        FROM tbl_agency
       WHERE is_approved = true
         AND (
           lower(btrim(agency_name)) = lower(btrim($1))
           OR agency_name ILIKE '%' || btrim($1) || '%'
           OR (length($2) >= 9 AND regexp_replace(coalesce(ein,''), '[^0-9]', '', 'g') = $2)
           OR ($3 <> '' AND lower(coalesce(main_email,'')) = lower($3))
         )
       ORDER BY name_exact DESC, agency_name
       LIMIT 10
    `, [app.agency_name, einDigits, mainEmail]);

    const dupCaseworkers = await query(`
      SELECT DISTINCT lower(ct.email)                     AS email,
             ct.first_name || ' ' || ct.last_name         AS existing_name,
             ag.agency_name                               AS existing_agency
        FROM tbl_agency_application_caseworker acw
        JOIN tbl_contact ct         ON ct.email IS NOT NULL AND lower(ct.email) = lower(acw.email)
        JOIN tbl_agency_contact agc ON agc.contact_id = ct.contact_id
        JOIN tbl_agency ag          ON ag.agency_id = agc.agency_id
       WHERE acw.agency_application_id = $1
       ORDER BY email
    `, [id]);

    res.json({
      application, caseworkers, populations, invitations,
      possible_duplicates: { agencies: dupAgencies, caseworker_emails: dupCaseworkers },
    });
  } catch (err) { next(err); }
});

/** POST /api/agencies/applications/:id/approve
 *  Atomic — see the router-level docstring for the exact row plan. */
agencyApplicationsReviewRouter.post('/:id/approve', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const result = await withTransaction(async (tx) => {
      // 1) Snapshot the application under FOR UPDATE so two Program
      //    Managers approving simultaneously don't both create agencies.
      const app = await tx.queryOne<any>(`
        SELECT * FROM tbl_agency_application
         WHERE agency_application_id = $1
         FOR UPDATE
      `, [id]);
      if (!app) { const e: any = new Error('Application not found'); e.status = 404; throw e; }
      if (app.status !== 'pending') {
        const e: any = new Error(`Application is already ${app.status}`); e.status = 409; throw e;
      }

      // Duplicate guard: refuse to approve into a second agency with the same
      // normalized name (also enforced by the unique index when present). Gives
      // the Program Manager a clean message instead of a raw constraint error.
      const existingAgency = await tx.queryOne<{ agency_name: string }>(`
        SELECT agency_name FROM tbl_agency
         WHERE is_approved = true
           AND lower(btrim(agency_name)) = lower(btrim($1))
         LIMIT 1
      `, [app.agency_name]);
      if (existingAgency) {
        const e: any = new Error(`An approved agency named "${existingAgency.agency_name}" already exists. Reject this as a duplicate, or rename the application if it's genuinely a different organization.`);
        e.status = 409; throw e;
      }

      // 2) Resolve lookup FKs for the address. City/county/state come as
      //    text on the form; use the closest existing lookup row or fall
      //    back to id=1 so the FK is always satisfied. This is optimistic —
      //    Program Manager can correct it later in the admin form.
      const cityRow    = await tx.queryOne<{ city_id: number }>(   `SELECT city_id FROM lkp_city WHERE LOWER(city) = LOWER($1) LIMIT 1`, [app.city]);
      const stateRow   = await tx.queryOne<{ state_id: number }>(  `SELECT state_id FROM lkp_state WHERE LOWER(state) = LOWER($1) OR LOWER(state) = LOWER($1) LIMIT 1`, [app.state]);
      const countyRow  = await tx.queryOne<{ county_id: number }>( `SELECT county_id FROM lkp_county ORDER BY county_id LIMIT 1`);
      const cityId    = cityRow?.city_id    ?? 1;
      const stateId   = stateRow?.state_id  ?? 1;
      const countyId  = countyRow?.county_id ?? 1;

      // Pick the agency-type row. Applicants don't specify one; use "Nonprofit"
      // if present, else the first available row.
      const typeRow = await tx.queryOne<{ agency_type_id: number }>(`
        SELECT agency_type_id FROM lkp_agency_type
         ORDER BY CASE WHEN agency_type ILIKE 'Nonprofit' THEN 0 ELSE 1 END, agency_type_id
         LIMIT 1
      `);
      if (!typeRow) { const e: any = new Error('lkp_agency_type is empty — cannot create agency'); e.status = 500; throw e; }

      // 3) Address
      const address = await tx.queryOne<{ address_id: number }>(`
        INSERT INTO tbl_address
          (address_type_id, address_name, address, address2,
           city_id, county_id, state_id, postalcode)
        VALUES (1, 'Main office', $1, $2, $3, $4, $5, $6)
        RETURNING address_id
      `, [app.address_line1, app.address_line2, cityId, countyId, stateId, app.postalcode]);

      // 4) Agency row — approval + application-derived fields
      const agency = await tx.queryOne<{ agency_id: number }>(`
        INSERT INTO tbl_agency
          (agency_name, address_id, agency_type_id, description,
           is_approved, approval_date, approved_by_user_account_id,
           public_description, service_area, website, ein, main_phone,
           main_email, executive_director_name, needs_filled,
           approx_clients_per_month)
        VALUES ($1, $2, $3, $4,
                true, NOW(), $5,
                $6, $7, $8, $9, $10,
                $11, $12, $13, $14)
        RETURNING agency_id
      `, [
        app.agency_name, address!.address_id, typeRow.agency_type_id,
        app.public_description ?? app.agency_name,
        req.user?.user_account_id ?? null,
        app.public_description, app.service_area, app.website, app.ein, app.main_phone,
        app.main_email, app.executive_director_name, app.needs_filled,
        app.approx_clients_per_month,
      ]);
      const agencyId = agency!.agency_id;

      // 5) Populations served — copy from application to the join
      await tx.query(`
        INSERT INTO tbl_agency_client_type (agency_id, client_type_id)
        SELECT $1, client_type_id
          FROM tbl_agency_application_client_type
         WHERE agency_application_id = $2
      `, [agencyId, id]);

      // 6) Caseworkers — one contact + agency_contact + invitation per row
      const caseworkers = await tx.query<any>(`
        SELECT * FROM tbl_agency_application_caseworker
         WHERE agency_application_id = $1
      `, [id]);

      const clientContactTypeRow = await tx.queryOne<{ contact_type_id: number }>(`
        SELECT contact_type_id FROM lkp_contact_type
         ORDER BY CASE WHEN contact_type ILIKE 'Caseworker' THEN 0
                       WHEN contact_type ILIKE 'Agency' THEN 1
                       ELSE 2 END, contact_type_id LIMIT 1
      `);
      const contactTypeId = clientContactTypeRow?.contact_type_id ?? 1;

      const invitations: Array<{
        caseworker_invitation_id: number;
        agency_contact_id: number;
        email: string;
        first_name: string;
        last_name: string;
        token: string;
      }> = [];

      for (const cw of caseworkers) {
        // Contact — reuse an existing person by email instead of creating a
        // duplicate tbl_contact (a caseworker may already exist, e.g. at
        // another agency). Only insert a fresh row when the email is new or
        // blank. Existing rows keep their current name/phone.
        let contactId: number;
        const existingContact = cw.email
          ? await tx.queryOne<{ contact_id: number }>(
              `SELECT contact_id FROM tbl_contact WHERE lower(email) = lower($1) ORDER BY contact_id LIMIT 1`,
              [cw.email],
            )
          : null;
        if (existingContact) {
          contactId = existingContact.contact_id;
        } else {
          const contact = await tx.queryOne<{ contact_id: number }>(`
            INSERT INTO tbl_contact (contact_type_id, first_name, last_name, email, mobile_phone)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING contact_id
          `, [contactTypeId, cw.first_name, cw.last_name, cw.email, cw.phone]);
          contactId = contact!.contact_id;
        }

        // Agency contact — link this (new or existing) person to the new
        // agency. Guard against a duplicate link if the same person appears
        // twice, or is somehow already linked to this agency.
        const agencyContact = await tx.queryOne<{ agency_contact_id: number }>(`
          INSERT INTO tbl_agency_contact (agency_id, contact_id, description)
          SELECT $1, $2, $3
           WHERE NOT EXISTS (
             SELECT 1 FROM tbl_agency_contact WHERE agency_id = $1 AND contact_id = $2
           )
          RETURNING agency_contact_id
        `, [agencyId, contactId, cw.title || null]);
        // If the link already existed, fetch it so the rest of the loop works.
        const agencyContactId = agencyContact?.agency_contact_id
          ?? (await tx.queryOne<{ agency_contact_id: number }>(
               `SELECT agency_contact_id FROM tbl_agency_contact WHERE agency_id = $1 AND contact_id = $2 LIMIT 1`,
               [agencyId, contactId],
             ))!.agency_contact_id;

        // Backfill the caseworker row on the application with the newly
        // minted agency_contact_id (audit trail for later reference).
        await tx.query(`
          UPDATE tbl_agency_application_caseworker
             SET agency_contact_id = $2
           WHERE agency_application_caseworker_id = $1
        `, [cw.agency_application_caseworker_id, agencyContactId]);

        // Invitation with a secure random 32-byte hex token
        const token = randomBytes(32).toString('hex');
        const invitation = await tx.queryOne<{ caseworker_invitation_id: number }>(`
          INSERT INTO tbl_caseworker_invitation
            (token, agency_id, agency_contact_id, email, status)
          VALUES ($1, $2, $3, $4, 'pending')
          RETURNING caseworker_invitation_id
        `, [token, agencyId, agencyContactId, cw.email]);

        invitations.push({
          caseworker_invitation_id: invitation!.caseworker_invitation_id,
          agency_contact_id: agencyContactId,
          email: cw.email,
          first_name: cw.first_name,
          last_name: cw.last_name,
          token,
        });
      }

      // 7) Flip the application to approved + link the created agency
      await tx.query(`
        UPDATE tbl_agency_application
           SET status = 'approved',
               reviewed_at = NOW(),
               reviewed_by_user_account_id = $2,
               approved_agency_id = $3
         WHERE agency_application_id = $1
      `, [id, req.user?.user_account_id ?? null, agencyId]);

      // Audit — a single CREATE per major entity keeps the log readable.
      await auditCreate(req, 'tbl_agency', agencyId, {
        agency_name: app.agency_name,
        approved_from_application_id: id,
        caseworker_invitations_issued: invitations.length,
      }, tx);

      return { agency_id: agencyId, invitations };
    });

    res.json(result);
  } catch (err) { next(err); }
});

/** POST /api/agencies/applications/:id/reject { note } */
agencyApplicationsReviewRouter.post('/:id/reject', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const note = String(req.body?.note ?? '').trim() || null;

    await withTransaction(async (tx) => {
      const app = await tx.queryOne<any>(`
        SELECT * FROM tbl_agency_application WHERE agency_application_id = $1 FOR UPDATE
      `, [id]);
      if (!app) { const e: any = new Error('Application not found'); e.status = 404; throw e; }
      if (app.status !== 'pending') {
        const e: any = new Error(`Application is already ${app.status}`); e.status = 409; throw e;
      }

      const after = await tx.queryOne<any>(`
        UPDATE tbl_agency_application
           SET status = 'rejected',
               reviewed_at = NOW(),
               reviewed_by_user_account_id = $2,
               rejection_note = $3
         WHERE agency_application_id = $1
         RETURNING *
      `, [id, req.user?.user_account_id ?? null, note]);
      if (after) await auditUpdate(req, 'tbl_agency_application', id, app, after, tx);
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

/** GET /api/agencies/applications/:id/invitation-preview/:cwId
 *  Returns { subject, plaintext, html, url } — the Program Manager copies
 *  this into the Agency_Onboarding@Furnish-Hope.com Google group email
 *  until FH's mailbox is connected in production. */
agencyApplicationsReviewRouter.get('/:id/invitation-preview/:cwId', async (req, res, next) => {
  try {
    const id   = Number(req.params.id);
    const cwId = Number(req.params.cwId);
    if (!Number.isInteger(id) || !Number.isInteger(cwId)) return res.status(400).json({ error: 'Invalid ids' });

    const invitation = await queryOne<any>(`
      SELECT ci.token, ci.email, ci.expires_at, ci.status,
             cnt.first_name, cnt.last_name,
             ag.agency_name,
             (SELECT setting_value FROM tbl_app_setting WHERE setting_key = 'agency_onboarding_from_email') AS from_email
        FROM tbl_caseworker_invitation ci
        JOIN tbl_agency_contact ac ON ac.agency_contact_id = ci.agency_contact_id
        JOIN tbl_contact cnt       ON cnt.contact_id       = ac.contact_id
        JOIN tbl_agency ag         ON ag.agency_id         = ci.agency_id
       WHERE ci.caseworker_invitation_id = $1
    `, [cwId]);
    if (!invitation) return res.status(404).json({ error: 'Invitation not found' });

    const appBaseUrl = process.env.APP_BASE_URL ?? `${req.protocol}://${req.get('host')}`;
    const signupUrl = `${appBaseUrl}/caseworker-register/${invitation.token}`;
    const fromEmail = invitation.from_email || 'Agency_Onboarding@Furnish-Hope.com';
    const expiresLabel = new Date(invitation.expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const subject = `Welcome to Furnish Hope — set up your ${invitation.agency_name} referral account`;
    const plaintext = `Hi ${invitation.first_name},

Great news — Furnish Hope has approved ${invitation.agency_name} as a
referring partner. You've been listed as a caseworker on your agency's
application, and you can now set up your own portal login so you can
start submitting referrals for the families you serve.

Click the link below to create your username and password. It's good
until ${expiresLabel}.

  ${signupUrl}

If the link doesn't work or expires, reply to this email and someone
from ${fromEmail} will send you a fresh invitation.

Welcome aboard,
The Furnish Hope team`;

    const html = `<p>Hi ${escapeHtml(invitation.first_name)},</p>
<p>Great news — Furnish Hope has approved <strong>${escapeHtml(invitation.agency_name)}</strong> as a referring partner. You've been listed as a caseworker on your agency's application, and you can now set up your own portal login so you can start submitting referrals for the families you serve.</p>
<p>Click the link below to create your username and password. It's good until <strong>${escapeHtml(expiresLabel)}</strong>.</p>
<p><a href="${signupUrl}">${signupUrl}</a></p>
<p>If the link doesn't work or expires, reply to this email and someone from <a href="mailto:${escapeHtml(fromEmail)}">${escapeHtml(fromEmail)}</a> will send you a fresh invitation.</p>
<p>Welcome aboard,<br>The Furnish Hope team</p>`;

    res.json({
      to: invitation.email,
      from: fromEmail,
      subject, plaintext, html, url: signupUrl,
      expires_at: invitation.expires_at,
      status: invitation.status,
    });
  } catch (err) { next(err); }
});

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
