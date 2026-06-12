/**
 * Small "Help ↗" link that opens the in-app user manual in a new
 * tab, scrolled to the right section.
 *
 * Usage:
 *   <HelpLink section="donations" />
 *   <HelpLink section="events" audience="agency" />
 *
 * Place it in a page header's `actions` slot alongside Edit / + New
 * buttons. The new-tab behavior keeps the user's form state alive in
 * the original tab while they read the docs.
 */

interface Props {
  /** Section anchor in the manual, e.g. "donations", "events". */
  section: string;
  /** Optional override; defaults to 'staff'. Agency portal pages use 'agency'. */
  audience?: 'staff' | 'agency';
}

export function HelpLink({ section, audience = 'staff' }: Props) {
  const base = audience === 'agency' ? '/agency/help' : '/help';
  const href = `${base}#${section}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Open the section of the User Manual for this page (opens in a new tab)"
      className="text-xs text-ink-soft hover:text-terracotta border border-hairline-strong px-3 py-1 rounded-md hover:border-terracotta inline-flex items-center gap-1"
    >
      Help
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 17L17 7M9 7h8v8" />
      </svg>
    </a>
  );
}
