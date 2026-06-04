/**
 * Mailbox — the current user's inbox / sent / all-messages view across
 * every connected email account. Click any message to expand the body
 * and reply inline. "Sync now" triggers an IMAP pull from each account;
 * new messages then appear in the list automatically.
 *
 * Strictly per-user — your messages are scoped by your user_account_id
 * on the server side. You never see another staff member's mail.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiGet, apiPost } from '../lib/api.ts';
import { PageHeader, Loading, ErrorBox } from '../components/ui.tsx';
import { MessageList, type MessageListItem } from '../components/email/MessageList.tsx';

type Folder = 'inbox' | 'sent' | 'all';

interface SyncSummary {
  account_id: number;
  account_email: string;
  inbox_new: number;
  sent_new: number;
  error: string | null;
}

interface SyncState {
  email_account_id: number;
  email_address: string;
  folder: string;
  last_synced_at: string | null;
  last_error: string | null;
}

export function Mailbox() {
  const qc = useQueryClient();
  const [folder, setFolder] = useState<Folder>('inbox');
  const [query, setQuery] = useState('');
  const [syncResult, setSyncResult] = useState<SyncSummary[] | null>(null);

  const { data: messages, isLoading, error } = useQuery<MessageListItem[]>({
    queryKey: ['mailbox', 'list', folder, query],
    queryFn: () => apiGet('/api/mailbox/messages', {
      folder: folder === 'all' ? undefined : folder,
      q: query || undefined,
      limit: '100',
    }),
  });

  const { data: syncStates } = useQuery<SyncState[]>({
    queryKey: ['mailbox', 'sync-state'],
    queryFn: () => apiGet('/api/mailbox/sync-state'),
  });

  const syncMut = useMutation({
    mutationFn: () => apiPost<{ summaries: SyncSummary[] }>('/api/mailbox/sync', {}),
    onSuccess: (r) => {
      setSyncResult(r.summaries);
      qc.invalidateQueries({ queryKey: ['mailbox'] });
    },
    onError: (e: any) => window.alert(e.message ?? 'Sync failed'),
  });

  const { data: unread } = useQuery<{ count: number }>({
    queryKey: ['mailbox', 'unread-count'],
    queryFn: () => apiGet('/api/mailbox/unread-count'),
  });

  const markAllReadMut = useMutation({
    mutationFn: () => apiPost<{ marked: number }>('/api/mailbox/mark-all-read', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mailbox'] }),
    onError: (e: any) => window.alert(e.message ?? 'Failed to mark all read'),
  });

  const totalNew = syncResult?.reduce((s, r) => s + r.inbox_new + r.sent_new, 0) ?? 0;
  const anyError = syncResult?.some(r => !!r.error) ?? false;

  // Friendly "last synced" — pick the most recent across all accounts/folders.
  const lastSyncedAt = syncStates && syncStates.length > 0
    ? syncStates
        .map(s => s.last_synced_at ? new Date(s.last_synced_at) : null)
        .filter(Boolean)
        .sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0]
    : null;

  return (
    <>
      <PageHeader
        title="Mailbox"
        emphasis="email"
        subtitle="Your sent and received messages across every connected email account. Reply inline; compose from Email → Compose."
        actions={
          <>
            {unread && unread.count > 0 && (
              <button
                onClick={() => {
                  if (window.confirm(`Mark all ${unread.count} unread message${unread.count === 1 ? '' : 's'} as read?`)) {
                    markAllReadMut.mutate();
                  }
                }}
                disabled={markAllReadMut.isPending}
                className="btn-ghost text-xs disabled:opacity-60"
              >
                Mark all read ({unread.count})
              </button>
            )}
            <Link to="/email/compose" className="btn-ghost">Compose</Link>
            <button
              onClick={() => syncMut.mutate()}
              disabled={syncMut.isPending}
              className="btn-primary text-xs disabled:opacity-60"
            >
              {syncMut.isPending ? 'Syncing…' : 'Sync now'}
            </button>
          </>
        }
      />

      {/* Sync result toast */}
      {syncResult && (
        <div className={`mb-4 p-3 rounded-md text-sm ${anyError ? 'bg-terracotta-soft text-terracotta-deep' : 'bg-sage-soft text-[#3F4A33]'}`}>
          {anyError ? '⚠ ' : '✓ '}
          Synced — {totalNew} new message{totalNew === 1 ? '' : 's'} across {syncResult.length} account{syncResult.length === 1 ? '' : 's'}.
          {anyError && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer">Show details</summary>
              <ul className="mt-1 ml-5 list-disc">
                {syncResult.filter(r => r.error).map(r => (
                  <li key={r.account_id}><strong>{r.account_email}:</strong> {r.error}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <FolderTab active={folder === 'inbox'} onClick={() => setFolder('inbox')}>Inbox</FolderTab>
        <FolderTab active={folder === 'sent'}  onClick={() => setFolder('sent')}>Sent</FolderTab>
        <FolderTab active={folder === 'all'}   onClick={() => setFolder('all')}>All</FolderTab>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search subject, sender, body…"
          className="field-input max-w-xs ml-auto"
        />
        {lastSyncedAt && (
          <span className="text-[11px] text-ink-faint">
            Last synced {lastSyncedAt.toLocaleString()}
          </span>
        )}
      </div>

      {error && <ErrorBox error={error} />}
      {isLoading && !messages && <Loading />}

      <div className="card p-0 overflow-hidden">
        <MessageList messages={messages ?? []} loading={isLoading} emptyHint="Click Sync now to pull from your inbox." />
      </div>
    </>
  );
}

function FolderTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-md border transition ${
        active
          ? 'border-terracotta bg-terracotta text-paper font-medium'
          : 'border-hairline-strong text-ink-soft hover:border-terracotta hover:text-terracotta'
      }`}
    >
      {children}
    </button>
  );
}
