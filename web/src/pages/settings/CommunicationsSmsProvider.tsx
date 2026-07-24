/**
 * SMS provider settings (COMMUNICATIONS_DESIGN §10.1). Twilio credentials +
 * From number + enable toggle, with a "send test" action. Secrets are
 * write-only: the API returns only "set" booleans, and blank fields on save
 * leave the stored secret untouched.
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '../../lib/api.ts';
import { PageHeader, Loading } from '../../components/ui.tsx';

interface SmsPublic {
  provider: string;
  from_phone: string | null;
  enabled: boolean;
  account_sid_set: boolean;
  auth_token_set: boolean;
  webhook_secret_set: boolean;
}

export function CommunicationsSmsProvider() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<SmsPublic>({
    queryKey: ['comms', 'sms-provider'],
    queryFn: () => apiGet('/api/settings/communications/sms-provider'),
  });

  const [fromPhone, setFromPhone] = useState('');
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setFromPhone(data.from_phone ?? '');
      setEnabled(data.enabled);
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () =>
      apiPut('/api/settings/communications/sms-provider', {
        provider: 'twilio',
        from_phone: fromPhone.trim(),
        enabled,
        // Only send secrets that were actually typed — blank means "keep".
        ...(accountSid.trim() ? { account_sid: accountSid.trim() } : {}),
        ...(authToken.trim() ? { auth_token: authToken.trim() } : {}),
        ...(webhookSecret.trim() ? { webhook_secret: webhookSecret.trim() } : {}),
      }),
    onSuccess: () => {
      setSaved(true); setError(null);
      setAccountSid(''); setAuthToken(''); setWebhookSecret('');
      queryClient.invalidateQueries({ queryKey: ['comms'] });
    },
    onError: (e: any) => { setError(e.message ?? 'Save failed'); setSaved(false); },
  });

  const [testTo, setTestTo] = useState('');
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const testMut = useMutation({
    mutationFn: () => apiPost<{ ok: boolean; status?: string }>('/api/settings/communications/sms-provider/test', { to: testTo.trim() }),
    onSuccess: (r) => setTestMsg(`Test sent (status: ${r.status ?? 'queued'}).`),
    onError: (e: any) => setTestMsg(e.message ?? 'Test failed.'),
  });

  return (
    <>
      <PageHeader title="SMS" emphasis="provider" subtitle="Twilio account for sending and receiving text messages." />

      {isLoading ? <Loading /> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-5xl">
          <form
            className="card space-y-4"
            onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }}
          >
            <div>
              <h3 className="font-display text-lg font-medium m-0">Twilio credentials</h3>
              <div className="text-xs text-ink-faint mt-0.5">Stored encrypted. Leave a secret blank to keep the current value.</div>
            </div>

            <div>
              <label className="field-label">From phone (E.164)</label>
              <input className="field-input" value={fromPhone} placeholder="+15415551234"
                onChange={(e) => { setFromPhone(e.target.value); setSaved(false); }} />
            </div>

            <div>
              <label className="field-label">Account SID {data?.account_sid_set && <span className="text-ink-faint normal-case">· saved</span>}</label>
              <input className="field-input" value={accountSid} autoComplete="off"
                placeholder={data?.account_sid_set ? '•••••••• (unchanged)' : 'ACxxxxxxxx…'}
                onChange={(e) => { setAccountSid(e.target.value); setSaved(false); }} />
            </div>

            <div>
              <label className="field-label">Auth Token {data?.auth_token_set && <span className="text-ink-faint normal-case">· saved</span>}</label>
              <input type="password" className="field-input" value={authToken} autoComplete="off"
                placeholder={data?.auth_token_set ? '•••••••• (unchanged)' : 'Twilio Auth Token'}
                onChange={(e) => { setAuthToken(e.target.value); setSaved(false); }} />
            </div>

            <div>
              <label className="field-label">Webhook secret (optional) {data?.webhook_secret_set && <span className="text-ink-faint normal-case">· saved</span>}</label>
              <input type="password" className="field-input" value={webhookSecret} autoComplete="off"
                placeholder={data?.webhook_secret_set ? '•••••••• (unchanged)' : 'Blank = validate with Auth Token'}
                onChange={(e) => { setWebhookSecret(e.target.value); setSaved(false); }} />
              <div className="text-[11px] text-ink-faint mt-1">Twilio signs webhooks with your Auth Token. Only set this to override.</div>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={enabled} className="accent-terracotta"
                onChange={(e) => { setEnabled(e.target.checked); setSaved(false); }} />
              Outbound SMS enabled
            </label>

            {error && <div className="p-2.5 bg-terracotta-soft text-terracotta-deep rounded-md text-xs">{error}</div>}
            {saved && <div className="p-2.5 bg-sage-soft text-[#3F4A33] rounded-md text-xs">Saved.</div>}

            <div className="flex justify-end">
              <button type="submit" disabled={saveMut.isPending} className="btn-primary disabled:opacity-60">
                {saveMut.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>

          <div className="card space-y-4 self-start">
            <div>
              <h3 className="font-display text-lg font-medium m-0">Send a test</h3>
              <div className="text-xs text-ink-faint mt-0.5">Sends a real SMS to the number below using the saved credentials.</div>
            </div>
            <div>
              <label className="field-label">Destination phone</label>
              <input className="field-input" value={testTo} placeholder="+15415550100"
                onChange={(e) => setTestTo(e.target.value)} />
            </div>
            {testMsg && <div className="p-2.5 bg-cream-deep text-ink-soft rounded-md text-xs">{testMsg}</div>}
            <div className="flex justify-end">
              <button type="button" disabled={testMut.isPending || !testTo.trim()} className="btn-ghost disabled:opacity-60"
                onClick={() => { setTestMsg(null); testMut.mutate(); }}>
                {testMut.isPending ? 'Sending…' : 'Send test SMS'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
