/**
 * Generic admin CRUD over every table. Everything is metadata-driven by
 * `admin/schema.ts`. Table and column names ONLY come from the introspected
 * schema (never from request input directly); values always go through
 * parameterized queries. The `displaySql` strings come from our config, not
 * from clients.
 */

import { Router } from 'express';
import bcrypt from 'bcrypt';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query, queryOne } from '../db/pool.js';
import { getSchema, getTable, refreshSchema } from '../admin/schema.js';
import { sortedGroups } from '../admin/introspect.js';
import type { ColumnMeta, TableMeta } from '../admin/types.js';
import { auditCreate, auditDelete, auditUpdate } from '../auth/audit.js';

export const adminRouter = Router();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

/* ----------------------------------------------------------------- */
/*  Schema metadata                                                  */
/* ----------------------------------------------------------------- */

/** GET /api/admin/schema — full metadata for the UI to render itself. */
adminRouter.get('/schema', async (_req, res, next) => {
  try {
    const schema = await getSchema();
    const tables = Object.values(schema);
    const groups = sortedGroups([...new Set(tables.map(t => t.group))]);
    res.json({
      tables,
      groups: groups.map(g => ({
        name: g,
        tables: tables.filter(t => t.group === g).sort((a, b) => a.label.localeCompare(b.label)),
      })),
    });
  } catch (err) { next(err); }
});

/** POST /api/admin/_refresh — clear introspection cache (dev convenience). */
adminRouter.post('/_refresh', (_req, res) => {
  refreshSchema();
  res.json({ ok: true });
});

/**
 * GET /api/admin/erd — serve the pre-generated entity-relationship PDF.
 * Regenerate by running `python scripts/generate_erd_pdf.py` against a
 * Postgres database whose schema matches what we want to document.
 * Declared BEFORE the /:table catchall so "erd" isn't parsed as a
 * table name.
 */
adminRouter.get('/erd', (_req, res, next) => {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    // From api/dist/routes/admin.js -> repo_root/docs/FurnishHopeERD.pdf
    // (and api/src/routes -> repo_root/docs in dev).
    // Both dev (api/src/routes/admin.ts) and prod build
    // (api/dist/routes/admin.js) are nested 3 levels under the repo root.
    const candidate = path.resolve(here, '..', '..', '..', 'docs', 'FurnishHopeERD.pdf');
    const found = fs.existsSync(candidate) ? candidate : null;
    if (!found) {
      return res.status(404).json({
        error: 'ERD PDF not found. Regenerate with: python scripts/generate_erd_pdf.py',
      });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="FurnishHopeERD.pdf"');
    res.setHeader('Cache-Control', 'private, max-age=300');
    fs.createReadStream(found).pipe(res);
  } catch (err) { next(err); }
});

/**
 * GET /api/admin/_counts?tables=a,b,c — returns `{ tableName: rowCount }`.
 * Used by the form's prerequisite check to spot empty FK targets in one
 * round-trip instead of one COUNT per FK.
 */
