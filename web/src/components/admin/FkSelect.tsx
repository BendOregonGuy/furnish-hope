/**
 * Searchable foreign-key selector. Fetches `/api/admin/fk-options/:table`
 * with a debounced search query. Shows the human label for the currently
 * selected id, even before the user types.
 */

import { useEffect, useRef, useState } from 'react';
import { apiGet } from '../../lib/api.ts';
import type { FkOption } from '../../lib/admin.ts';

export function FkSelect({
  fkTable,
  value,
  initialLabel,
  required,
  onChange,
  allowClear = true,
}: {
  fkTable: string;
  value: number | null;
  initialLabel?: string;
  required?: boolean;
  onChange: (id: number | null) => void;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<FkOption[]>([]);
  const [loading, setLoading] = useState(false);
  // Label of the *currently selected* value. Tracked separately so we can
  // show the previous label even while the user types something new.
  const [selectedLabel, setSelectedLabel] = useState<string | undefined>(initialLabel);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Fetch the label for the current value if we don't already have one
  // (e.g. on first mount when only the id is known).
  useEffect(() => {
    let cancelled = false;
    if (value && !selectedLabel) {
      apiGet<FkOption[]>(`/api/admin/fk-options/${fkTable}`, { limit: '50' })
        .then(opts => {
          if (cancelled) return;
          const match = opts.find(o => o.id === value);
          if (match) setSelectedLabel(match.label);
        })
        .catch(() => { /* ignore */ });
    }
    return () => { cancelled = true; };
  }, [value, fkTable, selectedLabel]);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      setLoading(true);
      apiGet<FkOption[]>(`/api/admin/fk-options/${fkTable}`, { search, limit: '50' })
        .then(opts => { setOptions(opts); setLoading(false); })
        .catch(() => { setOptions([]); setLoading(false); });
    }, 150);
    return () => clearTimeout(handle);
  }, [search, open, fkTable]);

  // Click-outside to close.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const buttonLabel = value
    ? (selectedLabel ?? `#${value}`)
    : <span className="text-ink-faint">Select…</span>;

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="field-input text-left flex items-center justify-between gap-2 w-full"
      >
        <span className="truncate">{buttonLabel}</span>
        <span className="text-ink-faint text-xs flex-shrink-0">▾</span>
      </button>

      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-paper border border-hairline-strong rounded-md shadow-lg max-h-72 overflow-hidden flex flex-col">
          <input
            autoFocus
            type="text"
            className="w-full bg-cream border-b border-hairline px-3 py-2 text-sm focus:outline-none"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="overflow-y-auto">
            {loading && <div className="px-3 py-2 text-xs text-ink-faint">Loading…</div>}
            {!loading && allowClear && !required && (
              <button
                type="button"
                onClick={() => { onChange(null); setSelectedLabel(undefined); setOpen(false); setSearch(''); }}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-terracotta/[0.05] text-ink-faint italic"
              >
                — Clear —
              </button>
            )}
            {!loading && options.length === 0 && (
              <div className="px-3 py-3 text-xs text-ink-faint">No matches.</div>
            )}
            {!loading && options.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChange(opt.id);
                  setSelectedLabel(opt.label);
                  setOpen(false);
                  setSearch('');
                }}
                className={`block w-full text-left px-3 py-2 text-sm hover:bg-terracotta/[0.05] ${value === opt.id ? 'bg-terracotta/[0.08] font-medium' : ''}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
