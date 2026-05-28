/**
 * Client-side form validation for the generic admin. Rules are derived from
 * the column metadata returned by the API — `required`, `maxLength`, and
 * field type are enough to cover most cases without a schema library.
 */

import type { ColumnMeta } from './admin.ts';

/** Map of column name → human-readable error message. Empty when valid. */
export type FormErrors = Record<string, string>;

/**
 * Run all field-level checks against the given form values. Pass in only
 * the columns that are actually rendered in the form (i.e. !hideInForm).
 */
export function validateForm(cols: ColumnMeta[], values: Record<string, any>): FormErrors {
  const errors: FormErrors = {};
  for (const col of cols) {
    const v = values[col.name];
    const msg = validateField(col, v);
    if (msg) errors[col.name] = msg;
  }
  return errors;
}

/** Validate a single field. Returns an error message or null. */
export function validateField(col: ColumnMeta, value: any): string | null {
  // Required check — only flag truly empty values.
  if (col.required && isEmpty(value)) {
    return 'Required';
  }

  // Non-required + empty is fine.
  if (isEmpty(value)) return null;

  // Type-specific checks below this point.
  switch (col.type) {
    case 'text':
    case 'textarea':
      if (typeof value === 'string' && col.maxLength && value.length > col.maxLength) {
        return `Too long (max ${col.maxLength} characters)`;
      }
      return null;

    case 'number':
    case 'money': {
      const n = typeof value === 'number' ? value : Number(value);
      if (Number.isNaN(n)) return 'Must be a number';
      if (col.type === 'money' && n < 0) return 'Must be zero or greater';
      return null;
    }

    case 'date':
    case 'datetime': {
      // Browser inputs typically yield valid strings, but a user could paste
      // something. Just confirm it's parseable.
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return 'Not a valid date';
      return null;
    }

    case 'time': {
      // Expect HH:MM or HH:MM:SS
      if (typeof value === 'string' && !/^\d{1,2}:\d{2}(:\d{2})?$/.test(value)) {
        return 'Not a valid time (HH:MM)';
      }
      return null;
    }

    case 'fk': {
      // Required-ness handled above; non-empty FK must be a positive integer.
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isInteger(n) || n <= 0) return 'Pick a value from the list';
      return null;
    }

    default:
      return null;
  }
}

/** True when the value should be treated as "not provided". */
function isEmpty(v: any): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  // Numbers, booleans, etc. are always "provided" (including 0 and false).
  return false;
}
