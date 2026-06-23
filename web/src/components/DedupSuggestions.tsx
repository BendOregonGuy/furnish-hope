/**
 * Inline "Did you mean...?" panel that watches the new-client form fields
 * and surfaces likely-existing-household matches above the form. Used by
 * both the staff ClientForm and the agency portal's ReferralForm.
 *
 * - Debounces 400ms so we don't fire a query on every keystroke.
 * - Hides itself when fewer than 2 chars in either name.
 * - Renders nothing when the search returns no candidates.
 * - On "Use existing", calls onPickExisting with the chosen row so the
 *   parent can navigate to the right detail page (staff vs agency see
 *   different URLs).
 */

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api.ts';

export interface DedupCandidate {
  client_id: number;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  mobile_phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  match_score: number;
  match_reasons: string;
  referral_count: number;
  request_count: number;
}

interface Props {
  /** Which API base to use. Staff: '/api/clients/search'.
   *  Agency: '/api/agency/clients/search' (scoped to their referrals). */
  apiPath: string;
  first_name: string;
  last_name: string;
  birth_date?: string;       // 'YYYY-MM-DD'
  mobile_phone?: string;
  email?: string;
  address_id?: number | null;
  /** Called when the user clicks "Use existing". Parent decides the URL. */
  onPickExisting: (c: DedupCandidate) => void;
}

export function DedupSuggestions(props: Props) {
  const {
    apiPath, first_name, last_name, birth_date, mobile_phone, email,
    address_id, onPickExisting,
  } = props;

  // 400ms debounce so we don't hammer the server on every keystroke.
  const [debounced, setDebounced] = useState({
    first: '', last: '', dob: '', phone: '', email: '', addrId: null as number | null,
  });
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced({
        first: first_name.trim(),
        last: last_name.trim(),
        dob: (birth_date ?? '').trim(),
        phone: (mobile_phone ?? '').trim(),
        email: (email ?? '').trim(),
        addrId: address_id ?? null,
      });
    }, 400);
    return () => clearTimeout(t);
  }, [first_name, last_name, birth_date, mobile_phone, email, address_id]);

  const enabled = debounced.first.length >= 2 && debounced.last.length >= 2;

  const { data: matches } = useQuery<DedupCandidate[]>({
    queryKey: ['dedup', apiPath, debounced],
    queryFn: () => {
      const qs = new URLSearchParams();
      qs.set('first_name', debounced.first);
      qs.set('last_name',  debounced.last);
      if (debounced.dob)    qs.set('birth_date',   debounced.dob);
      if (debounced.phone)  qs.set('mobile_phone', debounced.phone);
      if (debounced.email)  qs.set('email',        debounced.email);
      if (debounced.addrId) qs.set('address_id',   String(debounced.addrId));
      return apiGet<DedupCandidate[]>(`${apiPath}?${qs}`);
    },
    enabled,
    staleTime: 30_000,
  });

  if (!enabled || !matches || matches.length === 0) return null;

  return (
    <div className="mb-5 p-4 bg-gold-soft border-l-4 border-gold rounded-r-md">
      <div className="flex items-start gap-3">
        <div className="text-2xl">⚠</div>
        <div className="flex-1">
          <div className="font-semibold text-ink mb-1">
            Did you mean one of these existing households?
          </div>
          <div className="text-sm text-ink-muted mb-3">
            {matches.length === 1
              ? 'Furnish Hope already has a record that looks similar:'
              : `Furnish Hope already has ${matches.length} records that look similar:`}
          </div>
          <ul className="space-y-2">
            {matches.map(m => (
              <li key={m.client_id} className="bg-paper border border-paper-deep rounded p-3 flex items-center justify-between gap-3">
                <div className="text-sm">
                  <div className="font-medium text-ink">
                    {m.first_name} {m.last_name}
                    {m.birth_date && <span className="text-ink-muted"> · DOB {m.birth_date}</span>}
                  </div>
                  <div className="text-ink-muted">
                    {m.address ? `${m.address}, ${m.city ?? ''}` : <em>no address on file</em>}
                    {m.mobile_phone && <span> · {m.mobile_phone}</span>}
                  </div>
                  <div className="text-xs text-ink-muted mt-1">
                    {m.match_score}% match · {m.match_reasons}
                    {' · '}{m.referral_count} prior referral{m.referral_count === 1 ? '' : 's'}
                    {' · '}{m.request_count} request{m.request_count === 1 ? '' : 's'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onPickExisting(m)}
                  className="shrink-0 px-3 py-1.5 bg-sage text-paper text-sm rounded hover:bg-sage-deep"
                >
                  Use this household
                </button>
              </li>
            ))}
          </ul>
          <div className="text-xs text-ink-muted mt-3">
            If none of these are the same person, continue filling out the form below.
          </div>
        </div>
      </div>
    </div>
  );
}
