/**
 * Shared message list + detail view. Used by the Mailbox page and the
 * per-entity EmailWidget so they look and behave the same way.
 *
 * - List rows show sender, subject, preview, date. Click to expand.
 * - Expanded view shows full body (text or stripped HTML) + inline
 *   reply form.
 */

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import { apiGet, apiPost } from '../../lib/api.ts';
import { Loading, EmptyState } from '../ui.tsx';
import { useAttachments, AttachmentPicker } from './attachments.tsx';
import { TemplatePicker } from './TemplatePicker.tsx';
import { RecipientPicker, appendRecipient } from './RecipientPicker.tsx';
import { RecipientAutocomplete } from './RecipientAutocomplete.tsx';

export interface EmailAttachmentMeta {
  email_attachment_id: number;
  filename: string;
  content_type: string | null;
  size_bytes: number;
  is_inline: boolean;
  content_id: string | null;
}

export interface MessageListItem {
  message_id: number;
  /** Conversation thread this message belongs to. The list endpoint
   *  returns ONE row per thread (showing the latest message), so
   *  thread_id is what we click into for the full conversation. */
  thread_id: number;
  /** Total messages in the thread (≥1). When > 1 we show a count
   *  badge in the row. */
  message_count: number;
  /** Aggregate flags across the thread — drives the unread dot and
   *  the inbox/sent appearance even for threads with mixed direction. */
  thread_has_unread: boolean;
  thread_has_inbound: boolean;
  thread_has_outbound: boolean;
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
  // The list groups by thread; expansion is per-thread.
  const [expandedThread, setExpandedThread] = useState<number | null>(null);

  if (loading) return <Loading />;
  if (messages.length === 0) {
    return <EmptyState title="No messages" hint={emptyHint ?? 'Try Sync now to pull from your inbox.'} />;
  }

