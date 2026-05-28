/**
 * Reusable form dirty-tracking + navigation-guard utilities.
 *
 *   const { isDirty, safeNavigate } = useUnsavedChanges({
 *     values, initialValues, extraDirtyCheck: hasAddress !== initialHasAddress,
 *   });
 *
 * - `isDirty` is true when any rendered value differs from initial (empty
 *   string and null are treated as equivalent).
 * - `safeNavigate(to)` confirms with the user before leaving when dirty.
 * - A `beforeunload` handler is registered whenever dirty, so tab close /
 *   refresh also triggers the browser's native prompt.
 */

import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

export function useUnsavedChanges({
  values,
  initialValues,
  extraDirtyCheck = false,
}: {
  values: Record<string, any>;
  initialValues: Record<string, any>;
  /** Extra "is the form dirty" signal — e.g. a section was toggled on/off. */
  extraDirtyCheck?: boolean;
}): { isDirty: boolean; safeNavigate: (to: string) => void } {
  const navigate = useNavigate();

  const isDirty = useMemo(
    () => extraDirtyCheck || isDirtyValues(values, initialValues),
    [values, initialValues, extraDirtyCheck],
  );

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  function safeNavigate(to: string) {
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Leave this page anyway?')) return;
    }
    navigate(to);
  }

  return { isDirty, safeNavigate };
}

/** True if any key differs between two value maps. '' and null/undefined are
 *  treated as equivalent so a touched-but-unchanged text field doesn't flag. */
export function isDirtyValues(a: Record<string, any>, b: Record<string, any>): boolean {
  const norm = (v: any) => (v === '' || v === undefined ? null : v);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const av = a[k];
    const bv = b[k];
    // Arrays — shallow compare element-by-element after normalization.
    if (Array.isArray(av) || Array.isArray(bv)) {
      if (!Array.isArray(av) || !Array.isArray(bv)) return true;
      if (av.length !== bv.length) return true;
      for (let i = 0; i < av.length; i++) {
        if (typeof av[i] === 'object' && typeof bv[i] === 'object' && av[i] && bv[i]) {
          if (isDirtyValues(av[i], bv[i])) return true;
        } else if (norm(av[i]) !== norm(bv[i])) {
          return true;
        }
      }
      continue;
    }
    if (norm(av) !== norm(bv)) return true;
  }
  return false;
}
