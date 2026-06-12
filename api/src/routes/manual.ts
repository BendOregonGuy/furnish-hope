/**
 * User-manual screenshot management. The manual itself is rendered
 * client-side (static React content), but the images embedded in
 * the placeholder slots come from this endpoint. Admins upload
 * images to fill named slots; logged-in users read them via the
 * `/image` route.
 *
 *   GET    /api/manual/screenshots                 list all (metadata only)
 *   GET    /api/manual/screenshots/:slug/image     serve the image bytes
 *   PUT    /api/manual/screenshots/:slug           upload / replace
 *                                                  body: { content_base64, content_type,
 *                                                          filename, caption?, audience? }
 *   DELETE /api/manual/screenshots/:slug           remove a slot's image
 *
 * Uploads cap at 2MB per image. Allowed content types: png, jpeg, webp, gif.
 * Reading the list and the images requires login. Writing (PUT/DELETE)
 * requires admin.
 */

import { Router } from 'express';
import { query, queryOne } from '../db/pool.js';
import { auditCreate, auditDelete, auditUpdate } from '../auth/audit.js';
import { requireAdmin } from '../auth/middleware.js';

export const manualRouter = Router();

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_BYTES = 2 * 1024 * 1024;  // 2MB

interface ListRow {
  slug: string;
  audience: string;
  caption: string | null;
  content_type: string;
  filename: string | null;
  byte_size: number;
  uploaded_at: string;
}

manualRouter.get('/screenshots', async (_req, res, next) => {
  try {
    const rows = await query<ListRow>(`
      SELECT slug, audience, caption, content_type, filename, byte_size, uploaded_at
        FROM tbl_manual_screenshot
       ORDER BY audience, slug
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

manualRouter.get('/screenshots/:slug/image', async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').toLowerCase();
    if (!isValidSlug(slug)) return res.status(400).json({ error: 'Invalid slug' });
    const row = await queryOne<{ image_data: Buffer; content_type: string }>(
      `SELECT image_data, content_type FROM tbl_manual_screenshot WHERE slug = $1`, [slug],
    );
    if (!row) return res.status(404).json({ error: 'No screenshot for that slug yet' });
    res.setHeader('Content-Type', row.content_type);
    // Cache aggressively at the browser. If the image changes, the
    // slug doesn't — admins clear the cache or hard-refresh after
    // upload. Most users will see a fresh image on next load.
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(row.image_data);
  } catch (err) { next(err); }
});

manualRouter.put('/screenshots/:slug', requireAdmin, async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').toLowerCase();
    if (!isValidSlug(slug)) return res.status(400).json({ error: 'Invalid slug' });

    const body = req.body as {
      content_base64?: string;
      content_type?: string;
      filename?: string;
      caption?: string | null;
      audience?: 'staff' | 'agency';
    };
    if (!body?.content_base64) return res.status(400).json({ error: 'content_base64 required' });
    if (!body?.content_type)   return res.status(400).json({ error: 'content_type required' });
    if (!ALLOWED_TYPES.has(body.content_type)) {
      return res.status(400).json({ error: `Unsupported content_type. Allowed: ${[...ALLOWED_TYPES].join(', ')}` });
    }

    let bytes: Buffer;
    try {
      bytes = Buffer.from(body.content_base64, 'base64');
    } catch {
      return res.status(400).json({ error: 'Invalid base64 in content_base64' });
    }
    if (bytes.length === 0)       return res.status(400).json({ error: 'Empty image' });
    if (bytes.length > MAX_BYTES) return res.status(400).json({ error: `Image exceeds ${MAX_BYTES} bytes (${Math.round(MAX_BYTES/1024/1024)}MB).` });

    const audience = body.audience === 'agency' ? 'agency' : 'staff';
    const userId = req.user?.user_account_id ?? null;
    const before = await queryOne<Record<string, any>>(
      `SELECT slug, audience, caption, filename, byte_size FROM tbl_manual_screenshot WHERE slug = $1`, [slug],
    );

    const after = await queryOne<Record<string, any>>(`
      INSERT INTO tbl_manual_screenshot
        (slug, audience, caption, image_data, content_type, filename, byte_size,
         uploaded_at, uploaded_by_user_account_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
      ON CONFLICT (slug) DO UPDATE
         SET audience     = EXCLUDED.audience,
             caption      = EXCLUDED.caption,
             image_data   = EXCLUDED.image_data,
             content_type = EXCLUDED.content_type,
             filename     = EXCLUDED.filename,
             byte_size    = EXCLUDED.byte_size,
             uploaded_at  = EXCLUDED.uploaded_at,
             uploaded_by_user_account_id = EXCLUDED.uploaded_by_user_account_id
      RETURNING slug, audience, caption, content_type, filename, byte_size, uploaded_at
    `, [
      slug, audience, body.caption ?? null, bytes,
      body.content_type, body.filename ?? null, bytes.length, userId,
    ]);

    if (before) await auditUpdate(req, 'tbl_manual_screenshot', 0, before, after!);
    else        await auditCreate(req, 'tbl_manual_screenshot', 0, after!);
    res.status(before ? 200 : 201).json({ screenshot: after });
  } catch (err) { next(err); }
});

manualRouter.delete('/screenshots/:slug', requireAdmin, async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').toLowerCase();
    if (!isValidSlug(slug)) return res.status(400).json({ error: 'Invalid slug' });
    const before = await queryOne<Record<string, any>>(
      `SELECT slug, audience, caption, filename, byte_size FROM tbl_manual_screenshot WHERE slug = $1`, [slug],
    );
    if (!before) return res.status(404).json({ error: 'No screenshot to delete' });
    await query(`DELETE FROM tbl_manual_screenshot WHERE slug = $1`, [slug]);
    await auditDelete(req, 'tbl_manual_screenshot', 0, before);
    res.status(204).end();
  } catch (err) { next(err); }
});

/** Slug is the placeholder identifier — kebab-case, alphanumeric +
 *  dashes. Same character set as a URL path segment. Guards against
 *  path-traversal or weird characters in the database key. */
function isValidSlug(s: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,79}$/.test(s);
}
