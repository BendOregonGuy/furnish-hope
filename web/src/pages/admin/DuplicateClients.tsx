/**
 * Admin queue for potential duplicate clients flagged by the nightly
 * dedup scan. Two layers:
 *   - Queue view: list pending pairs, score, reasons, "Review" button.
 *   - Compare view: side-by-side data; admin picks which side to KEEP and
 *     either confirms the merge or marks the pair as not a duplicate.
 *
 * The merge transaction lives in the API; this page just orchestrates it.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, formatShortDate } from '../../lib/api.ts';
import { PageHeader, Loading, ErrorBox } from '../../components/ui.tsx';

interface QueueRow {
  potential_duplicate_id: number;
  client_id_a: number;
  client_id_b: number;
  name_a: string | null;
  name_b: string | null;
  match_score: number;
  match_reasons: string;
  detected_at: string;
}

interface ClientSide {
  client_id: number;
  name: string;
  birth_date: string | null;
  mobile_phone: string | null;
  home_phone: string | null;
  email: string | null;
  address: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  postalcode: string | null;
  referring_agencies: string | null;
  client_types: string[];
  referral_count: number;
  request_count: number;
  visit_count: number;
  delivery_count: number;
}

interface ScanSummary {
  scanned_pairs: number;
  newly_flagged: number;
  threshold: number;
  duration_ms: number;
}

export function DuplicateClients() {
  const qc = useQueryClient();
  const { data: queue, isLoading, error } = useQuery<QueueRow[]>({
    queryKey: ['duplicate-queue'],
    queryFn: () => apiGet('/api/admin/duplicates'),
  });

  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [scanResult, setScanResult]   = useState<ScanSummary | null>(null);

  const scanMut = useMutation({
    mutationFn: () => apiPost<ScanSummary>('/api/admin/duplicates/scan', {}),
    onSuccess: (r) => {
      setScanResult(r);
      qc.invalidateQueries({ queryKey: ['duplicate-queue'] });
    },
  });

  if (isLoading) return <Loading />;
  if (error)     return <ErrorBox error={error} />;

  return (
    <>
      <PageHeader
        title="Potential duplicate clients"
        subtitle="Pairs flagged by the nightly scan. Review each to merge or mark as distinct."
      />

      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => scanMut.mutate()}
          disabled={scanMut.isPending}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {scanMut.isPending ? 'Scanning…' : 'Run scan now'}
        </button>
        {scanResult && (
          <span className="text-xs text-ink-soft">
            Scanned {scanResult.scanned_pairs} pair{scanResult.scanned_pairs === 1 ? '' : 's'} at ≥{scanResult.threshold}% threshold; flagged {scanResult.newly_flagged} new ({scanResult.duration_ms}ms).
          </span>
        )}
      </div>

      {!queue || queue.length === 0 ? (
        <div className="card text-center py-12 text-ink-faint">
          <div className="text-2xl mb-2">✓</div>
          <div className="text-sm">No potential duplicates awaiting review.</div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="card-head">
            <h3 className="font-display font-medium text-[17px] m-0">{queue.length} pending</h3>
            <span className="text-xs text-ink-faint">Highest score first</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Score</th>
                <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Match</th>
                <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Why flagged</th>
                <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Detected</th>
                <th className="text-right text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {queue.map(r => (
                <tr key={r.potential_duplicate_id} className="border-t border-hairline align-top">
                  <td className="py-3 pr-3 w-[80px] font-medium">{r.match_score}%</td>
                  <td className="py-3 pr-3">
                    <Link to={`/clients/${r.client_id_a}`} className="text-terracotta">{r.name_a ?? `#${r.client_id_a}`}</Link>
                    <span className="text-ink-faint"> ↔ </span>
                    <Link to={`/clients/${r.client_id_b}`} className="text-terracotta">{r.name_b ?? `#${r.client_id_b}`}</Link>
                  </td>
                  <td className="py-3 pr-3 text-ink-soft text-xs">{r.match_reasons}</td>
                  <td className="py-3 pr-3 text-xs text-ink-soft whitespace-nowrap">{formatShortDate(r.detected_at)}</td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => setReviewingId(r.potential_duplicate_id)}
                      className="px-3 py-1.5 bg-sage text-paper text-xs rounded hover:bg-sage-deep"
                    >
                      Review →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reviewingId !== null && (
        <CompareModal id={reviewingId} onClose={() => setReviewingId(null)} />
      )}
    </>
  );
}

/* ====================================================================== */
/*  Compare modal — side by side, KEEP toggle, merge action               */
/* ====================================================================== */

