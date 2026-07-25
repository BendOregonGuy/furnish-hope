import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiDelete, apiGet, formatShortDate, formatLongDate } from '../lib/api.ts';
import { useAuth } from '../lib/auth.tsx';
import { Avatar, Loading, ErrorBox, StatusPill } from '../components/ui.tsx';
import { EmailWidget } from '../components/email/EmailWidget.tsx';
import { AttachmentsWidget } from '../components/attachments/AttachmentsWidget.tsx';

type ClientDetailData = {
  client: any;
  requests: Array<{
    request_id: number;
    request_at: string;
    client_request_note: string | null;
    item_count: number;
    matched_count: number;
  }>;
  prevId: number | null;
  nextId: number | null;
};

interface ClientVisitRow {
  client_visit_id: number;
  visit_date: string;
  visit_mode: string;
  visit_status: string;
  host_name: string | null;
  facility_name: string | null;
}

interface ReferralRow {
  referral_id: number;
  referral_date: string;
  referral_note: string | null;
  agency_id: number;
  agency_name: string;
  agency_contact_id: number;
  caseworker_name: string;
  caseworker_email: string | null;
  caseworker_phone: string | null;
  requests: Array<{
    request_id: number;
    request_at: string;
    review_status: string;
    item_count: number;
  }>;
}

interface DuplicateMatch {
  client_id: number;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  mobile_phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  match_score: number;
  match_reasons: string;
}

