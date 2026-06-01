/**
 * QuickBooks Online integration endpoints. Admin-only because accounting
 * touches the org's books — staff users don't need to see or change it.
 *
 *   GET    /api/quickbooks/status                connection status (configured? connected? company name?)
 *   GET    /api/quickbooks/connect-url           Intuit authorization URL (admin clicks it)
 *   GET    /api/quickbooks/callback              OAuth callback target (Intuit redirects here)
 *   POST   /api/quickbooks/disconnect            mark current connection inactive
 *
 *   GET    /api/quickbooks/accounts              QBO income accounts (for the mapping dropdown)
 *   GET    /api/quickbooks/deposit-accounts      bank + Undeposited Funds accounts
 *   GET    /api/quickbooks/mappings              fund → QBO account mappings
 *   PUT    /api/quickbooks/mappings/:fund_id     upsert one mapping
 *   DELETE /api/quickbooks/mappings/:fund_id     remove one mapping
 *
 *   POST   /api/quickbooks/sync/:donation_id     sync a single donation
 *   GET    /api/quickbooks/sync-log              recent sync attempts (admin diagnostics)
 *   GET    /api/quickbooks/donations/:id/sync-history per-donation history
 */

import { Router, type Request } from 'express';
import crypto from 'node:crypto';
import { query, queryOne } from '../db/pool.js';
import { auditCreate, auditUpdate, auditDelete } from '../auth/audit.js';
import {
  readQboConfig,
  makeOAuthClient,
  getActiveConnection,
  saveNewConnection,
  getCompanyInfo,
  listIncomeAccounts,
  listDepositAccounts,
} from '../quickbooks/client.js';
import { syncDonationToQbo } from '../quickbooks/sync.js';

export const quickbooksRouter = Router();

/* ----------------------------------------------------------------- */
/*  Helpers                                                           */
/* ----------------------------------------------------------------- */

function shortErr(err: any): string {
  const m = (err?.message ?? String(err)).replace(/\s+/g, ' ').trim();
  return m.length > 280 ? m.slice(0, 277) + '…' : m;
}

// Used by Intuit's redirect — we stash a random nonce in the session so the
// callback can verify it wasn't a forged redirect.
function getStateBuffer(req: Request): string {
  const buf = crypto.randomBytes(24).toString('base64url');
  (req.session as any).qboOauthState = buf;
  return buf;
}

/* ----------------------------------------------------------------- */
/*  GET /status                                                       */
/* ----------------------------------------------------------------- */

