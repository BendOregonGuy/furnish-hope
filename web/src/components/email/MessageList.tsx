/**
 * Shared message list + detail view. Used by the Mailbox page and the
 * per-entity EmailWidget so they look and behave the same way.
 *
 * - List rows show sender, subject, preview, date. Click to expand.
 * - Expanded view shows full body (text or stripped HTML) + inline
 *   reply form.
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../../lib/api.ts';
import { Loading, EmptyState } from '../ui.tsx';
import { useAttachments, AttachmentPicker } from './attachments.tsx';

export interface MessageListItem {
  message_id: number;
  folder: string;
  direction: 'in' | 'out';
  from_address: string;
  from_name: string | null;
  to_addresses: string;
  subject: string | null;
  body_preview: string | null;
  has_attachments: boolean;
  sent_at: string;
  received_at: string | null;
  read_at: string | null;
  account_email: string;
}

export function MessageList({
  messages,
  emptyHint,
  loading,
}: {
  messages: MessageListItem[];
  emptyHint?: string;
  loading?: boolean;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (loading) return <Loading />;
  if (messages.length === 0) {
    return <EmptyState title="No messages" hint={emptyHint ?? 'Try Sync now to pull from your inbox.'} />;
  }

  return (
    <div className="divide-y divide-hairline">
      {messages.map(m => (
        <MessageRow
          key={m.message_id}
          msg={m}
          expanded={expandedId === m.message_id}
          onToggle={() => setExpandedId(expandedId === m.message_id ? null : m.message_id)}
        />
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  Row                                                               */
/* ----------------------------------------------------------------- */

