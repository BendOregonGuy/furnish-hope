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
  attachments?: EmailAttachmentMeta[];
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

          {/* Body. If the message has an HTML part, render it sanitized
              via DOMPurify — that lets inline images, links, and basic
              formatting come through while stripping scripts and event
              handlers. If only plain text is present, render that with
              whitespace preserved. Inline images (cid: refs) get
              rewritten to point at our /attachments/:id endpoint. */}
          <MessageBody msg={msg} />

          {/* Non-inline attachments — files the sender attached but did
              not embed in the body (PDFs, docs, photos sent as files,
              etc). Inline images are excluded because they're already
              shown in the body. */}
          <AttachmentChips msg={msg} />

          <div className="flex gap-2 flex-wrap items-center">
            {/* type="button" everywhere — MessageList is embedded in admin
                detail pages whose outer <form> would otherwise treat these
                as type=submit and save (or wipe) the parent record. */}
            <button type="button" onClick={() => { setReplyOpen(true); setReplyAll(false); }} className="btn-primary text-xs">Reply</button>
            {msg.cc_addresses && (
              <button type="button" onClick={() => { setReplyOpen(true); setReplyAll(true); }} className="btn-ghost text-xs">Reply all</button>
            )}
            {msg.direction === 'in' && (
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
        </>
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
  for (const img of Array.from(root.querySelectorAll('img'))) {
    const src = img.getAttribute('src') ?? '';
    if (src.startsWith('cid:')) {
      const cid = src.slice(4).toLowerCase().replace(/^<|>$/g, '');
      const aid = cidMap.get(cid);
      if (aid) {
        img.setAttribute('src', `/api/mailbox/messages/${messageId}/attachments/${aid}`);
        img.setAttribute('loading', 'lazy');
        // Keep images bounded so a huge inline photo doesn't blow out
        // the panel width.
        img.setAttribute('style', `${img.getAttribute('style') ?? ''}; max-width:100%; height:auto;`);
      } else {
        // cid not found in attachments → drop the src so we don't get
        // a broken-image icon. Keep the alt text if any.
        img.removeAttribute('src');
      }
    } else if (/^https?:/i.test(src)) {
      // External image — drop to avoid loading remote trackers when the
      // user opens the message. (Future: add a "Show remote images"
      // toggle if any sender depends on this.)
      img.removeAttribute('src');
      img.setAttribute('title', 'External image not loaded');
    }
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