function CompareModal({ id, onClose }: { id: number; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery<{
    pair: QueueRow;
    a: ClientSide;
    b: ClientSide;
  }>({
    queryKey: ['duplicate', id],
    queryFn: () => apiGet(`/api/admin/duplicates/${id}`),
  });

  // Which side does the admin want to KEEP? Defaults to the side with more
  // existing referrals/requests (more history = stronger anchor).
  const [keepSide, setKeepSide] = useState<'a' | 'b' | null>(null);

  const mergeMut = useMutation({
    mutationFn: ({ keep, merge }: { keep: number; merge: number }) =>
      apiPost(`/api/admin/duplicates/${id}/merge`, { keep_client_id: keep, merge_client_id: merge }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['duplicate-queue'] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      onClose();
    },
  });
  const notDupMut = useMutation({
    mutationFn: () => apiPost(`/api/admin/duplicates/${id}/not-duplicate`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['duplicate-queue'] });
      onClose();
    },
  });

  if (isLoading) {
    return (
      <Modal onClose={onClose}>
        <Loading />
      </Modal>
    );
  }
  if (error || !data) {
    return (
      <Modal onClose={onClose}>
        <ErrorBox error={error ?? new Error('No data')} />
      </Modal>
    );
  }

  const { pair, a, b } = data;
  // First-time entry: default-keep the row with more history.
  const initialKeep: 'a' | 'b' =
    (a.referral_count + a.request_count + a.visit_count) >=
    (b.referral_count + b.request_count + b.visit_count) ? 'a' : 'b';
  const effectiveKeep = keepSide ?? initialKeep;

  const keep = effectiveKeep === 'a' ? a : b;
  const merge = effectiveKeep === 'a' ? b : a;

  function commitMerge() {
    if (!window.confirm(
      `Merge client #${merge.client_id} (${merge.name}) INTO client #${keep.client_id} (${keep.name})?\n\n` +
      'This will move every referral, request, visit, and delivery to the kept client, then delete the merged one. Cannot be undone.',
    )) return;
    mergeMut.mutate({ keep: keep.client_id, merge: merge.client_id });
  }

  return (
    <Modal onClose={onClose}>
      <div className="p-5">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="font-display text-xl font-medium m-0">Review potential duplicate</h2>
          <span className="text-sm text-ink-soft">{pair.match_score}% match · {pair.match_reasons}</span>
        </div>
        <p className="text-xs text-ink-soft mb-4">
          Toggle the <strong>Keep</strong> radio above each column. Merging moves every referral, request, visit, and delivery from the other side into the kept client, then deletes the kept-aside row.
        </p>

        <div className="grid grid-cols-[140px_1fr_1fr] gap-2 text-sm border border-hairline rounded">
          <div className="bg-cream-soft border-r border-hairline" />
          <div className={`p-3 border-r border-hairline ${effectiveKeep === 'a' ? 'bg-sage-soft' : 'bg-paper'}`}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="keep" checked={effectiveKeep === 'a'} onChange={() => setKeepSide('a')} />
              <span className="font-medium">Keep #{a.client_id}</span>
            </label>
          </div>
          <div className={`p-3 ${effectiveKeep === 'b' ? 'bg-sage-soft' : 'bg-paper'}`}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="keep" checked={effectiveKeep === 'b'} onChange={() => setKeepSide('b')} />
              <span className="font-medium">Keep #{b.client_id}</span>
            </label>
          </div>

          <Row label="Name"     a={a.name}                                              b={b.name} />
          <Row label="Born"     a={a.birth_date ?? '—'}                                 b={b.birth_date ?? '—'} />
          <Row label="Mobile"   a={a.mobile_phone ?? '—'}                               b={b.mobile_phone ?? '—'} />
          <Row label="Email"    a={a.email ?? '—'}                                      b={b.email ?? '—'} />
          <Row label="Address"  a={addrLine(a)}                                         b={addrLine(b)} />
          <Row label="Types"    a={a.client_types.join(', ') || '—'}                    b={b.client_types.join(', ') || '—'} />
          <Row label="Agencies" a={a.referring_agencies ?? '—'}                         b={b.referring_agencies ?? '—'} />
          <Row label="Referrals" a={String(a.referral_count)}                           b={String(b.referral_count)} />
          <Row label="Requests"  a={String(a.request_count)}                            b={String(b.request_count)} />
          <Row label="Visits"    a={String(a.visit_count)}                              b={String(b.visit_count)} />
          <Row label="Deliveries" a={String(a.delivery_count)}                          b={String(b.delivery_count)} />
        </div>

        <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-hairline">
          <button
            onClick={() => notDupMut.mutate()}
            disabled={notDupMut.isPending}
            className="btn-ghost text-sm"
          >
            {notDupMut.isPending ? 'Saving…' : 'Not a duplicate'}
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
            <button
              onClick={commitMerge}
              disabled={mergeMut.isPending}
              className="px-4 py-2 bg-terracotta text-paper rounded text-sm disabled:opacity-50"
            >
              {mergeMut.isPending
                ? 'Merging…'
                : `Merge ${merge.name} → ${keep.name}`}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, a, b }: { label: string; a: string; b: string }) {
  const different = a !== b;
  return (
    <>
      <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-ink-faint font-medium border-t border-hairline bg-cream-soft">{label}</div>
      <div className={`px-3 py-2 border-t border-hairline border-r ${different ? 'text-ink' : 'text-ink-soft'}`}>{a}</div>
      <div className={`px-3 py-2 border-t border-hairline ${different ? 'text-ink' : 'text-ink-soft'}`}>{b}</div>
    </>
  );
}

function addrLine(c: ClientSide): string {
  if (!c.address) return '—';
  const street = c.address2 ? `${c.address}, ${c.address2}` : c.address;
  const csz = [c.city, c.state, c.postalcode].filter(Boolean).join(', ');
  return csz ? `${street} · ${csz}` : street;
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-5" onClick={onClose}>
      <div className="bg-paper rounded-md max-w-3xl w-full max-h-[90vh] overflow-auto shadow-lg" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
