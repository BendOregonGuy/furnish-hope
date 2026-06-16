import { ReactNode } from 'react';
import { HelpLink } from './HelpLink.tsx';
import { IssueReporterButton } from './IssueReporter.tsx';

export function PageHeader({
  title,
  emphasis,
  subtitle,
  actions,
  helpSection,
  helpAudience,
}: {
  title: string;
  emphasis?: string;
  subtitle?: string;
  actions?: ReactNode;
  /** If set, a "Help ↗" link appears in the actions area, opening
   *  the user manual at /help#<helpSection> in a new tab. */
  helpSection?: string;
  /** 'staff' (default) for the main app, 'agency' for caseworker pages. */
  helpAudience?: 'staff' | 'agency';
}) {
  return (
    <div className="flex justify-between items-end mb-7 pb-5 border-b border-hairline">
      <div>
        <h1 className="font-display font-medium text-3xl leading-tight tracking-tight m-0">
          {title}
          {emphasis ? <em className="not-italic font-display italic text-terracotta"> {emphasis}</em> : null}
        </h1>
        {subtitle && <p className="text-sm text-ink-soft mt-1 max-w-xl">{subtitle}</p>}
      </div>
      <div className="flex gap-2">
        {actions}
        {helpSection && <HelpLink section={helpSection} audience={helpAudience} />}
        <IssueReporterButton />
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const cls = pillClassFor(status);
  return <span className={`pill ${cls}`}>{status}</span>;
}

function pillClassFor(status: string): string {
  const s = status.toLowerCase();
  if (s === 'available' || s === 'delivered' || s === 'active' || s === 'ready to schedule' || s === 'completed' || s === 'fulfilled') return 'pill-sage';
  if (s === 'matching' || s === 'reserved' || s === 'scheduled' || s === 'in transit' || s === 'in progress') return 'pill-gold';
  if (s === 'new' || s === 'out' || s === 'cancelled' || s === 'failed' || s === 'intake') return 'pill-terra';
  if (s === 'closed' || s === 'served' || s === 'rescheduled') return 'pill-slate';
  return 'pill-muted';
}

export function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const parts = name.trim().split(/\s+/);
  const init = parts.length === 1 ? parts[0].slice(0,2) : (parts[0][0] + parts[parts.length-1][0]);

  const dims = size === 'lg' ? 'w-14 h-14 text-xl' : size === 'md' ? 'w-9 h-9 text-sm' : 'w-7 h-7 text-[10px]';
  const isLg = size === 'lg' || size === 'md';

  return (
    <div className={`${dims} rounded-full flex items-center justify-center font-medium flex-shrink-0
                     ${isLg ? 'bg-terracotta text-paper font-display' : 'bg-cream-deep text-ink-soft'}`}>
      {init.toUpperCase()}
    </div>
  );
}

export function Loading() {
  return <div className="p-10 text-center text-ink-faint text-sm">Loading…</div>;
}

export function ErrorBox({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="p-4 bg-terracotta-soft text-terracotta-deep rounded-md text-sm">
      Couldn’t load this: {message}
    </div>
  );
}

/**
 * Discreet "Anonymous" indicator next to a donor's name. The donor's real
 * name is ALWAYS shown to staff — this pill just signals "this donor wants
 * public anonymity" (i.e. don't print the name on receipts to other donors,
 * annual reports, plaques, etc.). Internal views never hide the name.
 */
export function AnonPill({ className }: { className?: string }) {
  return (
    <span
      className={`pill pill-slate text-[10px] ${className ?? ''}`}
      title="Donor prefers anonymity in public-facing artifacts. Name stays visible to staff."
    >
      🔒 Anonymous
    </span>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="p-12 text-center">
      <div className="font-display text-lg text-ink-soft">{title}</div>
      {hint && <div className="text-sm text-ink-faint mt-1">{hint}</div>}
    </div>
  );
}
