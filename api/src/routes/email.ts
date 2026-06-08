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
import { randomBytes } from 'node:crypto';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditCreate, auditDelete, auditUpdate } from '../auth/audit.js';
import { encryptSecret } from '../email/crypto.js';
import { PROVIDERS, getProvider } from '../email/providers.js';
import { buildSmtpTransporter, testImap, testSmtp, type EmailAccountRow } from '../email/transports.js';
import { recordSentMessage } from '../email/sync.js';
import {
  OAUTH_PROVIDERS,
  getOAuthCredentials,
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  fetchUserInfo,
  type OAuthProviderId,
} from '../email/oauth.js';

export const emailRouter = Router();

/* ----------------------------------------------------------------- */
/*  GET /api/email/providers                                          */
/* ----------------------------------------------------------------- */

emailRouter.get('/providers', (_req, res) => {
  // Presets are public (host/port/notes), no encryption concerns.
  //
  // Decorate each preset with oauth_available — true only when the
  // provider declares an oauth_provider AND we have the OAuth client
  // credentials set in env vars. Lets the UI render the "Sign in
  // with…" button only when it'll actually work, keeping the connect
  // form clean during the password-only dev phase.
  const oauthAvail: Record<string, boolean> = {
    google:    !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET),
    microsoft: !!(process.env.MICROSOFT_OAUTH_CLIENT_ID && process.env.MICROSOFT_OAUTH_CLIENT_SECRET),
  };
  const providers = Object.values(PROVIDERS).map(p => ({
    ...p,
    oauth_available: p.oauth_provider ? !!oauthAvail[p.oauth_provider] : false,
  }));
  res.json({ providers });
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
             smtp_host, smtp_port, smtp_secure, encrypted_password, auth_type
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
/*  OAuth — Google (Gmail) and Microsoft (Outlook / O365)             */
/*                                                                    */
/*  GET  /api/email/oauth/:provider/start                             */
/*    Returns { url } the client should redirect to. Stashes a CSRF   */
/*    state nonce in the session.                                     */
/*                                                                    */
/*  GET  /api/email/oauth/callback?code=&state=                       */
/*    Provider redirects here. We verify state, exchange code for     */
/*    tokens, fetch the user's email, INSERT the row, redirect back   */
/*    to /email/accounts in the SPA.                                  */
/* ----------------------------------------------------------------- */

declare module 'express-session' {
  interface SessionData {
    emailOAuthState?: {
      nonce: string;
      provider: OAuthProviderId;
      createdAt: number;
    };
  }
}

function oauthRedirectUri(req: any): string {
  // Honor APP_BASE_URL when set (DO production), else derive from the
  // request. Critical that this matches EXACTLY what's registered in
  // the provider console — even trailing slash differences break it.
  const base = process.env.APP_BASE_URL?.replace(/\/$/, '')
    ?? `${req.protocol}://${req.get('host')}`;
  return `${base}/api/email/oauth/callback`;
}

emailRouter.get('/oauth/:provider/start', (req, res, next) => {
  try {
    const providerId = req.params.provider as OAuthProviderId;
    const provider = OAUTH_PROVIDERS[providerId];
    if (!provider) return res.status(400).json({ error: 'Unknown OAuth provider' });

    const { clientId } = getOAuthCredentials(providerId); // throws if env vars missing
    const nonce = randomBytes(24).toString('hex');
    req.session.emailOAuthState = { nonce, provider: providerId, createdAt: Date.now() };

    const url = buildAuthorizeUrl(provider, clientId, oauthRedirectUri(req), nonce);
    res.json({ url });
  } catch (err: any) { next(err); }
});

emailRouter.get('/oauth/callback', async (req, res, next) => {
  try {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const oauthErr = req.query.error as string | undefined;

    // Provider returned an error (user denied, etc).
    if (oauthErr) {
      return res.redirect(`/email/accounts?oauth_error=${encodeURIComponent(oauthErr)}`);
    }
    if (!code || !state) return res.status(400).send('Missing code or state');

    // Verify the state nonce we stashed at /start.
    const stashed = req.session.emailOAuthState;
    if (!stashed || stashed.nonce !== state) return res.status(400).send('Invalid OAuth state');
    if (Date.now() - stashed.createdAt > 10 * 60 * 1000) return res.status(400).send('OAuth state expired — try again');

    const provider = OAUTH_PROVIDERS[stashed.provider];
    const { clientId, clientSecret } = getOAuthCredentials(stashed.provider);
    const redirectUri = oauthRedirectUri(req);

    // Exchange code → tokens, then fetch the user's email.
    const tokens = await exchangeCodeForTokens(provider, clientId, clientSecret, redirectUri, code);
    if (!tokens.refresh_token) {
      // Without a refresh_token we couldn't keep this account working
      // past the first hour. Force the user to retry; Google requires
      // prompt=consent to issue one, which we already pass.
      return res.redirect(`/email/accounts?oauth_error=${encodeURIComponent('No refresh token received. Please disconnect and try again.')}`);
    }
    // Pull into a local so TS narrows for use inside the closures below.
    const refreshToken: string = tokens.refresh_token;
    const { email } = await fetchUserInfo(provider, tokens.access_token);

    // Clear the one-time state.
    req.session.emailOAuthState = undefined;

    const userId = req.user!.user_account_id;
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Upsert the account. If the user reconnects an account they
    // already have (same email + user), we update the tokens rather
    // than failing on the unique constraint.
    await withTransaction(async (tx) => {
      const existing = await tx.queryOne<{ email_account_id: number }>(
        `SELECT email_account_id FROM tbl_email_account
          WHERE user_account_id = $1 AND LOWER(email_address) = LOWER($2)`,
        [userId, email],
      );

      if (existing) {
        await tx.query(`
          UPDATE tbl_email_account
             SET auth_type = 'oauth',
                 oauth_provider = $1,
                 oauth_access_token_enc = $2,
                 oauth_refresh_token_enc = $3,
                 oauth_expires_at = $4,
                 oauth_scope = $5,
                 imap_host = $6, imap_port = $7, imap_secure = $8,
                 smtp_host = $9, smtp_port = $10, smtp_secure = $11,
                 username = $12,
                 last_tested_at = NULL, last_test_status = NULL, last_test_error = NULL
           WHERE email_account_id = $13
        `, [
          stashed.provider,
          encryptSecret(tokens.access_token),
          encryptSecret(refreshToken),
          expiresAt,
          tokens.scope ?? provider.scopes.join(' '),
          provider.imap.host, provider.imap.port, provider.imap.secure,
          provider.smtp.host, provider.smtp.port, provider.smtp.secure,
          email,
          existing.email_account_id,
        ]);
      } else {
        await tx.query(`
          INSERT INTO tbl_email_account
            (user_account_id, email_address, provider, auth_type,
             oauth_provider, oauth_access_token_enc, oauth_refresh_token_enc,
             oauth_expires_at, oauth_scope,
             imap_host, imap_port, imap_secure,
             smtp_host, smtp_port, smtp_secure,
             username, is_default_send)
          VALUES ($1, $2, $3, 'oauth', $4, $5, $6, $7, $8,
                  $9, $10, $11, $12, $13, $14, $15,
                  NOT EXISTS (SELECT 1 FROM tbl_email_account WHERE user_account_id = $1))
        `, [
          userId, email, provider.accountProvider,
          stashed.provider,
          encryptSecret(tokens.access_token),
          encryptSecret(refreshToken),
          expiresAt,
          tokens.scope ?? provider.scopes.join(' '),
          provider.imap.host, provider.imap.port, provider.imap.secure,
          provider.smtp.host, provider.smtp.port, provider.smtp.secure,
          email,
        ]);
      }
    });

    res.redirect(`/email/accounts?oauth=success&provider=${stashed.provider}&email=${encodeURIComponent(email)}`);
  } catch (err: any) {
    console.error('[email:oauth callback]', err);
    res.redirect(`/email/accounts?oauth_error=${encodeURIComponent(err.message ?? 'OAuth callback failed')}`);
  }
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

const PICKER_TYPES = new Set(['all', 'staff', 'volunteer', 'donor', 'client', 'agency', 'vendor']);

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

        UNION ALL

        -- Vendors / suppliers / trades-people. Prefer business name
        -- over personal when present so "Bend Plumbing" wins over
        -- "Joe Smith" in the picker. Inactive vendors hidden.
        SELECT
          COALESCE(v.business_name, c.first_name || ' ' || c.last_name) ||
            (CASE WHEN vs.vendor_specialty IS NOT NULL THEN ' — ' || vs.vendor_specialty ELSE '' END),
          c.email,
          'Vendor',
          'vendor',
          v.vendor_id
        FROM tbl_vendor v
        JOIN tbl_contact c ON c.contact_id = v.contact_id
        LEFT JOIN lkp_vendor_specialty vs ON vs.vendor_specialty_id = v.vendor_specialty_id
        WHERE v.is_active = true AND c.email IS NOT NULL AND c.email <> ''
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
               smtp_host, smtp_port, smtp_secure, encrypted_password, auth_type,
               signature
          FROM tbl_email_account
         WHERE email_account_id = $1 AND user_account_id = $2
      `, [body.email_account_id, userId]);
    } else {
      acct = await queryOne<EmailAccountRow & { signature: string | null }>(`
        SELECT email_account_id, email_address, username,
               imap_host, imap_port, imap_secure,
               smtp_host, smtp_port, smtp_secure, encrypted_password, auth_type,
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

    const transporter = await buildSmtpTransporter(acct);
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
