/**
 * Program-Manager (and Admin) review queue for agency-partner
 * applications submitted via the public /apply-to-refer form.
 *
 * Layout: left column = queue list filtered by status (pending / all /
 * approved / rejected); right column = detail view for the selected
 * application with Approve and Reject actions. On approve, a stack of
 * invitation-preview cards appears — each has copyable subject + body
 * that the Program Manager pastes into the Agency_Onboarding@Furnish-
 * Hope.com Google group (until the FH mailbox is connected in prod).
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, formatShortDate } from '../lib/api.ts';
import { PageHeader, Loading, ErrorBox, StatusPill } from '../components/ui.tsx';

interface QueueRow {
  agency_application_id: number;
  agency_name: string;
  legal_name: string | null;
  main_email: string;
  main_phone: string | null;
  city: string | null;
  state: string | null;
  service_area: string | null;
  public_description: string | null;
  approx_clients_per_month: number | null;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  reviewed_at: string | null;
  rejection_note: string | null;
  approved_agency_id: number | null;
  caseworker_count: number;
  population_count: number;
}

interface Caseworker {
  agency_application_caseworker_id: number;
  first_name: string;
  last_name: string;
  title: string | null;
  email: string;
  phone: string | null;
  agency_contact_id: number | null;
}

interface Population {
  client_type_id: number;
  client_type: string;
}

interface Invitation {
  caseworker_invitation_id: number;
  email: string;
  status: 'pending' | 'sent' | 'accepted' | 'expired' | 'revoked';
  issued_at: string;
  expires_at: string;
  sent_at: string | null;
  accepted_at: string | null;
  agency_contact_id: number;
  user_account_id: number | null;
}

interface DetailPayload {
  application: QueueRow & Record<string, any>;
  caseworkers: Caseworker[];
  populations: Population[];
  invitations: Invitation[];
}

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

export function AgencyApplications() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: queue, isLoading, error } = useQuery<QueueRow[]>({
    queryKey: ['agency-applications', filter],
    queryFn: () => apiGet('/api/agencies/applications', { status: filter }),
  });

  // Auto-select the first pending row on first load
  const rows = queue ?? [];
  const currentId = selectedId ?? rows[0]?.agency_application_id ?? null;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['agency-applications'] });
    qc.invalidateQueries({ queryKey: ['agency-application-detail'] });
  };

  if (isLoading) return <Loading />;
  if (error)     return <ErrorBox error={error} />;

  return (
    <>
      <PageHeader
        title="Agency applications"
        subtitle="Prospective referring-partner applications submitted through /apply-to-refer."
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(['pending', 'approved', 'rejected', 'all'] as StatusFilter[]).map(s => (
          <button
            key={s}
            onClick={() => { setFilter(s); setSelectedId(null); }}
            className={
              filter === s
                ? 'px-3 py-1.5 text-sm rounded-full bg-terracotta text-paper'
                : 'px-3 py-1.5 text-sm rounded-full bg-cream text-ink-soft hover:bg-cream-deep'
            }
          >
            {s === 'all' ? 'All' : titleCase(s)}
            <span className="ml-1.5 text-xs opacity-70">
              {s === filter ? rows.length : ''}
            </span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card text-center py-12 text-ink-faint">
          <div className="text-2xl mb-2">✓</div>
          <div className="text-sm">
            {filter === 'pending' ? 'No applications awaiting review.' : `No ${filter} applications.`}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
          {/* Queue list */}
          <div className="space-y-2">
            {rows.map(r => (
              <button
                key={r.agency_application_id}
                onClick={() => setSelectedId(r.agency_application_id)}
                className={
                  'w-full text-left card p-3 border-l-4 ' +
                  (r.agency_application_id === currentId
                    ? 'border-terracotta bg-cream-soft'
                    : 'border-transparent hover:bg-cream/40')
                }
              >
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <div className="font-medium text-ink truncate">{r.agency_name}</div>
                  <StatusPill status={r.status === 'pending' ? 'new' : r.status} />
                </div>
                <div className="text-xs text-ink-soft truncate">
                  {r.city ?? '—'}{r.state ? `, ${r.state}` : ''} · {r.caseworker_count} caseworker{r.caseworker_count === 1 ? '' : 's'} · {r.population_count} population{r.population_count === 1 ? '' : 's'}
                </div>
                <div className="text-[10px] text-ink-faint mt-1">
                  Submitted {formatShortDate(r.submitted_at)}
                </div>
              </button>
            ))}
          </div>

          {/* Detail */}
          <div>
            {currentId
              ? <ApplicationDetail id={currentId} onChange={invalidate} />
              : <div className="card text-center py-10 text-ink-faint text-sm">Pick an application from the list.</div>}
          </div>
        </div>
      )}
    </>
  );
}