adminRouter.get('/_counts', async (req, res, next) => {
  try {
    const requested = String(req.query.tables ?? '').split(',').filter(Boolean);
    if (!requested.length) return res.json({});

    const schema = await getSchema();
    const out: Record<string, number> = {};
    for (const name of requested) {
      const meta = schema[name];
      if (!meta) continue; // silently skip unknown tables
      const row = await queryOne<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM ${ident(meta.table)}`,
      );
      out[name] = Number(row?.count ?? 0);
    }
    res.json(out);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Address usage — count of FK references per table                 */
/*                                                                    */
/*  Used by the AdminForm's confirmation modal when editing a row     */
/*  in tbl_address: if more than one other row points at this         */
/*  address, the modal warns "N records share this — apply edits to  */
/*  all of them?" before allowing save. Declared BEFORE the generic  */
/*  /:table catch-all so "address-usage" isn't parsed as a table.    */
/* ----------------------------------------------------------------- */

adminRouter.get('/address-usage/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const counts = await queryOne<{
      contacts: string;
      corp_facilities: string;
      donors: string;
      agencies: string;
      donation_pickups: string;
      events: string;
    }>(`
      SELECT
        (SELECT COUNT(*)::text FROM tbl_contact         WHERE address_id        = $1) AS contacts,
        (SELECT COUNT(*)::text FROM tbl_corp_facility   WHERE address_id        = $1) AS corp_facilities,
        (SELECT COUNT(*)::text FROM tbl_donor           WHERE address_id        = $1) AS donors,
        (SELECT COUNT(*)::text FROM tbl_agency          WHERE address_id        = $1) AS agencies,
        (SELECT COUNT(*)::text FROM tbl_donation_pickup WHERE pickup_address_id = $1) AS donation_pickups,
        (SELECT COUNT(*)::text FROM tbl_event           WHERE address_id        = $1) AS events
    `, [id]);

    const breakdown = {
      contacts:         Number(counts?.contacts        ?? 0),
      corp_facilities:  Number(counts?.corp_facilities ?? 0),
      donors:           Number(counts?.donors          ?? 0),
      agencies:         Number(counts?.agencies        ?? 0),
      donation_pickups: Number(counts?.donation_pickups ?? 0),
      events:           Number(counts?.events          ?? 0),
    };
    const total = Object.values(breakdown).reduce((a, b) => a + b, 0);

    // Friendly labels for a few example contacts — helps the modal show
    // "Sally Staff, Joe Client, …" instead of bare counts. Cap at 5 so
    // the modal stays scannable; surface the total separately.
    const contactExamples = await query<{ name: string }>(`
      SELECT (c.first_name || ' ' || c.last_name) AS name
        FROM tbl_contact c
       WHERE c.address_id = $1
       ORDER BY c.contact_id
       LIMIT 5
    `, [id]);

    res.json({
      total,
      breakdown,
      contact_examples: contactExamples.map(r => r.name),
    });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Foreign-key dropdown options                                     */
/* ----------------------------------------------------------------- */

/**
 * GET /api/admin/fk-options/:table?search=…&limit=50
 *
 * Returns `[{id, label}]` for a referenced table. Used by FK select widgets.
 */
adminRouter.get('/fk-options/:table', async (req, res, next) => {
  try {
    const meta = await getTable(req.params.table);
    if (!meta) return res.status(404).json({ error: 'Unknown table' });

    const search = (req.query.search as string | undefined)?.trim();
    const limit = Math.min(Number(req.query.limit ?? 50), MAX_LIMIT);

    // Build: SELECT pk AS id, (displaySql) AS label FROM table t
    //        [WHERE fkOptionsFilter] [AND label ILIKE $1]
    //        ORDER BY label LIMIT N
    //
    // `fkOptionsFilter` (e.g. `t.is_approved = true` on tbl_agency)
    // restricts what can be picked without affecting label lookups on
    // existing rows in list/detail views — those go through the
    // separate labels endpoint and stay unfiltered so historical FK
    // references still resolve.
    const params: any[] = [];
    const conds: string[] = [];
    if (meta.fkOptionsFilter) conds.push(`(${meta.fkOptionsFilter})`);
    if (search) {
      params.push(`%${search}%`);
      conds.push(`(${meta.displaySql}) ILIKE $${params.length}`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    params.push(limit);

    const rows = await query<{ id: number; label: string }>(
      `SELECT t.${ident(meta.pk)} AS id, (${meta.displaySql}) AS label
         FROM ${ident(meta.table)} t
         ${where}
       ORDER BY label
       LIMIT $${params.length}`,
      params,
    );
    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  List                                                              */
/* ----------------------------------------------------------------- */

/**
 * GET /api/admin/:table?search=&sort=&dir=&limit=&offset=
 *
 * Returns:
 *   {
 *     total: number,
 *     rows: Row[],
 *     fkLabels: { [columnName: string]: { [id: string]: string } },
 *   }
 *
 * `fkLabels` maps each FK column in the result to a {id -> display label}
 * dictionary, so the frontend can render labels without round-trips.
 */
adminRouter.get('/:table', async (req, res, next) => {
  try {
    const meta = await getTable(req.params.table);
    if (!meta) return res.status(404).json({ error: 'Unknown table' });

    const search = (req.query.search as string | undefined)?.trim();
    const sortCol = pickSortColumn(meta, req.query.sort as string | undefined);
    const sortDir = (req.query.dir === 'asc' ? 'asc' : (req.query.dir === 'desc' ? 'desc' : meta.defaultSort.direction));
    const limit = Math.min(Number(req.query.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);

    // WHERE clause: ILIKE OR across searchColumns
    const params: any[] = [];
    let where = '';
    if (search && meta.searchColumns.length) {
      params.push(`%${search}%`);
      const clauses = meta.searchColumns.map(col => `t.${ident(col)} ILIKE $1`);
      where = `WHERE (${clauses.join(' OR ')})`;
    }

    const totalRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ${ident(meta.table)} t ${where}`,
      params,
    );
    const total = Number(totalRow?.count ?? 0);

    params.push(limit, offset);
    const rows = await query<Record<string, any>>(
      `SELECT * FROM ${ident(meta.table)} t
       ${where}
       ORDER BY t.${ident(sortCol)} ${sortDir === 'asc' ? 'ASC' : 'DESC'} NULLS LAST
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const fkLabels = await resolveFkLabels(meta, rows);

    res.json({ total, rows, fkLabels });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Read one                                                          */
/* ----------------------------------------------------------------- */

adminRouter.get('/:table/:id', async (req, res, next) => {
  try {
    const meta = await getTable(req.params.table);
    if (!meta) return res.status(404).json({ error: 'Unknown table' });

    const id = parsePkId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid id' });

    const row = await queryOne<Record<string, any>>(
      `SELECT * FROM ${ident(meta.table)} WHERE ${ident(meta.pk)} = $1`,
      [id],
    );
    if (!row) return res.status(404).json({ error: 'Not found' });

    const fkLabels = await resolveFkLabels(meta, [row]);
    const { prevId, nextId } = await neighborIds(meta, id);
    res.json({ row, fkLabels, prevId, nextId });
  } catch (err) { next(err); }
});

/**
 * Find the previous and next IDs for record-level navigation. Uses simple PK
 * ordering — predictable across all sort variations the user might pick in
 * the list view, and stable as data changes.
 */
async function neighborIds(
  meta: TableMeta,
  currentId: number,
): Promise<{ prevId: number | null; nextId: number | null }> {
  const prev = await queryOne<{ id: number }>(
    `SELECT ${ident(meta.pk)} AS id
       FROM ${ident(meta.table)}
      WHERE ${ident(meta.pk)} < $1
      ORDER BY ${ident(meta.pk)} DESC
      LIMIT 1`,
    [currentId],
  );
  const next = await queryOne<{ id: number }>(
    `SELECT ${ident(meta.pk)} AS id
       FROM ${ident(meta.table)}
      WHERE ${ident(meta.pk)} > $1
      ORDER BY ${ident(meta.pk)} ASC
      LIMIT 1`,
    [currentId],
  );
  return { prevId: prev?.id ?? null, nextId: next?.id ?? null };
}

/* ----------------------------------------------------------------- */
/*  Create                                                            */
/* ----------------------------------------------------------------- */

adminRouter.post('/:table', async (req, res, next) => {
  try {
    const meta = await getTable(req.params.table);
    if (!meta) return res.status(404).json({ error: 'Unknown table' });

    const body = { ...(req.body ?? {}) };
    applyHiddenDefaults(meta, body);
    await hashPlaintextPassword(meta, body);

    const writable = meta.columns.filter(c => !c.isPk);
    const { columns, values, params } = buildInsertValues(writable, body);

    if (!columns.length) return res.status(400).json({ error: 'No fields provided' });

    const sql = `INSERT INTO ${ident(meta.table)} (${columns.map(ident).join(', ')})
                 VALUES (${values.join(', ')})
                 RETURNING *`;
    const row = (await query<Record<string, any>>(sql, params))[0];
    await auditCreate(req, meta.table, row[meta.pk], row);
    res.status(201).json({ row });
  } catch (err) {
    next(translatePgError(err));
  }
});

/**
 * Auto-supply system-set values for columns that are hidden from the form
 * but NOT NULL in the schema. Currently handles datetime columns (sets to
 * NOW()). Extend here if you ever need defaults for other hidden+required
 * column types — e.g. a hidden uuid that should be generated.
 *
 * Only runs on INSERT (creates). On UPDATE, omitted columns stay untouched,
 * which is the right behavior — we don't want every save to bump created_at.
 */
function applyHiddenDefaults(meta: TableMeta, body: Record<string, any>): void {
  for (const col of meta.columns) {
    if (col.isPk) continue;
    if (!col.hideInForm) continue;
    if (!col.required) continue;
    if (col.name in body) continue;
    if (col.type === 'datetime') {
      body[col.name] = new Date().toISOString();
    }
  }
}

/**
 * On tbl_user_account create/update, accept either a bcrypt hash (kept
 * verbatim) or a plaintext password (hashed before storage). Lets admins
 * change passwords through the generic admin form without manually hashing.
 *
 * Bcrypt hashes start with $2a$, $2b$, or $2y$ — anything else is treated
 * as plaintext.
 */
async function hashPlaintextPassword(meta: TableMeta, body: Record<string, any>): Promise<void> {
  if (meta.table !== 'tbl_user_account') return;
  const v = body.password_hash;
  if (typeof v !== 'string' || !v) return;
  if (/^\$2[aby]\$/.test(v)) return; // already hashed
  body.password_hash = await bcrypt.hash(v, 10);
}

/* ----------------------------------------------------------------- */
/*  Update                                                            */
/* ----------------------------------------------------------------- */

adminRouter.put('/:table/:id', async (req, res, next) => {
  try {
    const meta = await getTable(req.params.table);
    if (!meta) return res.status(404).json({ error: 'Unknown table' });

    const id = parsePkId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid id' });

    const body = { ...(req.body ?? {}) };
    await hashPlaintextPassword(meta, body);
    const writable = meta.columns.filter(c => !c.isPk);
    const { columns, values, params } = buildInsertValues(writable, body);

    if (!columns.length) return res.status(400).json({ error: 'No fields provided' });

    // Snapshot before so the audit log can record what changed.
    const before = await queryOne<Record<string, any>>(
      `SELECT * FROM ${ident(meta.table)} WHERE ${ident(meta.pk)} = $1`, [id],
    );
    if (!before) return res.status(404).json({ error: 'Not found' });

    params.push(id);
    const setClauses = columns.map((c, i) => `${ident(c)} = ${values[i]}`).join(', ');
    const sql = `UPDATE ${ident(meta.table)}
                    SET ${setClauses}
                  WHERE ${ident(meta.pk)} = $${params.length}
              RETURNING *`;
    const row = (await query<Record<string, any>>(sql, params))[0];
    if (!row) return res.status(404).json({ error: 'Not found' });
    await auditUpdate(req, meta.table, id, before, row);
    res.json({ row });
  } catch (err) {
    next(translatePgError(err));
  }
});

/* ----------------------------------------------------------------- */
/*  Delete                                                            */
/* ----------------------------------------------------------------- */

adminRouter.delete('/:table/:id', async (req, res, next) => {
  try {
    const meta = await getTable(req.params.table);
    if (!meta) return res.status(404).json({ error: 'Unknown table' });

    const id = parsePkId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid id' });

    // Snapshot for audit log before we destroy the row.
    const before = await queryOne<Record<string, any>>(
      `SELECT * FROM ${ident(meta.table)} WHERE ${ident(meta.pk)} = $1`, [id],
    );
    if (!before) return res.status(204).end(); // already gone — no-op

    await pool.query(`DELETE FROM ${ident(meta.table)} WHERE ${ident(meta.pk)} = $1`, [id]);
    await auditDelete(req, meta.table, id, before);
    res.status(204).end();
  } catch (err) {
    next(translatePgError(err));
  }
});

/* ================================================================= */
/*  Helpers                                                           */
/* ================================================================= */

/**
 * Quote an identifier for SQL. We accept input only from the metadata layer
 * (which itself comes from information_schema), so a strict character check
 * is the belt-and-suspenders to a quote-and-escape.
 */
function ident(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
  return `"${name}"`;
}

function pickSortColumn(meta: TableMeta, requested: string | undefined): string {
  if (requested && meta.columns.some(c => c.name === requested)) return requested;
  return meta.defaultSort.column;
}

function parsePkId(s: string): number | null {
  const n = Number(s);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

/**
 * For each FK column in the result rows, batch-resolve IDs to display labels
 * via a single `SELECT pk, (displaySql) FROM <fk_table> WHERE pk IN (...)`.
 */
async function resolveFkLabels(
  meta: TableMeta,
  rows: Record<string, any>[],
): Promise<Record<string, Record<string, string>>> {
  const out: Record<string, Record<string, string>> = {};
  const fkCols = meta.columns.filter(c => c.isFk && c.fkTable);

  for (const col of fkCols) {
    const ids = new Set<number>();
    for (const row of rows) {
      const v = row[col.name];
      if (v !== null && v !== undefined) ids.add(Number(v));
    }
    if (!ids.size) continue;

    const target = await getTable(col.fkTable!);
    if (!target) continue;

    const idArray = [...ids];
    const rows2 = await query<{ id: number; label: string }>(
      `SELECT ${ident(target.pk)} AS id, (${target.displaySql}) AS label
         FROM ${ident(target.table)} t
        WHERE ${ident(target.pk)} = ANY($1::int[])`,
      [idArray],
    );
    const map: Record<string, string> = {};
    for (const r of rows2) map[String(r.id)] = r.label;
    out[col.name] = map;
  }

  return out;
}

/**
 * Build the column / value-placeholder / params arrays for INSERT or UPDATE.
 * Skips columns absent from the body so partial updates work.
 */
function buildInsertValues(
  writable: ColumnMeta[],
  body: Record<string, any>,
): { columns: string[]; values: string[]; params: any[] } {
  const columns: string[] = [];
  const values: string[] = [];
  const params: any[] = [];

  for (const col of writable) {
    if (!(col.name in body)) continue;
    const raw = body[col.name];
    const coerced = coerce(col, raw);
    // If the form sent null for a column that has a SQL DEFAULT
    // (e.g. created_at TIMESTAMPTZ NOT NULL DEFAULT now()), skip it
    // from the INSERT so Postgres applies the default. Without this
    // skip we send VALUES (..., NULL, ...) and Postgres rejects with
    // "violates not-null constraint" — the default only kicks in for
    // OMITTED columns.
    if (coerced === null && col.hasDefault) continue;
    columns.push(col.name);
    params.push(coerced);
    values.push(`$${params.length}`);
  }
  return { columns, values, params };
}

/** Coerce a JSON-from-client value into something the pg driver will accept. */
function coerce(col: ColumnMeta, v: any): any {
  if (v === '' || v === undefined) return null;
  if (v === null) return null;
  if (col.type === 'boolean') return Boolean(v);
  if (col.type === 'number' || col.type === 'money' || col.type === 'fk' || col.type === 'pk') {
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }
  return v;
}

/**
 * Translate Postgres error codes into user-friendly HTTP errors. Returns an
 * Error with a `.status` property for the central error handler.
 */
function translatePgError(err: any): any {
  if (!err || !err.code) return err;
  const e: any = new Error(err.message);
  switch (err.code) {
    case '23503': // foreign_key_violation
      e.message = err.detail
        ? `This record is referenced elsewhere: ${err.detail.replace(/^Key /, '')}`
        : 'This record is referenced by other rows and cannot be deleted.';
      e.status = 409;
      return e;
    case '23505': // unique_violation
      e.message = err.detail ?? 'This value is already in use.';
      e.status = 409;
      return e;
    case '23502': // not_null_violation
      e.message = `Missing required field: ${err.column ?? 'unknown'}`;
      e.status = 400;
      return e;
    case '22P02': // invalid_text_representation
      e.message = 'One of the values is not valid for its field type.';
      e.status = 400;
      return e;
    default:
      return err;
  }
}
