/**
 * Detail of one of THIS caseworker's referrals. Read-only view of
 * the household + the status of each provisioning request Furnish
 * Hope has opened for them. No internal data (staff names, vehicle
 * info, donor matches) — just what a referring caseworker needs to
 * follow up.
 */

import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api.ts';
import { Loading, ErrorBox } from '../../components/ui.tsx';

interface ReferralDetail {
  client: {
    client_id: number;
    client_name: string;
    email: string | null;
    mobile_phone: string | null;
    client_type: string;
    client_status: string;
    address: string | null;
    address2: string | null;
    city: string | null;
    state: string | null;
    postalcode: string | null;
    referral_date: string;
    notes: string | null;
  };
  requests: Array<{
    request_id: number;
    request_at: string;
    note: string | null;
    review_status: string;
    item_count: number;
    matched_count: number;
    latest_delivery_date: string | null;
    latest_delivery_status: string | null;
  }>;
}

export function AgencyReferralDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useQuery<ReferralDetail>({
    queryKey: ['agency', 'referral', id],
    queryFn: () => apiGet(`/api/agency/referrals/${id}`),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;
  const c = data.client;

  return (
    <>
      <div className="mb-5">
        <Link to="/agency/referrals" className="text-xs text-terracotta hover:text-terracotta-deep">← All referrals</Link>
        <h1 className="font-display text-2xl font-medium m-0 mt-1">{c.client_name}</h1>
        <p className="text-sm text-ink-soft mt-1">
          {c.client_type} · referred {formatDate(c.referral_date)}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">

          {/* Request status — the thing a caseworker actually cares about */}
          <div className="card">
            <div className="card-head">
              <h3 className="font-display font-medium text-[17px] m-0">Furniture request status</h3>
            </div>
            {data.requests.length === 0 ? (
              <div className="text-sm text-ink-faint italic">
                Furnish Hope hasn't opened a provisioning request for this household yet.
                They'll reach out to coordinate once they have. Check back in a few days.
              </div>
            ) : (
              <div className="space-y-3">
                {data.requests.map(r => (
                  <div key={r.request_id} className="border border-hairline rounded p-3">
                    <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
                      <div className="text-sm font-medium">Request #{r.request_id}</div>
                      <div className="text-[11px] text-ink-faint">
                        Opened {formatDate(r.request_at)}
                      </div>
                    </div>
                    {r.review_status && r.review_status !== 'approved' && (
                      <div className={`text-xs mb-2 p-2 rounded ${reviewBanner(r.review_status)}`}>
                        {reviewStatusBlurb(r.review_status, r.note)}
                      </div>
                    )}
                    <div className="text-xs text-ink-soft mb-2">
                      {r.item_count} item{r.item_count === 1 ? '' : 's'} requested
                      {r.matched_count > 0 && <> · {r.matched_count} reserved from inventory</>}
                    </div>
                    {r.latest_delivery_date ? (
                      <div className="text-sm">
                        <span className={`pill ${deliveryStatusPill(r.latest_delivery_status)}`}>
                          {deliveryStatusLabel(r.latest_delivery_status)}
                        </span>
                        <span className="ml-2 text-ink-soft">{formatDate(r.latest_delivery_date)}</span>
                      </div>
                    ) : (
                      <div className="text-xs text-ink-faint italic">No delivery scheduled yet.</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Household card */}
        <div className="space-y-5">
          <div className="card">
            <h3 className="font-display font-medium text-[17px] m-0 mb-3">Household</h3>
            <Row label="Status"  value={c.client_status} />
            <Row label="Type"    value={c.client_type} />
            <Row label="Email"   value={c.email ?? '—'} />
            <Row label="Phone"   value={c.mobile_phone ?? '—'} />
            <Row label="Address" value={
              <>
                {c.address ?? '—'}{c.address2 ? `, ${c.address2}` : ''}
                {(c.city || c.state || c.postalcode) && (
                  <div className="text-[11px] text-ink-soft mt-0.5">
                    {[c.city, c.state, c.postalcode].filter(Boolean).join(', ')}
                  </div>
                )}
              </>
            } />
            {c.notes && (
              <div className="mt-3 p-3 bg-cream/30 rounded text-sm whitespace-pre-wrap text-ink-soft">
                <div className="text-[10px] uppercase tracking-widest text-ink-faint font-medium mb-1">Your referral notes</div>
                {c.notes}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 text-sm py-1.5 border-b border-hairline last:border-b-0">
      <div className="text-[10px] uppercase tracking-widest text-ink-faint font-medium pt-0.5">{label}</div>
      <div className="text-ink">{value}</div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso); if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function deliveryStatusPill(s: string | null): string {
  if (!s) return 'pill-muted';
  const lower = s.toLowerCase();
  if (lower.includes('completed') || lower.includes('delivered')) return 'pill-sage';
  if (lower.includes('scheduled') || lower.includes('en route'))   return 'pill-gold';
  if (lower.includes('cancelled') || lower.includes('postponed'))  return 'pill-terra';
  return 'pill-muted';
}

function deliveryStatusLabel(s: string | null): string {
  return s ?? 'Pending';
}

function reviewBanner(status: string): string {
  if (status === 'rejected')        return 'bg-terracotta-soft text-terracotta-deep';
  if (status === 'awaiting_review') return 'bg-gold-soft text-ink';
  return 'bg-cream text-ink-soft';
}

function reviewStatusBlurb(status: string, note: string | null): string {
  if (status === 'awaiting_review') {
    return 'Awaiting staff review. Furnish Hope will reach out shortly.';
  }
  if (status === 'rejected') {
    return note
      ? `Request was rejected by Furnish Hope. ${extractRejectNote(note)}`
      : 'Request was rejected by Furnish Hope. Please contact them for details.';
  }
  if (status === 'in_progress') return 'In progress — Furnish Hope is matching items now.';
  if (status === 'completed')   return 'Request completed.';
  return status;
}

function extractRejectNote(note: string): string {
  // POST /reject prefixes the stored note with "[Rejected YYYY-MM-DD] ..." —
  // pull just the human-readable part out.
  const m = note.match(/^\[Rejected[^\]]+\]\s*(.*?)(?:\n\n|$)/s);
  return m ? m[1].trim() : note;
}
