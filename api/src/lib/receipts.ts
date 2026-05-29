/**
 * Helpers for sequential, per-fiscal-year receipt numbering.
 *
 * Receipt format: `{prefix}-{fiscal_year}-{padded_seq}` → e.g. `FH-2026-0001`.
 *
 * - The `prefix` and `fiscal_year_start_month` are configurable in
 *   `tbl_app_setting`. Defaults come from the auth migrations.
 * - The counter lives in `tbl_receipt_counter`, one row per fiscal year.
 * - `reserveNextReceiptNumber()` is transactional and uses `SELECT FOR
 *   UPDATE` so concurrent callers can't grab the same number.
 *
 * Usage from a route:
 *
 *   await withTransaction(async (tx) => {
 *     const num = await reserveNextReceiptNumber(tx, new Date());
 *     await tx.query('INSERT INTO tbl_donation (..., receipt_number) VALUES (..., $1)', [..., num]);
 *   });
 */

import type { withTransaction } from '../db/pool.js';
import { queryOne } from '../db/pool.js';

type Tx = Parameters<Parameters<typeof withTransaction>[0]>[0];

/** Determine the fiscal year a given date falls in, based on the configured
 *  `fiscal_year_start_month` (1-12). For start month = 1 this matches the
 *  calendar year. For July starts (month=7), dates Jul-Dec 2026 are FY 2027. */
export async function fiscalYearOf(date: Date): Promise<number> {
  const startMonth = await getStartMonth();
  const m = date.getMonth() + 1; // 1-12
  const y = date.getFullYear();
  if (m >= startMonth) {
    // We're in the fiscal year that started this calendar year. The fiscal
    // year is *labelled* by the calendar year it ENDS in (standard US
    // nonprofit convention), so Jul-2026 falls in FY 2027 when start = July.
    return startMonth === 1 ? y : y + 1;
  }
  return startMonth === 1 ? y : y;
}

async function getStartMonth(): Promise<number> {
  const row = await queryOne<{ setting_value: string }>(
    `SELECT setting_value FROM tbl_app_setting WHERE setting_key = 'fiscal_year_start_month'`,
  );
  const m = Number(row?.setting_value ?? 1);
  if (Number.isInteger(m) && m >= 1 && m <= 12) return m;
  return 1;
}

async function getReceiptPrefix(tx?: Tx): Promise<string> {
  const sql = `SELECT setting_value FROM tbl_app_setting WHERE setting_key = 'receipt_prefix'`;
  const row = tx
    ? (await tx.queryOne<{ setting_value: string }>(sql))
    : (await queryOne<{ setting_value: string }>(sql));
  return (row?.setting_value ?? 'FH').trim() || 'FH';
}

/**
 * Atomically reserve the next receipt number for the fiscal year that
 * contains `date`. Pass a transaction if you're already inside one — that
 * way receipt assignment rolls back with the rest of the mutation if it
 * fails downstream.
 */
export async function reserveNextReceiptNumber(tx: Tx, date: Date): Promise<string> {
  const fy = await fiscalYearOf(date);
  const prefix = await getReceiptPrefix(tx);

  // Lock the row for this FY (or insert if missing), then bump.
  await tx.query(
    `INSERT INTO tbl_receipt_counter (fiscal_year, next_number)
     VALUES ($1, 1)
     ON CONFLICT (fiscal_year) DO NOTHING`,
    [fy],
  );
  const row = await tx.queryOne<{ next_number: number }>(
    `SELECT next_number FROM tbl_receipt_counter WHERE fiscal_year = $1 FOR UPDATE`,
    [fy],
  );
  const n = row?.next_number ?? 1;
  await tx.query(
    `UPDATE tbl_receipt_counter SET next_number = next_number + 1, updated_at = NOW() WHERE fiscal_year = $1`,
    [fy],
  );

  return `${prefix}-${fy}-${String(n).padStart(4, '0')}`;
}
