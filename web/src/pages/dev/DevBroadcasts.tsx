/**
 * Developer broadcast composer + history. Send a message that pops up as
 * a banner for every signed-in user on every page until they dismiss it.
 *
 * Three kinds:
 *   - info: green, just informational
 *   - warning: red, attention-grabbing
 *   - refresh_required: gold, includes a "Refresh now" button so users
 *     pick up a new app build with one click
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost, apiPut, formatLongDate } from '../../lib/api.ts';
import { PageHeader, Loading, ErrorBox, EmptyState } from '../../components/ui.tsx';

type Kind = 'info' | 'refresh_required' | 'warning';

interface BroadcastRow {
  broadcast_id: number;
  message: string;
  kind: Kind;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
  related_issue_id: number | null;
  created_by_username: string | null;
  dismissal_count: number;
}

export function DevBroadcasts() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery<BroadcastRow[]>({
    queryKey: ['dev-broadcasts'],
    queryFn: () => apiGet('/api/broadcasts'),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: number) => apiPut(`/api/broadcasts/${id}`, { is_active: false }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dev-broadcasts'] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => apiDelete(`/api/broadcasts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dev-broadcasts'] }),
  });

  return (
    <>
      <PageHeader
        helpSection="developer-tools-broadcasts"
        title="Broadcasts"
        emphasis=""
        subtitle="Send a banner message to every signed-in user. Use this to warn before a deploy, request a refresh after one, or note a known issue."
        actions={
          <Link to="/dev/broadcasts/new" className="btn-primary text-xs py-1.5">+ New broadcast</Link>
        }
      />

      {isLoading && <Loading />}
      {error && <ErrorBox error={error} />}

      {data && data.length === 0 && (
        <EmptyState title="No broadcasts yet" hint="Click + New broadcast to send the first one." />
      )}

      {data && data.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream">
              <tr>
                <Th>Kind</Th>
                <Th>Message</Th>
                <Th>Sent</Th>
                <Th>Active</Th>
                <Th>Dismissals</Th>
                <Th>{' '}</Th>
              </tr>
            </thead>
            <tbody>
              {data.map(b => (
                <tr key={b.broadcast_id} className="border-t border-hairline">
                  <td className="px-4 py-2.5"><KindPill kind={b.kind} /></td>
                  <td className="px-4 py-2.5 max-w-md whitespace-pre-wrap">{b.message}</td>
                  <td className="px-4 py-2.5 text-xs text-ink-soft whitespace-nowrap">
                    {formatLongDate(b.created_at)}
                    {b.created_by_username && <div className="text-[10px] text-ink-faint">by {b.created_by_username}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {b.is_active
                      ? <span className="pill pill-sage">active</span>
                      : <span className="pill pill-slate">deactivated</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-ink-soft">{b.dismissal_count}</td>
                  <td className="px-4 py-2.5 text-xs text-right whitespace-nowrap">
                    {b.is_active && (
                      <button type="button" onClick={() => deactivateMut.mutate(b.broadcast_id)} className="text-terracotta hover:text-terracotta-deep mr-3">
                        Deactivate
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Delete this broadcast permanently?')) deleteMut.mutate(b.broadcast_id);
                      }}
                      className="text-ink-faint hover:text-terracotta"
                    >Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  function Th({ children }: { children: React.ReactNode }) {
    return <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-widest text-ink-faint font-medium">{children}</th>;
  }
}

export function DevBroadcastForm() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [kind, setKind] = useState<Kind>('refresh_required');

  const createMut = useMutation({
    mutationFn: () => apiPost('/api/broadcasts', { message: message.trim(), kind }),
    onSuccess: () => navigate('/dev/broadcasts'),
    onError: (e: any) => window.alert(e?.message ?? 'Broadcast failed'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) { window.alert('Please enter a message.'); return; }
    createMut.mutate();
  }

  return (
    <>
      <PageHeader
        helpSection="developer-tools-broadcasts"
        title="New broadcast"
        subtitle="Composes a banner that appears at the top of every page for every signed-in user until they dismiss it."
        actions={<Link to="/dev/broadcasts" className="text-xs text-ink-soft hover:text-terracotta">← All broadcasts</Link>}
      />
      <form onSubmit={handleSubmit} className="card max-w-2xl space-y-4">
        <div>
          <label className="field-label">Kind</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
            <KindOption value="info" current={kind} onSelect={setKind} title="Info" hint="Green banner. Just informational." />
            <KindOption value="warning" current={kind} onSelect={setKind} title="Warning" hint="Red banner. For known issues or planned outages." />
            <KindOption value="refresh_required" current={kind} onSelect={setKind} title="Refresh required" hint="Gold banner with a Refresh button. Use after a deploy." />
          </div>
        </div>

        <div>
          <label className="field-label">Message <span className="text-terracotta">*</span></label>
          <textarea
            className="field-input"
            rows={4}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={
              kind === 'refresh_required'
                ? "We just deployed a fix. Please save your work and click Refresh to pick up the new version."
                : kind === 'warning'
                  ? "We're seeing an issue with email sync. Working on it now."
                  : "FYI — donor reports were sluggish for a few minutes earlier; that's resolved."
            }
          />
          <div className="text-[11px] text-ink-faint mt-1">
            Plain text. Line breaks are preserved.
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-hairline">
          <Link to="/dev/broadcasts" className="btn-ghost text-xs">Cancel</Link>
          <button type="submit" disabled={createMut.isPending} className="btn-primary text-xs disabled:opacity-60">
            {createMut.isPending ? 'Sending…' : 'Send broadcast'}
          </button>
        </div>
      </form>
    </>
  );
}

function KindOption({
  value, current, onSelect, title, hint,
}: { value: Kind; current: Kind; onSelect: (k: Kind) => void; title: string; hint: string }) {
  const isOn = value === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`text-left p-2.5 rounded border transition ${isOn ? 'border-terracotta bg-terracotta/[0.08]' : 'border-hairline-strong hover:border-terracotta'}`}
    >
      <div className="font-medium text-sm">{title}</div>
      <div className="text-[11px] text-ink-faint mt-0.5">{hint}</div>
    </button>
  );
}

function KindPill({ kind }: { kind: Kind }) {
  const cls = kind === 'refresh_required' ? 'pill-gold' : kind === 'warning' ? 'pill-terra' : 'pill-sage';
  const label = kind === 'refresh_required' ? 'refresh' : kind;
  return <span className={`pill ${cls}`}>{label}</span>;
}
