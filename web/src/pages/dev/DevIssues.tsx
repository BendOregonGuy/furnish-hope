/**
 * Developer console — list every issue reported via the in-app
 * "Report issue" button, with filters and a detail panel.
 *
 * Only visible to users with is_admin && is_developer (enforced by
 * requireDeveloper in the API and by RequireDeveloper in the router).
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet, formatShortDate } from '../../lib/api.ts';
import { PageHeader, Loading, ErrorBox, EmptyState, StatusPill } from '../../components/ui.tsx';

type Status = 'open' | 'investigating' | 'resolved' | 'closed' | 'any';
type Severity = 'low' | 'medium' | 'high' | 'critical';

interface IssueRow {
  issue_id: number;
  title: string;
  severity: Severity;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  page_url: string | null;
  viewport_width: number | null;
  viewport_height: number | null;
  created_at: string;
  resolved_at: string | null;
  reporter_username: string | null;
  reporter_display_name: string | null;
  assignee_username: string | null;
  has_screenshot: boolean;
}

export function DevIssues() {
  const [status, setStatus] = useState<Status>('open');
  const [severity, setSeverity] = useState<Severity | 'any'>('any');

  const { data, isLoading, error } = useQuery<IssueRow[]>({
    queryKey: ['dev-issues', status, severity],
    queryFn: () => apiGet('/api/issues', {
      status: status === 'any' ? undefined : status,
      severity: severity === 'any' ? undefined : severity,
    }),
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });

  return (
    <>
      <PageHeader
        helpSection="developer-tools-console"
        title="Issues"
        emphasis="reported"
        subtitle="Issues filed from inside the app via the Report issue button. Triage by status, investigate the screenshot + page context, mark resolved when done."
        actions={
          <Link to="/dev/broadcasts/new" className="btn-primary text-xs py-1.5">
            + Broadcast to users
          </Link>
        }
      />

      <div className="card mb-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="field-label">Status</label>
            <select className="field-input" value={status} onChange={e => setStatus(e.target.value as Status)}>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
              <option value="any">All</option>
            </select>
          </div>
          <div>
            <label className="field-label">Severity</label>
            <select className="field-input" value={severity} onChange={e => setSeverity(e.target.value as any)}>
              <option value="any">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {isLoading && <Loading />}
      {error && <ErrorBox error={error} />}

      <div className="card">
        {data && data.length === 0 && (
          <EmptyState
            title="No issues match"
            hint="Either no one's reported anything, or your filters are too narrow."
          />
        )}
        {data && data.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-cream">
              <tr>
                <Th>#</Th>
                <Th>Title</Th>
                <Th>Severity</Th>
                <Th>Status</Th>
                <Th>Page</Th>
                <Th>Reporter</Th>
                <Th>Filed</Th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.issue_id} className="border-t border-hairline hover:bg-terracotta/[0.025]">
                  <td className="px-4 py-2.5 text-xs">
                    <Link to={`/dev/issues/${row.issue_id}`} className="text-terracotta font-medium">
                      #{row.issue_id}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link to={`/dev/issues/${row.issue_id}`} className="text-ink hover:text-terracotta font-medium">
                      {row.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5"><SeverityPill severity={row.severity} /></td>
                  <td className="px-4 py-2.5"><StatusPill status={row.status} /></td>
                  <td className="px-4 py-2.5 text-xs text-ink-soft truncate max-w-[260px]">
                    {row.page_url ? new URL(row.page_url, window.location.origin).pathname : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-ink-soft">
                    {row.reporter_display_name ?? row.reporter_username ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-ink-soft whitespace-nowrap">
                    {formatShortDate(row.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-widest text-ink-faint font-medium">{children}</th>;
}

export function SeverityPill({ severity }: { severity: Severity }) {
  const cls =
    severity === 'critical' ? 'pill-terra' :
    severity === 'high'     ? 'pill-gold' :
    severity === 'medium'   ? 'pill-muted' :
                              'pill-slate';
  return <span className={`pill ${cls}`}>{severity}</span>;
}
