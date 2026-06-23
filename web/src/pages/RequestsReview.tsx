/**
 * Staff triage queue — every agency-submitted provisioning request that
 * is sitting in review_status='awaiting_review', oldest first so nothing
 * gets forgotten.
 *
 * From here staff can:
 *   • Open the request to edit + save (existing RequestDetail flow)
 *   • Approve in-place → flips status to 'approved' and the request joins
 *     the normal matching pipeline
 *   • Reject with a note → flips to 'rejected'; the agency sees the note
 *     in their portal
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, formatShortDate } from '../lib/api.ts';
import { PageHeader, Loading, ErrorBox } from '../components/ui.tsx';

interface ReviewRow {
  request_id: number;
  request_at: string;
  client_request_note: string | null;
  client_id: number;
  client_name: string;
  agency_name: string | null;
  caseworker_name: string | null;
  referral_date: string | null;
  item_count: number;
}

export function RequestsReview() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery<ReviewRow[]>({
    queryKey: ['requests-review-queue'],
    queryFn: () => apiGet('/api/requests/review-queue'),
  });

  const approveMut = useMutation({
    mutationFn: (id: number) => apiPost(`/api/requests/${id}/approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requests-review-queue'] }),
  });
  const rejectMut = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) =>
      apiPost(`/api/requests/${id}/reject`, { note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requests-review-queue'] }),
  });

  const [rejecting, setRejecting] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  if (isLoading) return <Loading />;
  if (error)     return <ErrorBox error={error} />;

  return (
    <>
      <PageHeader
        title="Review queue"
        subtitle="Provisioning requests submitted by agency partners, awaiting staff review."
      />

      {!data || data.length === 0 ? (
        <div className="card text-center py-12 text-ink-faint">
          <div className="text-2xl mb-2">✓</div>
          <div className="text-sm">Nothing awaiting review — you're all caught up.</div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="card-head">
            <h3 className="font-display font-medium text-[17px] m-0">
              {data.length} {data.length === 1 ? 'request' : 'requests'} awaiting review
            </h3>
            <span className="text-xs text-ink-faint">Oldest first</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Submitted</th>
                <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Household</th>
                <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Agency</th>
                <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Items</th>
                <th className="text-right text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map(r => (
                <tr key={r.request_id} className="border-t border-hairline align-top">
                  <td className="py-3 pr-3 w-[100px] text-ink-soft">{formatShortDate(r.request_at)}</td>
                  <td className="py-3 pr-3">
                    <Link to={`/clients/${r.client_id}`} className="text-terracotta font-medium">
                      {r.client_name}
                    </Link>
                    {r.client_request_note && (
                      <div className="text-xs text-ink-soft italic mt-1">"{r.client_request_note}"</div>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <div className="text-ink">{r.agency_name ?? '—'}</div>
                    {r.caseworker_name && <div className="text-xs text-ink-soft">{r.caseworker_name}</div>}
                  </td>
                  <td className="py-3 pr-3 text-ink-soft">{r.item_count}</td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <Link
                      to={`/requests/${r.request_id}`}
                      className="text-terracotta hover:underline text-sm mr-3"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => approveMut.mutate(r.request_id)}
                      disabled={approveMut.isPending}
                      className="px-3 py-1.5 bg-sage text-paper text-xs rounded hover:bg-sage-deep disabled:opacity-50 mr-2"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => { setRejecting(r.request_id); setRejectNote(''); }}
                      className="px-3 py-1.5 bg-terracotta-soft text-terracotta-deep text-xs rounded hover:bg-terracotta hover:text-paper"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rejecting !== null && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50">
          <div className="bg-paper rounded-md max-w-md w-full p-5 shadow-lg">
            <h3 className="font-display font-medium text-lg mb-3">Reject request</h3>
            <p className="text-sm text-ink-soft mb-3">
              The agency will see this note in their portal. Be brief and constructive.
            </p>
            <textarea
              rows={4}
              autoFocus
              className="field-input font-sans w-full"
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              placeholder="e.g. We cannot accept additional referrals from your agency this month — please retry in October."
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setRejecting(null)} className="btn-ghost">Cancel</button>
              <button
                onClick={() => {
                  rejectMut.mutate({ id: rejecting, note: rejectNote }, {
                    onSuccess: () => setRejecting(null),
                  });
                }}
                disabled={rejectMut.isPending || !rejectNote.trim()}
                className="px-4 py-2 bg-terracotta text-paper rounded disabled:opacity-50"
              >
                {rejectMut.isPending ? 'Rejecting…' : 'Reject request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
