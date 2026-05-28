/**
 * Layout helpers shared across operational forms. Each section is a `card`
 * with a title, optional hint, and optional action buttons in the header.
 */

import type { ColumnMeta } from '../../lib/admin.ts';

export function Section({
  title,
  hint,
  children,
  actions,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3 className="font-display font-medium text-[17px] m-0">{title}</h3>
          {hint && <div className="text-xs text-ink-faint mt-0.5">{hint}</div>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

export function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">{children}</div>;
}

/** Wraps a Field so textarea spans both columns. */
export function Cell({ col, children }: { col: ColumnMeta; children: React.ReactNode }) {
  return <div className={col.type === 'textarea' ? 'sm:col-span-2' : ''}>{children}</div>;
}
