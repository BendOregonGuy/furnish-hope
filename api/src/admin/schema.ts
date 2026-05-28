/**
 * Module-level cache for the introspected schema. Lazy-loaded on first call
 * so the API can start even before the DB is reachable. Call `refreshSchema()`
 * to invalidate (useful in dev when the schema changes mid-session).
 */

import { introspectSchema } from './introspect.js';
import type { SchemaMap, TableMeta } from './types.js';

let cached: SchemaMap | null = null;
let pending: Promise<SchemaMap> | null = null;

export async function getSchema(): Promise<SchemaMap> {
  if (cached) return cached;
  if (!pending) {
    pending = introspectSchema().then(schema => {
      cached = schema;
      pending = null;
      return schema;
    }).catch(err => {
      pending = null;
      throw err;
    });
  }
  return pending;
}

export function refreshSchema(): void {
  cached = null;
  pending = null;
}

export async function getTable(table: string): Promise<TableMeta | null> {
  const schema = await getSchema();
  return schema[table] ?? null;
}