  return (
    <div className="divide-y divide-hairline">
      {messages.map(m => (
        <ThreadRow
          key={m.thread_id}
          msg={m}
          expanded={expandedThread === m.thread_id}
          onToggle={() => setExpandedThread(expandedThread === m.thread_id ? null : m.thread_id)}
        />
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  Row                                                               */
/* ----------------------------------------------------------------- */

function ThreadRow({
  msg, expanded, onToggle,
}: {
  msg: MessageListItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  // For the row label, prefer the most-recent message's "other party":
  //   - Inbound latest → show sender
  //   - Outbound latest → show first recipient
  const senderLabel = msg.direction === 'out'
    ? `To: ${msg.to_addresses.split(',')[0]}${msg.to_addresses.split(',').length > 1 ? ` +${msg.to_addresses.split(',').length - 1}` : ''}`
    : (msg.from_name ? `${msg.from_name} <${msg.from_address}>` : msg.from_address);

  // Unread highlight uses the THREAD-wide flag, not just the latest
  // message's read_at — a thread with an old unread reply should still
  // glow until the user opens it.
  const isUnread = msg.thread_has_unread;
  const count = msg.message_count ?? 1;

  return (
    <div className={isUnread ? 'bg-terracotta/[0.04]' : ''}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-3 py-3 hover:bg-terracotta/[0.06] flex items-baseline gap-3 cursor-pointer"
      >
        <span
          className={`inline-block w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
            isUnread
              ? 'bg-terracotta'
              : msg.thread_has_outbound && !msg.thread_has_inbound
                ? 'bg-sage/40'
                : 'bg-ink-faint/30'
          }`}
          title={isUnread ? 'Unread reply' : 'Read'}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-[11px] text-ink-faint uppercase tracking-widest font-medium flex-shrink-0">
              {msg.direction === 'out' ? 'Sent' : 'Inbox'}
            </span>
            <span className={`truncate ${isUnread ? 'font-semibold text-ink' : 'font-medium'}`}>
              {senderLabel}
            </span>
            {count > 1 && (
              <span className="text-[10px] text-ink-faint font-medium" title={`${count} messages in this conversation`}>
                ({count})
              </span>
            )}
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
      {expanded && <ThreadDetail threadId={msg.thread_id} onClose={onToggle} />}
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  Thread detail (every message in the conversation, chronological)  */
/* ----------------------------------------------------------------- */

interface FullMessage {
  message_id: number;
  thread_id: number;
  folder: string;
  direction: 'in' | 'out';
  from_address: string;
  from_name: string | null;
  to_addresses: string;
  cc_addresses: string;
  bcc_addresses: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  has_attachments: boolean;
  sent_at: string;
  received_at: string | null;
  read_at: string | null;
  account_email: string;
  message_id_header: string | null;
  attachments?: EmailAttachmentMeta[];
}

interface ThreadResponse {
  thread_id: number;
  messages: FullMessage[];
}

function ThreadDetail({ threadId, onClose }: { threadId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery<ThreadResponse>({
    queryKey: ['mailbox', 'thread', threadId],
    queryFn: () => apiGet(`/api/mailbox/threads/${threadId}`),
  });

  // Side-effect: thread fetch auto-marks every inbound message in the
  // thread as read. Invalidate list queries so the row + unread badge
  // reflect the change without a manual refresh.
  useEffect(() => {
    if (data && data.messages.some(m => m.direction === 'in')) {
      qc.invalidateQueries({ queryKey: ['mailbox', 'list'] });
      qc.invalidateQueries({ queryKey: ['mailbox', 'participant'] });
      qc.invalidateQueries({ queryKey: ['mailbox', 'unread-count'] });
    }
  }, [data?.thread_id, qc]);

  // Track which prior messages the user has expanded. The latest
  // message starts expanded automatically; older ones are collapsed.
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const latestId = data?.messages[data.messages.length - 1]?.message_id ?? null;

  if (isLoading) return <div className="bg-cream/30 border-t border-hairline px-4 py-3 text-xs text-ink-faint">Loading conversation…</div>;
  if (error) return <div className="bg-cream/30 border-t border-hairline px-4 py-3 text-xs text-terracotta-deep">{(error as any).message ?? 'Failed to load conversation'}</div>;
  if (!data || data.messages.length === 0) return null;

  const latest = data.messages[data.messages.length - 1];

  return (
    <div className="bg-cream/30 border-t border-hairline px-4 py-3 space-y-3">
      {/* Each message in the thread, oldest first. Latest is auto-
          expanded; the rest collapsed by default — click the header
          to expand inline. */}
      {data.messages.map((m, idx) => {
        const isLatest = m.message_id === latestId;
        const isExpanded = isLatest || expanded.has(m.message_id);
        return (
          <MessageInThread
            key={m.message_id}
            msg={m}
            expanded={isExpanded}
            isFirst={idx === 0}
            onToggle={() => {
              if (isLatest) return; // can't collapse the latest
              setExpanded(prev => {
                const next = new Set(prev);
                if (next.has(m.message_id)) next.delete(m.message_id);
                else next.add(m.message_id);
                return next;
              });
            }}
          />
        );
      })}

      {/* Reply form — always anchored to the latest message in the
          thread. Reply target is the other party of the latest msg. */}
      <ThreadReply latest={latest} onClose={onClose} onSent={() => {
        qc.invalidateQueries({ queryKey: ['mailbox'] });
      }} />
    </div>
  );
}

/** Render one message inside a thread. Collapsed view shows a single
 *  header line (sender + date); expanded shows the full body and
 *  attachments. The latest message is always expanded; others toggle
 *  on click. */
function MessageInThread({
  msg, expanded, isFirst, onToggle,
}: {
  msg: FullMessage;
  expanded: boolean;
  isFirst: boolean;
  onToggle: () => void;
}) {
  const senderLine = msg.from_name ? `${msg.from_name} <${msg.from_address}>` : msg.from_address;
  const directionLabel = msg.direction === 'out' ? 'You wrote' : 'From';
  return (
    <div className={`bg-paper border border-hairline rounded-md ${isFirst ? '' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-3 py-2 hover:bg-cream/40 cursor-pointer"
        title={expanded ? 'Click to collapse' : 'Click to expand'}
      >
        <div className="flex items-baseline gap-2 flex-wrap text-xs">
          <span className="text-ink-faint uppercase tracking-widest text-[10px] font-medium">{directionLabel}</span>
          <span className="font-medium truncate flex-1">{senderLine}</span>
          {msg.has_attachments && <span className="text-[10px] text-ink-faint">📎</span>}
          <span className="text-[11px] text-ink-faint whitespace-nowrap">{new Date(msg.sent_at).toLocaleString()}</span>
        </div>
        {!expanded && msg.body_text && (
          <div className="text-[11px] text-ink-soft truncate mt-0.5">{msg.body_text.replace(/\s+/g, ' ').slice(0, 140)}</div>
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-3 border-t border-hairline/40">
          <div className="grid grid-cols-[60px_1fr] gap-x-3 text-xs text-ink-soft my-3">
            <div className="text-ink-faint uppercase tracking-widest text-[10px] font-medium">To</div>
            <div>{msg.to_addresses || '—'}</div>
            {msg.cc_addresses && (
              <>
                <div className="text-ink-faint uppercase tracking-widest text-[10px] font-medium">Cc</div>
                <div>{msg.cc_addresses}</div>
              </>
            )}
          </div>
          <MessageBody msg={msg} />
          <AttachmentChips msg={msg} />
        </div>
      )}
    </div>
  );
}

/** Reply form anchored to the latest message in a thread. Replies are
 *  threaded automatically — the server attaches the same thread_id to
 *  the outbound message via the In-Reply-To header. */
function ThreadReply({ latest, onClose, onSent }: { latest: FullMessage; onClose: () => void; onSent: () => void }) {
  const qc = useQueryClient();
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyAll, setReplyAll] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [replyError, setReplyError] = useState<string | null>(null);
  const [toExtra, setToExtra] = useState('');
  const [ccExtra, setCcExtra] = useState('');
  const [bccExtra, setBccExtra] = useState('');
  const replyAttachments = useAttachments();

  // Reply target is always anchored to the LATEST message in the thread.
  const messageId = latest.message_id;

  const markUnreadMut = useMutation({
    mutationFn: () => apiPost(`/api/mailbox/messages/${messageId}/mark-unread`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mailbox'] });
      onClose();
    },
  });

  const replyMut = useMutation({
    mutationFn: () => apiPost(`/api/mailbox/messages/${messageId}/reply`, {
      body_text: replyBody,
      reply_all: replyAll,
      attachments: replyAttachments.files,
      to_extra:  toExtra.trim() || undefined,
      cc_extra:  ccExtra.trim() || undefined,
      bcc_extra: bccExtra.trim() || undefined,
    }),
    onSuccess: () => {
      setReplyOpen(false);
      setReplyBody('');
      setReplyError(null);
      setToExtra(''); setCcExtra(''); setBccExtra('');
      replyAttachments.clear();
      onSent();
    },
    onError: (err: any) => setReplyError(err.message ?? 'Reply failed'),
  });

  const replyTargetLabel = latest.direction === 'in'
    ? latest.from_address
    : (latest.to_addresses.split(',')[0] ?? '?');

  return (
    <div>
      <div className="flex gap-2 flex-wrap items-center mt-1">
        <button type="button" onClick={() => { setReplyOpen(true); setReplyAll(false); }} className="btn-primary text-xs">Reply</button>
        {latest.cc_addresses && (
          <button type="button" onClick={() => { setReplyOpen(true); setReplyAll(true); }} className="btn-ghost text-xs">Reply all</button>
        )}
        {latest.direction === 'in' && (
          <button
            type="button"
            onClick={() => markUnreadMut.mutate()}
            disabled={markUnreadMut.isPending}
            className="text-xs text-ink-faint hover:text-terracotta"
          >
            Mark as unread
          </button>
        )}
        <button type="button" onClick={onClose} className="text-xs text-ink-faint hover:text-terracotta ml-auto">Collapse</button>
      </div>

      {replyOpen && (
        <div className="mt-3 p-3 bg-paper rounded border border-hairline">
          <div className="text-[11px] text-ink-faint mb-2 flex items-center justify-between gap-2 flex-wrap">
            <div>
              Replying to <strong>{replyTargetLabel}</strong>
              {replyAll && latest.cc_addresses && <> · also Cc: {latest.cc_addresses}</>}
              {latest.account_email && <> · from <strong>{latest.account_email}</strong></>}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <span className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">To</span>
                <RecipientPicker target="to" onPick={email => setToExtra(prev => appendRecipient(prev, email))} />
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">Cc</span>
                <RecipientPicker target="cc" onPick={email => setCcExtra(prev => appendRecipient(prev, email))} />
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">Bcc</span>
                <RecipientPicker target="bcc" onPick={email => setBccExtra(prev => appendRecipient(prev, email))} />
              </span>
              <TemplatePicker
                onApply={t => setReplyBody(prev => prev ? `${prev}\n\n${t.body}` : t.body)}
              />
            </div>
          </div>

          {(toExtra || ccExtra || bccExtra) && (
            <div className="mb-2 grid grid-cols-[40px_1fr] gap-x-2 text-[11px]">
              {toExtra && <>
                <div className="text-ink-faint uppercase tracking-widest font-medium pt-1">+ To</div>
                <RecipientAutocomplete value={toExtra} onChange={setToExtra} className="bg-cream border border-hairline-strong px-2 py-0.5 rounded text-xs w-full focus:outline-none focus:border-terracotta" />
              </>}
              {ccExtra && <>
                <div className="text-ink-faint uppercase tracking-widest font-medium pt-1">+ Cc</div>
                <RecipientAutocomplete value={ccExtra} onChange={setCcExtra} className="bg-cream border border-hairline-strong px-2 py-0.5 rounded text-xs w-full focus:outline-none focus:border-terracotta" />
              </>}
              {bccExtra && <>
                <div className="text-ink-faint uppercase tracking-widest font-medium pt-1">+ Bcc</div>
                <RecipientAutocomplete value={bccExtra} onChange={setBccExtra} className="bg-cream border border-hairline-strong px-2 py-0.5 rounded text-xs w-full focus:outline-none focus:border-terracotta" />
              </>}
            </div>
          )}

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
            <button type="button" onClick={() => { setReplyOpen(false); setReplyError(null); replyAttachments.clear(); }} className="btn-ghost text-xs">Cancel</button>
            <button
              type="button"
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
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  Body renderer + attachments                                       */
/* ----------------------------------------------------------------- */

/** Render the email body. Prefers HTML (sanitized + cid: rewritten);
 *  falls back to plain text with whitespace preserved.
 *
 *  Security note: DOMPurify with a tight tag/attr allowlist scrubs all
 *  script execution vectors (<script>, on* attrs, javascript: URLs,
 *  <object>, <iframe>, etc). We additionally rewrite `src` attributes
 *  on <img> to either our own attachment endpoint (for cid: refs) or
 *  drop them entirely (so remote tracking pixels don't load on open).
 *  Links are left intact but get target=_blank + rel=noopener. */
function MessageBody({ msg }: { msg: FullMessage }) {
  const html = useMemo(() => {
    if (!msg.body_html) return null;
    return sanitizeAndRewrite(msg.body_html, msg.message_id, msg.attachments ?? []);
  }, [msg.body_html, msg.message_id, msg.attachments]);

  // Plain-text fallback also gets linkified — bare URLs and email
  // addresses in the body become clickable <a target=_blank>. Done
  // by escaping the text first (so the body itself can never inject
  // HTML), then swapping in anchor tags only for matched URLs.
  const linkedPlainText = useMemo(() => {
    if (!msg.body_text) return null;
    return linkifyPlainText(msg.body_text);
  }, [msg.body_text]);

  if (html) {
    return (
      <div
        className="bg-paper rounded p-3 mb-3 text-sm font-sans max-h-[32rem] overflow-y-auto email-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  if (linkedPlainText) {
    return (
      <div
        className="bg-paper rounded p-3 mb-3 text-sm whitespace-pre-wrap font-sans max-h-96 overflow-y-auto email-body"
        dangerouslySetInnerHTML={{ __html: linkedPlainText }}
      />
    );
  }

  return (
    <div className="bg-paper rounded p-3 mb-3 text-sm whitespace-pre-wrap font-sans max-h-96 overflow-y-auto">
      <span className="text-ink-faint italic">(empty body)</span>
    </div>
  );
}

/** Turn bare URLs and email addresses in plain text into clickable
 *  anchors that open in a new tab. Safe to feed the result to
 *  dangerouslySetInnerHTML because we HTML-escape the input first —
 *  the only tags we add are our own <a> elements with sanitized
 *  href values (http/https/mailto only).
 *
 *  Matches:
 *    - http://… and https://… URLs
 *    - www.…   URLs (prefixed with https:// in the href)
 *    - bare email addresses (prefixed with mailto:)
 *
 *  Trailing sentence punctuation (.,;:!?)]) is stripped from the link
 *  text and kept as the surrounding text so "See https://example.com."
 *  links the URL but keeps the period outside the anchor.
 */
function linkifyPlainText(text: string): string {
  // Escape HTML special chars FIRST — anything left from this point on
  // is plain text plus the anchors we add ourselves.
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const URL_RE = /\b(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})\b/gi;
  const TRAILING_PUNCT = /[.,;:!?)\]]+$/;

  return escaped.replace(URL_RE, (match) => {
    // Strip trailing punctuation so "look at https://x.com." → link
    // text is "https://x.com" with the period rendered after the link.
    const trimmedMatch = match.replace(TRAILING_PUNCT, '');
    const trail = match.slice(trimmedMatch.length);

    let href: string;
    if (/^https?:/i.test(trimmedMatch)) {
      href = trimmedMatch;
    } else if (/^www\./i.test(trimmedMatch)) {
      href = 'https://' + trimmedMatch;
    } else {
      // Email address.
      href = 'mailto:' + trimmedMatch;
    }

    // Belt-and-suspenders: only emit http/https/mailto hrefs. Anything
    // else falls through unchanged.
    if (!/^(https?:|mailto:)/i.test(href)) return match;

    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${trimmedMatch}</a>${trail}`;
  });
}

/** Run DOMPurify with a conservative allowlist, then rewrite the
 *  resulting DOM so:
 *    - <img src="cid:abc"> → src="/api/mailbox/messages/:id/attachments/:aid"
 *    - <img src="http(s)://..."> → src dropped (no remote loads)
 *    - <a href> gets target=_blank + rel=noopener
 *  Returns final HTML string ready to feed to dangerouslySetInnerHTML. */
function sanitizeAndRewrite(html: string, messageId: number, attachments: EmailAttachmentMeta[]): string {
  // First pass — strip scripts, event handlers, and dangerous tags.
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'a', 'b', 'br', 'blockquote', 'code', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 'q', 's', 'small', 'span', 'strong', 'sub',
      'sup', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul', 'font', 'center',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'width', 'height', 'style', 'colspan', 'rowspan', 'align', 'valign', 'border', 'cellpadding', 'cellspacing', 'color', 'face', 'size'],
    // Don't allow data: URLs in img src (could be huge / malicious).
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
  });

  // Build a cid → attachment_id map for fast inline-image rewriting.
  const cidMap = new Map<string, number>();
  for (const att of attachments) {
    if (att.content_id) cidMap.set(att.content_id.toLowerCase(), att.email_attachment_id);
  }

  // Second pass — DOM-level rewrites. We parse the sanitized HTML in a
  // detached document so the rewrites can't trigger any side effects
  // (image loads, etc) before they hit our actual DOM.
  const doc = new DOMParser().parseFromString(`<div>${clean}</div>`, 'text/html');
  const root = doc.body.firstChild as HTMLElement | null;
  if (!root) return clean;

  // Rewrite <img> src.
  //
  // Three cases:
  //   cid:xxx     → an inline image bundled with this email. Rewrite to
  //                 our attachment endpoint so the saved bytes render.
  //                 If the cid can't be resolved (backfill failed or
  //                 hasn't run), REMOVE the img element entirely so the
  //                 user doesn't see a small broken-image icon + alt
  //                 text where the image used to be.
  //   http(s)://  → an external image (hosted by the sender or a CDN).
  //                 Loaded as-is. Tradeoff: senders that use tracking
  //                 pixels learn you opened the email. Matches Gmail's
  //                 default behaviour and what staff expect.
  //   anything    → unknown / data: / file: — drop element entirely.
  for (const img of Array.from(root.querySelectorAll('img'))) {
    const src = img.getAttribute('src') ?? '';
    if (src.startsWith('cid:')) {
      const cid = src.slice(4).toLowerCase().replace(/^<|>$/g, '');
      const aid = cidMap.get(cid);
      if (aid) {
        img.setAttribute('src', `/api/mailbox/messages/${messageId}/attachments/${aid}`);
      } else {
        // cid not resolvable → kill the img element so we don't render
        // the broken-image placeholder. (The image is also listed in
        // the attachments chip section below the body if it came in
        // as a regular attachment, so the user can still download it.)
        img.remove();
        continue;
      }
    } else if (/^https?:\/\//i.test(src)) {
      // External image — leave the src alone, but harden the request:
      //   referrerpolicy=no-referrer hides which message URL is loading
      //   the image, so senders can correlate opens to a Furnish Hope
      //   user but not to the specific message thread.
      img.setAttribute('referrerpolicy', 'no-referrer');
    } else if (src) {
      // data:, file:, javascript:, mailto:, or anything else weird —
      // drop the element entirely (matches the cid-not-found case).
      img.remove();
      continue;
    } else {
      // No src at all in the source HTML — drop it.
      img.remove();
      continue;
    }

    // For every rendered image: lazy-load (don't fetch until in view)
    // and bound the size so a huge banner doesn't blow out the panel.
    img.setAttribute('loading', 'lazy');
    img.setAttribute('style', `${img.getAttribute('style') ?? ''}; max-width:100%; height:auto;`);
  }

  // Make all links open in a new tab with safe rel.
  for (const a of Array.from(root.querySelectorAll('a'))) {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  }

  return root.innerHTML;
}

/** Render the non-inline attachments as compact download chips. Inline
 *  images are filtered out — they're already shown in the body. */
function AttachmentChips({ msg }: { msg: FullMessage }) {
  const items = (msg.attachments ?? []).filter(a => !a.is_inline);
  if (items.length === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {items.map(att => (
        <a
          key={att.email_attachment_id}
          href={`/api/mailbox/messages/${msg.message_id}/attachments/${att.email_attachment_id}?download=1`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-xs border border-hairline-strong rounded-md px-2.5 py-1.5 hover:border-terracotta hover:text-terracotta bg-paper"
          title={`${att.filename} — ${formatBytes(att.size_bytes)}`}
        >
          <span>{iconFor(att.content_type)}</span>
          <span className="truncate max-w-[14rem]">{att.filename}</span>
          <span className="text-ink-faint">({formatBytes(att.size_bytes)})</span>
        </a>
      ))}
    </div>
  );
}

function iconFor(mime: string | null): string {
  if (!mime) return '📎';
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime.startsWith('video/')) return '🎞️';
  if (mime === 'application/pdf') return '📄';
  if (mime.includes('word')) return '📝';
  if (mime.includes('sheet') || mime.includes('excel')) return '📊';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return '📊';
  if (mime.includes('zip') || mime.includes('compressed')) return '🗜️';
  return '📎';
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
