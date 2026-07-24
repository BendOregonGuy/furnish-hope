/**
 * Fallback inbox setting (COMMUNICATIONS_DESIGN §10.3). A single shared email
 * address that receives the message body whenever a contact can't be reached
 * on any consented channel.
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut } from '../../lib/api.ts';
import { PageHeader, Loading } from '../../components/ui.tsx';

export function CommunicationsFallbackInbox() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<{ email: string | null }>({
    queryKey: ['comms', 'fallback-inbox'],
    queryFn: () => apiGet('/api/settings/communications/fallback-inbox'),
  });

  const [email, setEmail] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) setEmail(data.email ?? '');
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () => apiPut('/api/settings/communications/fallback-inbox', { email: email.trim() }),
    onSuccess: () => {
      setSaved(true); setError(null);
      queryClient.invalidateQueries({ queryKey: ['comms'] });
    },
    onError: (e: any) => { setError(e.message ?? 'Save failed'); setSaved(false); },
  });

  return (
    <>
      <PageHeader title="Fallback" emphasis="inbox" subtitle="Where a message goes when a contact can't be reached by SMS or email." />

      {isLoading ? <Loading /> : (
        <form className="card space-y-4 max-w-xl" onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }}>
          <div>
            <label className="field-label">Fallback email address</label>
            <input type="email" className="field-input" value={email} placeholder="ops@furnishhope.org"
              onChange={(e) => { setEmail(e.target.value); setSaved(false); }} />
            <div className="text-[11px] text-ink-faint mt-1">
              When a triggered or staff-initiated message can't reach a contact (no consented channel, or a hard
              send failure), the rendered message is emailed here and logged to the undeliverable queue.
            </div>
          </div>

          {error && <div className="p-2.5 bg-terracotta-soft text-terracotta-deep rounded-md text-xs">{error}</div>}
          {saved && <div className="p-2.5 bg-sage-soft text-[#3F4A33] rounded-md text-xs">Saved.</div>}

          <div className="flex justify-end">
            <button type="submit" disabled={saveMut.isPending} className="btn-primary disabled:opacity-60">
              {saveMut.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
