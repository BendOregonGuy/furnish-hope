/**
 * Public agency-partner application flow.
 *
 * Two routers:
 *  - publicApplicationRouter — mounted BEFORE requireUser.
 *      POST /api/public/agency-applications  — anonymous submission
 *      GET  /api/public/lookups/:name         — allowlisted reference data
 *                                                (client types, states)
 *  - Approve / reject / queue endpoints live in a Program-Manager router
 *    (see routes/agencyApplications.ts in Phase C).
 *
 * The public endpoint is a DOS + spam target — rate-limited to 5 posts
 * per IP per 15 min, plus an invisible honeypot field ("company_slogan")
 * that human applicants won't touch.
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { query, withTransaction } from '../db/pool.js';

export const publicAgencyApplicationRouter = Router();

// ---------------------------------------------------------------------- //
//  Public lookups                                                        //
// ---------------------------------------------------------------------- //

/** Allowlisted read-only lookups the public forms need. Distinct from the
 *  authenticated /api/lookups router so we can't accidentally leak
 *  operational reference tables through a shared endpoint. Returns
 *  {id, label} rows sorted by label. */
const PUBLIC_LOOKUP_ALLOWLIST: Record<string, { table: string; id: string; label: string }> = {
  client_type: { table: 'lkp_client_type', id: 'client_type_id', label: 'client_type' },
  state:       { table: 'lkp_state',       id: 'state_id',       label: 'state' },
  county:      { table: 'lkp_county',      id: 'county_id',      label: 'county' },
  city:        { table: 'lkp_city',        id: 'city_id',        label: 'city' },
};

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
