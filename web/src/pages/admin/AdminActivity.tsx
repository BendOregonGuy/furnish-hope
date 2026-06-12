/**
 * Activity log viewer. Same data as /admin/tbl_audit_log but enriched
 * (shows the actor's name, not just their user-account id) and with a
 * proper filter row + pagination — built for the case where the audit log
 * has hundreds or thousands of rows.
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { apiGet } from '../../lib/api.ts';
import { PageHeader, Loading, ErrorBox, EmptyState } from '../../components/ui.tsx';

const PAGE_SIZE = 50;

interface ActivityRow {
  audit_log_id: number;
  action_at: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entity_type: string;
  entity_id: number;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  user_account_id: number;
  actor_username: string | null;
  actor_name: string | null;
  actor_is_admin: boolean | null;
}

interface ActivityResponse { rows: ActivityRow[]; total: number; }

interface Facets {
  users: { id: number; label: string }[];
  entityTypes: string[];
  actions: string[];
}

export function AdminActivity() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [userId, setUserId] = useState('');
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(0);

  const { data: facets } = useQuery<Facets>({
    queryKey: ['admin', 'activity-facets'],
    queryFn: () => apiGet('/api/admin/activity/_facets'),
  });

  const { data, isLoading, error } = useQuery<ActivityResponse>({
    queryKey: ['admin', 'activity', from, to, userId, entityType, action, page],
    queryFn: () => apiGet('/api/admin/activity', {
      from: from || undefined,
      to: to || undefined,
      user_account_id: userId || undefined,
      entity_type: entityType || undefined,
      action: action || undefined,
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    }),
  });

  function resetFilters() {
    setFrom(''); setTo(''); setUserId(''); setEntityType(''); setAction(''); setPage(0);
  }

  const filtersActive = !!(from || to || userId || entityType || action);
  const total = data?.total ?? 0;
  const showingFrom = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const showingTo = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <>
      <PageHeader
        helpSection="admin"
        title="Activity"
        emphasis="log"
        subtitle="Every create / update / delete across the system. Filter by who, when, and what."
      />

      {/* Filters */}
      <div className="card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="field-label">From</label>
            <input type="date" className="field-input" value={from}
              onChange={e => { setFrom(e.target.value); setPage(0); }} />
          </div>
          <div>
            <label className="field-label">To</label>
            <input type="date" className="field-input" value={to}
              onChange={e => { setTo(e.target.value); setPage(0); }} />
          </div>
          <div>
            <label className="field-label">User</label>
            <select className="field-input" value={userId}
              onChange={e => { setUserId(e.target.value); setPage(0); }}>
              <option value="">All users</option>
              {(facets?.users ?? []).map(u => (
                <option key={u.id} value={u.id}>{u.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Entity</label>
            <select className="field-input" value={entityType}
              onChange={e => { setEntityType(e.target.value); setPage(0); }}>
              <option value="">All tables</option>
              {(facets?.entityTypes ?? []).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Action</label>
            <div className="flex gap-1.5 mt-1.5">
              {['', 'CREATE', 'UPDATE', 'DELETE'].map(a => (
                <button
                  key={a || 'all'}
                  type="button"
                  onClick={() => { setAction(a); setPage(0); }}
                  className={
                    'text-[11px] px-2.5 py-1 rounded-full border transition ' +
                    (action === a
                      ? 'bg-ink text-paper border-ink'
                      : 'bg-paper text-ink-soft border-hairline-strong hover:border-ink')
                  }
                >
                  {a || 'All'}
                </button>
              ))}
            </div>
          </div>
        </div>
        {filtersActive && (
          <div className="mt-3 pt-3 border-t border-hairline flex justify-between items-center">
            <div className="text-xs text-ink-faint">
              {total.toLocaleString()} {total === 1 ? 'entry' : 'entries'} match
            </div>
            <button onClick={resetFilters} className="text-xs text-terracotta hover:text-terracotta-deep">
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="card p-0 overflow-hidden">
        {isLoading && <Loading />}
        {error && <ErrorBox error={error} />}
        {data && data.rows.length === 0 && (
          <EmptyState
            title={filtersActive ? 'No activity matches' : 'No activity yet'}
            hint={filtersActive ? 'Try widening the filters.' : 'Mutations from anywhere in the app land here.'}
          />
        )}
        {data && data.rows.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-cream">
              <tr>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>What</Th>
                <Th>On</Th>
                <Th>Field</Th>
                <Th>Change</Th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map(r => (
                <tr key={r.audit_log_id} className="border-t border-hairline hover:bg-terracotta/[0.025]">
                  <td className="px-5 py-2.5 text-xs whitespace-nowrap">
                    <div>{formatDate(r.action_at)}</div>
                    <div className="text-[10px] text-ink-faint">{formatTime(r.action_at)}</div>
                  </td>
                  <td className="px-5 py-2.5 text-sm">
                    <div className="font-medium">{r.actor_name ?? r.actor_username ?? '—'}</div>
                    {r.actor_is_admin && <span className="pill pill-gold text-[9px] py-0">Admin</span>}
                  </td>
                  <td className="px-5 py-2.5">
                    <span className={`pill ${actionPill(r.action)}`}>{r.action}</span>
                  </td>
                  <td className="px-5 py-2.5 text-xs">
                    <Link
                      to={`/admin/${r.entity_type}/${r.entity_id}`}
                      className="text-terracotta font-mono hover:underline"
                    >
                      {r.entity_type}#{r.entity_id}
                    </Link>
                  </td>
                  <td className="px-5 py-2.5 text-xs font-mono text-ink-soft">
                    {r.field_changed ?? '—'}
                  </td>
                  <td className="px-5 py-2.5 text-xs">
                    <ChangeCell oldValue={r.old_value} newValue={r.new_value} action={r.action} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pager */}
      {total > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-between text-xs text-ink-faint">
          <span>Showing {showingFrom.toLocaleString()}–{showingTo.toLocaleString()} of {total.toLocaleString()}</span>
          <div className="flex gap-2">
            <button
              className="btn-ghost text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={page === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
            >
              ← Previous
            </button>
            <button
              className="btn-ghost text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={(page + 1) * PAGE_SIZE >= total}
              onClick={() => setPage(p => p + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium px-5 py-3">
      {children}
    </th>
  );
}

function ChangeCell({ oldValue, newValue, action }: { oldValue: string | null; newValue: string | null; action: string }) {
  if (action === 'CREATE') {
    return <span className="text-sage truncate inline-block max-w-md">+ {truncate(newValue)}</span>;
  }
  if (action === 'DELETE') {
    return <span className="text-terracotta-deep truncate inline-block max-w-md">− {truncate(oldValue)}</span>;
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-ink-faint line-through truncate max-w-[140px]">{truncate(oldValue, 30)}</span>
      <span className="text-ink-faint">→</span>
      <span className="text-ink truncate max-w-[200px]">{truncate(newValue, 60)}</span>
    </span>
  );
}

function truncate(s: string | null, max = 80): string {
  if (s === null || s === undefined) return '—';
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function actionPill(action: string): string {
  if (action === 'CREATE') return 'pill-sage';
  if (action === 'DELETE') return 'pill-terra';
  return 'pill-gold';
}
