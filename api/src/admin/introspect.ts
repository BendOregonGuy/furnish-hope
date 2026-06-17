/**
 * Schema introspection. Queries Postgres' information_schema once at startup
 * to discover tables, columns, primary keys, and foreign keys — then merges
 * with the manual overrides in config.ts to produce a complete `SchemaMap`.
 *
 * Re-running is cheap (a handful of small queries against system catalogs).
 */

import { query } from '../db/pool.js';
import type { ColumnMeta, FieldType, SchemaMap, TableMeta } from './types.js';
import { GROUP_ORDER, LOOKUP_OVERRIDES, TABLE_OVERRIDES, type ColumnOverride, type TableOverride } from './config.js';

interface RawColumn {
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  ordinal_position: number;
}

interface RawPk { table_name: string; column_name: string; }
interface RawFk {
  table_name: string;
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
}

/** Title-case a snake_case identifier. Trims a trailing "_id" for FK columns. */
function humanize(name: string, isFk: boolean): string {
  let s = name;
  if (isFk && s.endsWith('_id')) s = s.slice(0, -3);
  return s
    .split('_')
    .filter(Boolean)
    .map((w, i) => i === 0 ? w[0].toUpperCase() + w.slice(1) : w)
    .join(' ');
}

/** Lookup tables follow `lkp_<name>` with label column `<name>`. */
function lookupLabelColumn(table: string): string | null {
  if (!table.startsWith('lkp_')) return null;
  return table.slice(4);
}

function defaultLookupTableLabel(table: string): { label: string; singular: string } {
  const base = table.slice(4); // strip lkp_
  const titled = base.split('_').map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ');
  // Naive plural: append "s" unless it already ends in s/y.
  const plural =
    titled.endsWith('s') ? titled :
    titled.endsWith('y') ? titled.slice(0, -1) + 'ies' :
    titled + 's';
  return { singular: titled, label: plural };
}

/**
 * Auto-derive a FieldType from the raw Postgres column metadata, considering
 * PK and FK status (which the caller knows).
 */
function deriveFieldType(c: RawColumn, isPk: boolean, isFk: boolean): FieldType {
  if (isPk) return 'pk';
  if (isFk) return 'fk';

  const dt = c.data_type;
  const name = c.column_name;

  if (dt === 'boolean') return 'boolean';
  if (dt === 'date') return 'date';
  if (dt === 'time' || dt === 'time without time zone' || dt === 'time with time zone') return 'time';
  if (dt.startsWith('timestamp')) return 'datetime';
  if (dt === 'integer' || dt === 'bigint' || dt === 'smallint') return 'number';

  if (dt === 'numeric' || dt === 'real' || dt === 'double precision') {
    if (/amount|cost|value|price|total|fee|paid|raised/.test(name)) return 'money';
    return 'number';
  }

  if (dt === 'text') return 'textarea';

  if (dt === 'character varying' || dt === 'character') {
    const len = c.character_maximum_length ?? 0;
    return len > 120 ? 'textarea' : 'text';
  }

  return 'unknown';
}

