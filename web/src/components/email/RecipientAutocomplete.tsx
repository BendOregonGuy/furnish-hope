/**
 * Email-recipient autocomplete. Wraps AutocompleteInput with a fetch
 * function that hits /api/email/contact-picker. Drop-in replacement
 * for the plain `<input>` on To/Cc/Bcc fields — same value/onChange,
 * gains ghost-text completion as the user types.
 *
 * Pairs nicely with the existing RecipientPicker ("+ Contact ▾"
 * button) — autocomplete for "I know who I want, just let me type
 * it fast," picker for "let me browse."
 */

import { AutocompleteInput, type AutocompleteOption } from '../AutocompleteInput.tsx';
import { apiGet } from '../../lib/api.ts';

interface PickerRow {
  display_name: string;
  email: string;
  type_label: string;
}

async function fetchSuggestions(token: string): Promise<AutocompleteOption[]> {
  // Server caps at 100 rows; we only need a handful for ghost text.
  const rows = await apiGet<PickerRow[]>('/api/email/contact-picker', {
    type: 'all',
    q: token,
  });
  // Surface only rows whose email or display_name starts with the
  // token — the ghost only EXTENDS what's typed, so substring matches
  // in the middle of an address aren't useful here.
  const lc = token.toLowerCase();
  const prefixed = rows.filter(r =>
    r.email.toLowerCase().startsWith(lc) ||
    r.display_name.toLowerCase().startsWith(lc)
  );
  return prefixed.map(r => ({
    insertText: r.email,
    label: `${r.display_name} — ${r.email}`,
  }));
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export function RecipientAutocomplete(props: Props) {
  return (
    <AutocompleteInput
      {...props}
      onFetch={fetchSuggestions}
      splitChar=","
    />
  );
}
