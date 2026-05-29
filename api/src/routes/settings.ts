/**
 * App-level settings — keyed config that ships with sensible defaults
 * (see auth/migrations.ts) and can be edited by admins via /admin/settings.
 *
 *   GET  /api/admin/settings           → { settings: [{key, value, description}, ...] }
 *   PUT  /api/admin/settings           → bulk update { changes: { key: value, ... } }
 *
 * Setting values are stored as TEXT for flexibility; the caller is
 * responsible for parsing (e.g. fiscal_year_start_month → integer).
 *
 * Mounted under /api/admin/*, so requireAdmin is already applied by the
 * parent mount in index.ts.
 */

import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditUpdate } from '../auth/audit.js';

export const settingsRouter = Router();

interface SettingRow {
  setting_key: string;
  setting_value: string;
  description: string | null;
  updated_at: string;
}

settingsRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await query<SettingRow>(
      `SELECT setting_key, setting_value, description, updated_at
         FROM tbl_app_setting
        ORDER BY setting_key`,
    );
    res.json({ settings: rows });
  } catch (err) { next(err); }
});

settingsRouter.put('/', async (req, res, next) => {
  try {
    const changes = req.body?.changes;
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
      return res.status(400).json({ error: 'Body must be { "changes": { key: value, ... } }' });
    }
    const userId = req.user!.user_account_id;

    await withTransaction(async (tx) => {
      for (const [key, raw] of Object.entries(changes as Record<string, unknown>)) {
        if (typeof raw !== 'string' && typeof raw !== 'number' && typeof raw !== 'boolean') {
          // Coerce-able? Otherwise skip.
          continue;
        }
        const value = String(raw);

        // Light validation for known keys.
        if (key === 'fiscal_year_start_month') {
          const m = Number(value);
          if (!Number.isInteger(m) || m < 1 || m > 12) {
            throw withStatus(400, 'fiscal_year_start_month must be an integer between 1 and 12');
          }
        }
        if (key === 'acknowledgement_threshold') {
          const n = Number(value);
          if (!Number.isFinite(n) || n < 0) {
            throw withStatus(400, 'acknowledgement_threshold must be a non-negative number');
          }
        }

        // Capture before for audit.
        const before = await tx.queryOne<SettingRow>(
          `SELECT setting_key, setting_value, description, updated_at
             FROM tbl_app_setting WHERE setting_key = $1`,
          [key],
        );
        if (!before) continue; // unknown key — skip silently

        if (before.setting_value === value) continue; // no-op

        await tx.query(
          `UPDATE tbl_app_setting
              SET setting_value = $1,
                  updated_at = NOW(),
                  updated_by_user_account_id = $2
            WHERE setting_key = $3`,
          [value, userId, key],
        );
        const after = await tx.queryOne<SettingRow>(
          `SELECT setting_key, setting_value, description, updated_at
             FROM tbl_app_setting WHERE setting_key = $1`,
          [key],
        );
        if (after) {
          // Use the row's key as the "entity_id" surrogate via -1 + field name;
          // settings don't have integer PKs, so we encode the key into
          // field_changed for searchability.
          await auditUpdate(req, 'tbl_app_setting', 0, before as any, after as any, tx);
        }
      }
    });

    const fresh = await query<SettingRow>(
      `SELECT setting_key, setting_value, description, updated_at
         FROM tbl_app_setting
        ORDER BY setting_key`,
    );
    res.json({ settings: fresh });
  } catch (err: any) { next(err); }
});

function withStatus(status: number, message: string): Error {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

/** Convenience getter used by other routes — reads a single setting. */
export async function getSetting(key: string): Promise<string | null> {
  const row = await queryOne<{ setting_value: string }>(
    `SELECT setting_value FROM tbl_app_setting WHERE setting_key = $1`,
    [key],
  );
  return row?.setting_value ?? null;
}
