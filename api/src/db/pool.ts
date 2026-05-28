import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.PGHOST ?? 'localhost',
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE ?? 'furnish_hope',
  user: process.env.PGUSER ?? 'postgres',
  password: process.env.PGPASSWORD ?? 'postgres',
  max: 10,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle pg client:', err);
});

/**
 * Helper for parameterized queries. Returns rows directly.
 *
 *   const clients = await query<Client>(`SELECT * FROM tbl_client WHERE client_id = $1`, [42]);
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const result = await pool.query(sql, params);
  return result.rows as T[];
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/**
 * Run a function inside a transaction. The callback receives a query helper
 * that uses the same connection so all statements share the txn.
 *
 *   const newClientId = await withTransaction(async (tx) => {
 *     const contact = await tx.queryOne(`INSERT INTO tbl_contact ... RETURNING contact_id`, [...]);
 *     const client = await tx.queryOne(`INSERT INTO tbl_client (contact_id, ...) ... RETURNING client_id`, [contact.contact_id]);
 *     return client.client_id;
 *   });
 *
 * On thrown error the transaction is rolled back; on return it commits.
 */
export async function withTransaction<T>(
  fn: (tx: {
    query<R = any>(sql: string, params?: any[]): Promise<R[]>;
    queryOne<R = any>(sql: string, params?: any[]): Promise<R | null>;
  }) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn({
      async query<R = any>(sql: string, params: any[] = []): Promise<R[]> {
        const r = await client.query(sql, params);
        return r.rows as R[];
      },
      async queryOne<R = any>(sql: string, params: any[] = []): Promise<R | null> {
        const r = await client.query(sql, params);
        return (r.rows[0] as R) ?? null;
      },
    });
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { /* ignore */ });
    throw err;
  } finally {
    client.release();
  }
}