export function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [dupResults, setDupResults] = useState<DuplicateMatch[] | null>(null);
  const dupCheckMut = useMutation({
    mutationFn: () => apiGet<DuplicateMatch[]>(`/api/clients/${id}/check-duplicates`),
    onSuccess: (rows) => setDupResults(rows),
  });

  const { data, isLoading, error } = useQuery<ClientDetailData>({
    queryKey: ['client', id],
    queryFn: () => apiGet(`/api/clients/${id}`),
  });

  const { data: visits } = useQuery<ClientVisitRow[]>({
    queryKey: ['client-visits', id],
    queryFn: () => apiGet(`/api/visits`, { client_id: id }),
    enabled: !!id,
  });

  const { data: referrals } = useQuery<ReferralRow[]>({
    queryKey: ['client-referrals', id],
    queryFn: () => apiGet(`/api/clients/${id}/referrals`),
    enabled: !!id,
  });

  const deleteMut = useMutation({
    mutationFn: () => apiDelete(`/api/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      navigate('/clients');
    },
    onError: (err: any) => window.alert(err.message ?? 'Delete failed'),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;

  const c = data.client;
  const fullName = `${c.first_name} ${c.middle_name ?? ''} ${c.last_name}`.replace(/\s+/g, ' ').trim();

  function handleDelete() {
    const ok = window.confirm(`Permanently delete ${fullName}? This will also remove their contact and address records. This cannot be undone.`);
    if (ok) deleteMut.mutate();
  }

  return (
    <>
      {/* Top nav bar */}
      <div className="mb-5 flex items-center justify-between gap-3 flex-wrap bg-paper border border-hairline rounded-md px-3 py-2">
        <div className="flex items-center gap-3 flex-wrap">
          <Link to="/clients" className="text-xs text-ink-soft hover:text-terracotta">← All clients</Link>
          <span className="text-hairline-strong">•</span>
          {data.prevId ? (
            <Link to={`/clients/${data.prevId}`} className="text-xs text-ink-soft hover:text-terracotta">← Previous</Link>
          ) : (
            <span className="text-xs text-ink-faint opacity-40 cursor-not-allowed" title="No previous client">← Previous</span>
          )}
          {data.nextId ? (
            <Link to={`/clients/${data.nextId}`} className="text-xs text-ink-soft hover:text-terracotta">Next →</Link>
          ) : (
            <span className="text-xs text-ink-faint opacity-40 cursor-not-allowed" title="No next client">Next →</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {user?.is_admin && (
            <button
              onClick={() => dupCheckMut.mutate()}
              disabled={dupCheckMut.isPending}
              className="text-xs text-ink-soft hover:text-terracotta border border-hairline-strong px-3 py-1 rounded-md hover:border-terracotta disabled:opacity-50"
              title="Search the rest of the client database for likely duplicates of this household"
            >
              {dupCheckMut.isPending ? 'Checking…' : 'Check for duplicates'}
            </button>
          )}
          <Link
            to="/clients/new"
            className="text-xs text-ink-soft hover:text-terracotta border border-hairline-strong px-3 py-1 rounded-md hover:border-terracotta"
          >
            + New client
          </Link>
          <Link to={`/clients/${id}/edit`} className="btn-primary text-xs py-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </Link>
        </div>
      </div>

      {/* Header */}
      {dupResults !== null && (
        <div className={`mb-5 p-3 rounded border-l-4 ${dupResults.length === 0 ? 'bg-sage-soft border-sage' : 'bg-gold-soft border-gold'}`}>
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-sm">
              {dupResults.length === 0 ? (
                <span className="text-ink">No likely duplicates found in the rest of the database.</span>
              ) : (
                <>
                  <span className="font-medium text-ink">
                    {dupResults.length} possible duplicate{dupResults.length === 1 ? '' : 's'} found.
                  </span>
                  <ul className="mt-2 space-y-1">
                    {dupResults.map(m => (
                      <li key={m.client_id} className="text-xs">
                        <Link to={`/clients/${m.client_id}`} className="text-terracotta">
                          {m.first_name} {m.last_name}
                        </Link>
                        <span className="text-ink-soft"> · {m.match_score}% · {m.match_reasons}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="text-xs text-ink-soft mt-2">
                    Tip: Run a scan from <Link to="/admin/duplicate-clients" className="text-terracotta hover:underline">Duplicate clients</Link> to queue these for merge.
                  </div>
                </>
              )}
            </div>
            <button onClick={() => setDupResults(null)} className="text-ink-faint text-xs">Dismiss</button>
          </div>
        </div>
      )}

      <div className="flex gap-5 p-5 bg-cream border border-hairline rounded-[10px] mb-6">
        <Avatar name={fullName} size="lg" />
        <div className="flex-1">
          <div className="flex items-baseline gap-2 mb-1 flex-wrap">
            <div className="font-display text-2xl font-medium">{fullName}</div>
            {(Array.isArray(c.client_types) && c.client_types.length > 0
              ? c.client_types
              : [c.client_type]
            ).filter(Boolean).map((t: string) => (
              <span key={t} className="pill pill-terra">{t}</span>
            ))}
            <StatusPill status={c.client_status} />
          </div>
          <div className="flex gap-4 text-sm text-ink-soft flex-wrap">
            {c.mobile_phone && <span>{c.mobile_phone}</span>}
            {c.email && <><span>·</span><span>{c.email}</span></>}
            {c.address && <><span>·</span><span>{c.address}{c.address2 ? `, ${c.address2}` : ''}, {c.city}</span></>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-5">
        <div className="space-y-4">
          {/* Email widget — your messages with this client */}
          <EmailWidget email={c.email ?? null} displayName={fullName} />

          <div className="card">
            <div className="card-head">
              <h3 className="font-display font-medium text-[17px] m-0">Visits</h3>
              <Link
                to={`/visits/new?client_id=${c.client_id}`}
                className="btn-primary text-xs py-1.5"
              >+ Schedule visit</Link>
            </div>
            {!visits || visits.length === 0 ? (
              <div className="text-center text-ink-faint py-6 text-sm">No visits scheduled.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Date</th>
                    <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Mode</th>
                    <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Host</th>
                    <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.slice(0, 8).map(v => (
                    <tr key={v.client_visit_id} className="border-t border-hairline hover:bg-terracotta/[0.025]">
                      <td className="py-2 pr-3">
                        <Link to={`/visits/${v.client_visit_id}`} className="text-terracotta font-medium text-xs">
                          {formatShortDate(v.visit_date)}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-xs text-ink-soft">{v.visit_mode}</td>
                      <td className="py-2 pr-3 text-xs text-ink-soft">{v.host_name ?? '—'}</td>
                      <td className="py-2 text-xs"><StatusPill status={v.visit_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
          <div className="card-head">
            <h3 className="font-display font-medium text-[17px] m-0">Packing lists</h3>
            <span className="text-xs text-ink-faint">{data.requests.length} total</span>
          </div>

          {data.requests.length === 0 ? (
            <div className="text-center text-ink-faint py-10 text-sm">No requests yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Date</th>
                  <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Note</th>
                  <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Progress</th>
                </tr>
              </thead>
              <tbody>
                {data.requests.map(r => (
                  <tr key={r.request_id} className="border-t border-hairline hover:bg-terracotta/[0.025]">
                    <td className="py-3 pr-3 w-[100px]">
                      <Link to={`/requests/${r.request_id}`} className="text-terracotta font-medium">
                        {formatShortDate(r.request_at)}
                      </Link>
                    </td>
                    <td className="py-3 pr-3 text-ink-soft text-xs truncate max-w-md">
                      {r.client_request_note ?? '—'}
                    </td>
                    <td className="py-3 text-xs">
                      <span className="text-ink-soft">{r.matched_count}</span>
                      <span className="text-ink-faint"> / {r.item_count} items matched</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          </div>

          {referrals && referrals.length > 0 && (
            <div className="card">
              <div className="card-head">
                <h3 className="font-display font-medium text-[17px] m-0">Referral history</h3>
                <span className="text-xs text-ink-faint">
                  {referrals.length} {referrals.length === 1 ? 'referral' : 'referrals'}
                  {referrals.length > 1 && (() => {
                    const agencies = new Set(referrals.map(r => r.agency_id));
                    return agencies.size > 1
                      ? ` from ${agencies.size} agencies`
                      : '';
                  })()}
                </span>
              </div>

              <ul className="divide-y divide-hairline">
                {referrals.map(r => (
                  <li key={r.referral_id} className="py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <div>
                        <div className="font-medium text-ink">
                          {r.agency_name}
                          <span className="text-ink-muted font-normal"> via {r.caseworker_name}</span>
                        </div>
                        {r.referral_note && (
                          <div className="text-xs text-ink-soft mt-0.5 italic">"{r.referral_note}"</div>
                        )}
                      </div>
                      <div className="text-xs text-ink-faint shrink-0">{formatShortDate(r.referral_date)}</div>
                    </div>
                    {r.requests.length > 0 && (
                      <div className="mt-2 pl-3 border-l-2 border-paper-deep space-y-1">
                        {r.requests.map(req => (
                          <div key={req.request_id} className="flex items-center gap-2 text-xs">
                            <Link to={`/requests/${req.request_id}`} className="text-terracotta hover:underline">
                              Request #{req.request_id}
                            </Link>
                            <span className="text-ink-faint">·</span>
                            <span className="text-ink-soft">{formatShortDate(req.request_at)}</span>
                            <span className="text-ink-faint">·</span>
                            <span className="text-ink-soft">{req.item_count} {req.item_count === 1 ? 'item' : 'items'}</span>
                            <StatusPill status={req.review_status.replace(/_/g, ' ')} />
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="card-head" style={{marginBottom:'10px', paddingBottom:'8px'}}>
              <h3 className="font-display font-medium text-sm m-0">Identity & demographics</h3>
            </div>
            <Detail label="Born" value={c.birth_date ? formatLongDate(c.birth_date) : '—'} />
            <Detail label="Gender" value={c.gender ?? '—'} />
            <Detail label="Ethnicity" value={c.ethnicity ?? '—'} />
            <Detail label="Status" value={c.citizen_status ?? '—'} />
          </div>

          <div className="card">
            <div className="card-head" style={{marginBottom:'10px', paddingBottom:'8px'}}>
              <h3 className="font-display font-medium text-sm m-0">Contact</h3>
            </div>
            <Detail label="Mobile" value={c.mobile_phone ?? '—'} />
            <Detail label="Home" value={c.home_phone ?? '—'} />
            <Detail label="Other" value={c.other_phone ?? '—'} />
            <Detail label="Email" value={c.email ?? '—'} />
          </div>

          {c.address && (
            <div className="card">
              <div className="card-head" style={{marginBottom:'10px', paddingBottom:'8px'}}>
                <h3 className="font-display font-medium text-sm m-0">Address</h3>
              </div>
              <Detail label="Street" value={c.address + (c.address2 ? `, ${c.address2}` : '')} />
              <Detail label="City" value={`${c.city ?? '—'}${c.state ? `, ${c.state}` : ''}`} />
              <Detail label="ZIP" value={c.postalcode ?? '—'} />
            </div>
          )}

          <div className="card">
            <div className="card-head" style={{marginBottom:'10px', paddingBottom:'8px'}}>
              <h3 className="font-display font-medium text-sm m-0">Referral</h3>
            </div>
            <Detail label="Agency" value={c.referring_agency ?? '—'} />
            <Detail label="Caseworker" value={c.referring_caseworker ?? '—'} />
            <Detail label="Started" value={formatLongDate(c.start_date)} />
          </div>

          {/* Danger zone */}
          <button
            onClick={handleDelete}
            disabled={deleteMut.isPending}
            className="text-xs text-terracotta hover:text-terracotta-deep disabled:opacity-50 self-start"
          >
            {deleteMut.isPending ? 'Deleting…' : 'Delete this client'}
          </button>
        </div>
      </div>

      <div className="mt-5">
        <AttachmentsWidget entityType="client" entityId={c.client_id} />
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2 py-1.5 text-xs">
      <div className="text-ink-faint uppercase tracking-wider text-[10px] font-medium">{label}</div>
      <div className="text-ink">{value}</div>
    </div>
  );
}
