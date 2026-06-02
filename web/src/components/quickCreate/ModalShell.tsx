/**
 * Shared header/body/footer chrome + layout primitives for the quick-create
 * modals (Address, Vehicle, Contact, CorpFacility, FacilityStaff). Keeps
 * the modals visually consistent and shrinks each modal file to just its
 * own fields + state.
 */

import type { ReactNode } from 'react';

export function ModalShell({
  title, subtitle, onSubmit, onCancel, submitting, topError, children,
}: {
  title: string;
  subtitle?: string;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  submitting: boolean;
  topError?: string | null;
  children: ReactNode;
}) {
  return (
    <form onSubmit={onSubmit}>
      <div className="px-5 py-4 border-b border-hairline flex items-baseline justify-between">
        <div>
          <h2 className="font-display text-xl font-medium m-0">{title}</h2>
          {subtitle && <p className="text-[11px] text-ink-faint mt-0.5">{subtitle}</p>}
        </div>
        <button type="button" onClick={onCancel} className="text-ink-faint hover:text-terracotta text-xl leading-none">×</button>
      </div>

      <div className="px-5 py-4 max-h-[calc(100vh-220px)] overflow-y-auto space-y-2.5">
        {children}
        {topError && (
          <div className="p-2.5 bg-terracotta-soft text-terracotta-deep rounded-md text-xs">{topError}</div>
        )}
      </div>

      <div className="px-5 py-3 border-t border-hairline flex items-center justify-end gap-2 bg-cream/40 rounded-b-lg">
        <button type="button" onClick={onCancel} className="btn-ghost text-xs">Cancel</button>
        <button type="submit" disabled={submitting} className="btn-primary text-xs disabled:opacity-60">
          {submitting ? 'Saving…' : 'Save & select'}
        </button>
      </div>
    </form>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[10px] tracking-widest uppercase text-ink-faint font-medium mb-2 mt-2 first:mt-0">{title}</div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

export function Field({ label, required, full, children }: { label: string; required?: boolean; full?: boolean; children: ReactNode }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="field-label">{label}{required && ' *'}</label>
      {children}
    </div>
  );
}
