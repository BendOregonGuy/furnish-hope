import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiDelete, apiGet, formatShortDate, formatLongDate } from '../lib/api.ts';
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

export function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<ClientDetailData>({
    queryKey: ['client', id],
    queryFn: () => apiGet(`/api/clients/${id}`),
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
      <div className="flex gap-5 p-5 bg-cream border border-hairline rounded-[10px] mb-6">
        <Avatar name={fullName} size="lg" />
        <div className="flex-1">
          <div className="flex items-baseline gap-3.5 mb-1">
            <div className="font-display text-2xl font-medium">{fullName}</div>
            <span className="pill pill-terra">{c.client_type}</span>
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
            <h3 className="font-display font-medium text-[17px] m-0">Provisioning requests</h3>
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
