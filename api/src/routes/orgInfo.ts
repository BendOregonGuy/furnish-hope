/**
 * Lightweight read-only endpoint exposing the org's public-ish identity:
 * name, address, phone, email, EIN, receipt prefix.
 *
 * Used by pickup/delivery manifests (header + tax acknowledgement) and
 * future receipt PDFs. Mounted at /api/org-info, behind requireUser like
 * everything else under /api — so it's signed-in-users-only but not
 * admin-only. (Admin-only would block volunteer staff who legitimately
 * need to print manifests.)
 *
 * Values come from tbl_app_setting; whatever the admin has set via
 * /admin/settings is what gets returned.
 */

import { Router } from 'express';
import { query, queryOne } from '../db/pool.js';

export const orgInfoRouter = Router();

interface OrgInfo {
  org_name: string;
  org_address_line1: string;
  org_address_line2: string;
  org_city: string;
  org_state: string;
  org_postalcode: string;
  org_phone: string;
  org_email: string;
  org_ein: string;
  receipt_prefix: string;
  acknowledgement_threshold: string;
}

// Keys we'll surface — anything else stays in /admin/settings.
const KEYS: Array<keyof OrgInfo> = [
  'org_name', 'org_address_line1', 'org_address_line2',
  'org_city', 'org_state', 'org_postalcode',
  'org_phone', 'org_email', 'org_ein',
  'receipt_prefix', 'acknowledgement_threshold',
];

orgInfoRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await query<{ setting_key: string; setting_value: string }>(
      `SELECT setting_key, setting_value FROM tbl_app_setting WHERE setting_key = ANY($1)`,
      [KEYS],
    );
    const map: Record<string, string> = {};
    for (const k of KEYS) map[k] = '';
    for (const r of rows) map[r.setting_key] = r.setting_value ?? '';

    // Tack on a has_logo flag + a cache-busting key so the UI knows
    // whether to fetch /api/org-info/logo. The key changes whenever
    // the logo is updated/deleted, so the browser refetches the right
    // version.
    const logo = await queryOne<{ has_logo: boolean; updated_at: string }>(
      `SELECT (logo_data IS NOT NULL) AS has_logo, updated_at FROM tbl_org_branding WHERE branding_id = 1`,
    );
    (map as any).has_logo = !!logo?.has_logo;
    (map as any).logo_updated_at = logo?.updated_at ?? null;
    res.json(map);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  GET /api/org-info/logo — stream the logo bytes                    */
/*  Long-cached because the URL includes ?v=<updated_at> for          */
/*  invalidation on upload/delete.                                    */
/* ----------------------------------------------------------------- */

orgInfoRouter.get('/logo', async (_req, res, next) => {
  try {
    const row = await queryOne<{ logo_data: Buffer | null; content_type: string | null }>(
      `SELECT logo_data, content_type FROM tbl_org_branding WHERE branding_id = 1`,
    );
    if (!row || !row.logo_data || !row.content_type) {
      return res.status(404).json({ error: 'No logo set' });
    }
    res.setHeader('Content-Type', row.content_type);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(row.logo_data);
  } catch (err) { next(err); }
});
