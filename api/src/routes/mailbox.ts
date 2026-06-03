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
import { syncAllAccountsForUser } from '../email/sync.js';
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
/*  GET /messages — list                                              */
/*                                                                    */
/*  Filters (all optional):                                           */
/*    folder=inbox|sent                                               */
/*    account_id=<int>                                                */
/*    participant=<email-address>   (case-insensitive match against   */
/*                                   from_address OR to_addresses     */
/*                                   OR cc_addresses)                 */
/*    q=<text>                      (full-text-ish ILIKE on subject + */
/*                                   from_name + body_preview)        */
/*    limit (default 50, max 200)                                     */
/* ----------------------------------------------------------------- */

mailboxRouter.get('/messages', async (req, res, next) => {
  try {
    const userId = req.user!.user_account_id;
    const folder = (req.query.folder as string | undefined)?.toLowerCase();
    const accountId = req.query.account_id ? Number(req.query.account_id) : null;
    const participant = (req.query.participant as string | undefined)?.toLowerCase().trim() || null;
    const q = (req.query.q as string | undefined)?.trim() || null;
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));

    const conds: string[] = ['m.user_account_id = $1'];
    const params: any[] = [userId];
    if (folder === 'inbox') conds.push(`m.direction = 'in'`);
    else if (folder === 'sent') conds.push(`m.direction = 'out'`);
    if (accountId) { params.push(accountId); conds.push(`m.email_account_id = $${params.length}`); }
    if (participant) {
      params.push(participant);
      conds.push(`(
        LOWER(m.from_address) = $${params.length}
        OR POSITION($${params.length} IN LOWER(m.to_addresses))  > 0
        OR POSITION($${params.length} IN LOWER(m.cc_addresses))  > 0
        OR POSITION($${params.length} IN LOWER(m.bcc_addresses)) > 0
      )`);
    }
    if (q) {
      params.push(`%${q}%`);
      conds.push(`(m.subject ILIKE $${params.length} OR m.from_name ILIKE $${params.length} OR m.body_preview ILIKE $${params.length})`);
    }
    params.push(limit);

    const rows = await query(`
      SELECT
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
        a.email_address AS account_email
      FROM tbl_email_message m
      JOIN tbl_email_account a ON a.email_account_id = m.email_account_id
      WHERE ${conds.join(' AND ')}
      ORDER BY m.sent_at DESC
      LIMIT $${params.length}
    `, params);

    res.json(rows);
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

    res.json(m);
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

    const acct = await queryOne<EmailAccountRow>(`
      SELECT email_account_id, email_address, username,
             imap_host, imap_port, imap_secure,
             smtp_host, smtp_port, smtp_secure, encrypted_password
      FROM tbl_email_account
      WHERE email_account_id = $1
    `, [orig.email_account_id]);
    if (!acct) return res.status(404).json({ error: 'Account not found' });

    const subject = body.subject?.trim()
      || (orig.subject?.toLowerCase().startsWith('re:') ? orig.subject : `Re: ${orig.subject ?? ''}`);
    const cc = body.reply_all ? (orig.cc_addresses || undefined) : undefined;

    const attachments = (body.attachments ?? []).map(a => ({
      filename: a.filename,
      content: Buffer.from(a.content_base64, 'base64'),
      contentType: a.content_type,
    }));

    const transporter = buildSmtpTransporter(acct);
    try {
      const info = await transporter.sendMail({
        from: acct.email_address,
        to: replyTo,
        cc,
        subject,
        text: body.body_text || undefined,
        html: body.body_html || undefined,
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
          to: replyTo,
          cc: cc ?? null,
          bcc: null,
          subject,
          bodyText: body.body_text ?? null,
          bodyHtml: body.body_html ?? null,
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
