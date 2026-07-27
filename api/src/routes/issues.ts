/**
 * In-app issue tracker.
 *
 *   POST   /api/issues              admin   — file an issue (with screenshot)
 *   GET    /api/issues              developer — list, filterable
 *   GET    /api/issues/:id          developer — full detail
 *   PUT    /api/issues/:id          developer — update status/assignee/resolution
 *   GET    /api/issues/:id/screenshot  developer — stream the PNG
 *   DELETE /api/issues/:id          developer — delete
 *
 * The router is mounted twice in index.ts:
 *   - POST handler under /api/issues with requireAdmin
 *   - all other handlers under /api/issues with requireDeveloper
 * so an ordinary admin can FILE issues but only developers can triage.
 */

import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditCreate, auditUpdate, auditDelete } from '../auth/audit.js';

export const issuesRouter = Router();

interface CreatePayload {
  title: string;
  description: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  page_url?: string | null;
  page_title?: string | null;
  user_agent?: string | null;
  viewport_width?: number | null;
  viewport_height?: number | null;
  steps_to_reproduce?: string | null;
  expected_behavior?: string | null;
  actual_behavior?: string | null;
  screenshot_base64?: string | null;
  screenshot_content_type?: string | null;
}

interface UpdatePayload {
  status?: 'open' | 'investigating' | 'resolved' | 'closed';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  assignee_user_account_id?: number | null;
  resolution_notes?: string | null;
  title?: string;
  description?: string;
}

const VALID_STATUSES = ['open', 'investigating', 'resolved', 'closed'] as const;
const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

/** Returns true if the app-wide setting opens the Report Issue button to
 *  non-admin staff. Missing/unset is treated as false. */
async function isOpenToEveryone(): Promise<boolean> {
  const row = await queryOne<{ setting_value: string }>(
    `SELECT setting_value FROM tbl_app_setting WHERE setting_key = 'issue_reporter_visible_to_all'`,
  );
  return row?.setting_value === 'true';
}

/* ----------------------------------------------------------------- */
/*  Visibility — any signed-in staff user can ask "should I see the   */
/*  Report issue button?". Reply is { visible_to_all, can_report }.   */
/*  Declared BEFORE /:id so "visibility" isn't parsed as a numeric id.*/
/* ----------------------------------------------------------------- */

