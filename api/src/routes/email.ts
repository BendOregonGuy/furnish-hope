/**
 * Email account management + send. Accounts are PER-USER — each row
 * belongs to a single `tbl_user_account`. Listing only returns
 * accounts owned by the requester.
 *
 *   GET    /api/email/providers            preset list for the connect UI
 *   GET    /api/email/accounts             current user's accounts
 *   POST   /api/email/accounts             connect a new account
 *   GET    /api/email/accounts/:id         account detail (no password)
 *   PUT    /api/email/accounts/:id         update (password optional — only
 *                                          re-set if a non-empty string)
 *   DELETE /api/email/accounts/:id         disconnect
 *   POST   /api/email/accounts/:id/test    live IMAP + SMTP test;
 *                                          stamps last_test_*
 *   POST   /api/email/accounts/:id/default mark this account as default for send
 *   POST   /api/email/send                 send a message (Phase 4B)
 */

import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditCreate, auditDelete, auditUpdate } from '../auth/audit.js';
import { encryptSecret } from '../email/crypto.js';
import { PROVIDERS, getProvider } from '../email/providers.js';
import { buildSmtpTransporter, testImap, testSmtp, type EmailAccountRow } from '../email/transports.js';
import { recordSentMessage } from '../email/sync.js';

export const emailRouter = Router();

/* ----------------------------------------------------------------- */
/*  GET /api/email/providers                                          */
/* ----------------------------------------------------------------- */

emailRouter.get('/providers', (_req, res) => {
  // Strip the password URLs into a list shape the UI can iterate; presets are
  // already public, no encryption concerns.
  res.json({ providers: Object.values(PROVIDERS) });
});

/* ----------------------------------------------------------------- */
/*  GET /api/email/accounts                                           */
/* ----------------------------------------------------------------- */

