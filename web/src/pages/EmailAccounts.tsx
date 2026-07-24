/**
 * Per-user email accounts. List + add (provider preset wizard) + test +
 * set default. Accounts only show up for the user who connected them.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../lib/api.ts';
import { PageHeader, Loading, ErrorBox, EmptyState } from '../components/ui.tsx';

interface ProviderPreset {
  id: string;
  label: string;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  app_password_url: string;
  notes: string;
  requires_app_password: boolean;
  oauth_provider?: 'google' | 'microsoft';
  /** Server reports true only when the OAuth client credentials are
   *  configured for this provider in env vars. Hides the "Sign in
   *  with…" button until OAuth is actually usable. */
  oauth_available?: boolean;
}

interface Account {
  email_account_id: number;
  display_name: string | null;
  email_address: string;
  provider: string;
  imap_host: string | null;
  imap_port: number | null;
  imap_secure: boolean;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: boolean;
  username: string | null;
  is_default_send: boolean;
  last_tested_at: string | null;
  last_test_status: string | null;
  last_test_error: string | null;
  has_password: boolean;
  signature: string | null;
}

export function EmailAccounts() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // After returning from a Google/Microsoft OAuth flow, the server
  // redirects to /email/accounts?oauth=success&email=... or
  // ?oauth_error=...
  const oauthSuccess = searchParams.get('oauth') === 'success';
  const oauthError = searchParams.get('oauth_error');
  const oauthEmail = searchParams.get('email');
  useEffect(() => {
    if (oauthSuccess || oauthError) {
      queryClient.invalidateQueries({ queryKey: ['email', 'accounts'] });
      // Clear the query params after we read them so a refresh doesn't
      // re-show the banner. Keep this effect dep-free of the params
      // themselves so it only runs once per arrival.
      const timer = window.setTimeout(() => {
        searchParams.delete('oauth');
        searchParams.delete('oauth_error');
        searchParams.delete('email');
        searchParams.delete('provider');
        setSearchParams(searchParams, { replace: true });
      }, 8000);
      return () => window.clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { data: providers } = useQuery<{ providers: ProviderPreset[] }>({
    queryKey: ['email', 'providers'],
    queryFn: () => apiGet('/api/email/providers'),
  });
  const { data: accounts, isLoading, error } = useQuery<Account[]>({
    queryKey: ['email', 'accounts'],
    queryFn: () => apiGet('/api/email/accounts'),
  });

  const [adding, setAdding] = useState<ProviderPreset | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiDelete(`/api/email/accounts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email', 'accounts'] }),
    onError: (err: any) => window.alert(err.message ?? 'Delete failed'),
  });

  const defaultMut = useMutation({
    mutationFn: (id: number) => apiPost(`/api/email/accounts/${id}/default`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email', 'accounts'] }),
    onError: (err: any) => window.alert(err.message ?? 'Failed to set default'),
  });

  const testMut = useMutation({
    mutationFn: (id: number) => apiPost<{ status: string; detail: any; error?: string }>(`/api/email/accounts/${id}/test`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email', 'accounts'] }),
    onError: () => queryClient.invalidateQueries({ queryKey: ['email', 'accounts'] }),
  });

  const editing = accounts?.find(a => a.email_account_id === editingId);
  const editingPreset = editing && providers?.providers.find(p => p.id === editing.provider);

  return (
    <>
      <PageHeader
        helpSection="email-accounts"
        title="Email"
        emphasis="accounts"
        subtitle="Connect your inboxes so the app can send receipts, acknowledgements, and campaign emails through them."
      />

      {oauthSuccess && (
        <div className="mb-5 p-3 bg-sage-soft text-[#3F4A33] rounded-md text-sm">
          ✓ Connected {oauthEmail ?? 'your account'} via OAuth. The account is ready to use.
        </div>
      )}
      {oauthError && (
        <div className="mb-5 p-3 bg-terracotta-soft text-terracotta-deep rounded-md text-sm">
          OAuth sign-in failed: {oauthError}
        </div>
      )}

      {/* Account list */}
      {isLoading && <Loading />}
      {error && <ErrorBox error={error} />}
      {accounts && accounts.length === 0 && !adding && (
        <EmptyState
          title="No email accounts connected"
          hint="Pick a provider below to connect your first account."
        />
      )}
      {accounts && accounts.length > 0 && (
        <div className="space-y-3 mb-7">
          {accounts.map(a => (
            <div key={a.email_account_id} className="card">
              <div className="flex items-baseline justify-between gap-3 mb-1 flex-wrap">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <div className="font-display font-medium text-lg">{a.email_address}</div>
                  <span className="pill pill-muted">{providers?.providers.find(p => p.id === a.provider)?.label ?? a.provider}</span>
                  {a.is_default_send && <span className="pill pill-sage">Default for send</span>}
                  {a.last_test_status === 'success' && (
                    <span className="pill pill-sage">✓ Tested</span>
                  )}
                  {a.last_test_status === 'failure' && (
                    <span className="pill pill-terra">Test failed</span>
                  )}
                </div>
                <div className="flex gap-3 text-xs">
                  <button
                    onClick={() => testMut.mutate(a.email_account_id)}
                    disabled={testMut.isPending}
                    className="text-ink-soft hover:text-terracotta disabled:opacity-50"
                  >
                    {testMut.isPending ? 'Testing…' : 'Test'}
                  </button>
                  {!a.is_default_send && (
                    <button
                      onClick={() => defaultMut.mutate(a.email_account_id)}
                      disabled={defaultMut.isPending}
                      className="text-ink-soft hover:text-terracotta disabled:opacity-50"
                    >
                      Make default
                    </button>
                  )}
                  <button onClick={() => setEditingId(a.email_account_id)} className="text-ink-soft hover:text-terracotta">
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Disconnect ${a.email_address}? You'll need to re-enter the password to reconnect.`)) {
                        deleteMut.mutate(a.email_account_id);
                      }
                    }}
                    className="text-terracotta hover:text-terracotta-deep"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
              <div className="text-[11px] text-ink-faint">
                IMAP: <code className="font-mono">{a.imap_host}:{a.imap_port}</code> ·
                SMTP: <code className="font-mono">{a.smtp_host}:{a.smtp_port}</code>
                {a.last_tested_at && (
                  <> · last tested {new Date(a.last_tested_at).toLocaleString()}</>
                )}
              </div>
              {a.last_test_status === 'failure' && a.last_test_error && (
                <div className="mt-2 p-2.5 bg-terracotta-soft text-terracotta-deep rounded-md text-[11px]">
                  {a.last_test_error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Provider picker */}
      {!adding && !editing && (
        <div className="card">
          <div className="card-head">
            <h3 className="font-display font-medium text-[17px] m-0">Connect a new account</h3>
            <span className="text-xs text-ink-faint">Pick your provider</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {providers?.providers.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setAdding(p)}
                className="text-left p-3 border border-hairline rounded-md hover:border-terracotta hover:bg-terracotta/[0.025]"
              >
                <div className="font-medium">{p.label}</div>
                {p.requires_app_password && (
                  <div className="text-[10px] text-ink-faint mt-0.5">Requires app password</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add form */}
      {adding && (
        <AccountForm
          preset={adding}
          onCancel={() => setAdding(null)}
          onSaved={(id) => {
            setAdding(null);
            queryClient.invalidateQueries({ queryKey: ['email', 'accounts'] });
            // Trigger an automatic test after saving so the user sees success/failure right away.
            testMut.mutate(id);
          }}
        />
      )}

      {/* Edit form */}
      {editing && editingPreset && (
        <AccountForm
          preset={editingPreset}
          existing={editing}
          onCancel={() => setEditingId(null)}
          onSaved={(id) => {
            setEditingId(null);
            queryClient.invalidateQueries({ queryKey: ['email', 'accounts'] });
            testMut.mutate(id);
          }}
        />
      )}
    </>
  );
}

/* ----------------------------------------------------------------- */
/*  AccountForm — used for both add and edit                          */
/* ----------------------------------------------------------------- */

function AccountForm({
  preset, existing, onCancel, onSaved,
}: {
  preset: ProviderPreset;
  existing?: Account;
  onCancel: () => void;
  onSaved: (id: number) => void;
}) {
  const isEdit = !!existing;
  const [values, setValues] = useState({
    display_name: existing?.display_name ?? '',
    email_address: existing?.email_address ?? '',
    imap_host: existing?.imap_host ?? preset.imap_host,
    imap_port: existing?.imap_port ?? preset.imap_port,
    imap_secure: existing ? existing.imap_secure : preset.imap_secure,
    smtp_host: existing?.smtp_host ?? preset.smtp_host,
    smtp_port: existing?.smtp_port ?? preset.smtp_port,
    smtp_secure: existing ? existing.smtp_secure : preset.smtp_secure,
    username: existing?.username ?? '',
    password: '',
    is_default_send: existing?.is_default_send ?? false,
    signature: existing?.signature ?? '',
  });
  const [showAdvanced, setShowAdvanced] = useState(preset.id === 'imap');
  const [error, setError] = useState<string | null>(null);

  // When provider changes inside the wizard, reset the IMAP/SMTP fields.
  useEffect(() => {
    if (!isEdit) {
      setValues(v => ({
        ...v,
        imap_host: preset.imap_host, imap_port: preset.imap_port, imap_secure: preset.imap_secure,
        smtp_host: preset.smtp_host, smtp_port: preset.smtp_port, smtp_secure: preset.smtp_secure,
      }));
    }
  }, [preset.id, isEdit, preset.imap_host, preset.imap_port, preset.imap_secure, preset.smtp_host, preset.smtp_port, preset.smtp_secure]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const body = {
        ...values,
        provider: preset.id,
        // Don't send empty password on edit — server preserves existing.
        password: values.password || undefined,
        username: values.username || undefined,
      };
      if (isEdit) {
        await apiPut(`/api/email/accounts/${existing!.email_account_id}`, body);
        return existing!.email_account_id;
      } else {
        const r = await apiPost<{ email_account_id: number }>('/api/email/accounts', body);
        return r.email_account_id;
      }
    },
    onSuccess: (id) => onSaved(id),
    onError: (err: any) => setError(err.message ?? 'Save failed'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!values.email_address) { setError('Email address is required.'); return; }
    if (!isEdit && !values.password) { setError('Password is required to connect a new account.'); return; }
    saveMut.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="card max-w-2xl">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h3 className="font-display font-medium text-[18px] m-0">
            {isEdit ? `Edit ${existing!.email_address}` : `Connect ${preset.label}`}
          </h3>
          <div className="text-xs text-ink-faint mt-0.5">
            Per-user account — only you will be able to send/read through it.
          </div>
        </div>
        <button type="button" onClick={onCancel} className="text-xs text-ink-soft hover:text-terracotta">Cancel</button>
      </div>

      {/* OAuth "Sign in with…" button — only shown when the provider
          supports it AND the server has the OAuth client credentials
          configured (so clicking does something useful). Until you
          set GOOGLE_OAUTH_CLIENT_ID / MICROSOFT_OAUTH_CLIENT_ID in
          DigitalOcean, the form falls back to the password-only flow. */}
      {!isEdit && preset.oauth_provider && preset.oauth_available && (
        <OAuthSignInButton provider={preset.oauth_provider} label={preset.label} />
      )}

      {/* Setup instructions */}
      {preset.notes && (
        <div className="mb-4 p-3 bg-gold-soft border border-gold/40 rounded-md text-[13px] text-ink-soft">
          <div className="font-medium text-[#6B4D1E] mb-1">Setup</div>
          <p>{preset.notes}</p>
          {preset.app_password_url && (
            <a
              href={preset.app_password_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-xs text-terracotta hover:text-terracotta-deep font-medium"
            >
              Open {preset.label} app-password page →
            </a>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
        <div className="sm:col-span-2">
          <label className="field-label">Email address *</label>
          <input
            type="email"
            className="field-input"
            value={values.email_address}
            onChange={e => setValues(v => ({ ...v, email_address: e.target.value }))}
            placeholder="you@example.com"
            autoComplete="username"
            required
          />
        </div>

        <div className="sm:col-span-2">
          <label className="field-label">{isEdit ? 'New password (leave blank to keep current)' : 'Password / app password *'}</label>
          <input
            type="password"
            className="field-input"
            value={values.password}
            onChange={e => setValues(v => ({ ...v, password: e.target.value }))}
            autoComplete="new-password"
          />
          <div className="text-[11px] text-ink-faint mt-1">
            {preset.requires_app_password
              ? `This is an app-specific password — your normal ${preset.label} login won't work for IMAP/SMTP.`
              : 'Your normal login password, or an app-specific one if your provider issues them.'}
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="field-label">Display name (optional)</label>
          <input
            type="text"
            className="field-input"
            value={values.display_name}
            onChange={e => setValues(v => ({ ...v, display_name: e.target.value }))}
            placeholder="Jamie at Furnish Hope"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced(s => !s)}
        className="text-xs text-ink-soft hover:text-terracotta mb-3"
      >
        {showAdvanced ? '← Hide' : 'Show'} advanced settings (IMAP / SMTP host, port, TLS)
      </button>

      {showAdvanced && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 p-3 bg-cream rounded-md border border-hairline">
          <div className="sm:col-span-3 text-[11px] tracking-widest uppercase text-ink-faint font-medium">IMAP (read)</div>
          <div>
            <label className="field-label">Host</label>
            <input type="text" className="field-input" value={values.imap_host ?? ''} onChange={e => setValues(v => ({ ...v, imap_host: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Port</label>
            <input type="number" className="field-input" value={values.imap_port ?? ''} onChange={e => setValues(v => ({ ...v, imap_port: Number(e.target.value) || 0 }))} />
          </div>
          <div>
            <label className="field-label">TLS</label>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer pt-2">
              <input type="checkbox" checked={values.imap_secure} onChange={e => setValues(v => ({ ...v, imap_secure: e.target.checked }))} className="w-4 h-4 accent-terracotta" />
              Implicit TLS
            </label>
          </div>

          <div className="sm:col-span-3 text-[11px] tracking-widest uppercase text-ink-faint font-medium mt-2">SMTP (send)</div>
          <div>
            <label className="field-label">Host</label>
            <input type="text" className="field-input" value={values.smtp_host ?? ''} onChange={e => setValues(v => ({ ...v, smtp_host: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Port</label>
            <input type="number" className="field-input" value={values.smtp_port ?? ''} onChange={e => setValues(v => ({ ...v, smtp_port: Number(e.target.value) || 0 }))} />
          </div>
          <div>
            <label className="field-label">TLS</label>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer pt-2">
              <input type="checkbox" checked={values.smtp_secure} onChange={e => setValues(v => ({ ...v, smtp_secure: e.target.checked }))} className="w-4 h-4 accent-terracotta" />
              Implicit TLS
            </label>
            <div className="text-[10px] text-ink-faint mt-1">On = port 465. Off = STARTTLS upgrade on 587.</div>
          </div>

          <div className="sm:col-span-3">
            <label className="field-label">Username (defaults to email address)</label>
            <input type="text" className="field-input" value={values.username} onChange={e => setValues(v => ({ ...v, username: e.target.value }))} />
          </div>
        </div>
      )}

      <label className="inline-flex items-center gap-2 text-sm cursor-pointer mb-4">
        <input type="checkbox" checked={values.is_default_send} onChange={e => setValues(v => ({ ...v, is_default_send: e.target.checked }))} className="w-4 h-4 accent-terracotta" />
        Use this account as the default for sending email
      </label>

      <div className="mb-4">
        <label className="field-label">Signature</label>
        <textarea
          rows={5}
          className="field-input font-sans"
          value={values.signature}
          onChange={e => setValues(v => ({ ...v, signature: e.target.value }))}
          placeholder={'Jamie Smith\nFurnish Hope · Community Coordinator\n(541) 555-1234'}
          maxLength={2000}
        />
        <div className="text-[11px] text-ink-faint mt-1">
          Appended automatically to the bottom of every email you send (compose and replies) from this account.
        </div>
      </div>

      {error && <div className="mb-4 p-2.5 bg-terracotta-soft text-terracotta-deep rounded-md text-xs">{error}</div>}

      <div className="flex justify-end gap-2 pt-3 border-t border-hairline">
        <Link to="/email/compose" className="text-xs self-center text-ink-faint hover:text-terracotta mr-auto">
          Skip to compose →
        </Link>
        <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
        <button type="submit" disabled={saveMut.isPending} className="btn-primary disabled:opacity-60">
          {saveMut.isPending ? 'Saving…' : (isEdit ? 'Save changes' : 'Connect & test')}
        </button>
      </div>
    </form>
  );
}

/* ----------------------------------------------------------------- */
/*  OAuth sign-in button — one-click Google / Microsoft connect       */
/* ----------------------------------------------------------------- */

function OAuthSignInButton({ provider, label }: { provider: 'google' | 'microsoft'; label: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleClick() {
    setErr(null);
    setBusy(true);
    try {
      const { url } = await apiGet<{ url: string }>(`/api/email/oauth/${provider}/start`);
      // Full-page redirect — provider posts back to /api/email/oauth/callback
      // which then redirects to /email/accounts?oauth=success or ?oauth_error=
      window.location.assign(url);
    } catch (e: any) {
      setBusy(false);
      setErr(e.message ?? 'Failed to start OAuth flow');
    }
  }

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="w-full bg-paper border-2 border-hairline-strong rounded-md px-4 py-2.5 text-sm font-medium hover:border-terracotta hover:bg-terracotta/[0.04] disabled:opacity-60 flex items-center justify-center gap-3"
      >
        <span className="text-lg">{provider === 'google' ? '🇬' : '🪟'}</span>
        <span>{busy ? 'Opening sign-in…' : `Sign in with ${label} →`}</span>
      </button>
      <p className="text-[11px] text-ink-faint mt-1.5 text-center">
        Recommended. You'll be redirected to {label} to approve access, then bounced back here.
      </p>
      {err && <div className="mt-2 text-xs text-terracotta-deep">{err}</div>}
    </div>
  );
}
