/**
 * Issue detail — full context for one reported issue: description,
 * screenshot, page URL, browser, reproduce steps, expected vs actual.
 * Developer can transition status (open → investigating → resolved →
 * closed) and write resolution notes.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost, apiPut, formatLongDate } from '../../lib/api.ts';
import { PageHeader, Loading, ErrorBox, StatusPill } from '../../components/ui.tsx';
import { SeverityPill } from './DevIssues.tsx';

type Status = 'open' | 'investigating' | 'resolved' | 'closed';
type Severity = 'low' | 'medium' | 'high' | 'critical';

interface IssueDetail {
  issue_id: number;
  title: string;
  description: string;
  severity: Severity;
  status: Status;
  page_url: string | null;
  page_title: string | null;
  user_agent: string | null;
  viewport_width: number | null;
  viewport_height: number | null;
  steps_to_reproduce: string | null;
  expected_behavior: string | null;
  actual_behavior: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  reporter_username: string | null;
  assignee_username: string | null;
  has_screenshot: boolean;
}

export function DevIssueDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery<IssueDetail>({
    queryKey: ['dev-issue', id],
    queryFn: () => apiGet(`/api/issues/${id}`),
  });

  const [resolutionNotes, setResolutionNotes] = useState('');
  useEffect(() => { if (data?.resolution_notes != null) setResolutionNotes(data.resolution_notes); }, [data?.resolution_notes]);

  const updateMut = useMutation({
    mutationFn: (body: { status?: Status; severity?: Severity; resolution_notes?: string }) => apiPut(`/api/issues/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dev-issue', id] });
      qc.invalidateQueries({ queryKey: ['dev-issues'] });
    },
    onError: (e: any) => window.alert(e?.message ?? 'Update failed'),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiDelete(`/api/issues/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dev-issues'] }); navigate('/dev/issues'); },
    onError: (e: any) => window.alert(e?.message ?? 'Delete failed'),
  });

  const broadcastMut = useMutation({
    mutationFn: (msg: string) => apiPost('/api/broadcasts', {
      message: msg,
      kind: 'refresh_required',
      related_issue_id: Number(id),
    }),
    onSuccess: () => window.alert('Broadcast sent. Every signed-in user will see the banner.'),
    onError: (e: any) => window.alert(e?.message ?? 'Broadcast failed'),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;

  return (
    <>
      <PageHeader
        title={`Issue #${data.issue_id}`}
        subtitle={data.title}
        actions={
          <>
            <Link to="/dev/issues" className="text-xs text-ink-soft hover:text-terracotta">← All issues</Link>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Delete issue #${data.issue_id}? This removes the screenshot and audit history.`)) {
                  deleteMut.mutate();
                }
              }}
              className="text-xs text-terracotta hover:text-terracotta-deep"
            >Delete</button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* Main panel */}
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-baseline justify-between border-b border-hairline pb-2.5 mb-3 flex-wrap gap-2">
              <h2 className="font-display text-lg m-0">{data.title}</h2>
              <div className="flex gap-2">
                <SeverityPill severity={data.severity} />
                <StatusPill status={data.status} />
              </div>
            </div>
            <Section label="What happened">
              <pre className="text-sm text-ink whitespace-pre-wrap font-sans">{data.description}</pre>
            </Section>
            {data.expected_behavior && (
              <Section label="Expected">
                <pre className="text-sm text-ink whitespace-pre-wrap font-sans">{data.expected_behavior}</pre>
              </Section>
            )}
            {data.actual_behavior && (
              <Section label="Actual">
                <pre className="text-sm text-ink whitespace-pre-wrap font-sans">{data.actual_behavior}</pre>
              </Section>
            )}
            {data.steps_to_reproduce && (
              <Section label="Reproduce">
                <pre className="text-xs text-ink whitespace-pre-wrap font-mono bg-cream/40 p-2 rounded">{data.steps_to_reproduce}</pre>
              </Section>
            )}
          </div>

          {data.has_screenshot && (
            <div className="card">
              <div className="card-head"><h3 className="font-display font-medium text-base m-0">Screenshot</h3></div>
              <a href={`/api/issues/${id}/screenshot`} target="_blank" rel="noopener noreferrer" title="Open full size in new tab">
                <img src={`/api/issues/${id}/screenshot`} alt="Reported state" className="max-w-full border border-hairline rounded" />
              </a>
              <div className="text-[11px] text-ink-faint mt-2">Click to open at full size in a new tab.</div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card">
            <div className="card-head" style={{ marginBottom: 10, paddingBottom: 8 }}>
              <h3 className="font-display font-medium text-sm m-0">Triage</h3>
            </div>
            <div className="mb-3">
              <label className="field-label">Status</label>
              <select
                className="field-input"
                value={data.status}
                onChange={e => updateMut.mutate({ status: e.target.value as Status })}
                disabled={updateMut.isPending}
              >
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="field-label">Severity</label>
              <select
                className="field-input"
                value={data.severity}
                onChange={e => updateMut.mutate({ severity: e.target.value as Severity })}
                disabled={updateMut.isPending}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="field-label">Resolution notes</label>
              <textarea
                className="field-input"
                rows={4}
                value={resolutionNotes}
                onChange={e => setResolutionNotes(e.target.value)}
                onBlur={() => {
                  if (resolutionNotes !== (data.resolution_notes ?? '')) {
                    updateMut.mutate({ resolution_notes: resolutionNotes });
                  }
                }}
                placeholder="What you found, what you changed, follow-up needed."
              />
            </div>
            <div className="mt-3 pt-3 border-t border-hairline">
              <button
                type="button"
                onClick={() => {
                  const msg = window.prompt(
                    'Broadcast message:',
                    'We just deployed a fix for an issue. Please save your work and refresh the page to pick up the new version.',
                  );
                  if (msg) broadcastMut.mutate(msg);
                }}
                disabled={broadcastMut.isPending}
                className="btn-primary w-full text-xs disabled:opacity-60"
              >Notify all users to refresh</button>
              <div className="text-[11px] text-ink-faint mt-1">
                Posts a banner everyone sees on every page until they dismiss it.
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head" style={{ marginBottom: 10, paddingBottom: 8 }}>
              <h3 className="font-display font-medium text-sm m-0">Context</h3>
            </div>
            <Detail label="Filed by">{data.reporter_username ?? '—'}</Detail>
            <Detail label="Assignee">{data.assignee_username ?? '—'}</Detail>
            <Detail label="Filed">{formatLongDate(data.created_at)}</Detail>
            {data.resolved_at && <Detail label="Resolved">{formatLongDate(data.resolved_at)}</Detail>}
            <Detail label="Page">
              {data.page_url ? (
                <a href={data.page_url} className="text-terracotta hover:text-terracotta-deep text-[11px] break-all">
                  {new URL(data.page_url, window.location.origin).pathname}{new URL(data.page_url, window.location.origin).search}
                </a>
              ) : '—'}
            </Detail>
            <Detail label="Viewport">{data.viewport_width != null ? `${data.viewport_width} × ${data.viewport_height}` : '—'}</Detail>
            <Detail label="Browser">
              <span className="text-[10px] text-ink-soft break-all">{data.user_agent ?? '—'}</span>
            </Detail>
          </div>
        </div>
      </div>
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="text-[10px] uppercase tracking-widest text-ink-faint font-medium mb-0.5">{label}</div>
      {children}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-2 py-1 text-xs">
      <div className="text-ink-faint uppercase tracking-wider text-[10px] font-medium">{label}</div>
      <div className="text-ink break-words">{children}</div>
    </div>
  );
}
