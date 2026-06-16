/**
 * App-wide broadcasts. A developer composes a banner message ("Save your
 * work — deploying a fix in 2 minutes") and every signed-in user sees it
 * at the top of every page until they dismiss it. Refresh-required
 * broadcasts include a Refresh button on the banner.
 *
 *   GET    /api/broadcasts/active        any signed-in user
 *   POST   /api/broadcasts/:id/dismiss   any signed-in user (per-user)
 *   POST   /api/broadcasts               developer
 *   GET    /api/broadcasts               developer (history)
 *   PUT    /api/broadcasts/:id           developer (deactivate, edit)
 *   DELETE /api/broadcasts/:id           developer
 */

import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditCreate, auditUpdate, auditDelete } from '../auth/audit.js';
import { requireDeveloper } from '../auth/middleware.js';

export const broadcastsRouter = Router();

const VALID_KINDS = ['info', 'refresh_required', 'warning'] as const;

interface CreatePayload {
  message: string;
  kind?: 'info' | 'refresh_required' | 'warning';
  related_issue_id?: number | null;
  expires_at?: string | null;
}

/* ----------------------------------------------------------------- */
/*  Active broadcasts for the current user (any signed-in user)       */
/* ----------------------------------------------------------------- */

broadcastsRouter.get('/active', async (req, res, next) => {
  try {
    const userId = req.user!.user_account_id;
    const rows = await query(`
      SELECT
        b.broadcast_id,
        b.message,
        b.kind,
        b.created_at,
        b.expires_at,
        b.related_issue_id,
        u.username AS created_by_username
      FROM tbl_app_broadcast b
      LEFT JOIN tbl_user_account u ON u.user_account_id = b.created_by_user_account_id
      WHERE b.is_active = true
        AND (b.expires_at IS NULL OR b.expires_at > NOW())
        AND NOT EXISTS (
          SELECT 1 FROM tbl_app_broadcast_dismissal d
           WHERE d.broadcast_id = b.broadcast_id
             AND d.user_account_id = $1
        )
      ORDER BY b.created_at DESC
    `, [userId]);
    res.json(rows);
  } catch (err) { next(err); }
});

broadcastsRouter.post('/:id/dismiss', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const userId = req.user!.user_account_id;
    await query(`
      INSERT INTO tbl_app_broadcast_dismissal (broadcast_id, user_account_id)
      VALUES ($1, $2)
      ON CONFLICT (broadcast_id, user_account_id) DO NOTHING
    `, [id, userId]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Developer endpoints                                               */
/* ----------------------------------------------------------------- */

broadcastsRouter.get('/', requireDeveloper, async (_req, res, next) => {
  try {
    const rows = await query(`
      SELECT
        b.broadcast_id, b.message, b.kind, b.is_active,
        b.created_at, b.expires_at, b.related_issue_id,
        b.created_by_user_account_id,
        u.username AS created_by_username,
        (SELECT COUNT(*)::int FROM tbl_app_broadcast_dismissal d
          WHERE d.broadcast_id = b.broadcast_id) AS dismissal_count
      FROM tbl_app_broadcast b
      LEFT JOIN tbl_user_account u ON u.user_account_id = b.created_by_user_account_id
      ORDER BY b.created_at DESC
      LIMIT 200
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

broadcastsRouter.post('/', requireDeveloper, async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as CreatePayload;
    if (!body.message?.trim()) return res.status(400).json({ error: 'message required' });
    const kind = body.kind && VALID_KINDS.includes(body.kind) ? body.kind : 'info';

    const newId = await withTransaction(async (tx) => {
      const r = await tx.queryOne<Record<string, any>>(`
        INSERT INTO tbl_app_broadcast
          (message, kind, related_issue_id, expires_at, created_by_user_account_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [
        body.message.trim(),
        kind,
        body.related_issue_id ?? null,
        body.expires_at ?? null,
        req.user!.user_account_id,
      ]);
      await auditCreate(req, 'tbl_app_broadcast', r!.broadcast_id, r!, tx);
      return r!.broadcast_id as number;
    });
    res.status(201).json({ broadcast_id: newId });
  } catch (err) { next(err); }
});

broadcastsRouter.put('/:id', requireDeveloper, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const body = (req.body ?? {}) as { message?: string; kind?: string; is_active?: boolean; expires_at?: string | null };
    await withTransaction(async (tx) => {
      const before = await tx.queryOne<Record<string, any>>(
        `SELECT * FROM tbl_app_broadcast WHERE broadcast_id = $1`, [id],
      );
      if (!before) { const e: any = new Error('Broadcast not found'); e.status = 404; throw e; }
      const after = await tx.queryOne<Record<string, any>>(`
        UPDATE tbl_app_broadcast
           SET message = COALESCE($1, message),
               kind = COALESCE($2, kind),
               is_active = COALESCE($3, is_active),
               expires_at = $4
         WHERE broadcast_id = $5
         RETURNING *
      `, [
        body.message?.trim() ?? null,
        body.kind && VALID_KINDS.includes(body.kind as any) ? body.kind : null,
        typeof body.is_active === 'boolean' ? body.is_active : null,
        body.expires_at ?? before.expires_at,
        id,
      ]);
      if (after) await auditUpdate(req, 'tbl_app_broadcast', id, before, after, tx);
    });
    res.json({ broadcast_id: id });
  } catch (err) { next(err); }
});

broadcastsRouter.delete('/:id', requireDeveloper, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    await withTransaction(async (tx) => {
      const before = await tx.queryOne<Record<string, any>>(`SELECT * FROM tbl_app_broadcast WHERE broadcast_id = $1`, [id]);
      if (!before) { const e: any = new Error('Broadcast not found'); e.status = 404; throw e; }
      await tx.query(`DELETE FROM tbl_app_broadcast WHERE broadcast_id = $1`, [id]);
      await auditDelete(req, 'tbl_app_broadcast', id, before, tx);
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
