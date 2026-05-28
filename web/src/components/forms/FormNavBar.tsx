/**
 * Top navigation bar shared across every operational form (Clients, Requests,
 * Deliveries, Pickups, Volunteers, Inventory, …). Renders:
 *
 *   ← All <label>  •  ← Previous   Next →           [✓ Saved]  + New  [●]
 *
 * The dirty-dot on the right shows when there are unsaved changes; the
 * sage "✓ Saved" pill briefly appears after a successful update.
 */

interface FormNavBarProps {
  /** Plural label, e.g. "clients". Used in "← All clients". */
  listLabel: string;
  /** Singular label, e.g. "client". Used in "+ New client". */
  singularLabel: string;
  isNew: boolean;
  prevId: number | null;
  nextId: number | null;
  isDirty: boolean;
  savedFlash: boolean;
  /** Where the buttons should go. Implementations pass a `safeNavigate` that
   *  confirms unsaved changes before navigating. */
  onNav: (to: string) => void;
  /** Base URL — typically `/clients`. Prev/Next append `/:id/edit`. */
  basePath: string;
}

export function FormNavBar({
  listLabel, singularLabel, isNew, prevId, nextId,
  isDirty, savedFlash, onNav, basePath,
}: FormNavBarProps) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3 flex-wrap bg-paper border border-hairline rounded-md px-3 py-2">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => onNav(basePath)}
          className="text-xs text-ink-soft hover:text-terracotta"
        >
          ← All {listLabel}
        </button>
        <span className="text-hairline-strong">•</span>
        <button
          type="button"
          disabled={isNew || !prevId}
          onClick={() => prevId && onNav(`${basePath}/${prevId}/edit`)}
          title={isNew ? 'Save first' : (!prevId ? `No previous ${singularLabel}` : `Previous ${singularLabel}`)}
          className="text-xs text-ink-soft hover:text-terracotta disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-ink-soft"
        >
          ← Previous
        </button>
        <button
          type="button"
          disabled={isNew || !nextId}
          onClick={() => nextId && onNav(`${basePath}/${nextId}/edit`)}
          title={isNew ? 'Save first' : (!nextId ? `No next ${singularLabel}` : `Next ${singularLabel}`)}
          className="text-xs text-ink-soft hover:text-terracotta disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-ink-soft"
        >
          Next →
        </button>
      </div>
      <div className="flex items-center gap-3">
        {savedFlash && (
          <span className="text-xs text-sage font-medium inline-flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Saved
          </span>
        )}
        {!isNew && (
          <button
            type="button"
            onClick={() => onNav(`${basePath}/new`)}
            className="text-xs text-ink-soft hover:text-terracotta border border-hairline-strong px-3 py-1 rounded-md hover:border-terracotta"
          >
            + New {singularLabel}
          </button>
        )}
        {isDirty && <span className="w-2 h-2 rounded-full bg-terracotta" title="Unsaved changes" />}
      </div>
    </div>
  );
}

/**
 * Companion read-only nav bar for detail pages (no "dirty" state, no save
 * pill — just Back/Prev/Next/New plus Edit/Delete actions passed in).
 */
export function DetailNavBar({
  listLabel, singularLabel, prevId, nextId, basePath, actions,
}: {
  listLabel: string;
  singularLabel: string;
  prevId: number | null;
  nextId: number | null;
  basePath: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3 flex-wrap bg-paper border border-hairline rounded-md px-3 py-2">
      <div className="flex items-center gap-3 flex-wrap">
        <a href={basePath} className="text-xs text-ink-soft hover:text-terracotta">← All {listLabel}</a>
        <span className="text-hairline-strong">•</span>
        {prevId ? (
          <a href={`${basePath}/${prevId}`} className="text-xs text-ink-soft hover:text-terracotta">← Previous</a>
        ) : (
          <span className="text-xs text-ink-faint opacity-40 cursor-not-allowed" title={`No previous ${singularLabel}`}>← Previous</span>
        )}
        {nextId ? (
          <a href={`${basePath}/${nextId}`} className="text-xs text-ink-soft hover:text-terracotta">Next →</a>
        ) : (
          <span className="text-xs text-ink-faint opacity-40 cursor-not-allowed" title={`No next ${singularLabel}`}>Next →</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {actions}
      </div>
    </div>
  );
}
