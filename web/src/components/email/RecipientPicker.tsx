/**
 * "+ Contact" affordance shown next to To / Cc / Bcc fields on the
 * Compose and Reply forms. Click it to open a popover with:
 *   - a type filter (All / Staff / Volunteer / Donor / Client / Agency)
 *   - a search box that filters live as the user types
 *   - a list of contacts (name + email + type chip); click to add
 *
 * The To/Cc/Bcc destination is encoded in WHICH picker button the user
 * clicks — same affordance, three locations. No extra destination
 * picker step.
 *
 * The popover stays open after each pick (because adding several
 * people in a row is common). Click outside or press Escape to close.
 *
 * Calls `onPick(email)` for each row clicked — the parent decides how
 * to merge into its existing field state (we always dedupe + append).
 */

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api.ts';

export type RecipientTarget = 'to' | 'cc' | 'bcc';

interface PickerRow {
  display_name: string;
  email: string;
  type_label: string;
  entity_type: string;
  entity_id: number;
}

/** Last-used type filter, remembered for this session so adding
 *  multiple of the same kind doesn't require re-selecting it. */
let lastUsedType: string = 'all';

export function RecipientPicker({
  target,
  onPick,
}: {
  target: RecipientTarget;
  onPick: (email: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(lastUsedType);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Persist the type choice across all RecipientPicker instances.
  useEffect(() => { lastUsedType = type; }, [type]);

  // Close on click-outside or Escape.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Live search — react-query refetches on every keystroke. Server
  // caps at 100 rows, the query is a fast UNION, debounce isn't worth
  // the complexity yet.
  const { data: results, isLoading } = useQuery<PickerRow[]>({
    queryKey: ['email', 'contact-picker', type, query.trim().toLowerCase()],
    queryFn: () => apiGet('/api/email/contact-picker', {
      type,
      ...(query.trim() ? { q: query.trim() } : {}),
    }),
    enabled: open, // don't hammer the API until the popover opens
    staleTime: 30_000,
  });

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-[11px] text-terracotta hover:text-terracotta-deep border border-hairline-strong px-2 py-1 rounded hover:border-terracotta whitespace-nowrap"
        title={`Pick a contact to add to ${target.toUpperCase()}`}
      >
        + Contact ▾
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-[340px] max-h-96 overflow-hidden bg-paper border border-hairline-strong rounded-md shadow-xl right-0 flex flex-col">
          {/* Header — type filter + search */}
          <div className="p-2.5 border-b border-hairline bg-cream/50 space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="text-xs bg-paper border border-hairline-strong rounded px-1.5 py-0.5 flex-1"
              >
                <option value="all">All</option>
                <option value="staff">Staff</option>
                <option value="volunteer">Volunteer</option>
                <option value="donor">Donor</option>
                <option value="client">Client</option>
                <option value="agency">Agency</option>
              </select>
              <span className="text-[10px] text-ink-faint">→ {target.toUpperCase()}</span>
            </div>
            <input
              type="search"
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search name or email…"
              className="w-full text-xs bg-paper border border-hairline-strong rounded px-2 py-1 focus:outline-none focus:border-terracotta"
            />
          </div>

          {/* Results */}
          <div className="overflow-y-auto flex-1">
            {isLoading && <div className="p-3 text-xs text-ink-faint">Loading…</div>}
            {!isLoading && (!results || results.length === 0) && (
              <div className="p-3 text-xs text-ink-faint italic">
                {query.trim() ? 'No matches.' : 'Start typing to search, or pick a Type.'}
              </div>
            )}
            {results?.map(row => (
              <button
                key={`${row.entity_type}:${row.entity_id}`}
                type="button"
                onClick={() => {
                  onPick(row.email);
                  // Stay open so the user can keep adding people.
                }}
                className="w-full text-left px-3 py-2 hover:bg-terracotta/[0.06] border-b border-hairline last:border-b-0 block"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium truncate">{row.display_name}</span>
                  <span className="text-[10px] text-ink-faint uppercase tracking-widest flex-shrink-0">{row.type_label}</span>
                </div>
                <div className="text-[11px] text-ink-soft truncate">{row.email}</div>
              </button>
            ))}
          </div>

          {/* Footer hint */}
          <div className="px-2.5 py-1.5 border-t border-hairline text-[10px] text-ink-faint bg-cream/30">
            Click a name to add to {target.toUpperCase()}. Esc to close.
          </div>
        </div>
      )}
    </div>
  );
}

/** Append `email` to a comma-separated address list, deduping
 *  case-insensitively. Returns the new list. Used by callers of
 *  RecipientPicker as the canonical merge behavior. */
export function appendRecipient(existing: string, email: string): string {
  const seen = new Set(
    existing
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean),
  );
  if (seen.has(email.trim().toLowerCase())) return existing;
  const trimmed = existing.trim().replace(/,\s*$/, '');
  return trimmed.length === 0 ? email : `${trimmed}, ${email}`;
}