issuesRouter.get('/visibility', async (req, res, next) => {
  try {
    const visibleToAll = await isOpenToEveryone();
    res.json({
      visible_to_all: visibleToAll,
      can_report: !!req.user?.is_admin || visibleToAll,
    });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Create — admin always, or any staff if the setting is enabled.    */
/* ----------------------------------------------------------------- */

issuesRouter.post('/', async (req, res, next) => {
  try {
    // Authorization: admin OR (issue_reporter_visible_to_all = true).
    if (!req.user?.is_admin) {
      const open = await isOpenToEveryone();
      if (!open) {
        return res.status(403).json({ error: 'Only admins can file an issue. Ask an admin to flip "issue_reporter_visible_to_all" in App Settings to open this to everyone.' });
      }
    }
    const body = (req.body ?? {}) as CreatePayload;
    const errs: string[] = [];
    if (!body.title?.trim()) errs.push('title required');
    if (!body.description?.trim()) errs.push('description required');
    if (body.severity && !VALID_SEVERITIES.includes(body.severity)) errs.push('severity invalid');
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    // Decode the screenshot (base64) into a Buffer for BYTEA storage.
    let screenshotBuf: Buffer | null = null;
    let screenshotType: string | null = null;
    if (body.screenshot_base64) {
      try {
        screenshotBuf = Buffer.from(body.screenshot_base64, 'base64');
        screenshotType = body.screenshot_content_type || 'image/png';
        // Sanity cap — html2canvas can produce 5+ MB on big screens, but
        // a single issue shouldn't be allowed to bloat the table.
        if (screenshotBuf.length > 8 * 1024 * 1024) {
          return res.status(400).json({ error: 'Screenshot exceeds the 8 MB limit.' });
        }
      } catch {
        return res.status(400).json({ error: 'screenshot_base64 is not valid base64' });
      }
    }

    const newId = await withTransaction(async (tx) => {
      const r = await tx.queryOne<{ issue_id: number }>(`
        INSERT INTO tbl_app_issue
          (title, description, severity, page_url, page_title,
           user_agent, viewport_width, viewport_height,
           steps_to_reproduce, expected_behavior, actual_behavior,
           screenshot_data, screenshot_content_type, reporter_user_account_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING issue_id
      `, [
        body.title.trim().slice(0, 200),
        body.description.trim(),
        body.severity ?? 'medium',
        body.page_url ?? null,
        body.page_title?.slice(0, 200) ?? null,
        body.user_agent ?? null,
        body.viewport_width ?? null,
        body.viewport_height ?? null,
        body.steps_to_reproduce?.trim() || null,
        body.expected_behavior?.trim() || null,
        body.actual_behavior?.trim() || null,
        screenshotBuf,
        screenshotType,
        req.user!.user_account_id,
      ]);
      // Audit log — the BYTEA + base64 itself is masked via the
      // MASKED_FIELDS list in audit.ts so we can safely pass the row.
      const created = { ...body, screenshot_base64: undefined, screenshot_data: undefined, issue_id: r!.issue_id };
      await auditCreate(req, 'tbl_app_issue', r!.issue_id, created, tx);
      return r!.issue_id;
    });

    res.status(201).json({ issue_id: newId });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  List (developer)                                                  */
/* ----------------------------------------------------------------- */

issuesRouter.get('/', async (req, res, next) => {
  try {
    const params: any[] = [];
    const conds: string[] = [];
    if (req.query.status && typeof req.query.status === 'string' && VALID_STATUSES.includes(req.query.status as any)) {
      params.push(req.query.status);
      conds.push(`i.status = $${params.length}`);
    }
    if (req.query.severity && typeof req.query.severity === 'string' && VALID_SEVERITIES.includes(req.query.severity as any)) {
      params.push(req.query.severity);
      conds.push(`i.severity = $${params.length}`);
    }
    if (req.query.reporter_id) {
      const r = Number(req.query.reporter_id);
      if (Number.isInteger(r) && r > 0) {
        params.push(r);
        conds.push(`i.reporter_user_account_id = $${params.length}`);
      }
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 100)));
    params.push(limit);

    const rows = await query(`
      SELECT
        i.issue_id, i.title, i.severity, i.status, i.page_url,
        i.viewport_width, i.viewport_height,
        i.created_at, i.updated_at, i.resolved_at,
        i.reporter_user_account_id, i.assignee_user_account_id,
        reporter.username AS reporter_username,
        reporter_display.name AS reporter_display_name,
        assignee.username AS assignee_username,
        (i.screenshot_data IS NOT NULL) AS has_screenshot
      FROM tbl_app_issue i
      LEFT JOIN tbl_user_account reporter ON reporter.user_account_id = i.reporter_user_account_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(sc.first_name || ' ' || sc.last_name, reporter.username) AS name
        FROM tbl_user_account u2
        LEFT JOIN tbl_facility_staff fs ON fs.facility_staff_id = u2.facility_staff_id
        LEFT JOIN tbl_contact sc        ON sc.contact_id = fs.contact_id
        WHERE u2.user_account_id = i.reporter_user_account_id
      ) reporter_display ON true
      LEFT JOIN tbl_user_account assignee ON assignee.user_account_id = i.assignee_user_account_id
      ${where}
      ORDER BY
        CASE i.status WHEN 'open' THEN 0 WHEN 'investigating' THEN 1 WHEN 'resolved' THEN 2 ELSE 3 END,
        CASE i.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        i.created_at DESC
      LIMIT $${params.length}
    `, params);

    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Read one (developer)                                              */
/* ----------------------------------------------------------------- */

issuesRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const issue = await queryOne(`
      SELECT
        i.issue_id, i.title, i.description, i.severity, i.status,
        i.page_url, i.page_title, i.user_agent,
        i.viewport_width, i.viewport_height,
        i.steps_to_reproduce, i.expected_behavior, i.actual_behavior,
        i.resolution_notes, i.resolved_at,
        i.created_at, i.updated_at,
        i.reporter_user_account_id, i.assignee_user_account_id,
        (i.screenshot_data IS NOT NULL) AS has_screenshot,
        i.screenshot_content_type,
        reporter.username AS reporter_username,
        assignee.username AS assignee_username
      FROM tbl_app_issue i
      LEFT JOIN tbl_user_account reporter ON reporter.user_account_id = i.reporter_user_account_id
      LEFT JOIN tbl_user_account assignee ON assignee.user_account_id = i.assignee_user_account_id
      WHERE i.issue_id = $1
    `, [id]);

    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    res.json(issue);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Notes thread (developer) — list newest-first + add                */
/* ----------------------------------------------------------------- */

/** GET /api/issues/:id/notes — every triage note for an issue, most recent
 *  first, with the author's display name resolved. */
issuesRouter.get('/:id/notes', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const rows = await query(`
      SELECT
        n.issue_note_id, n.issue_id, n.note, n.created_at,
        n.author_user_account_id,
        COALESCE(NULLIF(btrim(sc.first_name || ' ' || sc.last_name), ''), ua.username) AS author_name
      FROM tbl_app_issue_note n
      LEFT JOIN tbl_user_account  ua ON ua.user_account_id = n.author_user_account_id
      LEFT JOIN tbl_facility_staff fs ON fs.facility_staff_id = ua.facility_staff_id
      LEFT JOIN tbl_contact        sc ON sc.contact_id = fs.contact_id
      WHERE n.issue_id = $1
      ORDER BY n.created_at DESC, n.issue_note_id DESC
    `, [id]);
    res.json(rows);
  } catch (err) { next(err); }
});

/** POST /api/issues/:id/notes — append a note authored by the current user. */
issuesRouter.post('/:id/notes', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const note = String(req.body?.note ?? '').trim();
    if (!note) return res.status(400).json({ error: 'note required' });

    const created = await withTransaction(async (tx) => {
      const issue = await tx.queryOne<{ issue_id: number }>(
        `SELECT issue_id FROM tbl_app_issue WHERE issue_id = $1`, [id],
      );
      if (!issue) { const e: any = new Error('Issue not found'); e.status = 404; throw e; }
      const row = await tx.queryOne<Record<string, any>>(`
        INSERT INTO tbl_app_issue_note (issue_id, author_user_account_id, note)
        VALUES ($1, $2, $3)
        RETURNING issue_note_id, issue_id, note, created_at, author_user_account_id
      `, [id, req.user!.user_account_id, note]);
      // Touch the parent issue so it sorts as recently active.
      await tx.query(`UPDATE tbl_app_issue SET updated_at = NOW() WHERE issue_id = $1`, [id]);
      await auditCreate(req, 'tbl_app_issue_note', row!.issue_note_id, row!, tx);
      return row!;
    });

    res.status(201).json(created);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Screenshot stream (developer)                                     */
/* ----------------------------------------------------------------- */

issuesRouter.get('/:id/screenshot', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const row = await queryOne<{ screenshot_data: Buffer | null; screenshot_content_type: string | null }>(
      `SELECT screenshot_data, screenshot_content_type FROM tbl_app_issue WHERE issue_id = $1`,
      [id],
    );
    if (!row || !row.screenshot_data) return res.status(404).json({ error: 'No screenshot for this issue' });
    res.setHeader('Content-Type', row.screenshot_content_type ?? 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(row.screenshot_data);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Update (developer)                                                */
/* ----------------------------------------------------------------- */

issuesRouter.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const body = (req.body ?? {}) as UpdatePayload;
    if (body.status && !VALID_STATUSES.includes(body.status)) return res.status(400).json({ error: 'status invalid' });
    if (body.severity && !VALID_SEVERITIES.includes(body.severity)) return res.status(400).json({ error: 'severity invalid' });

    await withTransaction(async (tx) => {
      const before = await tx.queryOne<Record<string, any>>(
        `SELECT * FROM tbl_app_issue WHERE issue_id = $1`, [id],
      );
      if (!before) { const e: any = new Error('Issue not found'); e.status = 404; throw e; }

      // If status transitioned to 'resolved' or 'closed' and there's no
      // resolved_at yet, stamp it. Going back to 'open' or 'investigating'
      // clears resolved_at.
      let resolvedAtSql = `i.resolved_at`;
      if (body.status === 'resolved' || body.status === 'closed') {
        resolvedAtSql = `COALESCE(i.resolved_at, NOW())`;
      } else if (body.status === 'open' || body.status === 'investigating') {
        resolvedAtSql = `NULL`;
      }
      // If assigning an assignee and none was set, auto-bump status to investigating.
      let statusToSet = body.status ?? before.status;
      if (body.assignee_user_account_id && !before.assignee_user_account_id && before.status === 'open' && !body.status) {
        statusToSet = 'investigating';
      }

      const after = await tx.queryOne<Record<string, any>>(`
        UPDATE tbl_app_issue i
           SET status = $1,
               severity = COALESCE($2, severity),
               assignee_user_account_id = $3,
               resolution_notes = COALESCE($4, resolution_notes),
               title = COALESCE($5, title),
               description = COALESCE($6, description),
               resolved_at = ${resolvedAtSql},
               updated_at = NOW()
         WHERE i.issue_id = $7
         RETURNING *
      `, [
        statusToSet,
        body.severity ?? null,
        // Always replace assignee (null = unassign). Use undefined check.
        body.assignee_user_account_id === undefined ? before.assignee_user_account_id : (body.assignee_user_account_id ?? null),
        body.resolution_notes ?? null,
        body.title ?? null,
        body.description ?? null,
        id,
      ]);
      if (after) await auditUpdate(req, 'tbl_app_issue', id, before, after, tx);
    });

    res.json({ issue_id: id });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Delete (developer)                                                */
/* ----------------------------------------------------------------- */

issuesRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    await withTransaction(async (tx) => {
      const before = await tx.queryOne<Record<string, any>>(`SELECT * FROM tbl_app_issue WHERE issue_id = $1`, [id]);
      if (!before) { const e: any = new Error('Issue not found'); e.status = 404; throw e; }
      await tx.query(`DELETE FROM tbl_app_issue WHERE issue_id = $1`, [id]);
      // Strip blob from audit payload — already masked, but no need to ship it.
      const { screenshot_data: _omit, ...beforeMeta } = before;
      void _omit;
      await auditDelete(req, 'tbl_app_issue', id, beforeMeta, tx);
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
