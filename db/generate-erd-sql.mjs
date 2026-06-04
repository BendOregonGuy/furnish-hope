/**
 * Convert the pg_dump-produced db/schema_current.sql into a clean DDL file
 * that drawio.com's "Insert → From SQL" feature actually parses. drawio
 * wants:
 *   - One CREATE TABLE per table
 *   - Primary key inline (column ... PRIMARY KEY)
 *   - Foreign keys inline as table-level constraints inside the CREATE TABLE
 *   - Portable types (no pg-specific oddities, no SERIAL+SEQUENCE separation)
 *   - No CREATE INDEX, CREATE SEQUENCE, ALTER OWNER, SET, COMMENT, or schema prefix
 *
 * Output goes to db/schema_erd.sql. Re-run after any schema change.
 *
 * Usage:
 *   node db/generate-erd-sql.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, 'schema_current.sql');
const OUT = path.join(__dirname, 'schema_erd.sql');

const raw = readFileSync(SRC, 'utf8');

/* ----------------------------------------------------------------- */
/*  1. Carve up the file by statement                                 */
/* ----------------------------------------------------------------- */

// pg_dump emits one statement per "--" comment-headed block. Split on
// semicolons that terminate a top-level statement. We accept that a few
// CREATE TABLE / CREATE INDEX statements will be the bulk.
const statements = raw
  .split(/;\s*\n/)
  .map(s => s.trim())
  .filter(Boolean);

/* ----------------------------------------------------------------- */
/*  2. Extract CREATE TABLE definitions (no FKs yet)                  */
/* ----------------------------------------------------------------- */

// name -> { columns: [...], primary: 'colname', fks: [...] }
const tables = new Map();

for (const s of statements) {
  // pg_dump prefixes every statement with a `-- Name: …` comment block,
  // so we can't anchor at start-of-string. Match CREATE TABLE anywhere.
  const m = s.match(/CREATE TABLE\s+(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([\s\S]+)\)\s*$/);
  if (!m) continue;
  const tableName = m[1];
  const bodyRaw = m[2];

  // Split column lines, respecting nested parens (e.g. NUMERIC(12,2))
  const lines = [];
  let buf = '';
  let depth = 0;
  for (const ch of bodyRaw) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      lines.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) lines.push(buf.trim());

  const columns = [];
  for (const line of lines) {
    const colMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+(.+)$/);
    if (!colMatch) continue;
    const name = colMatch[1];
    let rest = colMatch[2];

    // Portable type conversions.
    rest = rest
      .replace(/character varying\((\d+)\)/gi, 'VARCHAR($1)')
      .replace(/character varying/gi, 'VARCHAR')
      .replace(/timestamp with time zone/gi, 'TIMESTAMP')
      .replace(/timestamp without time zone/gi, 'TIMESTAMP')
      .replace(/time with time zone/gi, 'TIME')
      .replace(/time without time zone/gi, 'TIME')
      .replace(/double precision/gi, 'DOUBLE')
      .replace(/\bbytea\b/gi, 'BLOB')
      .replace(/\binteger\b/gi, 'INT')
      .replace(/\bsmallint\b/gi, 'SMALLINT')
      .replace(/\bbigint\b/gi, 'BIGINT')
      .replace(/\bboolean\b/gi, 'BOOLEAN')
      .replace(/\btext\b/gi, 'TEXT')
      .replace(/\bnumeric\((\d+),\s*(\d+)\)/gi, 'DECIMAL($1,$2)')
      .replace(/\bnumeric\b/gi, 'DECIMAL');

    columns.push({ name, rest });
  }

  tables.set(tableName, { columns, primary: null, fks: [] });
}

/* ----------------------------------------------------------------- */
/*  3. Stitch in PRIMARY KEY constraints (from ALTER TABLE ... PK)    */
/* ----------------------------------------------------------------- */

for (const s of statements) {
  const m = s.match(/ALTER TABLE\s+(?:ONLY\s+)?(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s+ADD CONSTRAINT\s+\S+\s+PRIMARY KEY\s+\(([^)]+)\)/i);
  if (!m) continue;
  const tableName = m[1];
  const colName = m[2].trim();
  const t = tables.get(tableName);
  if (!t) continue;
  t.primary = colName;
}

/* ----------------------------------------------------------------- */
/*  4. Stitch in FOREIGN KEY constraints (from ALTER TABLE ... FK)    */
/* ----------------------------------------------------------------- */

for (const s of statements) {
  const m = s.match(
    /ALTER TABLE\s+(?:ONLY\s+)?(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s+ADD CONSTRAINT\s+\S+\s+FOREIGN KEY\s+\(([^)]+)\)\s+REFERENCES\s+(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)\(([^)]+)\)/i,
  );
  if (!m) continue;
  const [, tableName, fromCol, toTable, toCol] = m;
  const t = tables.get(tableName);
  if (!t) continue;
  t.fks.push({ fromCol: fromCol.trim(), toTable, toCol: toCol.trim() });
}

/* ----------------------------------------------------------------- */
/*  5. Emit clean DDL                                                 */
/* ----------------------------------------------------------------- */

const out = [];
out.push('-- Furnish Hope database — ERD-ready DDL');
out.push('-- Generated from db/schema_current.sql by db/generate-erd-sql.mjs');
out.push('-- For drawio.com → Arrange → Insert → From SQL');
out.push('');

for (const [tableName, t] of tables) {
  const colLines = t.columns.map(c => {
    let line = `  ${c.name} ${c.rest}`;
    // Drop DEFAULT nextval(...) clauses — drawio doesn't care and they
    // reference sequences we've stripped anyway.
    line = line.replace(/\s+DEFAULT nextval\([^)]+\)/i, '');
    // Drop DEFAULT clauses that include now()/CURRENT_TIMESTAMP — drawio
    // sometimes mis-parses parentheses inside DEFAULT values.
    line = line.replace(/\s+DEFAULT [^,]+/i, '');
    if (c.name === t.primary) line += ' PRIMARY KEY';
    return line;
  });

  const fkLines = t.fks.map(fk =>
    `  FOREIGN KEY (${fk.fromCol}) REFERENCES ${fk.toTable} (${fk.toCol})`,
  );

  out.push(`CREATE TABLE ${tableName} (`);
  out.push([...colLines, ...fkLines].join(',\n'));
  out.push(');');
  out.push('');
}

writeFileSync(OUT, out.join('\n'), 'utf8');
console.log(`Wrote ${OUT} — ${tables.size} tables`);
