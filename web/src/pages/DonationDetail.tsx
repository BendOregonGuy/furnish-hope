/**
 * Read-only donation detail. Shows donor, gift breakdown, designation
 * splits, type-specific sub-records (stock / check), pledge linkage,
 * receipt + acknowledgement status, and a quick action to assign the
 * receipt number if it doesn't have one yet.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiDelete, apiGet, apiPost, formatLongDate, formatMoney } from '../lib/api.ts';
import { Avatar, Loading, ErrorBox, StatusPill, AnonPill } from '../components/ui.tsx';
import { DetailNavBar } from '../components/forms/FormNavBar.tsx';
import { useAuth } from '../lib/auth.tsx';
import { useState } from 'react';

interface Detail {
  donation: any;
  designations: Array<{ donation_designation_id: number; fund_id: number; amount: number | string; fund_name: string; description: string | null }>;
  securities: any | null;
  check: any | null;
  prevId: number | null;
  nextId: number | null;
}

export function DonationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;

  const { data, isLoading, error } = useQuery<Detail>({
    queryKey: ['donation', id],
    queryFn: () => apiGet(`/api/donations/${id}`),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiDelete(`/api/donations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      navigate('/donations');
    },
    onError: (err: any) => window.alert(err.message ?? 'Delete failed'),
  });

  const receiptMut = useMutation({
    mutationFn: () => apiPost<{ receipt_number: string }>(`/api/donations/${id}/receipt`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['donation', id] }),
    onError: (err: any) => window.alert(err.message ?? 'Receipt assignment failed'),
  });

  function handleDelete() {
    if (window.confirm('Permanently delete this donation? This cannot be undone.')) deleteMut.mutate();
  }

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;

  const d = data.donation;
  const designatedTotal = data.designations.reduce((s, x) => s + Number(x.amount ?? 0), 0);
  const undesignated = Math.max(0, Number(d.total_value) - designatedTotal);

  return (
    <>
      <DetailNavBar
        listLabel="donations" singularLabel="donation" basePath="/donations"
        prevId={data.prevId} nextId={data.nextId}
        actions={
          <>
            <Link to="/donations/new" className="text-xs text-ink-soft hover:text-terracotta border border-hairline-strong px-3 py-1 rounded-md hover:border-terracotta">
              + New donation
            </Link>
            <Link to={`/donations/${id}/edit`} className="btn-primary text-xs py-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </Link>
          </>
        }
      />

      <div className="flex gap-5 p-5 bg-cream border border-hairline rounded-[10px] mb-6">
        <Avatar name={d.donor_name ?? '?'} size="lg" />
        <div className="flex-1">
          <div className="flex items-baseline gap-3.5 mb-1 flex-wrap">
            <div className="font-display text-2xl font-medium">{d.donor_name}</div>
            {d.donor_is_anonymous && <AnonPill />}
            <span className="pill pill-terra">{d.donation_type}</span>
            {d.acknowledgement_status && <StatusPill status={d.acknowledgement_status} />}
          </div>
          <div className="flex gap-4 text-sm text-ink-soft flex-wrap">
            <span>{formatLongDate(d.donation_date)}</span>
            {d.payment_method && <><span>·</span><span>{d.payment_method}</span></>}
            {d.solicitation_method && <><span>·</span><span>via {d.solicitation_method}</span></>}
            {d.gift_in_honor_of && <><span>·</span><span className="italic">{d.gift_in_honor_of}</span></>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-ink-faint tracking-widest uppercase font-medium">Gift amount</div>
          <div className="font-display text-3xl font-medium leading-none">{formatMoney(d.total_value)}</div>
          {Number(d.tax_deductible_amount ?? d.total_value) !== Number(d.total_value) && (
            <div className="text-[11px] text-ink-soft mt-1">
              Tax-deductible: <span className="font-medium">{formatMoney(d.tax_deductible_amount ?? d.total_value)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-5">
        <div className="space-y-4">
          {/* Designations */}
          <div className="card">
            <div className="card-head">
              <h3 className="font-display font-medium text-[17px] m-0">Designation splits</h3>
              <span className="text-xs text-ink-faint">
                {data.designations.length === 0 ? 'No splits — full gift undesignated' : `${data.designations.length} split${data.designations.length === 1 ? '' : 's'}`}
              </span>
            </div>
            {data.designations.length === 0 ? (
              <div className="text-sm text-ink-faint italic">The entire {formatMoney(d.total_value)} is unrestricted / undesignated.</div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {data.designations.map(dd => (
                    <tr key={dd.donation_designation_id} className="border-t border-hairline first:border-0">
                      <td className="py-2.5 pr-3 font-medium">{dd.fund_name}</td>
                      <td className="py-2.5 pr-3 text-xs text-ink-soft">{dd.description ?? ''}</td>
                      <td className="py-2.5 text-right font-display font-medium">{formatMoney(dd.amount)}</td>
                    </tr>
                  ))}
                  {undesignated > 0 && (
                    <tr className="border-t border-hairline italic text-ink-faint">
                      <td className="py-2.5 pr-3">Undesignated remainder</td>
                      <td className="py-2.5 pr-3 text-xs"></td>
                      <td className="py-2.5 text-right">{formatMoney(undesignated)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Stock / bond details */}
          {data.securities && (
            <div className="card">
              <div className="card-head"><h3 className="font-display font-medium text-[17px] m-0">{data.securities.security_type} details</h3></div>
              <Detail label="Ticker" value={data.securities.ticker ?? '—'} mono />
              {data.securities.security_description && <Detail label="Description" value={data.securities.security_description} />}
              <Detail label="Shares" value={data.securities.shares != null ? Number(data.securities.shares).toLocaleString() : '—'} />
              <Detail label="Gift-date FMV" value={data.securities.gift_date_fmv != null ? formatMoney(data.securities.gift_date_fmv) : '—'} />
              <Detail label="Sale proceeds" value={data.securities.sale_proceeds != null ? formatMoney(data.securities.sale_proceeds) : '—'} />
              <Detail label="Broker" value={data.securities.broker_name ?? '—'} />
            </div>
          )}

          {/* Check details */}
          {data.check && (
            <div className="card">
              <div className="card-head"><h3 className="font-display font-medium text-[17px] m-0">Check details</h3></div>
              <Detail label="Check #" value={data.check.check_number ?? '—'} mono />
              <Detail label="Check date" value={data.check.check_date ? formatLongDate(data.check.check_date) : '—'} />
              <Detail label="Bank" value={data.check.bank_name ?? '—'} />
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Receipt + acknowledgement */}
          <div className="card">
            <div className="card-head" style={{marginBottom:'10px', paddingBottom:'8px'}}>
              <h3 className="font-display font-medium text-sm m-0">Receipt</h3>
            </div>
            {d.receipt_number ? (
              <div>
                <div className="font-mono text-base">{d.receipt_number}</div>
                <div className="text-[11px] text-ink-faint mt-1">Issued for this fiscal year</div>
              </div>
            ) : (
              <div>
                <div className="text-sm text-ink-faint italic mb-2">No receipt number assigned.</div>
                <button
                  onClick={() => receiptMut.mutate()}
                  disabled={receiptMut.isPending}
                  className="btn-primary text-xs py-1.5 disabled:opacity-60"
                >
                  {receiptMut.isPending ? 'Assigning…' : 'Assign next receipt #'}
                </button>
              </div>
            )}
          </div>

          <ReceiptCard donationId={Number(id)} donation={d} onSent={() => queryClient.invalidateQueries({ queryKey: ['donation', id] })} />

          <div className="card">
            <div className="card-head" style={{marginBottom:'10px', paddingBottom:'8px'}}>
              <h3 className="font-display font-medium text-sm m-0">Acknowledgement</h3>
            </div>
            <Detail label="Status" value={d.acknowledgement_status ?? 'Not set'} />
            <Detail label="Sent" value={d.acknowledgement_sent_date ? formatLongDate(d.acknowledgement_sent_date) : '—'} />
            {d.soft_credit_name && <Detail label="Soft credit" value={d.soft_credit_name} />}
          </div>

          {isAdmin && (
            <QuickBooksCard donationId={Number(id)} donation={d} />
          )}

          {(d.received_via || d.external_transaction_id) && (
            <div className="card">
              <div className="card-head" style={{marginBottom:'10px', paddingBottom:'8px'}}>
                <h3 className="font-display font-medium text-sm m-0">Source</h3>
              </div>
              {d.received_via && <Detail label="Via" value={d.received_via} />}
              {d.external_transaction_id && <Detail label="Txn ID" value={d.external_transaction_id} mono />}
            </div>
          )}

          {d.description && (
            <div className="card">
              <div className="card-head" style={{marginBottom:'10px', paddingBottom:'8px'}}>
                <h3 className="font-display font-medium text-sm m-0">Notes</h3>
              </div>
              <div className="text-sm text-ink-soft whitespace-pre-line">{d.description}</div>
            </div>
          )}

          <button onClick={handleDelete} disabled={deleteMut.isPending}
            className="text-xs text-terracotta hover:text-terracotta-deep disabled:opacity-50 self-start">
            {deleteMut.isPending ? 'Deleting…' : 'Delete this donation'}
          </button>
        </div>
      </div>
    </>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2 py-1.5 text-xs">
      <div className="text-ink-faint uppercase tracking-wider text-[10px] font-medium">{label}</div>
      <div className={'text-ink ' + (mono ? 'font-mono' : '')}>{value}</div>
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  QuickBooks card — admin-only, on the right column                 */
/* ----------------------------------------------------------------- */

interface SyncHistoryRow {
  sync_id: number;
  qbo_sales_receipt_id: string | null;
  sync_status: 'synced' | 'failed' | 'skipped' | 'pending';
  attempted_at: string;
  synced_at: string | null;
  error_message: string | null;
  attempted_by_username: string | null;
}

function QuickBooksCard({ donationId, donation }: { donationId: number; donation: any }) {
  const qc = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);
  const [lastResult, setLastResult] = useState<{ status: string; message: string } | null>(null);

  const { data: history } = useQuery<SyncHistoryRow[]>({
    queryKey: ['qbo', 'donation', donationId, 'history'],
    queryFn: () => apiGet(`/api/quickbooks/donations/${donationId}/sync-history`),
    enabled: showHistory,
  });

  const syncMut = useMutation({
    mutationFn: () => apiPost<{ status: string; message: string }>(`/api/quickbooks/sync/${donationId}`, {}),
    onSuccess: (r) => {
      setLastResult(r);
      qc.invalidateQueries({ queryKey: ['donation', String(donationId)] });
      qc.invalidateQueries({ queryKey: ['qbo', 'donation', donationId, 'history'] });
      qc.invalidateQueries({ queryKey: ['donations'] });
    },
    onError: (e: any) => {
      setLastResult({ status: 'failed', message: e.message ?? 'Sync failed' });
    },
  });

  const status = donation.qbo_sync_status as string | null;
  const syncedAt = donation.qbo_synced_at as string | null;

  return (
    <div className="card">
      <div className="card-head" style={{marginBottom:'10px', paddingBottom:'8px'}}>
        <h3 className="font-display font-medium text-sm m-0">QuickBooks</h3>
        {status === 'synced'  && <span className="pill pill-sage text-[10px]">Synced</span>}
        {status === 'failed'  && <span className="pill pill-terra text-[10px]">Failed</span>}
        {status === 'skipped' && <span className="pill pill-muted text-[10px]">Skipped</span>}
        {!status && <span className="pill pill-muted text-[10px]">Not synced</span>}
      </div>

      {syncedAt && status === 'synced' && (
        <div className="text-[11px] text-ink-faint mb-2">
          Synced {new Date(syncedAt).toLocaleString()}
        </div>
      )}

      {lastResult && (
        <div className={`p-2 rounded text-[11px] mb-2 ${
          lastResult.status === 'synced'  ? 'bg-sage-soft text-[#3F4A33]' :
          lastResult.status === 'skipped' ? 'bg-cream text-ink-soft' :
          'bg-terracotta-soft text-terracotta-deep'
        }`}>
          {lastResult.message}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => syncMut.mutate()}
          disabled={syncMut.isPending}
          className="btn-primary text-xs py-1.5 disabled:opacity-60"
        >
          {syncMut.isPending ? 'Syncing…' : status === 'synced' ? 'Re-sync to QBO' : 'Sync to QBO'}
        </button>
        <button
          onClick={() => setShowHistory(s => !s)}
          className="text-[11px] text-ink-faint hover:text-terracotta self-center"
        >
          {showHistory ? 'Hide history' : 'History'}
        </button>
      </div>

      {showHistory && history && (
        <div className="mt-3 space-y-1.5 max-h-60 overflow-y-auto">
          {history.length === 0 && <div className="text-[11px] text-ink-faint italic">No sync attempts yet.</div>}
          {history.map(h => (
            <div key={h.sync_id} className="text-[11px] border-l-2 pl-2 py-1"
                 style={{ borderColor: h.sync_status === 'synced' ? '#7C8B5E' : h.sync_status === 'failed' ? '#C7704A' : '#999' }}>
              <div className="flex justify-between gap-2">
                <span className="font-medium">{h.sync_status}</span>
                <span className="text-ink-faint">{new Date(h.attempted_at).toLocaleString()}</span>
              </div>
              {h.qbo_sales_receipt_id && <div className="text-ink-faint">Sales Receipt {h.qbo_sales_receipt_id}</div>}
              {h.error_message && <div className="text-terracotta-deep">{h.error_message}</div>}
              {h.attempted_by_username && <div className="text-ink-faint text-[10px]">by {h.attempted_by_username}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  Receipt card — preview PDF + email it to the donor                */
/* ----------------------------------------------------------------- */

function ReceiptCard({ donationId, donation, onSent }: {
  donationId: number;
  donation: any;
  onSent: () => void;
}) {
  const [lastResult, setLastResult] = useState<{ status: string; message: string } | null>(null);

  const sendMut = useMutation({
    mutationFn: () => apiPost<{ status: string; message: string }>(`/api/receipts/donation/${donationId}/send`, {}),
    onSuccess: (r) => {
      setLastResult(r);
      if (r.status === 'sent') onSent();
    },
    onError: (e: any) => setLastResult({ status: 'failed', message: e.message ?? 'Send failed' }),
  });

  const alreadySent = !!donation.acknowledgement_sent_date;

  return (
    <div className="card">
      <div className="card-head" style={{marginBottom:'10px', paddingBottom:'8px'}}>
        <h3 className="font-display font-medium text-sm m-0">Receipt</h3>
        {alreadySent && <span className="pill pill-sage text-[10px]">✓ Sent</span>}
      </div>

      {lastResult && (
        <div className={`p-2 rounded text-[11px] mb-2 ${
          lastResult.status === 'sent' ? 'bg-sage-soft text-[#3F4A33]' :
          lastResult.status === 'skipped' ? 'bg-cream text-ink-soft' :
          'bg-terracotta-soft text-terracotta-deep'
        }`}>
          {lastResult.message}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <a
          href={`/api/receipts/donation/${donationId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost text-xs"
        >
          Preview PDF
        </a>
        <button
          onClick={() => {
            if (alreadySent && !window.confirm('A receipt has already been sent for this donation. Send another?')) return;
            sendMut.mutate();
          }}
          disabled={sendMut.isPending}
          className="btn-primary text-xs disabled:opacity-60"
        >
          {sendMut.isPending ? 'Sending…' : (alreadySent ? 'Resend' : 'Email receipt')}
        </button>
      </div>

      <div className="text-[10px] text-ink-faint mt-2">
        Sends from your connected email account (Email → Accounts) with the PDF attached.
      </div>
    </div>
  );
}