function MessageRow({
  msg, expanded, onToggle,
}: {
  msg: MessageListItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const senderLabel = msg.direction === 'out'
    ? `To: ${msg.to_addresses.split(',')[0]}${msg.to_addresses.split(',').length > 1 ? ` +${msg.to_addresses.split(',').length - 1}` : ''}`
    : (msg.from_name ? `${msg.from_name} <${msg.from_address}>` : msg.from_address);

  // Unread = inbound + never opened. Outbound messages are always "read"
  // since the user authored them; we don't badge them as unread.
  const isUnread = msg.direction === 'in' && !msg.read_at;

  return (
    <div className={isUnread ? 'bg-terracotta/[0.04]' : ''}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-3 py-3 hover:bg-terracotta/[0.06] flex items-baseline gap-3 cursor-pointer"
      >
        {/* Status dot: solid colored when unread, hollow ring when read/sent. */}
        <span
          className={`inline-block w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
            isUnread
              ? 'bg-terracotta'
              : msg.direction === 'out'
                ? 'bg-sage/40'
                : 'bg-ink-faint/30'
          }`}
          title={isUnread ? 'Unread' : 'Read'}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-[11px] text-ink-faint uppercase tracking-widest font-medium flex-shrink-0">
              {msg.direction === 'out' ? 'Sent' : 'Inbox'}
            </span>
            <span className={`truncate ${isUnread ? 'font-semibold text-ink' : 'font-medium'}`}>
              {senderLabel}
            </span>
            {msg.has_attachments && <span className="text-[10px] text-ink-faint">📎</span>}
            <span className="ml-auto text-[11px] text-ink-faint whitespace-nowrap">
              {new Date(msg.sent_at).toLocaleString()}
            </span>
          </div>
          <div className={`font-display text-base truncate ${isUnread ? 'font-semibold text-ink' : 'font-medium text-ink'}`}>
            {msg.subject || '(no subject)'}
          </div>
          {msg.body_preview && (
            <div className={`text-xs truncate ${isUnread ? 'text-ink' : 'text-ink-soft'}`}>
              {msg.body_preview}
            </div>
          )}
        </div>
      </button>
      {expanded && <MessageDetail messageId={msg.message_id} onClose={onToggle} />}
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  Detail + reply                                                    */
/* ----------------------------------------------------------------- */

interface FullMessage extends MessageListItem {
  body_text: string | null;
  body_html: string | null;
  cc_addresses: string;
  account_email: string;
  message_id_header: string | null;
}

function MessageDetail({ messageId, onClose }: { messageId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: msg, isLoading, error } = useQuery<FullMessage>({
    queryKey: ['mailbox', 'message', messageId],
    queryFn: () => apiGet(`/api/mailbox/messages/${messageId}`),
  });

  // Detail fetch auto-marks inbound messages as read on the server.
  // Invalidate list queries so the row updates from unread → read
  // styling without the user having to refresh. Also bumps the sidebar
  // unread-count badge.
  useEffect(() => {
    if (msg && msg.direction === 'in') {
      qc.invalidateQueries({ queryKey: ['mailbox', 'list'] });
      qc.invalidateQueries({ queryKey: ['mailbox', 'participant'] });
      qc.invalidateQueries({ queryKey: ['mailbox', 'unread-count'] });
    }
  }, [msg?.message_id, msg?.read_at, qc]);

  const markUnreadMut = useMutation({
    mutationFn: () => apiPost(`/api/mailbox/messages/${messageId}/mark-unread`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mailbox'] });
      onClose();
    },
  });

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyAll, setReplyAll] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [replyError, setReplyError] = useState<string | null>(null);
  const replyAttachments = useAttachments();

  const replyMut = useMutation({
    mutationFn: () => apiPost(`/api/mailbox/messages/${messageId}/reply`, {
      body_text: replyBody,
      reply_all: replyAll,
      attachments: replyAttachments.files,
    }),
    onSuccess: () => {
      setReplyOpen(false);
      setReplyBody('');
      setReplyError(null);
      replyAttachments.clear();
      qc.invalidateQueries({ queryKey: ['mailbox'] });
    },
    onError: (err: any) => setReplyError(err.message ?? 'Reply failed'),
  });

  return (
    <div className="bg-cream/30 border-t border-hairline px-4 py-3">
      {isLoading && <div className="text-xs text-ink-faint">Loading…</div>}
      {error && <div className="text-xs text-terracotta-deep">{(error as any).message ?? 'Load failed'}</div>}
      {msg && (
        <>
          <div className="grid grid-cols-[60px_1fr] gap-x-3 text-xs text-ink-soft mb-3">
            <div className="text-ink-faint uppercase tracking-widest text-[10px] font-medium">From</div>
            <div>{msg.from_name ? `${msg.from_name} <${msg.from_address}>` : msg.from_address}</div>
            <div className="text-ink-faint uppercase tracking-widest text-[10px] font-medium">To</div>
            <div>{msg.to_addresses || '—'}</div>
            {msg.cc_addresses && (
              <>
                <div className="text-ink-faint uppercase tracking-widest text-[10px] font-medium">Cc</div>
                <div>{msg.cc_addresses}</div>
              </>
            )}
            <div className="text-ink-faint uppercase tracking-widest text-[10px] font-medium">Date</div>
            <div>{new Date(msg.sent_at).toLocaleString()}</div>
          </div>

          {/* Body. Prefer text/plain; if only HTML is present, strip tags
              defensively before rendering — we never want to render
              untrusted HTML directly into our DOM. */}
          <div className="bg-paper rounded p-3 mb-3 text-sm whitespace-pre-wrap font-sans max-h-96 overflow-y-auto">
            {msg.body_text || stripHtml(msg.body_html ?? '') || <span className="text-ink-faint italic">(empty body)</span>}
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <button onClick={() => { setReplyOpen(true); setReplyAll(false); }} className="btn-primary text-xs">Reply</button>
            {msg.cc_addresses && (
              <button onClick={() => { setReplyOpen(true); setReplyAll(true); }} className="btn-ghost text-xs">Reply all</button>
            )}
            {msg.direction === 'in' && (
              <button
                onClick={() => markUnreadMut.mutate()}
                disabled={markUnreadMut.isPending}
                className="text-xs text-ink-faint hover:text-terracotta"
              >
                Mark as unread
              </button>
            )}
            <button onClick={onClose} className="text-xs text-ink-faint hover:text-terracotta ml-auto">Collapse</button>
          </div>

          {replyOpen && (
            <div className="mt-3 p-3 bg-paper rounded border border-hairline">
              <div className="text-[11px] text-ink-faint mb-2">
                Replying to <strong>{msg.direction === 'in' ? msg.from_address : (msg.to_addresses.split(',')[0] ?? '?')}</strong>
                {replyAll && msg.cc_addresses && <> · also Cc: {msg.cc_addresses}</>}
                {msg.account_email && <> · from <strong>{msg.account_email}</strong></>}
              </div>
              <textarea
                rows={5}
                className="field-input font-sans"
                value={replyBody}
                onChange={e => setReplyBody(e.target.value)}
                placeholder="Type your reply…"
                autoFocus
              />
              <div className="mt-2">
                <AttachmentPicker
                  files={replyAttachments.files}
                  onAdd={replyAttachments.add}
                  onRemove={replyAttachments.remove}
                />
              </div>
              {replyError && <div className="text-xs text-terracotta-deep mt-2">{replyError}</div>}
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => { setReplyOpen(false); setReplyError(null); replyAttachments.clear(); }} className="btn-ghost text-xs">Cancel</button>
                <button
                  onClick={() => {
                    if (!replyBody.trim()) { setReplyError('Reply body is required.'); return; }
                    replyMut.mutate();
                  }}
                  disabled={replyMut.isPending}
                  className="btn-primary text-xs disabled:opacity-60"
                >
                  {replyMut.isPending ? 'Sending…' : 'Send reply'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Defensive HTML strip — never render arbitrary HTML from email, so
 *  collapse to text. Keeps line breaks readable. */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n');
}
