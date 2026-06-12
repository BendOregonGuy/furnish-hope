/**
 * Layout wrapper for the user manual. A sticky table of contents on
 * the left, scrollable content on the right. Smooth scroll to anchor
 * on click, and scroll-margin on every section so anchored landings
 * don't get hidden under any sticky header chrome.
 *
 * The list of TOC entries is passed in by the parent so the staff
 * manual and agency manual can have different (overlapping) TOCs
 * without forking the layout.
 */

import { useEffect, useState, type ReactNode } from 'react';

export interface TocEntry {
  /** Anchor id matching the rendered section's id="" */
  id: string;
  /** Display label for the TOC */
  label: string;
  /** Indented subsection */
  children?: Array<{ id: string; label: string }>;
}

export function ManualShell({
  title,
  subtitle,
  toc,
  children,
}: {
  title: string;
  subtitle?: string;
  toc: TocEntry[];
  children: ReactNode;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // Watch which section is currently in view and highlight it in
  // the TOC. IntersectionObserver fires whenever a section crosses
  // the viewport — we mark the top-most intersecting one.
  useEffect(() => {
    const ids = toc.flatMap(e => [e.id, ...(e.children ?? []).map(c => c.id)]);
    const els = ids
      .map(id => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
    );
    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [toc]);

  // Scroll to the URL's hash anchor. Three cases to handle:
  //
  //   1. First mount of the manual page (fresh tab) — React has
  //      just rendered, the section element may or may not exist
  //      in the DOM yet. A single setTimeout(50) loses the race
  //      on slow renders. We retry up to ~500ms.
  //
  //   2. Hash changes within the SAME loaded page — the user
  //      clicked another Help button from the main app, the
  //      manual tab was reused (target="furnish-hope-manual"),
  //      and the URL hash flipped. React doesn't re-mount; we
  //      have to listen to `hashchange` explicitly.
  //
  //   3. Clicking a TOC entry inside the manual itself — same
  //      as #2; the anchor link bumps the URL hash and we
  //      re-scroll.
  useEffect(() => {
    function scrollToHash() {
      if (!window.location.hash) return;
      const id = window.location.hash.slice(1);
      let attempts = 0;
      const tryScroll = () => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'start' });
          return;
        }
        if (attempts++ < 10) {
          setTimeout(tryScroll, 50);  // up to ~500ms total
        }
      };
      tryScroll();
    }
    scrollToHash();
    window.addEventListener('hashchange', scrollToHash);
    return () => window.removeEventListener('hashchange', scrollToHash);
  }, []);

  return (
    <>
      <style>{`
        .manual-content section, .manual-content h2[id], .manual-content h3[id] {
          scroll-margin-top: 24px;
        }
        .manual-content h2 {
          font-family: 'Spectral', Georgia, serif;
          font-weight: 500;
          font-size: 26px;
          margin-top: 36px;
          margin-bottom: 12px;
          padding-bottom: 6px;
          border-bottom: 1px solid var(--hairline, #e8e3da);
        }
        .manual-content h2:first-child { margin-top: 0; }
        .manual-content h3 {
          font-family: 'Spectral', Georgia, serif;
          font-weight: 500;
          font-size: 19px;
          margin-top: 24px;
          margin-bottom: 8px;
        }
        .manual-content p { margin-bottom: 12px; line-height: 1.55; }
        .manual-content ol, .manual-content ul {
          padding-left: 24px;
          margin-bottom: 14px;
        }
        .manual-content ol { list-style: decimal; }
        .manual-content ul { list-style: disc; }
        .manual-content li { margin-bottom: 4px; line-height: 1.55; }
        .manual-content code {
          background: #f5f0e8;
          padding: 1px 5px;
          border-radius: 3px;
          font-size: 0.9em;
        }
        .manual-content .callout {
          border-left: 3px solid #c97757;
          background: #fbf7f2;
          padding: 12px 16px;
          margin: 14px 0;
          border-radius: 0 6px 6px 0;
          font-size: 0.95em;
        }
        .manual-content .callout strong { color: #8d4a2c; }
        .manual-content .tip { border-left-color: #7a8c5e; background: #f4f6ee; }
        .manual-content .tip strong { color: #4d5a3a; }
        .manual-content .warn { border-left-color: #c97757; background: #fbf2ec; }
        .manual-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 14px 0;
          font-size: 13px;
        }
        .manual-content th, .manual-content td {
          border: 1px solid #e8e3da;
          padding: 8px 10px;
          text-align: left;
          vertical-align: top;
        }
        .manual-content th { background: #f5f0e8; font-weight: 500; }
      `}</style>

      <div className="mb-7 pb-5 border-b border-hairline">
        <h1 className="font-display font-medium text-3xl leading-tight tracking-tight m-0">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-ink-soft mt-1 max-w-2xl">{subtitle}</p>}
      </div>

      {/* Two-column at md+, single column on mobile so the TOC doesn't
          eat half the screen. Tailwind's `md:grid-cols-[220px_1fr]`
          generates a media-query — no inline style needed. */}
      <div className="grid gap-7 grid-cols-1 md:grid-cols-[220px_1fr]">
        <nav className="text-sm md:sticky md:top-4 md:self-start md:max-h-[calc(100vh-32px)] md:overflow-y-auto">
          <div className="text-[10px] uppercase tracking-widest text-ink-faint font-medium mb-2">
            Table of contents
          </div>
          <ul className="space-y-0.5">
            {toc.map(e => (
              <li key={e.id}>
                <a
                  href={`#${e.id}`}
                  className={`block py-1 pr-2 text-[13px] border-l-2 pl-2.5 -ml-2.5 ${
                    activeId === e.id
                      ? 'border-terracotta text-terracotta font-medium'
                      : 'border-transparent text-ink-soft hover:text-ink hover:border-hairline-strong'
                  }`}
                >
                  {e.label}
                </a>
                {e.children && e.children.length > 0 && (
                  <ul className="ml-3 space-y-0.5">
                    {e.children.map(c => (
                      <li key={c.id}>
                        <a
                          href={`#${c.id}`}
                          className={`block py-0.5 text-[12px] border-l-2 pl-2.5 -ml-2.5 ${
                            activeId === c.id
                              ? 'border-terracotta text-terracotta'
                              : 'border-transparent text-ink-faint hover:text-ink-soft hover:border-hairline'
                          }`}
                        >
                          {c.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <article className="manual-content max-w-3xl" style={{ minWidth: 0 }}>
          {children}
        </article>
      </div>
    </>
  );
}