/** Run the introspection queries and build the schema map. */
export async function introspectSchema(): Promise<SchemaMap> {
  // All BASE TABLEs in the public schema.
  const tables = await query<{ table_name: string }>(`
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name
  `);

  // Columns for those tables.
  const columns = await query<RawColumn>(`
    SELECT table_name, column_name, data_type, udt_name, is_nullable,
           column_default, character_maximum_length, numeric_precision,
           numeric_scale, ordinal_position
      FROM information_schema.columns
     WHERE table_schema = 'public'
     ORDER BY table_name, ordinal_position
  `);

  // Primary keys (one row per pk-column; composite PKs supported but we only
  // use the first column for SERIAL-style PKs).
  const pks = await query<RawPk>(`
    SELECT kcu.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name
       AND kcu.table_schema    = tc.table_schema
     WHERE tc.table_schema = 'public'
       AND tc.constraint_type = 'PRIMARY KEY'
  `);

  // Foreign keys: column → referenced table + column.
  const fks = await query<RawFk>(`
    SELECT tc.table_name,
           kcu.column_name,
           ccu.table_name  AS foreign_table_name,
           ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name
       AND kcu.table_schema    = tc.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema    = tc.table_schema
     WHERE tc.table_schema = 'public'
       AND tc.constraint_type = 'FOREIGN KEY'
  `);

  // Index everything by table.
  const pkByTable = new Map<string, string>();
  for (const p of pks) pkByTable.set(p.table_name, p.column_name);

  const fkByTableCol = new Map<string, RawFk>();
  for (const f of fks) fkByTableCol.set(`${f.table_name}.${f.column_name}`, f);

  const columnsByTable = new Map<string, RawColumn[]>();
  for (const c of columns) {
    const arr = columnsByTable.get(c.table_name) ?? [];
    arr.push(c);
    columnsByTable.set(c.table_name, arr);
  }

  const schema: SchemaMap = {};

  for (const { table_name: table } of tables) {
    const cols = columnsByTable.get(table) ?? [];
    const pk = pkByTable.get(table);
    if (!pk) continue; // skip tables without a PK (none in this schema, but be safe)

    const override: TableOverride | undefined = TABLE_OVERRIDES[table];
    const lookupOv: Partial<TableOverride> | undefined = LOOKUP_OVERRIDES[table];
    const colOverrides: Record<string, ColumnOverride> = override?.columns ?? {};

    const columnMetas: ColumnMeta[] = cols.map(c => {
      const isPk = c.column_name === pk;
      const fk = fkByTableCol.get(`${table}.${c.column_name}`);
      const isFk = !!fk;

      const ov = colOverrides[c.column_name] ?? {};
      const derivedType = deriveFieldType(c, isPk, isFk);

      const meta: ColumnMeta = {
        name: c.column_name,
        label: ov.label ?? humanize(c.column_name, isFk),
        type: ov.type ?? derivedType,
        required: c.is_nullable === 'NO' && c.column_default === null && !isPk,
        isPk,
        isFk,
        fkTable: fk?.foreign_table_name,
        fkColumn: fk?.foreign_column_name,
        maxLength: c.character_maximum_length ?? undefined,
        precision: c.numeric_precision ?? undefined,
        scale: c.numeric_scale ?? undefined,
        helpText: ov.helpText,
        hideInForm: ov.hideInForm || isPk, // PKs are read-only in form (server assigns)
        hideInList: ov.hideInList,
        enumValues: ov.enumValues,
      };
      return meta;
    });

    // Defaults for lookup tables.
    const isLookup = table.startsWith('lkp_');
    const lookupLabel = lookupLabelColumn(table);

    let label: string;
    let singular: string;
    let group: string;
    let displaySql: string;

    if (override) {
      label = override.label ?? humanize(table.replace(/^tbl_|^lkp_/, ''), false);
      singular = override.singular ?? label.replace(/s$/, '');
      group = override.group;
      displaySql = override.displaySql ?? defaultDisplaySql(table, pk, columnMetas, lookupLabel);
    } else if (isLookup) {
      const defaults = defaultLookupTableLabel(table);
      label = lookupOv?.label ?? defaults.label;
      singular = lookupOv?.singular ?? defaults.singular;
      group = lookupOv?.group ?? 'Lookups';
      displaySql = lookupOv?.displaySql ?? (lookupLabel ? `t.${lookupLabel}` : `t.${pk}::text`);
    } else {
      const base = table.replace(/^tbl_/, '');
      const titled = base.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
      label = titled + 's';
      singular = titled;
      group = 'Other';
      displaySql = defaultDisplaySql(table, pk, columnMetas, null);
    }

    // listColumns: explicit override, or first 5 non-hidden columns.
    const listColumns = override?.listColumns
      ?? columnMetas
        .filter(c => !c.hideInList && c.name !== 'description')
        .slice(0, 5)
        .map(c => c.name);

    // searchColumns: explicit, or all text/textarea columns.
    const searchColumns = override?.searchColumns
      ?? columnMetas.filter(c => c.type === 'text' || c.type === 'textarea').map(c => c.name);

    const defaultSort = override?.defaultSort ?? { column: pk, direction: 'desc' as const };

    schema[table] = {
      table,
      pk,
      label,
      singular,
      group,
      description: override?.description,
      columns: columnMetas,
      listColumns,
      searchColumns,
      displaySql,
      defaultSort,
    };
  }

  return schema;
}

/** Reasonable display expression for a table with no explicit override. */
function defaultDisplaySql(table: string, pk: string, cols: ColumnMeta[], lookupLabel: string | null): string {
  if (lookupLabel && cols.some(c => c.name === lookupLabel)) {
    return `t.${lookupLabel}`;
  }
  // First text column is usually a good fallback.
  const firstText = cols.find(c => c.type === 'text' || c.type === 'textarea');
  if (firstText) return `t.${firstText.name}`;
  // Otherwise show the PK.
  return `'${table.replace(/^tbl_|^lkp_/, '')} #' || t.${pk}::text`;
}

/** Order groups: explicit order first, then any extras alphabetically. */
export function sortedGroups(groups: string[]): string[] {
  const explicit = GROUP_ORDER.filter(g => groups.includes(g));
  const extras = groups.filter(g => !GROUP_ORDER.includes(g)).sort();
  return [...explicit, ...extras];
}
