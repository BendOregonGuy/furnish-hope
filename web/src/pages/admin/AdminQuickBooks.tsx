/**
 * QuickBooks Online integration settings — admin-only. Three areas:
 *   1. Connection status + Connect/Disconnect button
 *   2. Default deposit account picker (where sales receipts land)
 *   3. Fund → QBO account mapping table
 *
 * The OAuth flow is a redirect: clicking "Connect" sends the browser to
 * Intuit, which redirects back to /api/quickbooks/callback, which redirects
 * here with ?connected=1.
 */

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api.ts';
import { PageHeader, Loading, ErrorBox } from '../../components/ui.tsx';

interface QboStatus {
  configured: boolean;
  environment: 'sandbox' | 'production' | null;
  connected: boolean;
  realm_id: string | null;
  connected_at: string | null;
  last_sync_at: string | null;
  company_name: string | null;
}

interface QboAccount {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
}

interface FundMapping {
  fund_id: number;
  fund_name: string;
  fund_description: string | null;
  mapping_id: number | null;
  qbo_account_id: string | null;
  qbo_account_name: string | null;
  qbo_account_type: string | null;
}

interface SettingRow {
  setting_key: string;
  setting_value: string;
}

export function AdminQuickBooks() {
  const qc = useQueryClient();
  const [search, setSearch] = useSearchParams();
  const justConnected = search.get('connected') === '1';

  // Clear the ?connected=1 param after first render so a page refresh
  // doesn't keep showing the toast.
  useEffect(() => {
    if (justConnected) {
      const t = setTimeout(() => {
        const s = new URLSearchParams(search); s.delete('connected'); setSearch(s, { replace: true });
      }, 6000);
      return () => clearTimeout(t);
    }
  }, [justConnected]);  // eslint-disable-line react-hooks/exhaustive-deps

  const { data: status, isLoading, error } = useQuery<QboStatus>({
    queryKey: ['qbo', 'status'],
    queryFn: () => apiGet('/api/quickbooks/status'),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  return (
    <>
      <PageHeader
        helpSection="admin-qbo"
        title="QuickBooks"
        emphasis="integration"
        subtitle="Sync donations to QuickBooks Online as sales receipts. One-time mapping per fund; then donations sync on-demand or automatically."
      />

      {justConnected && (
        <div className="mb-5 p-3 bg-sage-soft text-[#3F4A33] rounded-md text-sm border border-sage/40">
          ✓ Connected to QuickBooks. {status?.company_name && <>Company: <strong>{status.company_name}</strong>.</>} Map funds below before syncing donations.
        </div>
      )}

      <ConnectionCard status={status!} onChange={() => qc.invalidateQueries({ queryKey: ['qbo'] })} />

      {status?.connected && (
        <>
          <DepositAccountCard onChange={() => qc.invalidateQueries({ queryKey: ['qbo'] })} />
          <UndesignatedAccountCard onChange={() => qc.invalidateQueries({ queryKey: ['qbo'] })} />
          <MappingsCard />
          <SyncLogCard />
        </>
      )}
    </>
  );
}

/* ----------------------------------------------------------------- */
/*  Connection card                                                   */
/* ----------------------------------------------------------------- */

function ConnectionCard({ status, onChange }: { status: QboStatus; onChange: () => void }) {
  const connectMut = useMutation({
    mutationFn: () => apiGet<{ url: string }>('/api/quickbooks/connect-url'),
    onSuccess: (r) => { window.location.href = r.url; },
    onError: (e: any) => window.alert(e.message ?? 'Failed to start QuickBooks connection'),
  });

  const disconnectMut = useMutation({
    mutationFn: () => apiPost('/api/quickbooks/disconnect', {}),
    onSuccess: () => onChange(),
    onError: (e: any) => window.alert(e.message ?? 'Disconnect failed'),
  });

  if (!status.configured) {
    return (
      <div className="card mb-5 border-l-4 border-terracotta">
        <div className="font-display text-lg mb-1">QuickBooks isn't configured on this server</div>
        <div className="text-sm text-ink-soft mb-3">
          The server is missing the Intuit app credentials needed to connect to QuickBooks Online. An admin needs to:
        </div>
        <ol className="text-sm text-ink-soft list-decimal ml-5 space-y-1.5">
          <li>Create a free <a className="text-terracotta hover:text-terracotta-deep" href="https://developer.intuit.com" target="_blank" rel="noopener noreferrer">Intuit Developer account</a> and a new app.</li>
          <li>Add the redirect URI <code className="font-mono bg-cream px-1.5 py-0.5 rounded text-xs">{location.origin}/api/quickbooks/callback</code> in the app's Keys &amp; OAuth section.</li>
          <li>Copy the Client ID + Client Secret into the server's environment variables: <code className="font-mono bg-cream px-1.5 py-0.5 rounded text-xs">QBO_CLIENT_ID</code>, <code className="font-mono bg-cream px-1.5 py-0.5 rounded text-xs">QBO_CLIENT_SECRET</code>, <code className="font-mono bg-cream px-1.5 py-0.5 rounded text-xs">QBO_REDIRECT_URI</code>, <code className="font-mono bg-cream px-1.5 py-0.5 rounded text-xs">QBO_ENVIRONMENT</code> (<em>sandbox</em> or <em>production</em>).</li>
          <li>Redeploy the app. Then come back here and click <strong>Connect QuickBooks</strong>.</li>
        </ol>
      </div>
    );
  }

  return (
    <div className="card mb-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-display font-medium text-lg">Connection</span>
            {status.connected
              ? <span className="pill pill-sage">Connected</span>
              : <span className="pill pill-muted">Not connected</span>}
            {status.environment === 'sandbox' && <span className="pill pill-gold">Sandbox</span>}
          </div>
          {status.connected ? (
            <div className="text-xs text-ink-faint">
              {status.company_name && <>Company: <strong>{status.company_name}</strong> · </>}
              Realm: <code className="font-mono">{status.realm_id}</code>
              {status.connected_at && <> · connected {new Date(status.connected_at).toLocaleString()}</>}
              {status.last_sync_at && <> · last sync {new Date(status.last_sync_at).toLocaleString()}</>}
            </div>
          ) : (
            <div className="text-sm text-ink-soft mt-1">
              Click below to authorize QuickBooks. You'll be redirected to Intuit, then back here.
            </div>
          )}
        </div>
        <div>
          {status.connected ? (
            <button
              onClick={() => {
                if (window.confirm('Disconnect QuickBooks? Existing syncs will remain but no new syncs will happen until you reconnect.')) {
                  disconnectMut.mutate();
                }
              }}
              disabled={disconnectMut.isPending}
              className="btn-ghost"
            >
              {disconnectMut.isPending ? 'Disconnecting…' : 'Disconnect'}
            </button>
          ) : (
            <button onClick={() => connectMut.mutate()} disabled={connectMut.isPending} className="btn-primary">
              {connectMut.isPending ? 'Starting…' : 'Connect QuickBooks'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  Deposit account picker                                            */
/* ----------------------------------------------------------------- */

function DepositAccountCard({ onChange }: { onChange: () => void }) {
  const { data: settings } = useQuery<{ settings: SettingRow[] }>({
    queryKey: ['admin', 'settings'],
    queryFn: () => apiGet('/api/admin/settings'),
  });
  const { data: depositAccounts, isLoading, error } = useQuery<QboAccount[]>({
    queryKey: ['qbo', 'deposit-accounts'],
    queryFn: () => apiGet('/api/quickbooks/deposit-accounts'),
  });

  const currentId = settings?.settings.find(s => s.setting_key === 'qbo_default_deposit_account_id')?.setting_value ?? '';
  const [value, setValue] = useState('');
  useEffect(() => { setValue(currentId); }, [currentId]);

  const saveMut = useMutation({
    mutationFn: (v: string) => apiPut('/api/admin/settings', { changes: { qbo_default_deposit_account_id: v } }),
    onSuccess: () => onChange(),
  });

  return (
    <div className="card mb-5">
      <div className="card-head">
        <div>
          <h3 className="font-display font-medium text-[17px] m-0">Default deposit account</h3>
          <div className="text-xs text-ink-faint mt-0.5">Where each sales receipt deposits to in QuickBooks. Most orgs use "Undeposited Funds" so the bookkeeper can group deposits before recording them at the bank.</div>
        </div>
      </div>
      {isLoading && <Loading />}
      {error && <ErrorBox error={error} />}
      {depositAccounts && (
        <div className="flex items-center gap-3">
          <select
            value={value}
            onChange={e => setValue(e.target.value)}
            className="field-input max-w-md"
          >
            <option value="">— Pick an account —</option>
            {depositAccounts.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.subtype ?? a.type})</option>
            ))}
          </select>
          <button
            onClick={() => saveMut.mutate(value)}
            disabled={saveMut.isPending || value === currentId}
            className="btn-primary disabled:opacity-50"
          >
            {saveMut.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  Undesignated-donation income account                              */
/* ----------------------------------------------------------------- */

function UndesignatedAccountCard({ onChange }: { onChange: () => void }) {
  const { data: settings } = useQuery<{ settings: SettingRow[] }>({
    queryKey: ['admin', 'settings'],
    queryFn: () => apiGet('/api/admin/settings'),
  });
  const { data: incomeAccounts, isLoading, error } = useQuery<QboAccount[]>({
    queryKey: ['qbo', 'income-accounts'],
    queryFn: () => apiGet('/api/quickbooks/accounts'),
  });

  const currentId = settings?.settings.find(s => s.setting_key === 'qbo_undesignated_account_id')?.setting_value ?? '';
  const [value, setValue] = useState('');
  useEffect(() => { setValue(currentId); }, [currentId]);

  const saveMut = useMutation({
    mutationFn: (v: string) => {
      const acct = incomeAccounts?.find(a => a.id === v);
      return apiPut('/api/admin/settings', { changes: {
        qbo_undesignated_account_id: v,
        qbo_undesignated_account_name: acct?.name ?? '',
      }});
    },
    onSuccess: () => onChange(),
  });

  return (
    <div className="card mb-5">
      <div className="card-head">
        <div>
          <h3 className="font-display font-medium text-[17px] m-0">Undesignated donations</h3>
          <div className="text-xs text-ink-faint mt-0.5">
            Where undesignated/unrestricted donations (no specific fund) post in QuickBooks. Most orgs pick a "General Donations" income account here.
          </div>
        </div>
      </div>
      {isLoading && <Loading />}
      {error && <ErrorBox error={error} />}
      {incomeAccounts && (
        <div className="flex items-center gap-3">
          <select
            value={value}
            onChange={e => setValue(e.target.value)}
            className="field-input max-w-md"
          >
            <option value="">— Pick an income account —</option>
            {incomeAccounts.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.subtype ?? a.type})</option>
            ))}
          </select>
          <button
            onClick={() => saveMut.mutate(value)}
            disabled={saveMut.isPending || value === currentId}
            className="btn-primary disabled:opacity-50"
          >
            {saveMut.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  Mappings card — fund → QBO account                                */
/* ----------------------------------------------------------------- */

function MappingsCard() {
  const qc = useQueryClient();
  const { data: mappings, isLoading: mLoading, error: mErr } = useQuery<FundMapping[]>({
    queryKey: ['qbo', 'mappings'],
    queryFn: () => apiGet('/api/quickbooks/mappings'),
  });
  const { data: accounts, isLoading: aLoading, error: aErr } = useQuery<QboAccount[]>({
    queryKey: ['qbo', 'income-accounts'],
    queryFn: () => apiGet('/api/quickbooks/accounts'),
  });

  const updateMut = useMutation({
    mutationFn: ({ fundId, account }: { fundId: number; account: QboAccount | null }) => {
      if (!account) return apiDelete(`/api/quickbooks/mappings/${fundId}`);
      return apiPut(`/api/quickbooks/mappings/${fundId}`, {
        qbo_account_id: account.id,
        qbo_account_name: account.name,
        qbo_account_type: account.type,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qbo', 'mappings'] }),
    onError: (e: any) => window.alert(e.message ?? 'Failed to save mapping'),
  });

  return (
    <div className="card mb-5">
      <div className="card-head">
        <div>
          <h3 className="font-display font-medium text-[17px] m-0">Fund mapping</h3>
          <div className="text-xs text-ink-faint mt-0.5">
            Each Furnish Hope fund needs to map to a QuickBooks income account. Donations split across multiple funds become multi-line sales receipts.
          </div>
        </div>
      </div>
      {(mLoading || aLoading) && <Loading />}
      {mErr && <ErrorBox error={mErr} />}
      {aErr && <ErrorBox error={aErr} />}
      {mappings && accounts && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-ink-faint">
              <tr className="border-b border-hairline">
                <th className="text-left py-2 pr-3 font-medium">Fund</th>
                <th className="text-left py-2 pr-3 font-medium">QuickBooks income account</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {mappings.length === 0 && (
                <tr><td colSpan={3} className="py-8 text-center text-ink-faint">
                  No funds yet. Create funds under <code>/admin/lkp_fund</code> first.
                </td></tr>
              )}
              {mappings.map(m => (
                <tr key={m.fund_id} className="border-b border-hairline/60">
                  <td className="py-2.5 pr-3">
                    <div className="font-medium">{m.fund_name}</div>
                    {m.fund_description && <div className="text-[11px] text-ink-faint">{m.fund_description}</div>}
                  </td>
                  <td className="py-2.5 pr-3">
                    <select
                      value={m.qbo_account_id ?? ''}
                      onChange={e => {
                        const acct = accounts.find(a => a.id === e.target.value) ?? null;
                        updateMut.mutate({ fundId: m.fund_id, account: acct });
                      }}
                      className="field-input"
                    >
                      <option value="">— Not mapped —</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.subtype ?? a.type})</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2.5">
                    {m.qbo_account_id && <span className="pill pill-sage text-[10px]">✓</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  Sync log card                                                     */
/* ----------------------------------------------------------------- */

interface SyncLogRow {
  sync_id: number;
  donation_id: number;
  qbo_sales_receipt_id: string | null;
  sync_status: 'synced' | 'failed' | 'skipped' | 'pending';
  attempted_at: string;
  synced_at: string | null;
  error_message: string | null;
  payload_summary: string | null;
  attempted_by_username: string | null;
  receipt_number: string | null;
  total_value: number | null;
  donation_date: string | null;
  donor_name: string | null;
}

function SyncLogCard() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { data, isLoading, error } = useQuery<SyncLogRow[]>({
    queryKey: ['qbo', 'sync-log', statusFilter],
    queryFn: () => apiGet('/api/quickbooks/sync-log', { status: statusFilter || undefined, limit: '100' }),
  });

  return (
    <div className="card mb-5">
      <div className="card-head">
        <div>
          <h3 className="font-display font-medium text-[17px] m-0">Recent syncs</h3>
          <div className="text-xs text-ink-faint mt-0.5">Last 100 sync attempts. Failures show the error from QuickBooks.</div>
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="field-input text-xs max-w-[160px]"
        >
          <option value="">All statuses</option>
          <option value="synced">Synced</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </select>
      </div>
      {isLoading && <Loading />}
      {error && <ErrorBox error={error} />}
      {data && (data.length === 0 ? (
        <div className="p-6 text-center text-ink-faint text-sm">No sync attempts yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-widest text-ink-faint">
              <tr className="border-b border-hairline">
                <th className="text-left py-2 pr-3 font-medium">When</th>
                <th className="text-left py-2 pr-3 font-medium">Donation</th>
                <th className="text-left py-2 pr-3 font-medium">Donor</th>
                <th className="text-right py-2 pr-3 font-medium">Amount</th>
                <th className="text-left py-2 pr-3 font-medium">Status</th>
                <th className="text-left py-2 pr-3 font-medium">QBO ref / error</th>
              </tr>
            </thead>
            <tbody>
              {data.map(r => (
                <tr key={r.sync_id} className="border-b border-hairline/60">
                  <td className="py-2 pr-3 text-ink-faint">{new Date(r.attempted_at).toLocaleString()}</td>
                  <td className="py-2 pr-3">
                    <a href={`/donations/${r.donation_id}`} className="text-terracotta hover:text-terracotta-deep">
                      {r.receipt_number ?? `#${r.donation_id}`}
                    </a>
                  </td>
                  <td className="py-2 pr-3">{r.donor_name ?? '—'}</td>
                  <td className="py-2 pr-3 text-right font-mono">{r.total_value != null ? `$${Number(r.total_value).toFixed(2)}` : '—'}</td>
                  <td className="py-2 pr-3">
                    {r.sync_status === 'synced'  && <span className="pill pill-sage">Synced</span>}
                    {r.sync_status === 'failed'  && <span className="pill pill-terra">Failed</span>}
                    {r.sync_status === 'skipped' && <span className="pill pill-muted">Skipped</span>}
                    {r.sync_status === 'pending' && <span className="pill pill-gold">Pending</span>}
                  </td>
                  <td className="py-2 pr-3">
                    {r.qbo_sales_receipt_id && <span className="text-ink-faint">Sales Receipt {r.qbo_sales_receipt_id}</span>}
                    {r.error_message && <span className="text-terracotta-deep">{r.error_message}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
