/**
 * Generic editable list of child rows. Used wherever the user needs to manage
 * a 1-to-many relationship inline on the parent form — request items, delivery
 * crew, delivery items loaded, volunteer skills, etc.
 *
 * Pattern: each row is an object. Rows with an `id` exist server-side; rows
 * without one are new and will be INSERTed on save. The full array is sent
 * back to the server, which diffs against the existing rows to determine
 * INSERT / UPDATE / DELETE.
 *
 *   <SubformList
 *     rows={items}
 *     onChange={setItems}
 *     emptyHint="No items yet."
 *     addLabel="+ Add item"
 *     newRow={() => ({ item_category_id: null, quantity: 1, priority: 'Medium' })}
 *     renderRow={(row, update) => (
 *       <>
 *         <FkSelect fkTable="lkp_item_category" value={row.item_category_id}
 *           onChange={v => update({ item_category_id: v })} />
 *         …
 *       </>
 *     )}
 *   />
 */

import type { ReactNode } from 'react';

export interface SubformRow {
  _key?: string;        // client-only unique key (for React)
  id?: number | null;   // server PK if existing
  [field: string]: any;
}

interface SubformListProps<R extends SubformRow> {
  rows: R[];
  onChange: (rows: R[]) => void;
  /** Headers shown above the row grid. */
  headers?: ReactNode;
  /** Renders one row's editable cells. `update` merges a partial patch. */
  renderRow: (row: R, update: (patch: Partial<R>) => void, index: number) => ReactNode;
  /** Factory for a blank row to add. */
  newRow: () => R;
  addLabel?: string;
  emptyHint?: string;
  /** Override the column count of the row grid; defaults to a single span. */
  className?: string;
}

export function SubformList<R extends SubformRow>({
  rows, onChange, headers, renderRow, newRow,
  addLabel = '+ Add row', emptyHint = 'Nothing here yet.',
  className,
}: SubformListProps<R>) {
  function addRow() {
    onChange([...rows, { ...newRow(), _key: cryptoKey() }]);
  }
  function removeRow(index: number) {
    const next = rows.slice();
    next.splice(index, 1);
    onChange(next);
  }
  function updateRow(index: number, patch: Partial<R>) {
    const next = rows.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  return (
    <div className={className}>
      {headers && (
        <div className="text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2 border-b border-hairline mb-2">
          {headers}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="text-xs text-ink-faint py-3 italic">{emptyHint}</div>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div
              key={row._key ?? row.id ?? `row-${i}`}
              className="grid grid-cols-[1fr_auto] gap-3 items-start py-1"
            >
              <div>{renderRow(row, patch => updateRow(i, patch), i)}</div>
              <button
                type="button"
                onClick={() => removeRow(i)}
                title="Remove this row"
                className="text-ink-faint hover:text-terracotta text-lg leading-none px-2 py-1"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addRow}
        className="mt-3 text-xs text-terracotta hover:text-terracotta-deep font-medium"
      >
        {addLabel}
      </button>
    </div>
  );
}

/** Stable enough unique key for newly-added rows; React only needs uniqueness within the array. */
function cryptoKey(): string {
  return `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
