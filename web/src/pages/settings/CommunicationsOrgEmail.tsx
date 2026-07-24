/**
 * Organization email settings (COMMUNICATIONS_DESIGN §10.2). Org-level SMTP
 * used to send mail AS Furnish Hope (distinct from per-user Mailbox accounts).
 * Password is write-only; "Send test" either emails a recipient or verifies
 * the SMTP connection when no recipient is given.
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '../../lib/api.ts';
import { PageHeader, Loading } from '../../components/ui.tsx';

interface EmailPublic {
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_use_tls: boolean;
  from_address: string | null;
  from_display_name: string | null;
  reply_domain: string | null;
  enabled: boolean;
  smtp_password_set: boolean;
}

export function CommunicationsOrgEmail() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<EmailPublic>({
    queryKey: ['comms', 'org-email'],
    queryFn: () => apiGet('/api/settings/communications/org-email'),
  });

  const [f, setF] = useState({
    smtp_host: '', smtp_port: '', smtp_username: '', from_address: '',
    from_display_name: '', reply_domain: '',
  });
  const [password, setPassword] = useState('');
  const [useTls, setUseTls] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setF({
        smtp_host: data.smtp_host ?? '',
        smtp_port: data.smtp_port != null ? String(data.smtp_port) : '',
        smtp_username: data.smtp_username ?? '',
        from_address: data.from_address ?? '',
        from_display_name: data.from_display_name ?? '',
        reply_domain: data.reply_domain ?? '',
      });
      setUseTls(data.smtp_use_tls);
      setEnabled(data.enabled);
    }
  }, [data]);

  function set(name: keyof typeof f, v: string) {
    setF((prev) => ({ ...prev, [name]: v }));
    setSaved(false);
  }

  const saveMut = useMutation({
    mutationFn: () =>
      apiPut('/api/settings/communications/org-email', {
        smtp_host: f.smtp_host.trim(),
        smtp_port: f.smtp_port.trim() ? Number(f.smtp_port.trim()) : '',
        smtp_username: f.smtp_username.trim(),
        smtp_use_tls: useTls,
        from_address: f.from_address.trim(),
        from_display_name: f.from_display_name.trim(),
        reply_domain: f.reply_domain.trim(),
        enabled,
        ...(password.trim() ? { smtp_password: password } : {}),
      }),
    onSuccess: () => {
      setSaved(true); setError(null); setPassword('');
      queryClient.invalidateQueries({ queryKey: ['comms'] });
    },
    onError: (e: any) => { setError(e.message ?? 'Save failed'); setSaved(false); },
  });

  const [testTo, setTestTo] = useState('');
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const testMut = useMutation({
    mutationFn: () => apiPost<{ ok: boolean; verified?: boolean }>('/api/settings/communications/org-email/test', testTo.trim() ? { to: testTo.trim() } : {}),
    onSuccess: (r) => setTestMsg(r.verified ? 'SMTP connection verified.' : 'Test email sent.'),
    onError: (e: any) => setTestMsg(e.message ?? 'Test failed.'),
  });

  return (
    <>
      <PageHeader title="Organization" emphasis="email" subtitle="SMTP settings for email sent as Furnish Hope." />

      {isLoading ? <Loading /> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-5xl">
          <form className="card space-y-4" onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }}>
            <div>
              <h3 className="font-display text-lg font-medium m-0">SMTP</h3>
              <div className="text-xs text-ink-faint mt-0.5">Password is stored encrypted. Leave blank to keep the current one.</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">SMTP host</label>
                <input className="field-input" value={f.smtp_host} placeholder="smtp.gmail.com"
                  onChange={(e) => set('smtp_host', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Port</label>
                <input className="field-input" value={f.smtp_port} placeholder="587"
                  onChange={(e) => set('smtp_port', e.target.value)} />
              </div>
            </div>

            <div>
              <label className="field-label">Username</label>
              <input className="field-input" value={f.smtp_username} autoComplete="off"
                onChange={(e) => set('smtp_username', e.target.value)} />
            </div>

            <div>
              <label className="field-label">Password {data?.smtp_password_set && <span className="text-ink-faint normal-case">· saved</span>}</label>
              <input type="password" className="field-input" value={password} autoComplete="off"
                placeholder={data?.smtp_password_set ? '•••••••• (unchanged)' : 'SMTP password'}
                onChange={(e) => { setPassword(e.target.value); setSaved(false); }} />
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={useTls} className="accent-terracotta"
                onChange={(e) => { setUseTls(e.target.checked); setSaved(false); }} />
              Require STARTTLS (port 587)
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">From address</label>
                <input className="field-input" value={f.from_address} placeholder="ops@furnishhope.org"
                  onChange={(e) => set('from_address', e.target.value)} />
              </div>
              <div>
                <label className="field-label">From display name</label>
                <input className="field-input" value={f.from_display_name} placeholder="Furnish Hope"
                  onChange={(e) => set('from_display_name', e.target.value)} />
              </div>
            </div>

            <div>
              <label className="field-label">Reply domain</label>
              <input className="field-input" value={f.reply_domain} placeholder="replies.furnishhope.org"
                onChange={(e) => set('reply_domain', e.target.value)} />
              <div className="text-[11px] text-ink-faint mt-1">Used for plus-addressed reply capture (Reply-To: replies+code@…).</div>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={enabled} className="accent-terracotta"
                onChange={(e) => { setEnabled(e.target.checked); setSaved(false); }} />
              Outbound org email enabled
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
              <div className="text-xs text-ink-faint mt-0.5">With a recipient, sends a test email. Blank just verifies the connection.</div>
            </div>
            <div>
              <label className="field-label">Recipient (optional)</label>
              <input type="email" className="field-input" value={testTo} placeholder="you@example.org"
                onChange={(e) => setTestTo(e.target.value)} />
            </div>
            {testMsg && <div className="p-2.5 bg-cream-deep text-ink-soft rounded-md text-xs">{testMsg}</div>}
            <div className="flex justify-end">
              <button type="button" disabled={testMut.isPending} className="btn-ghost disabled:opacity-60"
                onClick={() => { setTestMsg(null); testMut.mutate(); }}>
                {testMut.isPending ? 'Testing…' : testTo.trim() ? 'Send test email' : 'Verify connection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
