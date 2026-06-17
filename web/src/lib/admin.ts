/**
 * Client-side types and helpers for the generic admin. The shapes mirror
 * `api/src/admin/types.ts` — keep them in sync.
 */

import { apiGet } from './api.ts';

export type FieldType =
  | 'pk' | 'fk' | 'text' | 'textarea' | 'number' | 'money'
  | 'date' | 'datetime' | 'time' | 'boolean' | 'unknown';

export interface ColumnMeta {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  isPk: boolean;
  isFk: boolean;
  fkTable?: string;
  fkColumn?: string;
  maxLength?: number;
  precision?: number;
  scale?: number;
  helpText?: string;
  hideInForm?: boolean;
  hideInList?: boolean;
  /** When set, the field renders as a <select> with these allowed
   *  values instead of a plain text input. Populated from config.ts
   *  for VARCHAR columns pinned by a CHECK constraint to an enum
   *  (e.g. tbl_app_issue.severity / .status). */
  enumValues?: string[];
}

export interface TableMeta {
  table: string;
  pk: string;
  label: string;
  singular: string;
  group: string;
  description?: string;
  columns: ColumnMeta[];
  listColumns: string[];
  searchColumns: string[];
  displaySql: string;
  defaultSort: { column: string; direction: 'asc' | 'desc' };
}

export interface AdminSchema {
  tables: TableMeta[];
  groups: { name: string; tables: TableMeta[] }[];
}

export interface ListResponse {
  total: number;
  rows: Record<string, any>[];
  fkLabels: Record<string, Record<string, string>>;
}

export interface RowResponse {
  row: Record<string, any>;
  fkLabels: Record<string, Record<string, string>>;
  prevId: number | null;
  nextId: number | null;
}

export interface FkOption { id: number; label: string; }

/** Cached schema fetch — the metadata never changes within a session. */
let schemaCache: Promise<AdminSchema> | null = null;
export function fetchSchema(): Promise<AdminSchema> {
  if (!schemaCache) {
    schemaCache = apiGet<AdminSchema>('/api/admin/schema').catch(err => {
      schemaCache = null;
      throw err;
    });
  }
  return schemaCache;
}

/** Find a table's metadata by name. */
export function findTable(schema: AdminSchema, name: string): TableMeta | undefined {
  return schema.tables.find(t => t.table === name);
}

/** Format any value for display in a list cell. */
export function formatValue(col: ColumnMeta, value: any, fkLabel?: string): string {
  if (value === null || value === undefined || value === '') return '—';
  if (col.isFk) return fkLabel ?? `#${value}`;
  switch (col.type) {
    case 'boolean': return value ? 'Yes' : 'No';
    case 'money': {
      const n = Number(value);
      return Number.isNaN(n) ? String(value) : '$' + Math.round(n).toLocaleString('en-US');
    }
    case 'date': {
      const d = new Date(value);
      return Number.isNaN(d.getTime())
        ? String(value)
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    case 'datetime': {
      const d = new Date(value);
      return Number.isNaN(d.getTime())
        ? String(value)
        : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    }
    default:
      return String(value);
  }
}

/** Convert a date/datetime string from the API into a value an <input> accepts. */
export function toInputValue(col: ColumnMeta, value: any): string {
  if (value === null || value === undefined) return '';
  if (col.type === 'date') {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toISOString().slice(0, 10);
  }
  if (col.type === 'datetime') {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    // datetime-local needs YYYY-MM-DDTHH:MM
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  if (col.type === 'boolean') return value ? 'true' : 'false';
  return String(value);
}
