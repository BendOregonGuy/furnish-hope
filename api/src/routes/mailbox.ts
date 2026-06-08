/**
 * Mailbox — read-side API over tbl_email_message. Strictly per-user:
 * messages are filtered by the requesting user's user_account_id so
 * no staff member sees another's private correspondence.
 *
 *   POST /api/mailbox/sync                              IMAP pull → cache
 *   GET  /api/mailbox/messages                          list with filters
 *   GET  /api/mailbox/messages/:id                      full body
 *   POST /api/mailbox/messages/:id/reply                send a reply
 *   GET  /api/mailbox/sync-state                        last_synced per account
 */

import { Router } from 'express';
import { query, queryOne } from '../db/pool.js';
import { syncAllAccountsForUser, backfillAttachments } from '../email/sync.js';
import { buildSmtpTransporter, type EmailAccountRow } from '../email/transports.js';
import { recordSentMessage } from '../email/sync.js';

export const mailboxRouter = Router();

/* ----------------------------------------------------------------- */
/*  POST /sync — trigger IMAP pull                                    */
/* ----------------------------------------------------------------- */

mailboxRouter.post('/sync', async (req, res, next) => {
  try {
    const limit = req.body?.limit ? Math.min(500, Math.max(1, Number(req.body.limit))) : 100;
    const summaries = await syncAllAccountsForUser(req.user!.user_account_id, { limit });
    res.json({ summaries });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  GET /sync-state — last_synced per account                         */
/* ----------------------------------------------------------------- */

mailboxRouter.get('/sync-state', async (req, res, next) => {
  try {
    const rows = await query(`
      SELECT
        s.email_account_id,
        s.folder,
        s.last_uid,
        s.last_synced_at,
        s.last_error,
        a.email_address
      FROM tbl_email_sync_state s
      JOIN tbl_email_account a ON a.email_account_id = s.email_account_id
      WHERE a.user_account_id = $1
      ORDER BY a.email_address, s.folder
    `, [req.user!.user_account_id]);
    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  GET /messages — list (now thread-grouped)                         */
/*                                                                    */
/*  Returns ONE row per conversation thread (not per message). Each   */
/*  row carries the most-recent message's metadata + a count of how   */
/*  many messages are in the thread. Click → expand the full thread   */
/*  via GET /threads/:thread_id.                                      */
/*                                                                    */
/*  Folder filter operates at the thread level:                       */
/*    inbox  → threads with at least one inbound message              */
/*    sent   → threads with at least one outbound message             */
/*    all    → every thread                                           */
/*  A back-and-forth thread appears in BOTH inbox and sent — matches  */
/*  Gmail's "Conversations" model.                                    */
/*                                                                    */
/*  q / participant filters still apply at the message level — if     */
/*  ANY message in a thread matches, the whole thread shows up.       */
/* ----------------------------------------------------------------- */

mailboxRouter.get('/messages', async (req, res, next) => {
  try {
    const userId = req.user!.user_account_id;
    const folder = (req.query.folder as string | undefined)?.toLowerCase();
    const accountId = req.query.account_id ? Number(req.query.account_id) : null;
    const participant = (req.query.participant as string | undefined)?.toLowerCase().trim() || null;
    const q = (req.query.q as string | undefined)?.trim() || null;
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));

    // Per-message conditions (applied inside the EXISTS subquery to
    // determine which threads qualify). These filter THREADS by
    // whether any constituent message matches.
    const msgConds: string[] = ['m2.user_account_id = $1'];
    const params: any[] = [userId];
    if (accountId) { params.push(accountId); msgConds.push(`m2.email_account_id = $${params.length}`); }
    if (participant) {
      params.push(participant);
      msgConds.push(`(
        LOWER(m2.from_address) = $${params.length}
        OR POSITION($${params.length} IN LOWER(m2.to_addresses))  > 0
        OR POSITION($${params.length} IN LOWER(m2.cc_addresses))  > 0
        OR POSITION($${params.length} IN LOWER(m2.bcc_addresses)) > 0
      )`);
    }
    if (q) {
      params.push(`%${q}%`);
      msgConds.push(`(m2.subject ILIKE $${params.length} OR m2.from_name ILIKE $${params.length} OR m2.body_preview ILIKE $${params.length} OR m2.from_address ILIKE $${params.length})`);
    }

    // Folder filter applies to the thread (any message must satisfy).
    const folderCondition = folder === 'inbox'
      ? `AND EXISTS (SELECT 1 FROM tbl_email_message m3 WHERE m3.user_account_id = $1 AND m3.thread_id = t.thread_id AND m3.direction = 'in')`
      : folder === 'sent'
        ? `AND EXISTS (SELECT 1 FROM tbl_email_message m3 WHERE m3.user_account_id = $1 AND m3.thread_id = t.thread_id AND m3.direction = 'out')`
        : '';

    params.push(limit);

    // The query has three layers:
    //   1. thread_summary: one row per (user, thread) with count + flags
    //   2. latest_in_thread: DISTINCT ON gets the newest message's metadata per thread
    //   3. SELECT joins them, applies folder/search filter, returns latest+stats
    const rows = await query(`
      WITH thread_summary AS (
        SELECT
          m.thread_id,
          COUNT(*) AS message_count,
          MAX(m.sent_at) AS latest_sent_at,
          BOOL_OR(m.direction = 'in' AND m.read_at IS NULL) AS has_unread,
          BOOL_OR(m.direction = 'in')  AS has_inbound,
          BOOL_OR(m.direction = 'out') AS has_outbound
        FROM tbl_email_message m
        WHERE m.user_account_id = $1
        GROUP BY m.thread_id
      ),
      latest AS (
        SELECT DISTINCT ON (m.thread_id)
          m.thread_id,
          m.message_id,
          m.folder,
          m.direction,
          m.from_address,
          m.from_name,
          m.to_addresses,
          m.subject,
          m.body_preview,
          m.has_attachments,
          m.sent_at,
          m.received_at,
          m.read_at,
          a.email_address AS account_email
        FROM tbl_email_message m
        JOIN tbl_email_account a ON a.email_account_id = m.email_account_id
        WHERE m.user_account_id = $1
        ORDER BY m.thread_id, m.sent_at DESC
      )
      SELECT
        l.message_id,
        l.thread_id,
        l.folder,
        l.direction,
        l.from_address,
        l.from_name,
        l.to_addresses,
        l.subject,
        l.body_preview,
        l.has_attachments,
        l.sent_at,
        l.received_at,
        l.read_at,
        l.account_email,
        t.message_count::int  AS message_count,
        t.has_unread          AS thread_has_unread,
        t.has_inbound         AS thread_has_inbound,
        t.has_outbound        AS thread_has_outbound
      FROM latest l
      JOIN thread_summary t ON t.thread_id = l.thread_id
      WHERE EXISTS (
        SELECT 1 FROM tbl_email_message m2
        WHERE m2.thread_id = l.thread_id
          AND ${msgConds.join(' AND ')}
      )
      ${folderCondition}
      ORDER BY l.sent_at DESC
      LIMIT $${params.length}
    `, params);

    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  GET /unread-count — for the sidebar badge                         */
/* ----------------------------------------------------------------- */

mailboxRouter.get('/unread-count', async (req, res, next) => {
  try {
    const row = await queryOne<{ count: string }>(`
      SELECT COUNT(*)::text AS count
      FROM tbl_email_message
      WHERE user_account_id = $1
        AND direction = 'in'
        AND read_at IS NULL
    `, [req.user!.user_account_id]);
    res.json({ count: Number(row?.count ?? 0) });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  GET /threads/:thread_id — every message in the conversation       */
/*                                                                    */
/*  Returns the full thread (oldest first) with body, attachments,    */
/*  and per-message read flags. Side-effect: marks every inbound      */
/*  message in the thread as read on first fetch — opening a thread   */
/*  "reads" the whole conversation (matches Gmail behaviour).         */
/* ----------------------------------------------------------------- */

mailboxRouter.get('/threads/:thread_id', async (req, res, next) => {
  try {
    const threadId = Number(req.params.thread_id);
    if (!Number.isInteger(threadId) || threadId <= 0) return res.status(400).json({ error: 'Invalid thread id' });

    // Pull every message in the thread, plus account email for display.
    const messages = await query<any>(`
      SELECT
        m.message_id,
        m.thread_id,
        m.folder,
        m.direction,
        m.imap_uid,
        m.message_id_header,
        m.in_reply_to,
        m.from_address,
        m.from_name,
        m.to_addresses,
        m.cc_addresses,
        m.bcc_addresses,
        m.subject,
        m.body_text,
        m.body_html,
        m.body_preview,
        m.has_attachments,
        m.sent_at,
        m.received_at,
        m.read_at,
        a.email_address AS account_email
      FROM tbl_email_message m
      JOIN tbl_email_account a ON a.email_account_id = m.email_account_id
      WHERE m.thread_id = $1 AND m.user_account_id = $2
      ORDER BY m.sent_at ASC, m.message_id ASC
    `, [threadId, req.user!.user_account_id]);

    if (messages.length === 0) return res.status(404).json({ error: 'Thread not found' });

    // Best-effort attachment backfill for the LATEST message — that's
    // the one the UI auto-expands. Older messages backfill on click
    // when their detail loads. Keeps thread-open latency bounded.
    const latest = messages[messages.length - 1];
    if (latest.has_attachments) {
      const existing = await queryOne<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM tbl_email_attachment WHERE message_id = $1`,
        [latest.message_id],
      );
      if (Number(existing?.count ?? 0) === 0) {
        try {
          await Promise.race([
            backfillAttachments(latest.message_id, req.user!.user_account_id),
            new Promise<number>((_, rej) => setTimeout(() => rej(new Error('backfill timeout')), 15000)),
          ]);
        } catch (err: any) {
          console.warn(`[mailbox] thread backfill msg ${latest.message_id} failed: ${err.message}`);
        }
      }
    }

    // Auto-mark every inbound message in the thread as read.
    await query(`
      UPDATE tbl_email_message
         SET read_at = COALESCE(read_at, NOW())
       WHERE thread_id = $1
         AND user_account_id = $2
         AND direction = 'in'
         AND read_at IS NULL
    `, [threadId, req.user!.user_account_id]);

    // Refresh the in-memory read_at flags so the response reflects the
    // just-updated state without an extra round-trip.
    for (const m of messages) {
      if (m.direction === 'in' && !m.read_at) m.read_at = new Date().toISOString();
    }

    // Per-message attachment metadata. Fetch in one query for the
    // whole thread, then group client-side here.
    const messageIds = messages.map(m => m.message_id);
    const attachments = await query<any>(`
      SELECT email_attachment_id, message_id, filename, content_type, size_bytes, is_inline, content_id
      FROM tbl_email_attachment
      WHERE message_id = ANY($1::int[])
      ORDER BY email_attachment_id
    `, [messageIds]);
    const attsByMessage: Record<number, any[]> = {};
    for (const a of attachments) {
      (attsByMessage[a.message_id] ??= []).push(a);
    }
    for (const m of messages) {
      m.attachments = attsByMessage[m.message_id] ?? [];
    }

    res.json({ thread_id: threadId, messages });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  GET /messages/:id — full body                                     */
/* ----------------------------------------------------------------- */

mailboxRouter.get('/messages/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const m = await queryOne(`
      SELECT
        m.*,
        a.email_address AS account_email
      FROM tbl_email_message m
      JOIN tbl_email_account a ON a.email_account_id = m.email_account_id
      WHERE m.message_id = $1 AND m.user_account_id = $2
    `, [id, req.user!.user_account_id]);
    if (!m) return res.status(404).json({ error: 'Message not found' });

    // Auto-mark inbound messages as read on first detail-fetch. Only
    // inbound (direction='in') — outbound messages are "read" by
    // definition (the user wrote them). COALESCE preserves the original
    // read_at if it's already set, so the stamp is stable.
    if (m.direction === 'in' && !m.read_at) {
      await query(`
        UPDATE tbl_email_message
           SET read_at = COALESCE(read_at, NOW())
         WHERE message_id = $1 AND user_account_id = $2
      `, [id, req.user!.user_account_id]);
      m.read_at = new Date().toISOString();
    }

    // Attachment metadata for this message (filename, size, inline flag,
    // content_id). Used by the frontend to:
    //  - rewrite cid: refs in body_html to point at /attachments/:id
    //  - show non-inline files as download chips at the bottom
    //
    // If has_attachments=true but nothing is stored locally, the message
    // was synced BEFORE the attachment-storage feature shipped. Pull the
    // original from IMAP on-demand and save the attachments now so the
    // inline images render. Bound at 8s — if IMAP is slow or the message
    // is gone we just return the message without attachments; the user
    // sees the body either way. Subsequent opens are fast because the
    // attachments are then in the DB.
    if (m.has_attachments) {
      const existing = await queryOne<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM tbl_email_attachment WHERE message_id = $1`,
        [id],
      );
      if (Number(existing?.count ?? 0) === 0) {
        const startedAt = Date.now();
        try {
          const saved = await Promise.race([
            backfillAttachments(id, req.user!.user_account_id),
            new Promise<number>((_, rej) => setTimeout(() => rej(new Error('backfill timeout')), 15000)),
          ]);
          console.log(`[mailbox] backfill msg ${id}: saved ${saved} attachment(s) in ${Date.now() - startedAt}ms`);
        } catch (err: any) {
          // Non-fatal — just log and continue. Common causes: IMAP slow,
          // message deleted from server, account creds rotated, folder
          // name on the server differs from what we synced.
          console.warn(`[mailbox] backfill msg ${id} failed in ${Date.now() - startedAt}ms: ${err.message}`);
        }
      }
    }

    const atts = await query<{
      email_attachment_id: number;
      filename: string;
      content_type: string | null;
      size_bytes: number;
      is_inline: boolean;
      content_id: string | null;
    }>(`
      SELECT email_attachment_id, filename, content_type, size_bytes, is_inline, content_id
      FROM tbl_email_attachment
      WHERE message_id = $1
      ORDER BY email_attachment_id
    `, [id]);
    m.attachments = atts;

    res.json(m);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  GET /messages/:id/attachments/:attachment_id — stream the bytes   */
/*  Inline images in the body and the download chips both hit this.   */
/*  Per-user scoped via the JOIN — you can only fetch attachments for */
/*  messages on your own user_account_id.                              */
/* ----------------------------------------------------------------- */

mailboxRouter.get('/messages/:id/attachments/:aid', async (req, res, next) => {
  try {
    const messageId = Number(req.params.id);
    const attId = Number(req.params.aid);
    if (!Number.isInteger(messageId) || messageId <= 0 || !Number.isInteger(attId) || attId <= 0) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const row = await queryOne<{
      filename: string;
      content_type: string | null;
      content: Buffer;
    }>(`
      SELECT a.filename, a.content_type, a.content
      FROM tbl_email_attachment a
      JOIN tbl_email_message m ON m.message_id = a.message_id
      WHERE a.email_attachment_id = $1
        AND a.message_id = $2
        AND m.user_account_id = $3
    `, [attId, messageId, req.user!.user_account_id]);
    if (!row) return res.status(404).json({ error: 'Attachment not found' });

    res.setHeader('Content-Type', row.content_type ?? 'application/octet-stream');
    // Long cache — attachment content is immutable per (message, attachment).
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    // Default to inline disposition so <img src=...> works in the body. The
    // download chip in the UI sets ?download=1 to force a save dialog.
    const disposition = req.query.download === '1' ? 'attachment' : 'inline';
    // Filename in UTF-8 per RFC 5987 so unicode names don't break headers.
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
    );
    res.send(row.content);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  POST /messages/:id/mark-unread — undo auto-read                   */
/* ----------------------------------------------------------------- */

mailboxRouter.post('/messages/:id/mark-unread', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    await query(
      `UPDATE tbl_email_message SET read_at = NULL WHERE message_id = $1 AND user_account_id = $2`,
      [id, req.user!.user_account_id],
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  POST /mark-all-read                                                */
/* ----------------------------------------------------------------- */

mailboxRouter.post('/mark-all-read', async (req, res, next) => {
  try {
    const result = await query<{ count: string }>(`
      WITH updated AS (
        UPDATE tbl_email_message
           SET read_at = NOW()
         WHERE user_account_id = $1
           AND direction = 'in'
           AND read_at IS NULL
         RETURNING 1
      )
      SELECT COUNT(*)::text AS count FROM updated
    `, [req.user!.user_account_id]);
    res.json({ marked: Number(result[0]?.count ?? 0) });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  POST /messages/:id/reply — send a reply                           */
/* ----------------------------------------------------------------- */

interface ReplyPayload {
  body_text?: string;
  body_html?: string;
  reply_all?: boolean;   // include original Cc list
  subject?: string;      // override; default = "Re: <original subject>"
  attachments?: Array<{ filename: string; content_base64: string; content_type?: string }>;
  /** Optional extra recipients added via the contact picker. Merged
   *  with the auto-computed defaults (reply target, reply_all cc). */
  to_extra?: string;
  cc_extra?: string;
  bcc_extra?: string;
}

mailboxRouter.post('/messages/:id/reply', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const body = req.body as ReplyPayload;
    if (!body.body_text?.trim() && !body.body_html?.trim()) {
      return res.status(400).json({ error: 'Reply body is required.' });
    }

    const orig = await queryOne<any>(`
      SELECT m.*, a.email_address AS account_email,
             a.email_account_id
      FROM tbl_email_message m
      JOIN tbl_email_account a ON a.email_account_id = m.email_account_id
      WHERE m.message_id = $1 AND m.user_account_id = $2
    `, [id, req.user!.user_account_id]);
    if (!orig) return res.status(404).json({ error: 'Original message not found' });

    // Reply target: the From address of inbound messages, or the To
    // address of outbound (so "reply to my own sent message" still
    // reaches the original recipient).
    const replyTo = orig.direction === 'in' ? orig.from_address : firstOf(orig.to_addresses);
    if (!replyTo) return res.status(400).json({ error: 'No recipient on original message.' });

    const acct = await queryOne<EmailAccountRow & { signature: string | null }>(`
      SELECT email_account_id, email_address, username,
             imap_host, imap_port, imap_secure,
             smtp_host, smtp_port, smtp_secure, encrypted_password,
             signature
      FROM tbl_email_account
      WHERE email_account_id = $1
    `, [orig.email_account_id]);
    if (!acct) return res.status(404).json({ error: 'Account not found' });

    const subject = body.subject?.trim()
      || (orig.subject?.toLowerCase().startsWith('re:') ? orig.subject : `Re: ${orig.subject ?? ''}`);

    // Merge auto-computed defaults with any extras the user added via
    // the contact picker. Dedupe case-insensitively so the same address
    // doesn't end up in the list twice.
    const finalTo = mergeAddresses(replyTo, body.to_extra);
    const finalCc = mergeAddresses(
      body.reply_all ? (orig.cc_addresses || null) : null,
      body.cc_extra,
    );
    const finalBcc = mergeAddresses(null, body.bcc_extra);

    const attachments = (body.attachments ?? []).map(a => ({
      filename: a.filename,
      content: Buffer.from(a.content_base64, 'base64'),
      contentType: a.content_type,
    }));

    // Append the user's signature to the reply body (text and/or html).
    // Mirrors the behaviour in /api/email/send so signatures show up
    // whether the user composes new or replies.
    const sig = acct.signature;
    const textWithSig = body.body_text && sig
      ? `${body.body_text.replace(/\s+$/, '')}\n\n${sig}\n`
      : body.body_text;
    const htmlWithSig = body.body_html && sig
      ? `${body.body_html}<br><br><pre style="font-family:inherit;white-space:pre-wrap;margin:0">${escapeHtml(sig)}</pre>`
      : body.body_html;

    const transporter = buildSmtpTransporter(acct);
    try {
      const info = await transporter.sendMail({
        from: acct.email_address,
        to: finalTo || undefined,
        cc: finalCc || undefined,
        bcc: finalBcc || undefined,
        subject,
        text: textWithSig || undefined,
        html: htmlWithSig || undefined,
        inReplyTo: orig.message_id_header ?? undefined,
        references: orig.message_id_header ?? undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      try {
        await recordSentMessage({
          userId: req.user!.user_account_id,
          emailAccountId: acct.email_account_id,
          fromAddress: acct.email_address,
          fromName: null,
          to: finalTo || replyTo,
          cc: finalCc || null,
          bcc: finalBcc || null,
          subject,
          bodyText: textWithSig ?? null,
          bodyHtml: htmlWithSig ?? null,
          messageIdHeader: info.messageId ?? null,
          inReplyTo: orig.message_id_header ?? null,
          hasAttachments: attachments.length > 0,
        });
      } catch (err: any) {
        console.error('[mailbox:reply] recordSentMessage failed:', err.message);
      }

      res.json({ messageId: info.messageId, accepted: info.accepted, rejected: info.rejected });
    } finally {
      transporter.close();
    }
  } catch (err: any) {
    next(err);
  }
});

function firstOf(csv: string | null): string | null {
  if (!csv) return null;
  return csv.split(',').map(s => s.trim()).filter(Boolean)[0] ?? null;
}

/** Combine two comma-separated address lists, trim each entry, drop
 *  blanks, and dedupe case-insensitively. Used to merge auto-computed
 *  reply recipients with any extras the user added via the picker. */
function mergeAddresses(a: string | null | undefined, b: string | null | undefined): string {
  const all = [a, b].filter(Boolean).join(',');
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of all.split(',')) {
    const s = part.trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out.join(', ');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
