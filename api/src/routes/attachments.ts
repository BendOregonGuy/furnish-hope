/**
 * Generic per-entity attachments — upload, list, edit, download, delete.
 * Entity-agnostic: the (entity_type, entity_id) pair points at any row
 * the rest of the app understands. Storage is delegated to the
 * StorageProvider abstraction so we can swap pg_blob for object
 * storage later without rewriting any of this.
 *
 *   POST   /api/attachments/:entity_type/:entity_id
 *   GET    /api/attachments/:entity_type/:entity_id
 *   GET    /api/attachments/:id/download
 *   PUT    /api/attachments/:id   (rename / edit description)
 *   DELETE /api/attachments/:id
 *
 * Plus, for the admin storage page:
 *   GET    /api/attachments/stats
 *   GET    /api/attachments/providers
 */

import { Router, json } from 'express';
import { query, queryOne } from '../db/pool.js';
import { auditCreate, auditUpdate, auditDelete } from '../auth/audit.js';
import { getProvider, getDefaultProvider, listProviders } from '../storage/index.js';

export const attachmentsRouter = Router();

/* ----------------------------------------------------------------- */
/*  Body-parser limit                                                 */
/*                                                                    */
/*  The app's default JSON body limit is 1MB. File uploads land here  */
/*  as base64-encoded JSON, so a 10MB file is ~13.4MB of JSON. Set a  */
/*  higher cap on this router only — the global default stays small.  */
/* ----------------------------------------------------------------- */

attachmentsRouter.use(json({ limit: '20mb' }));

const MAX_BYTES = 10 * 1024 * 1024;   // 10 MB
const VALID_ENTITY_TYPES = new Set([
  'donor', 'client', 'volunteer', 'contact', 'agency',
  'pickup', 'delivery', 'campaign', 'event', 'pledge', 'donation',
  'request', 'inventory', 'corp_facility', 'vehicle',
]);

function isValidEntityType(t: string): boolean {
  return VALID_ENTITY_TYPES.has(t);
}

/* ----------------------------------------------------------------- */
/*  POST /:entity_type/:entity_id — upload                            */
/* ----------------------------------------------------------------- */

interface UploadPayload {
  filename: string;
  mime_type: string;
  content_base64: string;        // base64 of the file bytes
  description?: string | null;
}

