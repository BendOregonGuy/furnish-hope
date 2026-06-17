/**
 * Renders a single form field based on a ColumnMeta. The parent passes the
 * current value and an onChange that hands back the new value in whatever
 * shape the server expects (bool stays bool, fk stays number-or-null, etc.).
 */

import type { ColumnMeta } from '../../lib/admin.ts';
import { FkSelect } from './FkSelect.tsx';

export function Field({
  col,
  value,
  initialFkLabel,
  error,
  onChange,
  onBlur,
}: {
  col: ColumnMeta;
  value: any;
  initialFkLabel?: string;
  error?: string | null;
  onChange: (v: any) => void;
  onBlur?: () => void;
}) {
  const id = `field-${col.name}`;
  const hasError = !!error;

  return (
    <div onBlur={onBlur}>
      <label htmlFor={id} className="field-label flex items-center gap-1">
        {col.label}
        {col.required && <span className="text-terracotta" title="Required">*</span>}
      </label>
      <div className={hasError ? 'admin-field-error' : ''}>
        <FieldInput
          id={id}
          col={col}
          value={value}
          initialFkLabel={initialFkLabel}
          onChange={onChange}
        />
      </div>
      {hasError && (
        <div className="text-[11px] text-terracotta-deep mt-1 font-medium">{error}</div>
      )}
      {!hasError && col.helpText && (
        <div className="text-[11px] text-ink-faint mt-1">{col.helpText}</div>
      )}
    </div>
  );
}

function FieldInput({
  id,
  col,
  value,
  initialFkLabel,
  onChange,
}: {
  id: string;
  col: ColumnMeta;
  value: any;
  initialFkLabel?: string;
  onChange: (v: any) => void;
}) {
  if (col.type === 'fk') {
    return (
      <FkSelect
        fkTable={col.fkTable!}
        value={value ?? null}
        initialLabel={initialFkLabel}
        required={col.required}
        onChange={onChange}
      />
    );
  }

  // VARCHAR columns pinned by a CHECK constraint to an enum render as a
  // <select> with the allowed values. Declared in api/src/admin/config.ts
  // because the introspector can't read CHECK constraint content.
  if (col.enumValues && col.enumValues.length > 0) {
    return (
      <select
        id={id}
        className="field-input"
        value={value ?? ''}
        required={col.required}
        onChange={e => onChange(e.target.value || null)}
      >
        {!col.required && <option value="">— None —</option>}
        {col.enumValues.map(v => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
    );
  }

  if (col.type === 'boolean') {
    return (
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <input
          id={id}
          type="checkbox"
          checked={!!value}
          onChange={e => onChange(e.target.checked)}
          className="w-4 h-4 accent-terracotta"
        />
        <span className="text-sm">{value ? 'Yes' : 'No'}</span>
      </label>
    );
  }

  if (col.type === 'textarea') {
    return (
      <textarea
        id={id}
        rows={3}
        className="field-input font-sans"
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
      />
    );
  }

  if (col.type === 'number' || col.type === 'money') {
    const prefix = col.type === 'money' ? '$' : null;
    return (
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint text-sm">{prefix}</span>}
        <input
          id={id}
          type="number"
          step={col.scale ? `0.${'0'.repeat(Math.max(col.scale - 1, 0))}1` : '1'}
          className={`field-input ${prefix ? 'pl-7' : ''}`}
          value={value ?? ''}
          onChange={e => onChange(e.target.value === '' ? null : e.target.valueAsNumber)}
        />
      </div>
    );
  }

  if (col.type === 'date') {
    return (
      <input
        id={id}
        type="date"
        className="field-input"
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
      />
    );
  }

  if (col.type === 'datetime') {
    return (
      <input
        id={id}
        type="datetime-local"
        className="field-input"
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
      />
    );
  }

  if (col.type === 'time') {
    return (
      <input
        id={id}
        type="time"
        className="field-input"
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
      />
    );
  }

  if (col.type === 'pk') {
    return (
      <input
        id={id}
        type="text"
        className="field-input bg-cream-deep text-ink-faint"
        value={value ?? '(assigned on save)'}
        readOnly
      />
    );
  }

  // text + unknown
  return (
    <input
      id={id}
      type="text"
      className="field-input"
      maxLength={col.maxLength}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
    />
  );
}
