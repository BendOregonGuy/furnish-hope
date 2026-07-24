/**
 * Batch acknowledgements page. Lists all donations missing an
 * acknowledgement, lets the user select all (or a subset), and sends
 * receipt emails to every selected donor in one click.
 *
 * Reads via /api/receipts/unsent, sends via /api/receipts/send-batch.
 * The send endpoint loops server-side and returns a per-donation
 * status array so the UI can show what succeeded vs. failed.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiGet, apiPost, formatMoney, formatShortDate } from '../lib/api.ts';
import { PageHeader, Loading, ErrorBox, EmptyState } from '../components/ui.tsx';

interface UnsentRow {
  donation_id: number;
  donation_date: string;
  total_value: number | string;
  receipt_number: string | null;
  donor_name: string;
  donor_email: string | null;
  donation_type: string;
}

interface SendResult {
  donation_id: number;
  status: 'sent' | 'skipped' | 'failed';
  message: string;
  recipient?: string;
}

interface BatchResult {
  results: SendResult[];
  summary: { sent: number; skipped: number; failed: number };
}

export function Acknowledgements() {
  const qc = useQueryClient();
  const [fromDate, setFromDate] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [batch, setBatch] = useState<BatchResult | null>(null);

  const { data, isLoading, error } = useQuery<UnsentRow[]>({
    queryKey: ['receipts', 'unsent', fromDate],
    queryFn: () => apiGet('/api/receipts/unsent', { from: fromDate || undefined }),
  });

  // Rows that actually have an email — those are eligible. Without an
  // email we can't send anything; they should be handled by mail merge
  // or another path.
  const eligible = useMemo(() => (data ?? []).filter(r => !!r.donor_email), [data]);
  const noEmail  = useMemo(() => (data ?? []).filter(r => !r.donor_email), [data]);

  const allSelected = eligible.length > 0 && eligible.every(r => selected.has(r.donation_id));

  function toggle(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(eligible.map(r => r.donation_id)));
  }

  const sendMut = useMutation({
    mutationFn: () => apiPost<BatchResult>('/api/receipts/send-batch', {
      donation_ids: Array.from(selected),
    }),
    onSuccess: (r) => {
      setBatch(r);
      // Refresh the unsent list — sent items disappear.
      qc.invalidateQueries({ queryKey: ['receipts', 'unsent'] });
      qc.invalidateQueries({ queryKey: ['donations'] });
      setSelected(new Set());
    },
    onError: (e: any) => window.alert(e.message ?? 'Batch send failed'),
  });

  return (
    <>
      <PageHeader
        helpSection="donations-receipt"
        title="Donation"
        emphasis="acknowledgements"
        subtitle="Donations missing a tax-receipt acknowledgement. Send PDFs to everyone selected with one click."
      />

      <div className="card mb-5 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <label className="field-label">From date</label>
          <input type="date" className="field-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          <div className="text-[10px] text-ink-faint mt-1">Leave blank to show every unsent receipt regardless of age.</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-ink-faint mb-1">{selected.size} selected of {eligible.length} eligible</div>
          <button
            onClick={() => {
              if (!selected.size) return;
              if (!window.confirm(`Send ${selected.size} receipt email${selected.size === 1 ? '' : 's'}? PDFs will be generated server-side and emailed from your default-send account.`)) return;
              sendMut.mutate();
            }}
            disabled={selected.size === 0 || sendMut.isPending}
            className="btn-primary disabled:opacity-50"
          >
            {sendMut.isPending ? 'Sending…' : `Send ${selected.size || 0} receipt${selected.size === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>

      {/* Batch result summary */}
      {batch && (
        <div className="card mb-5">
          <div className="font-display font-medium text-base mb-2">Batch result</div>
          <div className="flex gap-4 text-sm mb-3">
            <span className="pill pill-sage">{batch.summary.sent} sent</span>
            {batch.summary.skipped > 0 && <span className="pill pill-muted">{batch.summary.skipped} skipped</span>}
            {batch.summary.failed > 0 && <span className="pill pill-terra">{batch.summary.failed} failed</span>}
          </div>
          {(batch.summary.skipped > 0 || batch.summary.failed > 0) && (
            <details className="text-xs">
              <summary className="cursor-pointer text-ink-faint">Show details</summary>
              <table className="w-full mt-2">
                <tbody>
                  {batch.results.filter(r => r.status !== 'sent').map(r => (
                    <tr key={r.donation_id} className="border-t border-hairline">
                      <td className="py-1.5 pr-3">Donation #{r.donation_id}</td>
                      <td className="py-1.5 pr-3">
                        <span className={`pill ${r.status === 'skipped' ? 'pill-muted' : 'pill-terra'}`}>{r.status}</span>
                      </td>
                      <td className="py-1.5 text-ink-soft">{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </div>
      )}

      {isLoading && <Loading />}
      {error && <ErrorBox error={error} />}

      <div className="card">
        {data && data.length === 0 && (
          <EmptyState title="All caught up" hint="No donations need an acknowledgement." />
        )}

        {eligible.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-cream">
              <tr>
                <th className="px-5 py-2.5 w-10">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 accent-terracotta cursor-pointer" />
                </th>
                <Th>Date</Th>
                <Th>Donor</Th>
                <Th>Email</Th>
                <Th>Receipt #</Th>
                <Th className="text-right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {eligible.map(r => (
                <tr key={r.donation_id} className="border-t border-hairline hover:bg-terracotta/[0.025]">
                  <td className="px-5 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(r.donation_id)}
                      onChange={() => toggle(r.donation_id)}
                      className="w-4 h-4 accent-terracotta cursor-pointer"
                    />
                  </td>
                  <td className="px-5 py-2.5 text-xs whitespace-nowrap">
                    <Link to={`/donations/${r.donation_id}`} className="text-terracotta font-medium">
                      {formatShortDate(r.donation_date)}
                    </Link>
                  </td>
                  <td className="px-5 py-2.5">{r.donor_name}</td>
                  <td className="px-5 py-2.5 text-xs text-ink-soft">{r.donor_email}</td>
                  <td className="px-5 py-2.5 text-xs font-mono">{r.receipt_number ?? <span className="text-ink-faint italic">none</span>}</td>
                  <td className="px-5 py-2.5 text-right font-display font-medium">{formatMoney(r.total_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {noEmail.length > 0 && (
          <details className="border-t border-hairline mt-4 pt-3">
            <summary className="cursor-pointer text-xs text-ink-faint">
              {noEmail.length} donation{noEmail.length === 1 ? '' : 's'} can't be sent — donor has no email on file
            </summary>
            <table className="w-full text-sm mt-2">
              <tbody>
                {noEmail.map(r => (
                  <tr key={r.donation_id} className="border-t border-hairline/60">
                    <td className="px-5 py-2 text-xs whitespace-nowrap">{formatShortDate(r.donation_date)}</td>
                    <td className="px-5 py-2">
                      <Link to={`/donors/${r.donation_id}`} className="text-terracotta">
                        {r.donor_name}
                      </Link>
                    </td>
                    <td className="px-5 py-2 text-xs text-ink-faint italic">no email — needs mail merge or manual letter</td>
                    <td className="px-5 py-2 text-right font-display">{formatMoney(r.total_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </div>
    </>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left px-5 py-2.5 text-[10px] uppercase tracking-widest text-ink-faint font-medium ${className ?? ''}`}>{children}</th>;
}
