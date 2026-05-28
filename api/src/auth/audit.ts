/**
 * Audit log helper. Every mutation route calls one of these so the
 * `tbl_audit_log` table reflects who did what.
 *
 *   await auditCreate(req, 'tbl_client', newId, newRow);
 *   await auditUpdate(req, 'tbl_client', id, beforeRow, afterRow);
 *   await auditDelete(req, 'tbl_client', id, beforeRow);
 *
 * UPDATE writes ONE row per CHANGED field so the log is searchable; CREATE
 * and DELETE write a single row each with the whole snapshot in
 * old_value / new_value (as JSON).
 *
 * If `req.user` isn't set (shouldn't happen if requireUser is mounted, but
 * defensive), the audit write is silently skipped — better than crashing
 * the mutation.
 */

import type { Request } from 'express';
import { query, type withTransaction } from '../db/pool.js';

type Tx = Parameters<Parameters<typeof withTransaction>[0]>[0];

/** Optional tx — if you're inside withTransaction, pass it so the audit row
 *  rolls back with the mutation if the mutation later fails. */
async function writeOne(
  tx: Tx | null,
  userId: number,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  entityType: string,
  entityId: number,
  fieldChanged: string | null,
  oldValue: string | null,
  newValue: string | null,
): Promise<void> {
  const sql = `
    INSERT INTO tbl_audit_log
      (user_account_id, action, entity_type, entity_id,
       field_changed, old_value, new_value, action_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
  `;
  const params = [userId, action, entityType, entityId, fieldChanged, oldValue, newValue];
  if (tx) await tx.query(sql, params);
  else    await query(sql, params);
}

function userIdFrom(req: Request): number | null {
  return req.user?.user_account_id ?? null;
}

/** Stringify a value for audit storage. Dates / objects become JSON. */
function fmt(v: any): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();
  try { return JSON.stringify(v); } catch { return String(v); }
}

export async function auditCreate(
  req: Request,
  entityType: string,
  entityId: number,
  newRow: Record<string, any>,
  tx: Tx | null = null,
): Promise<void> {
  const userId = userIdFrom(req);
  if (!userId) return;
  await writeOne(tx, userId, 'CREATE', entityType, entityId, null, null, fmt(newRow));
}

export async function auditDelete(
  req: Request,
  entityType: string,
  entityId: number,
  oldRow: Record<string, any> | null,
  tx: Tx | null = null,
): Promise<void> {
  const userId = userIdFrom(req);
  if (!userId) return;
  await writeOne(tx, userId, 'DELETE', entityType, entityId, null, fmt(oldRow), null);
}

/** Writes one row per CHANGED field. Fields whose value didn't change are
 *  skipped. Drops these audit columns from comparison: never-meaningful
 *  fields like password_hash are masked to '***'. */
const MASKED_FIELDS = new Set(['password_hash']);

export async function auditUpdate(
  req: Request,
  entityType: string,
  entityId: number,
  oldRow: Record<string, any>,
  newRow: Record<string, any>,
  tx: Tx | null = null,
): Promise<void> {
  const userId = userIdFrom(req);
  if (!userId) return;

  const keys = new Set([...Object.keys(oldRow ?? {}), ...Object.keys(newRow ?? {})]);
  for (const key of keys) {
    const oldV = oldRow?.[key];
    const newV = newRow?.[key];
    if (sameValue(oldV, newV)) continue;
    const oldStr = MASKED_FIELDS.has(key) ? '***' : fmt(oldV);
    const newStr = MASKED_FIELDS.has(key) ? '***' : fmt(newV);
    await writeOne(tx, userId, 'UPDATE', entityType, entityId, key, oldStr, newStr);
  }
}

/** Equal for audit purposes: nulls/undefined/empty-string all equal; dates
 *  compared by ISO; objects by JSON. */
function sameValue(a: any, b: any): boolean {
  const norm = (v: any) => {
    if (v === null || v === undefined || v === '') return null;
    if (v instanceof Date) return v.toISOString();
    return v;
  };
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return true;
  if (typeof na === 'object' || typeof nb === 'object') {
    try { return JSON.stringify(na) === JSON.stringify(nb); } catch { return false; }
  }
  return String(na) === String(nb);
}
