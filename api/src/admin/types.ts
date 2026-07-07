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
  /** True when the column has a SQL DEFAULT (NOW(), 0, false, etc.).
   *  Used by the admin POST handler to OMIT the column from the INSERT
   *  when the form sent null — so Postgres applies its DEFAULT instead
   *  of failing the NOT NULL check. Same idea on UPDATE we DON'T skip,
   *  because explicitly setting a column to null is meaningful. */
  hasDefault: boolean;
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
  /** When set, the field renders as a <select> with these allowed
   *  values (instead of a plain text input). Used for VARCHAR
   *  columns whose CHECK constraint pins them to an enum — admin
   *  introspection has no way to read CHECK content, so we declare
   *  the values manually in config.ts. */
  enumValues?: string[];
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
  /** Optional SQL predicate applied ONLY to /fk-options/:table dropdown
   *  queries. Lets a table restrict what can be *picked* going forward
   *  without hiding existing rows from list/detail views. `t` aliases
   *  the row. */
  fkOptionsFilter?: string;
}

/** Server-side schema map keyed by raw table name. */
export type SchemaMap = Record<string, TableMeta>;
