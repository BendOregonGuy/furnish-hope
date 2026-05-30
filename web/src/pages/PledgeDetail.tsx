/**
 * Read-only pledge detail. Shows donor, totals with progress bar,
 * linked payment donations, and edit/delete actions.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiDelete, apiGet, formatLongDate, formatMoney } from '../lib/api.ts';
import { Avatar, Loading, ErrorBox, StatusPill } from '../components/ui.tsx';
import { DetailNavBar } from '../components/forms/FormNavBar.tsx';

interface Detail {
  pledge: any;
  payments: Array<{
    donation_id: number;
    donation_date: string;
    total_value: number | string;
    tax_deductible_amount: number | string | null;
    receipt_number: string | null;
    donation_type: string;
  }>;
}

export function PledgeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<Detail>({
    queryKey: ['pledge', id],
    queryFn: () => apiGet(`/api/pledges/${id}`),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiDelete(`/api/pledges/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pledges'] });
      navigate('/pledges');
    },
    onError: (err: any) => window.alert(err.message ?? 'Delete failed'),
  });

  function handleDelete() {
    if (window.confirm('Permanently delete this pledge? It must have no linked donations.')) deleteMut.mutate();
  }

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;

  const p = data.pledge;
  const total = Number(p.total_pledged_amount ?? 0);
  const fulfilled = Number(p.amount_fulfilled ?? 0);
  const outstanding = Number(p.amount_outstanding ?? Math.max(0, total - fulfilled));
  const fulfilledPct = Math.min(100, Math.round((fulfilled / Math.max(1, total)) * 100));
  const isOverdue = !!p.expected_fulfillment_date
    && new Date(p.expected_fulfillment_date) < new Date()
    && p.pledge_status !== 'Fulfilled' && p.pledge_status !== 'Cancelled';

  return (
    <>
      <DetailNavBar
        listLabel="pledges" singularLabel="pledge" basePath="/pledges"
        prevId={null} nextId={null}
        actions={
          <>
            <Link to="/pledges/new" className="text-xs text-ink-soft hover:text-terracotta border border-hairline-strong px-3 py-1 rounded-md hover:border-terracotta">
              + New pledge
            </Link>
            <Link to={`/pledges/${id}/edit`} className="btn-primary text-xs py-1.5">
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
        <Avatar name={p.donor_name ?? '?'} size="lg" />
        <div className="flex-1">
          <div className="flex items-baseline gap-3.5 mb-1">
            <div className="font-display text-2xl font-medium">{p.donor_name}</div>
            <StatusPill status={p.pledge_status} />
            {isOverdue && <span className="pill pill-terra">Overdue</span>}
          </div>
          <div className="flex gap-4 text-sm text-ink-soft flex-wrap">
            <span>Pledged {formatLongDate(p.pledge_date)}</span>
            {p.expected_fulfillment_date && (
              <>
                <span>·</span>
                <span>Expected by {formatLongDate(p.expected_fulfillment_date)}</span>
              </>
            )}
            {p.fund_name && <><span>·</span><span>For <span className="text-ink font-medium">{p.fund_name}</span></span></>}
            {p.solicitation_method && <><span>·</span><span>via {p.solicitation_method}</span></>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-ink-faint tracking-widest uppercase font-medium">Pledged</div>
          <div className="font-display text-3xl font-medium leading-none">{formatMoney(total)}</div>
          <div className="text-[11px] text-ink-soft mt-1">
            <span className="text-sage font-medium">{formatMoney(fulfilled)} fulfilled</span>
            {outstanding > 0 && <> · <span className="text-terracotta-deep">{formatMoney(outstanding)} remaining</span></>}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="card mb-5">
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-[11px] tracking-widest uppercase text-ink-faint font-medium">Fulfillment progress</div>
          <div className="text-xs text-ink-soft">{fulfilledPct}%</div>
        </div>
        <div className="w-full h-3 bg-cream-deep rounded-full overflow-hidden">
          <div className="h-full bg-sage transition-all" style={{ width: `${fulfilledPct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-5">
        <div className="card">
          <div className="card-head">
            <h3 className="font-display font-medium text-[17px] m-0">Payment donations</h3>
            <span className="text-xs text-ink-faint">{data.payments.length} payment{data.payments.length === 1 ? '' : 's'}</span>
          </div>
          {data.payments.length === 0 ? (
            <div className="text-sm text-ink-faint italic">No payments yet. Record a donation with this pledge linked to start filling it.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Date</th>
                  <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Type</th>
                  <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Receipt</th>
                  <th className="text-right text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map(pmt => (
                  <tr key={pmt.donation_id} className="border-t border-hairline">
                    <td className="py-2.5 pr-3">
                      <Link to={`/donations/${pmt.donation_id}`} className="text-terracotta font-medium text-xs">
                        {formatLongDate(pmt.donation_date)}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3 text-xs">{pmt.donation_type}</td>
                    <td className="py-2.5 pr-3 text-xs font-mono">{pmt.receipt_number ?? <span className="text-ink-faint">—</span>}</td>
                    <td className="py-2.5 text-right font-display font-medium">{formatMoney(pmt.total_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="space-y-4">
          {p.notes && (
            <div className="card">
              <div className="card-head" style={{marginBottom:'10px', paddingBottom:'8px'}}>
                <h3 className="font-display font-medium text-sm m-0">Notes</h3>
              </div>
              <div className="text-sm text-ink-soft whitespace-pre-line">{p.notes}</div>
            </div>
          )}

          <button onClick={handleDelete} disabled={deleteMut.isPending}
            className="text-xs text-terracotta hover:text-terracotta-deep disabled:opacity-50 self-start">
            {deleteMut.isPending ? 'Deleting…' : 'Delete this pledge'}
          </button>
        </div>
      </div>
    </>
  );
}