/* ================================================================== */
/*  Detail                                                             */
/* ================================================================== */

function ApplicationDetail({ id, onChange }: { id: number; onChange: () => void }) {
  const { data, isLoading, error } = useQuery<DetailPayload>({
    queryKey: ['agency-application-detail', id],
    queryFn: () => apiGet(`/api/agencies/applications/${id}`),
  });

  const approveMut = useMutation({
    mutationFn: () => apiPost<{ agency_id: number; invitations: Array<{ caseworker_invitation_id: number }> }>(
      `/api/agencies/applications/${id}/approve`, {},
    ),
    onSuccess: () => onChange(),
  });

  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const rejectMut = useMutation({
    mutationFn: (note: string) => apiPost(`/api/agencies/applications/${id}/reject`, { note }),
    onSuccess: () => { setShowRejectForm(false); setRejectNote(''); onChange(); },
  });

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox error={error ?? new Error('No data')} />;

  const app = data.application;

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-head">
          <div>
            <h2 className="font-display text-xl font-medium m-0">{app.agency_name}</h2>
            <div className="text-xs text-ink-faint mt-0.5">
              Submitted {formatShortDate(app.submitted_at)}
              {app.reviewed_at && <> · Reviewed {formatShortDate(app.reviewed_at)}</>}
            </div>
          </div>
          <StatusPill status={app.status === 'pending' ? 'new' : app.status} />
        </div>

        {app.status === 'pending' && (
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => approveMut.mutate()}
              disabled={approveMut.isPending}
              className="px-4 py-2 bg-sage text-paper text-sm rounded hover:bg-sage-deep disabled:opacity-50"
            >
              {approveMut.isPending ? 'Approving…' : 'Approve + invite caseworkers'}
            </button>
            <button
              onClick={() => setShowRejectForm(v => !v)}
              className="px-4 py-2 bg-terracotta-soft text-terracotta-deep text-sm rounded hover:bg-terracotta hover:text-paper"
            >
              {showRejectForm ? 'Cancel' : 'Reject…'}
            </button>
          </div>
        )}

        {showRejectForm && (
          <div className="p-3 bg-terracotta-soft/40 rounded mb-4">
            <label className="field-label">Rejection note (visible to the applicant)</label>
            <textarea
              rows={3}
              className="field-input font-sans"
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              placeholder="e.g. Overlaps too heavily with an existing partner in your service area. Try again in 6 months."
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={() => rejectMut.mutate(rejectNote)}
                disabled={rejectMut.isPending || !rejectNote.trim()}
                className="px-3 py-1.5 bg-terracotta text-paper text-sm rounded disabled:opacity-50"
              >
                {rejectMut.isPending ? 'Rejecting…' : 'Confirm reject'}
              </button>
            </div>
          </div>
        )}

        {app.status === 'rejected' && app.rejection_note && (
          <div className="p-3 bg-terracotta-soft rounded mb-4 text-sm text-terracotta-deep">
            <div className="font-medium mb-1">Rejection note</div>
            {app.rejection_note}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Row label="Legal name"    value={app.legal_name ?? '—'} />
          <Row label="EIN"           value={app.ein ?? '—'} />
          <Row label="Website"       value={app.website ?? '—'} />
          <Row label="Main phone"    value={app.main_phone ?? '—'} />
          <Row label="Main email"    value={app.main_email} />
          <Row label="Exec Director" value={app.executive_director_name ?? '—'} />
          <Row label="Address"       value={`${app.address_line1}${app.address_line2 ? ', ' + app.address_line2 : ''}, ${app.city}, ${app.state} ${app.postalcode}`} />
          <Row label="Service area"  value={app.service_area ?? '—'} />
          <Row label="Clients / mo"  value={app.approx_clients_per_month != null ? String(app.approx_clients_per_month) : '—'} />
        </div>

        {app.public_description && (
          <div className="mt-3">
            <div className="text-[10px] uppercase tracking-widest text-ink-faint font-medium mb-1">Description</div>
            <div className="text-sm">{app.public_description}</div>
          </div>
        )}
        {app.needs_filled && (
          <div className="mt-3">
            <div className="text-[10px] uppercase tracking-widest text-ink-faint font-medium mb-1">Needs typically filled</div>
            <div className="text-sm">{app.needs_filled}</div>
          </div>
        )}
        {app.other_info && (
          <div className="mt-3">
            <div className="text-[10px] uppercase tracking-widest text-ink-faint font-medium mb-1">Other info</div>
            <div className="text-sm">{app.other_info}</div>
          </div>
        )}

        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-widest text-ink-faint font-medium mb-1">Populations served</div>
          <div className="flex flex-wrap gap-1">
            {data.populations.length === 0
              ? <span className="text-ink-faint text-sm">None specified</span>
              : data.populations.map(p => (
                <span key={p.client_type_id} className="pill pill-terra text-[10px]">{p.client_type}</span>
              ))}
          </div>
        </div>
      </div>

      {/* Caseworkers */}
      <div className="card">
        <div className="card-head">
          <h3 className="font-display font-medium text-[15px] m-0">Caseworkers ({data.caseworkers.length})</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Name</th>
              <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Title</th>
              <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Email</th>
              <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Phone</th>
            </tr>
          </thead>
          <tbody>
            {data.caseworkers.map(cw => (
              <tr key={cw.agency_application_caseworker_id} className="border-t border-hairline">
                <td className="py-2 pr-3">{cw.first_name} {cw.last_name}</td>
                <td className="py-2 pr-3 text-ink-soft">{cw.title ?? '—'}</td>
                <td className="py-2 pr-3 font-mono text-xs">{cw.email}</td>
                <td className="py-2 text-ink-soft">{cw.phone ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invitations (post-approval) */}
      {data.invitations.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h3 className="font-display font-medium text-[15px] m-0">Caseworker invitations ({data.invitations.length})</h3>
            <span className="text-xs text-ink-faint">Copy each into the Agency_Onboarding@Furnish-Hope.com group email.</span>
          </div>
          <div className="space-y-2">
            {data.invitations.map(inv => (
              <InvitationCard key={inv.caseworker_invitation_id} appId={id} invitation={inv} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Invitation preview card                                            */
/* ================================================================== */

interface InvitationPreview {
  to: string;
  from: string;
  subject: string;
  plaintext: string;
  html: string;
  url: string;
  expires_at: string;
  status: string;
}

function InvitationCard({ appId, invitation }: { appId: number; invitation: Invitation }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<'body' | 'url' | null>(null);

  const { data: preview } = useQuery<InvitationPreview>({
    queryKey: ['invitation-preview', appId, invitation.caseworker_invitation_id],
    queryFn: () => apiGet(`/api/agencies/applications/${appId}/invitation-preview/${invitation.caseworker_invitation_id}`),
    enabled: open,
  });

  function copy(text: string, which: 'body' | 'url') {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div className="border border-hairline rounded p-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm">
          <span className="font-mono">{invitation.email}</span>
          <span className="text-ink-faint"> · </span>
          <StatusPill status={invitation.status === 'pending' ? 'new' : invitation.status} />
          <span className="ml-2 text-xs text-ink-faint">
            expires {formatShortDate(invitation.expires_at)}
          </span>
        </div>
        <button onClick={() => setOpen(v => !v)} className="text-xs text-terracotta hover:underline">
          {open ? 'Hide email' : 'Show email'}
        </button>
      </div>

      {open && preview && (
        <div className="mt-3 space-y-2">
          <div className="text-xs">
            <span className="text-ink-faint">To:</span> {preview.to}
            <span className="text-ink-faint ml-3">From:</span> {preview.from}
          </div>
          <div className="text-sm font-medium">{preview.subject}</div>
          <pre className="text-xs bg-cream-soft p-3 rounded whitespace-pre-wrap font-sans">{preview.plaintext}</pre>
          <div className="text-xs">
            <span className="text-ink-faint">Signup link: </span>
            <a href={preview.url} target="_blank" rel="noreferrer" className="text-terracotta underline break-all">{preview.url}</a>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => copy(`Subject: ${preview.subject}\n\n${preview.plaintext}`, 'body')}
              className="text-xs px-2 py-1 bg-sage text-paper rounded hover:bg-sage-deep"
            >
              {copied === 'body' ? '✓ Copied' : 'Copy subject + body'}
            </button>
            <button
              onClick={() => copy(preview.url, 'url')}
              className="text-xs px-2 py-1 bg-cream text-ink rounded hover:bg-cream-deep"
            >
              {copied === 'url' ? '✓ Copied' : 'Copy signup link'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Small helpers                                                      */
/* ================================================================== */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 py-1">
      <div className="text-[10px] uppercase tracking-widest text-ink-faint font-medium pt-0.5">{label}</div>
      <div className="text-ink">{value}</div>
    </div>
  );
}

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
