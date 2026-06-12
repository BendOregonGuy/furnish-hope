/**
 * Force window scroll to (0, 0) on every route change.
 *
 * Without this, react-router keeps the document scroll position
 * across navigations — if the user scrolls halfway down a long
 * form and then clicks "Cancel" or a sidebar link, they land on
 * the next page already scrolled down, which feels broken.
 *
 * Renders nothing; only useful for the side effect.
 *
 * Mount once near the top of the React tree, inside the Router but
 * outside the Routes block (so it survives Route swaps).
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Don't override the URL's #anchor target. The Help buttons throughout
    // the app open the manual in a new tab at /help#section — without this
    // guard, ScrollToTop fires on initial mount and wipes the browser's
    // hash-anchor scroll before ManualShell's own scroll-to-anchor can run.
    if (window.location.hash) return;
    // `instant` because the user didn't ask for smooth scroll — they
    // expect to land at the top, not see the previous content scroll
    // past. Some browsers don't honor `behavior: 'instant'` and default
    // to instant anyway, which is fine.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}