attachmentsRouter.post('/:entity_type/:entity_id', async (req, res, next) => {
  try {
    const entityType = String(req.params.entity_type).toLowerCase();
    const entityId   = Number(req.params.entity_id);
    if (!isValidEntityType(entityType)) {
      return res.status(400).json({ error: `Unknown entity_type: ${entityType}` });
    }
    if (!Number.isInteger(entityId) || entityId <= 0) {
      return res.status(400).json({ error: 'Invalid entity_id' });
    }

    const body = req.body as UploadPayload;
    if (!body?.filename?.trim()) return res.status(400).json({ error: 'filename is required' });
    if (!body?.mime_type?.trim()) return res.status(400).json({ error: 'mime_type is required' });
    if (!body?.content_base64) return res.status(400).json({ error: 'content_base64 is required' });

    let bytes: Buffer;
    try {
      bytes = Buffer.from(body.content_base64, 'base64');
    } catch {
      return res.status(400).json({ error: 'content_base64 is not valid base64' });
    }
    if (bytes.length === 0) return res.status(400).json({ error: 'File is empty' });
    if (bytes.length > MAX_BYTES) {
      return res.status(413).json({ error: `File too large (${(bytes.length / 1024 / 1024).toFixed(1)} MB > 10 MB limit). Pick a smaller file or compress it.` });
    }

    // Defer to whichever storage provider is currently default.
    const provider = await getDefaultProvider();
    const { ref } = await provider.put({ bytes, mimeType: body.mime_type, filename: body.filename });

    // Cap filename length to fit the column.
    const safeName = body.filename.slice(0, 255);
    const safeMime = body.mime_type.slice(0, 150);
    const safeDesc = body.description?.slice(0, 500) ?? null;

    const row = await queryOne<{ attachment_id: number }>(`
      INSERT INTO tbl_entity_attachment
        (entity_type, entity_id, filename, mime_type, size_bytes, description,
         storage_provider, storage_ref,
         uploaded_by_user_account_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING attachment_id
    `, [
      entityType, entityId, safeName, safeMime, bytes.length, safeDesc,
      provider.name, ref,
      req.user!.user_account_id,
    ]);

    await auditCreate(req, 'tbl_entity_attachment', row!.attachment_id, {
      entity_type: entityType, entity_id: entityId, filename: safeName, size_bytes: bytes.length,
    });

    res.status(201).json({ attachment_id: row!.attachment_id });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  GET /:id/download — stream the file bytes                         */
/*                                                                    */
/*  IMPORTANT: must be declared BEFORE GET /:entity_type/:entity_id.  */
/*  Express picks the first matching route, and `/123/download`       */
/*  also matches the two-param list pattern. The literal "download"   */
/*  segment in the path makes this one more specific, but Express     */
/*  doesn't reorder for specificity — declaration order wins.         */
/* ----------------------------------------------------------------- */

attachmentsRouter.get('/:id/download', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const row = await queryOne<{
      filename: string; mime_type: string; storage_provider: string; storage_ref: string; external_url: string | null;
    }>(`
      SELECT filename, mime_type, storage_provider, storage_ref, external_url
      FROM tbl_entity_attachment WHERE attachment_id = $1
    `, [id]);
    if (!row) return res.status(404).json({ error: 'Attachment not found' });

    // If the provider hosts the file externally (Drive, etc.) and we have
    // a direct URL, redirect instead of streaming through us.
    if (row.external_url) {
      return res.redirect(row.external_url);
    }

    const provider = getProvider(row.storage_provider);
    const bytes = await provider.get(row.storage_ref);

    res.setHeader('Content-Type', row.mime_type);
    res.setHeader('Content-Length', String(bytes.length));
    // inline so PDFs/images render in the browser; downloads still
    // work via the filename hint.
    res.setHeader('Content-Disposition', `inline; filename="${row.filename.replace(/"/g, '')}"`);
    res.send(bytes);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  GET /:entity_type/:entity_id — list                               */
/* ----------------------------------------------------------------- */

attachmentsRouter.get('/:entity_type/:entity_id', async (req, res, next) => {
  try {
    const entityType = String(req.params.entity_type).toLowerCase();
    const entityId   = Number(req.params.entity_id);
    if (!isValidEntityType(entityType)) return res.status(400).json({ error: 'Unknown entity_type' });
    if (!Number.isInteger(entityId) || entityId <= 0) return res.status(400).json({ error: 'Invalid entity_id' });

    // display_name on tbl_user_account is computed (via facility_staff →
    // contact) rather than stored, so we mirror the middleware's join here.
    const rows = await query(`
      SELECT
        a.attachment_id,
        a.filename,
        a.mime_type,
        a.size_bytes,
        a.description,
        a.storage_provider,
        a.external_url,
        a.uploaded_at,
        a.last_modified_at,
        u.username AS uploaded_by_username,
        COALESCE(c.first_name || ' ' || c.last_name, u.username) AS uploaded_by_name
      FROM tbl_entity_attachment a
      LEFT JOIN tbl_user_account u   ON u.user_account_id = a.uploaded_by_user_account_id
      LEFT JOIN tbl_facility_staff fs ON fs.facility_staff_id = u.facility_staff_id
      LEFT JOIN tbl_contact c        ON c.contact_id = fs.contact_id
      WHERE a.entity_type = $1 AND a.entity_id = $2
      ORDER BY a.uploaded_at DESC
    `, [entityType, entityId]);

    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  PUT /:id — rename / edit description                              */
/* ----------------------------------------------------------------- */

attachmentsRouter.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const { filename, description } = req.body ?? {};
    const before = await queryOne(`SELECT * FROM tbl_entity_attachment WHERE attachment_id = $1`, [id]);
    if (!before) return res.status(404).json({ error: 'Attachment not found' });

    const after = await queryOne(`
      UPDATE tbl_entity_attachment
         SET filename = COALESCE($1, filename),
             description = $2,
             last_modified_at = NOW()
       WHERE attachment_id = $3
       RETURNING *
    `, [
      filename?.trim() ? filename.trim().slice(0, 255) : null,
      description?.trim() ? description.trim().slice(0, 500) : null,
      id,
    ]);
    if (after) await auditUpdate(req, 'tbl_entity_attachment', id, before, after);

    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  DELETE /:id                                                       */
/* ----------------------------------------------------------------- */

attachmentsRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const before = await queryOne<{ storage_provider: string; storage_ref: string }>(
      `SELECT * FROM tbl_entity_attachment WHERE attachment_id = $1`, [id],
    );
    if (!before) return res.status(404).json({ error: 'Attachment not found' });

    // Delete the metadata row first; THEN best-effort delete the blob.
    // Order matters: if blob delete fails (network blip on remote
    // storage), the metadata is gone so the user doesn't see a ghost
    // row pointing at unreachable content. Orphan blobs are cleanable
    // by a future GC job; orphan metadata rows are user-visible bugs.
    await query(`DELETE FROM tbl_entity_attachment WHERE attachment_id = $1`, [id]);
    await auditDelete(req, 'tbl_entity_attachment', id, before);

    try {
      const provider = getProvider(before.storage_provider);
      await provider.delete(before.storage_ref);
    } catch (err: any) {
      console.error('[attachments] blob delete failed (metadata gone OK):', err.message);
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Admin storage page support                                        */
/* ----------------------------------------------------------------- */

/** GET /stats — totals for the admin storage page. */
attachmentsRouter.get('/stats', async (_req, res, next) => {
  try {
    const totals = await queryOne<{
      count: string; total_bytes: string;
    }>(`
      SELECT COUNT(*)::text AS count, COALESCE(SUM(size_bytes), 0)::text AS total_bytes
      FROM tbl_entity_attachment
    `);
    const byProvider = await query<{
      storage_provider: string; count: string; total_bytes: string;
    }>(`
      SELECT storage_provider, COUNT(*)::text AS count, COALESCE(SUM(size_bytes), 0)::text AS total_bytes
      FROM tbl_entity_attachment
      GROUP BY storage_provider
      ORDER BY storage_provider
    `);
    const byEntity = await query<{
      entity_type: string; count: string; total_bytes: string;
    }>(`
      SELECT entity_type, COUNT(*)::text AS count, COALESCE(SUM(size_bytes), 0)::text AS total_bytes
      FROM tbl_entity_attachment
      GROUP BY entity_type
      ORDER BY entity_type
    `);
    res.json({
      totals: { count: Number(totals?.count ?? 0), total_bytes: Number(totals?.total_bytes ?? 0) },
      byProvider: byProvider.map(p => ({ ...p, count: Number(p.count), total_bytes: Number(p.total_bytes) })),
      byEntity:   byEntity.map(p => ({ ...p, count: Number(p.count), total_bytes: Number(p.total_bytes) })),
    });
  } catch (err) { next(err); }
});

/** GET /providers — list known providers + which are currently configured. */
attachmentsRouter.get('/providers', async (_req, res, next) => {
  try {
    res.json({ providers: listProviders() });
  } catch (err) { next(err); }
});
