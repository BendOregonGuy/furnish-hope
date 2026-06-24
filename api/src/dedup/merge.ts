/**
 * Atomic merge of two clients. Reassigns every FK pointing at the "merge"
 * client to the "keep" client, then deletes the merge row. The contact +
 * address rows are intentionally left intact — they may be referenced by
 * other tables (and the address dedupe already keeps shared addresses).
 *
 * Discovery is dynamic: we read `information_schema` to find every column
 * that references tbl_client(client_id), so a future migration that adds a
 * new FK to clients gets merged automatically.
 *
 * The reassignment uses INSERT-on-conflict semantics where possible:
 * - For tables with a UNIQUE constraint that would collide after the
 *   reassignment (e.g. tbl_client_client_type's PK), we use
 *   UPDATE ... ON CONFLICT DO NOTHING, then DELETE leftover merge rows.
 * - For ordinary FK columns we just UPDATE.
 *
 * Everything runs inside ONE transaction; on any error the entire merge
 * rolls back.
 */

/** Shape of the transaction client passed by withTransaction in db/pool.ts. */
type Tx = {
  query<R = any>(sql: string, params?: any[]): Promise<R[]>;
  queryOne<R = any>(sql: string, params?: any[]): Promise<R | null>;
};

interface FkColumn {
  table_name: string;
  column_name: string;
  has_unique_with_client: boolean;
}

/** Find every column that references tbl_client(client_id), plus a hint
 *  flag for whether it participates in a UNIQUE constraint together with
 *  client_id (so the merge needs the collision-aware upsert path). */
async function discoverFks(tx: Tx): Promise<FkColumn[]> {
  const rows = await tx.query<FkColumn>(`
    SELECT
      kcu.table_name,
      kcu.column_name,
      EXISTS (
        SELECT 1
          FROM information_schema.table_constraints tc2
          JOIN information_schema.key_column_usage kcu2
            ON kcu2.constraint_name = tc2.constraint_name
           AND kcu2.table_name = tc2.table_name
         WHERE tc2.table_name = kcu.table_name
           AND tc2.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
           AND kcu2.column_name = kcu.column_name
      ) AS has_unique_with_client
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
     AND kcu.table_name = tc.table_name
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'tbl_client'
      AND ccu.column_name = 'client_id'
      AND kcu.table_name <> 'tbl_client'
    ORDER BY kcu.table_name, kcu.column_name
  `);
  return rows;
}

export interface MergeResult {
  keep_client_id: number;
  merge_client_id: number;
  rows_moved_by_table: Record<string, number>;
  duration_ms: number;
}

/** Run the merge inside the caller's transaction. The caller is responsible
 *  for opening the tx, updating `tbl_potential_duplicate.status='merged'`,
 *  and writing the audit log entry (we don't reach into req from here). */
export async function mergeClients(
  tx: Tx,
  keepClientId: number,
  mergeClientId: number,
): Promise<MergeResult> {
  if (keepClientId === mergeClientId) {
    const e: any = new Error('keep_client_id and merge_client_id must differ');
    e.status = 400;
    throw e;
  }

  const t0 = Date.now();
  const allFks = await discoverFks(tx);
  // tbl_potential_duplicate FKs to tbl_client TWICE (a + b) with a CHECK
  // constraint (a < b). Reassigning either column would either violate
  // the CHECK or create a self-pair. Strip it from the dynamic loop and
  // handle it explicitly first: any pending pair involving the merge
  // client is now obsolete (it either IS this merge — handled by the
  // caller — or it's about a client that's about to disappear).
  const fks = allFks.filter(fk => fk.table_name !== 'tbl_potential_duplicate');
  // The caller should mark THIS pair's status to something other than
  // 'pending' BEFORE invoking mergeClients (so it survives below). Any
  // OTHER pending pair involving merge_client_id is now stale — the
  // merge_client_id is about to vanish — so drop them.
  await tx.query(
    `DELETE FROM tbl_potential_duplicate
       WHERE (client_id_a = $1 OR client_id_b = $1)
         AND status = 'pending'`,
    [mergeClientId],
  );
  const movedByTable: Record<string, number> = {};

  for (const fk of fks) {
    if (fk.has_unique_with_client) {
      // The reassignment could violate uniqueness. Pattern:
      // 1) INSERT keep-version of any merge-row whose key would now collide
      //    (we just want the row to exist on the keep side).
      // 2) DELETE the merge-side rows.
      // Simpler universal version: UPDATE with ON CONFLICT-style guard by
      // first deleting merge-side rows that already exist on keep side.
      //
      // Step A: delete merge-side rows that have a counterpart on keep side
      // (same OTHER columns of the unique constraint).
      // For the common 2-col PK case (client_id, other_id) — the other_id
      // is the rest of the key. We find it by reading the PK definition.
      const otherCols = await tx.query<{ column_name: string }>(`
        SELECT kcu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON kcu.constraint_name = tc.constraint_name
           AND kcu.table_name = tc.table_name
         WHERE tc.table_name = $1
           AND tc.constraint_type = 'PRIMARY KEY'
           AND kcu.column_name <> $2
      `, [fk.table_name, fk.column_name]);

      if (otherCols.length > 0) {
        const otherList = otherCols.map((c: { column_name: string }) => c.column_name).join(', ');
        const otherJoin = otherCols.map((c: { column_name: string }) => `m.${c.column_name} = k.${c.column_name}`).join(' AND ');
        // Drop merge-side rows whose (otherCols) pair already exists on keep
        await tx.query(
          `DELETE FROM ${fk.table_name} m
             WHERE m.${fk.column_name} = $1
               AND EXISTS (
                 SELECT 1 FROM ${fk.table_name} k
                  WHERE k.${fk.column_name} = $2
                    AND ${otherJoin}
               )`,
          [mergeClientId, keepClientId],
        );
        // Reassign whatever's left
        const r = await tx.query(
          `UPDATE ${fk.table_name} SET ${fk.column_name} = $2
             WHERE ${fk.column_name} = $1
             RETURNING 1 AS moved`,
          [mergeClientId, keepClientId],
        );
        movedByTable[fk.table_name + '.' + fk.column_name] = r.length;
        // suppress unused warning for our debug var
        void otherList;
      } else {
        // No PK other than client_id (very rare). Plain UPDATE.
        const r = await tx.query(
          `UPDATE ${fk.table_name} SET ${fk.column_name} = $2
             WHERE ${fk.column_name} = $1
             RETURNING 1 AS moved`,
          [mergeClientId, keepClientId],
        );
        movedByTable[fk.table_name + '.' + fk.column_name] = r.length;
      }
    } else {
      // Ordinary FK column — just reassign.
      const r = await tx.query(
        `UPDATE ${fk.table_name} SET ${fk.column_name} = $2
           WHERE ${fk.column_name} = $1
           RETURNING 1 AS moved`,
        [mergeClientId, keepClientId],
      );
      movedByTable[fk.table_name + '.' + fk.column_name] = r.length;
    }
  }

  // Finally delete the merge client row itself.
  await tx.query(`DELETE FROM tbl_client WHERE client_id = $1`, [mergeClientId]);

  return {
    keep_client_id: keepClientId,
    merge_client_id: mergeClientId,
    rows_moved_by_table: movedByTable,
    duration_ms: Date.now() - t0,
  };
}
