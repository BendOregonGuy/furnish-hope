/**
 * Enriched audit log viewer for the admin UI. Joins `tbl_audit_log` to
 * `tbl_user_account` → `tbl_facility_staff` → `tbl_contact` so the UI can
 * show "Jamie Mercer" instead of "user #4".
 *
 * Filters: from / to (date range on action_at), user, entity_type, action.
 * Paginated; default 50, max 500.
 *
 * Mounted at /api/admin/activity — requires admin (the router is mounted
 * behind requireAdmin in index.ts).
 */

import { Router } from 'express';
import { query, queryOne } from '../db/pool.js';

export const activityRouter = Router();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

/** GET /api/admin/activity — filterable, paginated audit log. */
activityRouter.get('/', async (req, res, next) => {
  try {
    const from = (req.query.from as string | undefined) || null;
    const to   = (req.query.to as string | undefined)   || null;
    const userId      = req.query.user_account_id ? Number(req.query.user_account_id) : null;
    const entityType  = (req.query.entity_type as string | undefined) || null;
    const entityId    = req.query.entity_id ? Number(req.query.entity_id) : null;
    const action      = (req.query.action as string | undefined) || null;
    const limit  = Math.min(Number(req.query.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);

    const conds: string[] = [];
    const params: any[] = [];

    if (from) { params.push(from); conds.push(`a.action_at >= $${params.length}::date`); }
    if (to)   { params.push(to);   conds.push(`a.action_at <  $${params.length}::date + interval '1 day'`); }
    if (userId)     { params.push(userId);     conds.push(`a.user_account_id = $${params.length}`); }
    if (entityType) { params.push(entityType); conds.push(`a.entity_type = $${params.length}`); }
    if (entityId)   { params.push(entityId);   conds.push(`a.entity_id = $${params.length}`); }
    if (action)     { params.push(action);     conds.push(`a.action = $${params.length}`); }

    const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const totalRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tbl_audit_log a ${whereSql}`,
      params,
    );
    const total = Number(totalRow?.count ?? 0);

    params.push(limit, offset);
    const rows = await query(`
      SELECT
        a.audit_log_id,
        a.action_at,
        a.action,
        a.entity_type,
        a.entity_id,
        a.field_changed,
        a.old_value,
        a.new_value,
        a.user_account_id,
        ua.username AS actor_username,
        COALESCE(
          contact.first_name || ' ' || contact.last_name,
          ua.username
        ) AS actor_name,
        ua.is_admin AS actor_is_admin
      FROM tbl_audit_log a
      LEFT JOIN tbl_user_account ua ON ua.user_account_id = a.user_account_id
      LEFT JOIN tbl_facility_staff fs ON fs.facility_staff_id = ua.facility_staff_id
      LEFT JOIN tbl_contact contact   ON contact.contact_id = fs.contact_id
      ${whereSql}
      ORDER BY a.action_at DESC, a.audit_log_id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({ rows, total });
  } catch (err) { next(err); }
});

/** GET /api/admin/activity/_facets — distinct values to populate filter
 *  dropdowns. Returns small lists, deduped and sorted. */
activityRouter.get('/_facets', async (_req, res, next) => {
  try {
    const users = await query(`
      SELECT DISTINCT a.user_account_id AS id,
             COALESCE(contact.first_name || ' ' || contact.last_name, ua.username) AS label
        FROM tbl_audit_log a
        LEFT JOIN tbl_user_account ua ON ua.user_account_id = a.user_account_id
        LEFT JOIN tbl_facility_staff fs ON fs.facility_staff_id = ua.facility_staff_id
        LEFT JOIN tbl_contact contact ON contact.contact_id = fs.contact_id
       ORDER BY label
    `);
    const entityTypes = await query<{ entity_type: string }>(`
      SELECT DISTINCT entity_type FROM tbl_audit_log ORDER BY entity_type
    `);
    res.json({
      users,
      entityTypes: entityTypes.map(r => r.entity_type),
      actions: ['CREATE', 'UPDATE', 'DELETE'],
    });
  } catch (err) { next(err); }
});
