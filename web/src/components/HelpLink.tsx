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

/**
 * The single tab name we use for every Help click. Browsers will
 * reuse the tab with this name on subsequent clicks instead of
 * spawning a fresh one each time, AND any in-page #anchor change
 * triggers ManualShell's hashchange listener to re-scroll.
 */
const MANUAL_TAB_NAME = 'furnish-hope-manual';

export function HelpLink({ section, audience = 'staff' }: Props) {
  const base = audience === 'agency' ? '/agency/help' : '/help';
  const href = `${base}#${section}`;

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // Let modifier-clicks fall through to the browser default
    // (cmd-click / ctrl-click to open in a real new tab).
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    // window.open with a name reuses any existing tab with that
    // name; otherwise it opens a new one. Calling focus() pulls the
    // tab to the front so the user actually sees the new section.
    const win = window.open(href, MANUAL_TAB_NAME);
    if (win) {
      try { win.focus(); } catch { /* some browsers block focus() — silent fail is fine */ }
    }
  }

  return (
    <a
      href={href}
      target={MANUAL_TAB_NAME}
      rel="noopener noreferrer"
      onClick={handleClick}
      title="Open the User Manual at the section for this page (reuses one tab)"
      className="text-xs text-ink-soft hover:text-terracotta border border-hairline-strong px-3 py-1 rounded-md hover:border-terracotta inline-flex items-center gap-1"
    >
      Help
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 17L17 7M9 7h8v8" />
      </svg>
    </a>
  );
}