emailRouter.get('/accounts', async (req, res, next) => {
  try {
    const userId = req.user!.user_account_id;
    const rows = await query(`
      SELECT email_account_id, display_name, email_address, provider,
             auth_type, imap_host, imap_port, imap_secure,
             smtp_host, smtp_port, smtp_secure, username,
             is_default_send, last_tested_at, last_test_status, last_test_error,
             signature, created_at,
             (encrypted_password IS NOT NULL) AS has_password
        FROM tbl_email_account
       WHERE user_account_id = $1
       ORDER BY is_default_send DESC, created_at DESC
    `, [userId]);
    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  GET /api/email/accounts/:id                                       */
/* ----------------------------------------------------------------- */

emailRouter.get('/accounts/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const row = await queryOne(`
      SELECT email_account_id, display_name, email_address, provider,
             auth_type, imap_host, imap_port, imap_secure,
             smtp_host, smtp_port, smtp_secure, username,
             is_default_send, last_tested_at, last_test_status, last_test_error,
             signature, created_at,
             (encrypted_password IS NOT NULL) AS has_password
        FROM tbl_email_account
       WHERE email_account_id = $1 AND user_account_id = $2
    `, [id, req.user!.user_account_id]);
    if (!row) return res.status(404).json({ error: 'Email account not found' });
    res.json(row);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  POST /api/email/accounts                                          */
/* ----------------------------------------------------------------- */

interface AccountWritePayload {
  display_name?: string | null;
  email_address: string;
  provider: string;
  imap_host?: string | null;
  imap_port?: number | null;
  imap_secure?: boolean;
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_secure?: boolean;
  username?: string | null;
  password?: string;
  is_default_send?: boolean;
  /** Plain-text signature appended to outbound mail (and replies). */
  signature?: string | null;
}

emailRouter.post('/accounts', async (req, res, next) => {
  try {
    const userId = req.user!.user_account_id;
    const body = applyPreset(req.body as AccountWritePayload);
    const errs = validate(body, /*isCreate*/ true);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    const newId = await withTransaction(async (tx) => {
      if (body.is_default_send) {
        await tx.query(
          `UPDATE tbl_email_account SET is_default_send = false WHERE user_account_id = $1`,
          [userId],
        );
      }
      const r = await tx.queryOne<Record<string, any>>(`
        INSERT INTO tbl_email_account
          (user_account_id, display_name, email_address, provider,
           imap_host, imap_port, imap_secure,
           smtp_host, smtp_port, smtp_secure,
           username, encrypted_password, is_default_send, signature)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `, [
        userId, body.display_name ?? null, body.email_address.trim(), body.provider,
        body.imap_host ?? null, body.imap_port ?? null, body.imap_secure ?? true,
        body.smtp_host ?? null, body.smtp_port ?? null, body.smtp_secure ?? false,
        body.username ?? body.email_address.trim(),
        body.password ? encryptSecret(body.password) : null,
        body.is_default_send ?? false,
        body.signature ?? null,
      ]);
      await auditCreate(req, 'tbl_email_account', r!.email_account_id, redactForAudit(r!), tx);
      return r!.email_account_id;
    });
    res.status(201).json({ email_account_id: newId });
  } catch (err) {
    if ((err as any)?.code === '23505') {
      return res.status(409).json({ error: 'You already have an account connected for this email address.' });
    }
    next(err);
  }
});

/* ----------------------------------------------------------------- */
/*  PUT /api/email/accounts/:id                                       */
/* ----------------------------------------------------------------- */

emailRouter.put('/accounts/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user!.user_account_id;
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const body = applyPreset(req.body as AccountWritePayload);
    const errs = validate(body, /*isCreate*/ false);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    await withTransaction(async (tx) => {
      const before = await tx.queryOne<Record<string, any>>(
        `SELECT * FROM tbl_email_account WHERE email_account_id = $1 AND user_account_id = $2`,
        [id, userId],
      );
      if (!before) throw withStatus(404, 'Email account not found');

      if (body.is_default_send) {
        await tx.query(
          `UPDATE tbl_email_account SET is_default_send = false WHERE user_account_id = $1 AND email_account_id <> $2`,
          [userId, id],
        );
      }

      // Preserve existing password unless caller sent a new non-empty one.
      const newEncrypted = body.password && body.password.length > 0
        ? encryptSecret(body.password)
        : before.encrypted_password;

      // Preserve existing signature when caller omits the field (undefined)
      // — only overwrite when they explicitly pass it (including null/empty).
      const newSignature = body.signature === undefined ? before.signature : body.signature;

      const after = await tx.queryOne<Record<string, any>>(`
        UPDATE tbl_email_account
           SET display_name = $1, email_address = $2, provider = $3,
               imap_host = $4, imap_port = $5, imap_secure = $6,
               smtp_host = $7, smtp_port = $8, smtp_secure = $9,
               username = $10, encrypted_password = $11, is_default_send = $12,
               signature = $13,
               -- clear stale test result on edit so the user re-tests
               last_tested_at = NULL, last_test_status = NULL, last_test_error = NULL
         WHERE email_account_id = $14 AND user_account_id = $15
         RETURNING *
      `, [
        body.display_name ?? null, body.email_address.trim(), body.provider,
        body.imap_host ?? null, body.imap_port ?? null, body.imap_secure ?? true,
        body.smtp_host ?? null, body.smtp_port ?? null, body.smtp_secure ?? false,
        body.username ?? body.email_address.trim(),
        newEncrypted,
        body.is_default_send ?? false,
        newSignature,
        id, userId,
      ]);
      if (after) await auditUpdate(req, 'tbl_email_account', id, redactForAudit(before), redactForAudit(after), tx);
    });
    res.json({ email_account_id: id });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  DELETE /api/email/accounts/:id                                    */
/* ----------------------------------------------------------------- */

emailRouter.delete('/accounts/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user!.user_account_id;
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    await withTransaction(async (tx) => {
      const before = await tx.queryOne<Record<string, any>>(
        `SELECT * FROM tbl_email_account WHERE email_account_id = $1 AND user_account_id = $2`,
        [id, userId],
      );
      if (!before) throw withStatus(404, 'Email account not found');
      await tx.query(`DELETE FROM tbl_email_account WHERE email_account_id = $1`, [id]);
      await auditDelete(req, 'tbl_email_account', id, redactForAudit(before), tx);
    });
    res.status(204).end();
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  POST /api/email/accounts/:id/test                                  */
/* ----------------------------------------------------------------- */

emailRouter.post('/accounts/:id/test', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user!.user_account_id;
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const acct = await queryOne<EmailAccountRow>(`
      SELECT email_account_id, email_address, username,
             imap_host, imap_port, imap_secure,
             smtp_host, smtp_port, smtp_secure, encrypted_password
        FROM tbl_email_account
       WHERE email_account_id = $1 AND user_account_id = $2
    `, [id, userId]);
    if (!acct) return res.status(404).json({ error: 'Email account not found' });

    let status: 'success' | 'failure' = 'success';
    let errMsg: string | null = null;
    const detail: Record<string, string> = { imap: 'ok', smtp: 'ok' };

    try {
      await testImap(acct);
    } catch (e: any) {
      status = 'failure';
      detail.imap = `failed: ${shortErr(e)}`;
      errMsg = `IMAP: ${shortErr(e)}`;
    }
    try {
      await testSmtp(acct);
    } catch (e: any) {
      status = 'failure';
      detail.smtp = `failed: ${shortErr(e)}`;
      errMsg = errMsg ? `${errMsg}; SMTP: ${shortErr(e)}` : `SMTP: ${shortErr(e)}`;
    }

    await query(`
      UPDATE tbl_email_account
         SET last_tested_at = NOW(),
             last_test_status = $1,
             last_test_error = $2
       WHERE email_account_id = $3
    `, [status, errMsg, id]);

    if (status === 'success') {
      res.json({ status, detail });
    } else {
      res.status(400).json({ status, detail, error: errMsg });
    }
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  POST /api/email/accounts/:id/default                              */
/* ----------------------------------------------------------------- */

emailRouter.post('/accounts/:id/default', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user!.user_account_id;
    await withTransaction(async (tx) => {
      const exists = await tx.queryOne<{ id: number }>(
        `SELECT email_account_id AS id FROM tbl_email_account WHERE email_account_id = $1 AND user_account_id = $2`,
        [id, userId],
      );
      if (!exists) throw withStatus(404, 'Email account not found');
      await tx.query(`UPDATE tbl_email_account SET is_default_send = false WHERE user_account_id = $1`, [userId]);
      await tx.query(`UPDATE tbl_email_account SET is_default_send = true WHERE email_account_id = $1`, [id]);
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  GET /api/email/contact-picker?q=<search>&type=<filter>            */
/*                                                                    */
/*  Powers the "+ Contact" affordance next to To / Cc / Bcc fields    */
/*  in the Compose and Reply forms. Returns up to 100 contacts (with  */
/*  emails on file) drawn from staff, volunteers, donors, clients,    */
/*  and agency contacts.                                              */
/*                                                                    */
/*  Filters:                                                          */
/*    type=all (default) | staff | volunteer | donor | client | agency*/
/*    q=<substring>      matched case-insensitively against name+email*/
/* ----------------------------------------------------------------- */

const PICKER_TYPES = new Set(['all', 'staff', 'volunteer', 'donor', 'client', 'agency']);

emailRouter.get('/contact-picker', async (req, res, next) => {
  try {
    const rawType = String(req.query.type ?? 'all').toLowerCase();
    const type = PICKER_TYPES.has(rawType) ? rawType : 'all';
    const q = String(req.query.q ?? '').trim();
    const qParam = q.length > 0 ? `%${q.toLowerCase()}%` : null;

    // UNION across every place a contact lives. Each branch filters
    // to contacts that actually have an email — contacts with no email
    // can't be picked as a recipient, so we exclude them from the list
    // rather than show them disabled (less visual noise).
    const rows = await query<{
      display_name: string;
      email: string;
      type_label: string;
      entity_type: string;
      entity_id: number;
    }>(`
      WITH all_contacts AS (
        -- Paid staff
        SELECT
          (c.first_name || ' ' || c.last_name) AS display_name,
          c.email AS email,
          'Staff' AS type_label,
          'staff' AS entity_type,
          fs.facility_staff_id AS entity_id
        FROM tbl_facility_staff fs
        JOIN tbl_contact c ON c.contact_id = fs.contact_id
        WHERE fs.is_volunteer = false AND c.email IS NOT NULL AND c.email <> ''

        UNION ALL

        -- Volunteers
        SELECT
          (c.first_name || ' ' || c.last_name),
          c.email,
          'Volunteer',
          'volunteer',
          fs.facility_staff_id
        FROM tbl_facility_staff fs
        JOIN tbl_contact c ON c.contact_id = fs.contact_id
        WHERE fs.is_volunteer = true AND c.email IS NOT NULL AND c.email <> ''

        UNION ALL

        -- Donors (via their primary contact)
        SELECT
          (c.first_name || ' ' || c.last_name),
          c.email,
          'Donor',
          'donor',
          d.donor_id
        FROM tbl_donor d
        JOIN tbl_contact c ON c.contact_id = d.contact_id
        WHERE c.email IS NOT NULL AND c.email <> ''

        UNION ALL

        -- Clients
        SELECT
          (c.first_name || ' ' || c.last_name),
          c.email,
          'Client',
          'client',
          cl.client_id
        FROM tbl_client cl
        JOIN tbl_contact c ON c.contact_id = cl.contact_id
        WHERE c.email IS NOT NULL AND c.email <> ''

        UNION ALL

        -- Agency contacts — name includes the agency in parens so
        -- you can tell two same-named contacts apart.
        SELECT
          (c.first_name || ' ' || c.last_name || ' (' || ag.agency_name || ')'),
          c.email,
          'Agency',
          'agency',
          ac.agency_contact_id
        FROM tbl_agency_contact ac
        JOIN tbl_contact c ON c.contact_id = ac.contact_id
        JOIN tbl_agency ag ON ag.agency_id = ac.agency_id
        WHERE c.email IS NOT NULL AND c.email <> ''
      )
      SELECT display_name, email, type_label, entity_type, entity_id
      FROM all_contacts
      WHERE
        ($1::text = 'all' OR entity_type = $1)
        AND ($2::text IS NULL
             OR LOWER(display_name) LIKE $2
             OR LOWER(email) LIKE $2)
      ORDER BY display_name
      LIMIT 100
    `, [type, qParam]);

    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  POST /api/email/send  (Phase 4B)                                  */
/* ----------------------------------------------------------------- */

interface SendPayload {
  /** Which connected account to send from. If omitted, uses the default. */
  email_account_id?: number;
  to: string;          // comma-separated supported
  cc?: string;
  bcc?: string;
  subject: string;
  body_text?: string;
  body_html?: string;
  /** Attachments: array of { filename, content_base64, content_type } */
  attachments?: Array<{ filename: string; content_base64: string; content_type?: string }>;
}

emailRouter.post('/send', async (req, res, next) => {
  try {
    const userId = req.user!.user_account_id;
    const body = req.body as SendPayload;
    const errs = validateSend(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    // Pick the account: explicit, else default, else error.
    let acct: EmailAccountRow | null;
    if (body.email_account_id) {
      acct = await queryOne<EmailAccountRow & { signature: string | null }>(`
        SELECT email_account_id, email_address, username,
               imap_host, imap_port, imap_secure,
               smtp_host, smtp_port, smtp_secure, encrypted_password,
               signature
          FROM tbl_email_account
         WHERE email_account_id = $1 AND user_account_id = $2
      `, [body.email_account_id, userId]);
    } else {
      acct = await queryOne<EmailAccountRow & { signature: string | null }>(`
        SELECT email_account_id, email_address, username,
               imap_host, imap_port, imap_secure,
               smtp_host, smtp_port, smtp_secure, encrypted_password,
               signature
          FROM tbl_email_account
         WHERE user_account_id = $1 AND is_default_send = true
      `, [userId]);
    }
    if (!acct) return res.status(400).json({ error: 'No email account selected and no default set.' });

    // Append the account's signature to the outgoing body. The
    // signature is plain text — if the caller is sending plain text we
    // tack it on with a blank line; if they're sending HTML we wrap it
    // in <pre> so newlines are preserved. Caller can suppress by
    // passing { skip_signature: true } (used by the bulk receipt
    // sender, which already builds its own footer).
    const sig: string | null = (acct as any).signature ?? null;
    const skipSig: boolean = !!(body as any).skip_signature;
    const textWithSig = body.body_text && sig && !skipSig
      ? `${body.body_text.replace(/\s+$/, '')}\n\n${sig}\n`
      : body.body_text;
    const htmlWithSig = body.body_html && sig && !skipSig
      ? `${body.body_html}<br><br><pre style="font-family:inherit;white-space:pre-wrap;margin:0">${escapeHtml(sig)}</pre>`
      : body.body_html;

    const transporter = buildSmtpTransporter(acct);
    try {
      const info = await transporter.sendMail({
        from: acct.email_address,
        to: body.to,
        cc: body.cc || undefined,
        bcc: body.bcc || undefined,
        subject: body.subject,
        text: textWithSig || undefined,
        html: htmlWithSig || undefined,
        attachments: (body.attachments ?? []).map(a => ({
          filename: a.filename,
          content: Buffer.from(a.content_base64, 'base64'),
          contentType: a.content_type,
        })),
      });

      // Cache locally so the user sees the sent message immediately,
      // without waiting for the next IMAP sync of the Sent folder.
      // De-dupes against the eventual IMAP copy via Message-Id.
      try {
        await recordSentMessage({
          userId,
          emailAccountId: acct.email_account_id,
          fromAddress: acct.email_address,
          fromName: null,
          to: body.to,
          cc: body.cc ?? null,
          bcc: body.bcc ?? null,
          subject: body.subject,
          bodyText: textWithSig ?? null,
          bodyHtml: htmlWithSig ?? null,
          messageIdHeader: info.messageId ?? null,
          inReplyTo: (body as any).in_reply_to ?? null,
          hasAttachments: (body.attachments ?? []).length > 0,
        });
      } catch (err: any) {
        console.error('[email:send] recordSentMessage failed (sent OK, just cache miss):', err.message);
      }

      res.json({ messageId: info.messageId, accepted: info.accepted, rejected: info.rejected });
    } finally {
      transporter.close();
    }
  } catch (err: any) {
    next(withStatus(502, `Send failed: ${shortErr(err)}`));
  }
});

/* ================================================================= */
/*  Helpers                                                           */
/* ================================================================= */

/** Merge user input with the provider preset so the UI can send minimal
 *  fields (provider + email + password) and we fill in IMAP/SMTP. */
function applyPreset(body: AccountWritePayload): AccountWritePayload {
  const preset = getProvider(body?.provider);
  return {
    ...body,
    provider: preset.id,
    imap_host: body.imap_host || preset.imap_host || null,
    imap_port: body.imap_port ?? preset.imap_port ?? null,
    imap_secure: body.imap_secure ?? preset.imap_secure,
    smtp_host: body.smtp_host || preset.smtp_host || null,
    smtp_port: body.smtp_port ?? preset.smtp_port ?? null,
    smtp_secure: body.smtp_secure ?? preset.smtp_secure,
  };
}

function validate(b: AccountWritePayload, isCreate: boolean): string[] {
  const errs: string[] = [];
  if (!b?.email_address || !/^.+@.+\..+$/.test(b.email_address)) errs.push('valid email_address required');
  if (!b?.provider || !PROVIDERS[b.provider]) errs.push('provider must be one of: ' + Object.keys(PROVIDERS).join(', '));
  if (isCreate && !b?.password) errs.push('password required on create');
  if (b?.provider === 'imap') {
    if (!b.imap_host) errs.push('imap_host required for custom IMAP');
    if (!b.smtp_host) errs.push('smtp_host required for custom IMAP');
  }
  return errs;
}

function validateSend(b: SendPayload): string[] {
  const errs: string[] = [];
  if (!b?.to?.trim()) errs.push('to required');
  if (!b?.subject?.trim()) errs.push('subject required');
  if (!b?.body_text && !b?.body_html) errs.push('body_text or body_html required');
  return errs;
}

function withStatus(status: number, message: string): Error {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

/** Trim noisy IMAP/SMTP error messages down to something useful. */
function shortErr(e: any): string {
  if (!e) return 'unknown';
  const msg = String(e.message ?? e);
  return msg.length > 240 ? msg.slice(0, 240) + '…' : msg;
}

/** Escape plain text for safe inclusion inside an HTML email body
 *  (used when appending a plain-text signature to an HTML message). */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Strip encrypted_password before logging in the audit log. */
function redactForAudit(row: Record<string, any>): Record<string, any> {
  const r = { ...row };
  if ('encrypted_password' in r) r.encrypted_password = r.encrypted_password ? '***' : null;
  return r;
}
