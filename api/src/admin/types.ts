/**
 * Shared types for the generic admin layer. The frontend consumes these via
 * `/api/admin/schema`, so any change here is a wire-protocol change.
 */

export type FieldType =
  | 'pk'         // primary key, read-only after create
  | 'fk'         // foreign key, rendered as a searchable dropdown
  | 'text'       // single-line string
  | 'textarea'   // multi-line string (TEXT or long VARCHAR)
  | 'number'     // integer or numeric without money semantics
  | 'money'      // numeric formatted as currency
  | 'date'       // calendar date
  | 'datetime'   // timestamptz
  | 'time'       // time of day
  | 'boolean'    // checkbox / toggle
  | 'unknown';

export interface ColumnMeta {
  name: string;            // raw column name
  label: string;            // human-friendly label
  type: FieldType;
  required: boolean;       // NOT NULL with no default
  isPk: boolean;
  isFk: boolean;
  fkTable?: string;        // when isFk
  fkColumn?: string;       // when isFk — the referenced PK column
  maxLength?: number;
  precision?: number;
  scale?: number;
  helpText?: string;
  hideInForm?: boolean;
  hideInList?: boolean;
}

export interface TableMeta {
  table: string;            // raw table name, e.g. tbl_client
  pk: string;               // primary key column name
  label: string;            // plural human-friendly label
  singular: string;         // singular human-friendly label
  group: string;            // sidebar group, e.g. "Clients & Referrals"
  description?: string;     // optional caption
  columns: ColumnMeta[];
  listColumns: string[];    // column names to show in list (in order)
  searchColumns: string[];  // text-typed columns searched by ?search=
  /** Postgres expression returning the row's display text. `t` aliases the row. */
  displaySql: string;
  defaultSort: { column: string; direction: 'asc' | 'desc' };
}

/** Server-side schema map keyed by raw table name. */
export type SchemaMap = Record<string, TableMeta>;