quickbooksRouter.get('/status', async (_req, res, next) => {
  try {
    const cfg = readQboConfig();
    const conn = await getActiveConnection();
    let companyName: string | null = null;
    if (conn) {
      try {
        const info = await getCompanyInfo();
        companyName = info?.companyName ?? null;
      } catch {
        // Don't block status — the UI will show the connection but with no
        // company name, and the user can hit "Re-test" or reconnect.
      }
    }
    res.json({
      configured: !!cfg,
      environment: cfg?.environment ?? null,
      connected: !!conn,
      realm_id: conn?.realm_id ?? null,
      connected_at: conn ? (await queryOne<{ connected_at: string }>(
        `SELECT connected_at FROM tbl_quickbooks_connection WHERE qbo_connection_id = $1`,
        [conn.qbo_connection_id],
      ))?.connected_at : null,
      last_sync_at: conn ? (await queryOne<{ last_sync_at: string | null }>(
        `SELECT last_sync_at FROM tbl_quickbooks_connection WHERE qbo_connection_id = $1`,
        [conn.qbo_connection_id],
      ))?.last_sync_at : null,
      company_name: companyName,
    });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  GET /connect-url                                                  */
/* ----------------------------------------------------------------- */

quickbooksRouter.get('/connect-url', (req, res) => {
  const cfg = readQboConfig();
  if (!cfg) {
    return res.status(503).json({
      error: 'QuickBooks is not configured on the server. Set QBO_CLIENT_ID, QBO_CLIENT_SECRET, and QBO_REDIRECT_URI environment variables.',
    });
  }
  const oauth = makeOAuthClient(cfg);
  const state = getStateBuffer(req);
  const authUrl = oauth.authorizeUri({
    scope: ['com.intuit.quickbooks.accounting'],
    state,
  });
  res.json({ url: authUrl });
});

/* ----------------------------------------------------------------- */
/*  GET /callback                                                     */
/* ----------------------------------------------------------------- */

quickbooksRouter.get('/callback', async (req, res, next) => {
  try {
    const cfg = readQboConfig();
    if (!cfg) return res.status(503).send('QuickBooks not configured.');

    const { state, realmId, code } = req.query as Record<string, string | undefined>;
    const sessState = (req.session as any).qboOauthState as string | undefined;
    if (!state || !sessState || state !== sessState) {
      return res.status(400).send('OAuth state mismatch. Restart the QuickBooks connection flow.');
    }
    delete (req.session as any).qboOauthState;
    if (!realmId || !code) {
      return res.status(400).send('Missing realmId or code from QuickBooks. Try connecting again.');
    }

    const oauth = makeOAuthClient(cfg);
    // intuit-oauth's createToken takes the full callback URL. Reconstruct it
    // from req so we pass back exactly what Intuit sent.
    const protocol = (req.headers['x-forwarded-proto'] as string) ?? req.protocol;
    const host = req.headers.host;
    const fullUrl = `${protocol}://${host}${req.originalUrl}`;
    const tokRes = await oauth.createToken(fullUrl);
    const tok = tokRes.getJson();

    await saveNewConnection({
      realmId,
      environment: cfg.environment,
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token,
      expiresIn: tok.expires_in ?? 3600,
      refreshExpiresIn: tok.x_refresh_token_expires_in ?? null,
      userAccountId: req.user!.user_account_id,
    });

    await auditCreate(req, 'tbl_quickbooks_connection', 0, { realm_id: realmId, environment: cfg.environment });

    // Bounce the browser back to the settings page. Use a hash so the React
    // router can show a "connected!" toast on landing.
    res.redirect('/admin/settings/quickbooks?connected=1');
  } catch (err: any) {
    console.error('[qbo] Callback error:', err);
    res.status(500).send(`QuickBooks connection failed: ${shortErr(err)}. Try again or check the server logs.`);
  }
});

/* ----------------------------------------------------------------- */
/*  POST /disconnect                                                  */
/* ----------------------------------------------------------------- */

quickbooksRouter.post('/disconnect', async (req, res, next) => {
  try {
    const conn = await getActiveConnection();
    if (!conn) return res.status(404).json({ error: 'No active QuickBooks connection to disconnect.' });
    await query(
      `UPDATE tbl_quickbooks_connection SET is_active = false, disconnected_at = NOW() WHERE qbo_connection_id = $1`,
      [conn.qbo_connection_id],
    );
    await auditDelete(req, 'tbl_quickbooks_connection', conn.qbo_connection_id, conn);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  GET /accounts and /deposit-accounts                               */
/* ----------------------------------------------------------------- */

quickbooksRouter.get('/accounts', async (_req, res, next) => {
  try {
    const accts = await listIncomeAccounts();
    res.json(accts.map(a => ({
      id: a.Id,
      name: a.FullyQualifiedName,
      type: a.AccountType,
      subtype: a.AccountSubType ?? null,
    })));
  } catch (err: any) { next(err); }
});

quickbooksRouter.get('/deposit-accounts', async (_req, res, next) => {
  try {
    const accts = await listDepositAccounts();
    res.json(accts.map(a => ({
      id: a.Id,
      name: a.FullyQualifiedName,
      type: a.AccountType,
      subtype: a.AccountSubType ?? null,
    })));
  } catch (err: any) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  GET /mappings                                                     */
/* ----------------------------------------------------------------- */

quickbooksRouter.get('/mappings', async (_req, res, next) => {
  try {
    // Return every fund with its current mapping (if any) so the UI can show
    // the full list and mark unmapped ones.
    const rows = await query(`
      SELECT
        f.fund_id, f.fund_name, f.description AS fund_description,
        m.mapping_id, m.qbo_account_id, m.qbo_account_name, m.qbo_account_type,
        m.created_at, m.updated_at
      FROM lkp_fund f
      LEFT JOIN tbl_quickbooks_account_mapping m ON m.fund_id = f.fund_id
      ORDER BY f.fund_name
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  PUT /mappings/:fund_id                                            */
/* ----------------------------------------------------------------- */

quickbooksRouter.put('/mappings/:fund_id', async (req, res, next) => {
  try {
    const fundId = Number(req.params.fund_id);
    if (!Number.isInteger(fundId) || fundId <= 0) return res.status(400).json({ error: 'Invalid fund_id' });
    const { qbo_account_id, qbo_account_name, qbo_account_type } = req.body ?? {};
    if (!qbo_account_id || !qbo_account_name) {
      return res.status(400).json({ error: 'qbo_account_id and qbo_account_name are required.' });
    }

    const before = await queryOne(
      `SELECT * FROM tbl_quickbooks_account_mapping WHERE fund_id = $1`, [fundId],
    );

    const row = await queryOne<{ mapping_id: number }>(`
      INSERT INTO tbl_quickbooks_account_mapping
        (fund_id, qbo_account_id, qbo_account_name, qbo_account_type, created_by_user_account_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (fund_id) DO UPDATE
        SET qbo_account_id = EXCLUDED.qbo_account_id,
            qbo_account_name = EXCLUDED.qbo_account_name,
            qbo_account_type = EXCLUDED.qbo_account_type,
            updated_at = NOW()
      RETURNING mapping_id
    `, [fundId, qbo_account_id, qbo_account_name, qbo_account_type ?? null, req.user!.user_account_id]);

    const after = await queryOne(`SELECT * FROM tbl_quickbooks_account_mapping WHERE mapping_id = $1`, [row!.mapping_id]);
    if (before) {
      await auditUpdate(req, 'tbl_quickbooks_account_mapping', row!.mapping_id, before, after!);
    } else {
      await auditCreate(req, 'tbl_quickbooks_account_mapping', row!.mapping_id, after!);
    }

    res.json({ mapping_id: row!.mapping_id });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  DELETE /mappings/:fund_id                                         */
/* ----------------------------------------------------------------- */

quickbooksRouter.delete('/mappings/:fund_id', async (req, res, next) => {
  try {
    const fundId = Number(req.params.fund_id);
    if (!Number.isInteger(fundId) || fundId <= 0) return res.status(400).json({ error: 'Invalid fund_id' });
    const before = await queryOne(`SELECT * FROM tbl_quickbooks_account_mapping WHERE fund_id = $1`, [fundId]);
    if (!before) return res.status(404).json({ error: 'No mapping for that fund.' });
    await query(`DELETE FROM tbl_quickbooks_account_mapping WHERE fund_id = $1`, [fundId]);
    await auditDelete(req, 'tbl_quickbooks_account_mapping', (before as any).mapping_id, before);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  POST /sync/:donation_id                                           */
/* ----------------------------------------------------------------- */

quickbooksRouter.post('/sync/:donation_id', async (req, res, next) => {
  try {
    const id = Number(req.params.donation_id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid donation id' });
    const result = await syncDonationToQbo(id, req.user!.user_account_id);
    const httpStatus = result.status === 'failed' ? 400 : 200;
    res.status(httpStatus).json(result);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  GET /sync-log                                                     */
/* ----------------------------------------------------------------- */

quickbooksRouter.get('/sync-log', async (req, res, next) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
    const status = String(req.query.status ?? '').trim();
    const conds: string[] = [];
    const params: any[] = [];
    if (status && ['synced', 'failed', 'skipped', 'pending'].includes(status)) {
      params.push(status);
      conds.push(`s.sync_status = $${params.length}`);
    }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    params.push(limit);
    const rows = await query(`
      SELECT
        s.sync_id, s.donation_id, s.qbo_sales_receipt_id, s.sync_status,
        s.attempted_at, s.synced_at, s.error_message, s.payload_summary,
        ua.username AS attempted_by_username,
        d.receipt_number, d.total_value, d.donation_date,
        TRIM(CONCAT_WS(' ', c.first_name, c.last_name)) AS donor_name
      FROM tbl_quickbooks_donation_sync s
      LEFT JOIN tbl_user_account ua ON ua.user_account_id = s.attempted_by_user_account_id
      LEFT JOIN tbl_donation d ON d.donation_id = s.donation_id
      LEFT JOIN tbl_donor donor ON donor.donor_id = d.donor_id
      LEFT JOIN tbl_contact c ON c.contact_id = donor.contact_id
      ${where}
      ORDER BY s.attempted_at DESC
      LIMIT $${params.length}
    `, params);
    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  GET /donations/:id/sync-history                                   */
/* ----------------------------------------------------------------- */

quickbooksRouter.get('/donations/:id/sync-history', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const rows = await query(`
      SELECT
        s.sync_id, s.qbo_sales_receipt_id, s.sync_status, s.attempted_at,
        s.synced_at, s.error_message, s.payload_summary,
        ua.username AS attempted_by_username
      FROM tbl_quickbooks_donation_sync s
      LEFT JOIN tbl_user_account ua ON ua.user_account_id = s.attempted_by_user_account_id
      WHERE s.donation_id = $1
      ORDER BY s.attempted_at DESC
    `, [id]);
    res.json(rows);
  } catch (err) { next(err); }
});
