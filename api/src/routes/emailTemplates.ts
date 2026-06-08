/**
 * Per-user email templates. Pre-canned subject + body that staff can
 * apply to a Compose or Reply form to skip retyping the same message
 * for the 100th time (cash-gift thank-you, pickup confirmation,
 * volunteer welcome, etc).
 *
 * Templates are strictly per-user — no sharing yet. A future "org-wide"
 * flag is straightforward to add when needed. Per-user is the safer
 * default because each user's voice/tone differs.
 *
 * Placeholder substitution ({{donor_first_name}} etc) happens on the
 * client at apply-time. The server stores the raw text.
 */

import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditCreate, auditUpdate, auditDelete } from '../auth/audit.js';

export const emailTemplatesRouter = Router();

interface TemplateRow {
  email_template_id: number;
  user_account_id: number;
  name: string;
  description: string | null;
  subject: string | null;
  body: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface WritePayload {
  name: string;
  description?: string | null;
  subject?: string | null;
  body: string;
  sort_order?: number;
}

/* ----------------------------------------------------------------- */
/*  GET / — list this user's templates                                */
/* ----------------------------------------------------------------- */

emailTemplatesRouter.get('/', async (req, res, next) => {
  try {
    const rows = await query<TemplateRow>(`
      SELECT email_template_id, user_account_id, name, description, subject, body,
             sort_order, created_at, updated_at
      FROM tbl_email_template
      WHERE user_account_id = $1
      ORDER BY sort_order ASC, LOWER(name) ASC
    `, [req.user!.user_account_id]);
    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  GET /:id                                                          */
/* ----------------------------------------------------------------- */

emailTemplatesRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const row = await queryOne<TemplateRow>(`
      SELECT email_template_id, user_account_id, name, description, subject, body,
             sort_order, created_at, updated_at
      FROM tbl_email_template
      WHERE email_template_id = $1 AND user_account_id = $2
    `, [id, req.user!.user_account_id]);
    if (!row) return res.status(404).json({ error: 'Template not found' });
    res.json(row);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  POST / — create                                                    */
/* ----------------------------------------------------------------- */

emailTemplatesRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body as WritePayload;
    const errs = validate(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    const id = await withTransaction(async (tx) => {
      const r = await tx.queryOne<TemplateRow>(`
        INSERT INTO tbl_email_template (user_account_id, name, description, subject, body, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        req.user!.user_account_id,
        body.name.trim().slice(0, 120),
        body.description?.trim() || null,
        body.subject?.trim() || null,
        body.body,
        body.sort_order ?? 0,
      ]);
      await auditCreate(req, 'tbl_email_template', r!.email_template_id, r!, tx);
      return r!.email_template_id;
    });
    res.status(201).json({ email_template_id: id });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  PUT /:id                                                          */
/* ----------------------------------------------------------------- */

emailTemplatesRouter.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const body = req.body as WritePayload;
    const errs = validate(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    await withTransaction(async (tx) => {
      const before = await tx.queryOne<TemplateRow>(
        `SELECT * FROM tbl_email_template WHERE email_template_id = $1 AND user_account_id = $2`,
        [id, req.user!.user_account_id],
      );
      if (!before) {
        const e: any = new Error('Template not found');
        e.status = 404;
        throw e;
      }
      const after = await tx.queryOne<TemplateRow>(`
        UPDATE tbl_email_template
           SET name = $1, description = $2, subject = $3, body = $4, sort_order = $5,
               updated_at = NOW()
         WHERE email_template_id = $6 AND user_account_id = $7
         RETURNING *
      `, [
        body.name.trim().slice(0, 120),
        body.description?.trim() || null,
        body.subject?.trim() || null,
        body.body,
        body.sort_order ?? before.sort_order,
        id, req.user!.user_account_id,
      ]);
      if (after) await auditUpdate(req, 'tbl_email_template', id, before, after, tx);
    });
    res.json({ email_template_id: id });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  DELETE /:id                                                       */
/* ----------------------------------------------------------------- */

emailTemplatesRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    await withTransaction(async (tx) => {
      const before = await tx.queryOne<TemplateRow>(
        `SELECT * FROM tbl_email_template WHERE email_template_id = $1 AND user_account_id = $2`,
        [id, req.user!.user_account_id],
      );
      if (!before) {
        const e: any = new Error('Template not found');
        e.status = 404;
        throw e;
      }
      await tx.query(
        `DELETE FROM tbl_email_template WHERE email_template_id = $1 AND user_account_id = $2`,
        [id, req.user!.user_account_id],
      );
      await auditDelete(req, 'tbl_email_template', id, before, tx);
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

function validate(b: WritePayload): string[] {
  const errs: string[] = [];
  if (!b?.name?.trim()) errs.push('name required');
  if (!b?.body || !String(b.body).trim()) errs.push('body required');
  if (b?.name && b.name.length > 120) errs.push('name too long (120 max)');
  return errs;
}
