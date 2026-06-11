/**
 * AutocompleteInput — inline ghost-text completion. As the user types,
 * the best match from `onFetch` is shown in muted text overlaying the
 * input. Tab or Enter accepts the match; ArrowDown cycles to the next
 * alternate; Escape dismisses; continued typing refines the match.
 *
 * Two modes:
 *   - Single-value (default): the whole field is one token.
 *   - Multi-value (splitChar=','): only the token after the LAST
 *     separator is auto-completed. On accept, replace just that token
 *     and append "$splitChar " so the user can keep adding.
 *
 * Visually, the ghost is a position:absolute overlay that mirrors the
 * input's own text in invisible color, then appends the un-typed
 * remainder in muted color. As long as the overlay's padding / font /
 * letter-spacing match the input's, the ghost lines up at the caret.
 *
 * Designed to be a near-drop-in replacement for a plain `<input>` —
 * same value/onChange contract, just add `onFetch` and (optionally)
 * `splitChar`.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

/** A single completion suggestion. */
export interface AutocompleteOption {
  /** Text that the suggestion will insert when accepted (e.g. "kate@x.com"). */
  insertText: string;
  /**
   * Optional richer label for UX hints (e.g. "Kate Smith — kate@x.com").
   * The ghost text still only shows the un-typed remainder of insertText —
   * label is for the future "and 2 others" hint, not used yet.
   */
  label?: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  /**
   * Called whenever the active token changes (debounced). Return a
   * list of options. The component will pick the FIRST option whose
   * insertText starts with the current token (case-insensitive) as
   * the ghost candidate. Returning [] (or no prefix match) → no ghost.
   */
  onFetch: (token: string) => Promise<AutocompleteOption[]>;
  /** If set, treat the input as multi-value separated by this char. */
  splitChar?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  type?: string;
  autoFocus?: boolean;
  /** Min characters before fetching. Default 2. */
  minChars?: number;
}

/** Split a multi-value string into (everything-before-current-token, current-token). */
function splitToken(value: string, splitChar: string): [string, string] {
  const lastIdx = value.lastIndexOf(splitChar);
  if (lastIdx === -1) return ['', value];
  const prefix = value.slice(0, lastIdx + 1);
  const after = value.slice(lastIdx + 1);
  // Preserve a single space if the user typed "a@b.com, " — natural style.
  const leading = after.match(/^\s+/)?.[0] ?? '';
  return [prefix + leading, after.slice(leading.length)];
}

export function AutocompleteInput({
  value,
  onChange,
  onFetch,
  splitChar,
  placeholder,
  required,
  className = 'field-input',
  type = 'text',
  autoFocus,
  minChars = 2,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [options, setOptions] = useState<AutocompleteOption[]>([]);
  const [cursor, setCursor] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const fetchSeq = useRef(0);

  const [prefix, token] = splitChar ? splitToken(value, splitChar) : ['', value];

  // Debounced fetch on token change.
  useEffect(() => {
    if (dismissed) { setOptions([]); return; }
    const trimmed = token.trim();
    if (trimmed.length < minChars) { setOptions([]); return; }
    const mySeq = ++fetchSeq.current;
    const handle = setTimeout(async () => {
      try {
        const opts = await onFetch(trimmed);
        // Discard stale results if the user has typed more since.
        if (mySeq !== fetchSeq.current) return;
        setOptions(opts);
        setCursor(0);
      } catch {
        if (mySeq === fetchSeq.current) setOptions([]);
      }
    }, 120);
    return () => clearTimeout(handle);
  }, [token, dismissed, onFetch, minChars]);

  // Reset "dismissed" when the token meaningfully changes (so dismissing
  // one suggestion doesn't permanently mute autocomplete in this field).
  useEffect(() => { setDismissed(false); }, [token]);

  // Pick the best ghost candidate: first option whose insertText
  // starts with the token (case-insensitive). Ghost only makes sense
  // when the suggestion EXTENDS what's been typed.
  const ghost = useMemo(() => {
    if (!token) return '';
    const lc = token.toLowerCase();
    // Order options so prefix matches come first (in case the server
    // also returned substring matches at the same query).
    const prefixMatches = options.filter(o => o.insertText.toLowerCase().startsWith(lc));
    const candidate = prefixMatches[cursor] ?? prefixMatches[0];
    if (!candidate) return '';
    if (candidate.insertText.length <= token.length) return '';
    return candidate.insertText.slice(token.length);
  }, [options, token, cursor]);

  function acceptGhost() {
    if (!ghost) return;
    const full = token + ghost;
    if (splitChar) {
      // Replace current token + append "<sep> " so user can keep adding.
      onChange(prefix + full + `${splitChar} `);
    } else {
      onChange(full);
    }
    setOptions([]);
    setDismissed(true);
    // Move caret to end so further typing starts fresh.
    setTimeout(() => {
      const el = inputRef.current;
      if (el) {
        const end = el.value.length;
        el.setSelectionRange(end, end);
      }
    }, 0);
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!ghost) return;
    if (e.key === 'Tab' || e.key === 'Enter') {
      // Only intercept Enter inside a multi-line context if there's
      // actually a ghost — otherwise let form-submit through.
      e.preventDefault();
      acceptGhost();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor(c => Math.min(options.length - 1, c + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor(c => Math.max(0, c - 1));
    } else if (e.key === 'Escape') {
      setDismissed(true);
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        className={className}
        // Stop browser autofill from cluttering — server-side suggestions
        // are the source of truth here.
        autoComplete="off"
        // Mirror the input styling on the overlay below.
        spellCheck={false}
      />
      {ghost && (
        <div
          aria-hidden
          // Same className as the input so padding + font + line-height
          // match exactly — that's what makes the ghost text land at
          // the same baseline as the user's typed text. Force a
          // transparent background and border so the overlay doesn't
          // double up the input's chrome.
          className={`absolute inset-0 pointer-events-none overflow-hidden whitespace-pre ${className}`}
          style={{
            background: 'transparent',
            borderColor: 'transparent',
            boxShadow: 'none',
          }}
        >
          <span style={{ visibility: 'hidden' }}>{value}</span>
          <span className="text-ink-faint">{ghost}</span>
        </div>
      )}
    </div>
  );
}
