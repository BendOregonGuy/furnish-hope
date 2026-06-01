/**
 * QuickBooks Online API client.
 *
 * Wraps the OAuth2 dance + token refresh + REST calls so the rest of the
 * app talks to QBO via simple typed methods. We deliberately use direct
 * fetch (rather than `node-quickbooks`) because:
 *   - QBO's REST API is straightforward and well-documented
 *   - we only need ~6 endpoints (account list, customer create/query, sales receipt create)
 *   - the node-quickbooks package is unmaintained and uses an older auth model
 *
 * Tokens are encrypted at rest with the same AES-256-GCM helper used for
 * email passwords (api/src/email/crypto.ts).
 */

import OAuthClient from 'intuit-oauth';
import { encryptSecret, decryptSecret } from '../email/crypto.js';
import { query, queryOne, withTransaction } from '../db/pool.js';

/** QBO sandbox vs production base URL — depends on the connection's environment. */
const QBO_API_BASE = {
  sandbox:    'https://sandbox-quickbooks.api.intuit.com',
  production: 'https://quickbooks.api.intuit.com',
} as const;

/** Minor version pins the response schema. Latest stable at time of writing. */
const QBO_MINOR_VERSION = 73;

/* ----------------------------------------------------------------- */
/*  Config                                                            */
/* ----------------------------------------------------------------- */

export interface QboConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: 'sandbox' | 'production';
}

export function readQboConfig(): QboConfig | null {
  const clientId = process.env.QBO_CLIENT_ID;
  const clientSecret = process.env.QBO_CLIENT_SECRET;
  const redirectUri = process.env.QBO_REDIRECT_URI;
  const environment = (process.env.QBO_ENVIRONMENT ?? 'sandbox').toLowerCase();
  if (!clientId || !clientSecret || !redirectUri) return null;
  if (environment !== 'sandbox' && environment !== 'production') {
    console.warn(`[qbo] Invalid QBO_ENVIRONMENT="${environment}", defaulting to sandbox.`);
    return { clientId, clientSecret, redirectUri, environment: 'sandbox' };
  }
  return { clientId, clientSecret, redirectUri, environment };
}

export function makeOAuthClient(cfg: QboConfig): any {
  // intuit-oauth's TS types are loose; cast to any.
  return new (OAuthClient as any)({
    clientId:     cfg.clientId,
    clientSecret: cfg.clientSecret,
    environment:  cfg.environment,
    redirectUri:  cfg.redirectUri,
  });
}

/* ----------------------------------------------------------------- */
/*  Connection row helpers                                            */
/* ----------------------------------------------------------------- */

export interface ConnectionRow {
  qbo_connection_id: number;
  realm_id: string;
  environment: 'sandbox' | 'production';
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  access_token_expires_at: string;
  refresh_token_expires_at: string | null;
  is_active: boolean;
}

/** Return the single active connection row, or null if QBO isn't connected. */
export async function getActiveConnection(): Promise<ConnectionRow | null> {
  return await queryOne<ConnectionRow>(
    `SELECT * FROM tbl_quickbooks_connection WHERE is_active = true LIMIT 1`,
  );
}

/* ----------------------------------------------------------------- */
/*  Token lifecycle                                                   */
/* ----------------------------------------------------------------- */

/**
 * Return a valid access token. If the stored one is expired (or about to
 * expire in the next 60 seconds), refresh it transparently and persist the
 * new tokens. Throws if the refresh token itself is expired or revoked.
 */
export async function getValidAccessToken(): Promise<{ accessToken: string; realmId: string; environment: 'sandbox' | 'production' }> {
  const cfg = readQboConfig();
  if (!cfg) throw new Error('QuickBooks is not configured on this server (missing QBO_CLIENT_ID/SECRET/REDIRECT_URI env vars).');

  const conn = await getActiveConnection();
  if (!conn) throw new Error('No active QuickBooks connection. Connect QuickBooks in Settings → QuickBooks first.');

  const expiresAt = new Date(conn.access_token_expires_at).getTime();
  const now = Date.now();
  // Refresh if expired OR within 60s of expiring.
  if (now < expiresAt - 60_000) {
    return {
      accessToken: decryptSecret(conn.access_token_encrypted),
      realmId: conn.realm_id,
      environment: conn.environment,
    };
  }

  // Need to refresh.
  const refreshToken = decryptSecret(conn.refresh_token_encrypted);
  const oauth = makeOAuthClient({ ...cfg, environment: conn.environment });
  oauth.setToken({ refresh_token: refreshToken, access_token: '', token_type: 'bearer' });

  let tok;
  try {
    const res = await oauth.refresh();
    tok = res.getJson();
  } catch (err: any) {
    console.error('[qbo] Refresh failed:', err.message ?? err);
    // Mark the connection inactive so the UI can prompt for re-auth.
    await query(
      `UPDATE tbl_quickbooks_connection SET is_active = false, disconnected_at = NOW() WHERE qbo_connection_id = $1`,
      [conn.qbo_connection_id],
    );
    throw new Error('QuickBooks refresh token expired or revoked. Reconnect QuickBooks in Settings.');
  }

  const newAccess = tok.access_token as string;
  const newRefresh = (tok.refresh_token as string) ?? refreshToken;
  const expiresIn = (tok.expires_in as number) ?? 3600;
  const refreshExpiresIn = (tok.x_refresh_token_expires_in as number) ?? null;

  await query(`
    UPDATE tbl_quickbooks_connection
       SET access_token_encrypted   = $1,
           refresh_token_encrypted  = $2,
           access_token_expires_at  = NOW() + ($3 || ' seconds')::interval,
           refresh_token_expires_at = CASE WHEN $4::int IS NULL THEN refresh_token_expires_at
                                           ELSE NOW() + ($4 || ' seconds')::interval END,
           last_refresh_at          = NOW()
     WHERE qbo_connection_id = $5
  `, [
    encryptSecret(newAccess),
    encryptSecret(newRefresh),
    String(expiresIn),
    refreshExpiresIn ? String(refreshExpiresIn) : null,
    conn.qbo_connection_id,
  ]);

  return { accessToken: newAccess, realmId: conn.realm_id, environment: conn.environment };
}

/**
 * Persist freshly-issued tokens after the OAuth callback. Deactivates any
 * prior active connection so there's only ever one current row.
 */
export async function saveNewConnection(args: {
  realmId: string;
  environment: 'sandbox' | 'production';
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number | null;
  userAccountId: number;
}): Promise<number> {
  return await withTransaction(async (tx) => {
    await tx.query(
      `UPDATE tbl_quickbooks_connection SET is_active = false, disconnected_at = NOW() WHERE is_active = true`,
    );
    const row = await tx.queryOne<{ qbo_connection_id: number }>(`
      INSERT INTO tbl_quickbooks_connection
        (realm_id, environment, access_token_encrypted, refresh_token_encrypted,
         access_token_expires_at, refresh_token_expires_at,
         is_active, connected_by_user_account_id)
      VALUES ($1, $2, $3, $4,
              NOW() + ($5 || ' seconds')::interval,
              CASE WHEN $6::int IS NULL THEN NULL ELSE NOW() + ($6 || ' seconds')::interval END,
              true, $7)
      RETURNING qbo_connection_id
    `, [
      args.realmId, args.environment,
      encryptSecret(args.accessToken), encryptSecret(args.refreshToken),
      String(args.expiresIn),
      args.refreshExpiresIn ? String(args.refreshExpiresIn) : null,
      args.userAccountId,
    ]);
    return row!.qbo_connection_id;
  });
}

/* ----------------------------------------------------------------- */
/*  REST calls                                                        */
/* ----------------------------------------------------------------- */

/** Low-level QBO request — handles auth header, base URL, minor version. */
async function qboFetch(opts: {
  method: 'GET' | 'POST';
  path: string;            // e.g. '/v3/company/{realmId}/account' (path is interpolated)
  query?: Record<string, string>;
  body?: any;
}): Promise<any> {
  const { accessToken, realmId, environment } = await getValidAccessToken();
  const base = QBO_API_BASE[environment];
  const resolvedPath = opts.path.replace('{realmId}', realmId);
  const url = new URL(base + resolvedPath);
  url.searchParams.set('minorversion', String(QBO_MINOR_VERSION));
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    method: opts.method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* leave as text */ }

  if (!res.ok) {
    const fault = json?.Fault?.Error?.[0];
    const msg = fault
      ? `${fault.code}: ${fault.Message}${fault.Detail ? ' — ' + fault.Detail : ''}`
      : (text || `HTTP ${res.status}`);
    const err = new Error(`QuickBooks API error: ${msg}`) as Error & { status?: number; raw?: any };
    err.status = res.status;
    err.raw = json ?? text;
    throw err;
  }
  return json;
}

/** Fetch all income accounts (the kind donations get posted to). */
export async function listIncomeAccounts(): Promise<Array<{ Id: string; Name: string; FullyQualifiedName: string; AccountType: string; AccountSubType?: string }>> {
  const q = "SELECT Id, Name, FullyQualifiedName, AccountType, AccountSubType FROM Account WHERE AccountType IN ('Income', 'Other Income') MAXRESULTS 200";
  const r = await qboFetch({
    method: 'GET',
    path: '/v3/company/{realmId}/query',
    query: { query: q },
  });
  return r?.QueryResponse?.Account ?? [];
}

/** Fetch all asset accounts a sales-receipt deposit can land in (bank + Undeposited Funds). */
export async function listDepositAccounts(): Promise<Array<{ Id: string; Name: string; FullyQualifiedName: string; AccountType: string; AccountSubType?: string }>> {
  // Bank accounts + Other Current Asset (which is where Undeposited Funds lives).
  const q = "SELECT Id, Name, FullyQualifiedName, AccountType, AccountSubType FROM Account WHERE AccountType IN ('Bank', 'Other Current Asset') MAXRESULTS 200";
  const r = await qboFetch({
    method: 'GET',
    path: '/v3/company/{realmId}/query',
    query: { query: q },
  });
  return r?.QueryResponse?.Account ?? [];
}

/** Fetch a single customer by display name (case-insensitive). Returns null if not found. */
export async function findCustomerByName(displayName: string): Promise<{ Id: string; DisplayName: string } | null> {
  // QBO query syntax: escape single quotes by doubling them.
  const safe = displayName.replace(/'/g, "''");
  const q = `SELECT Id, DisplayName FROM Customer WHERE DisplayName = '${safe}' MAXRESULTS 1`;
  const r = await qboFetch({
    method: 'GET',
    path: '/v3/company/{realmId}/query',
    query: { query: q },
  });
  const found = r?.QueryResponse?.Customer?.[0];
  return found ? { Id: found.Id, DisplayName: found.DisplayName } : null;
}

/** Create a Customer. QBO requires DisplayName to be unique. */
export async function createCustomer(args: {
  displayName: string;
  email?: string;
  givenName?: string;
  familyName?: string;
  companyName?: string;
}): Promise<{ Id: string; DisplayName: string }> {
  const body: any = {
    DisplayName: args.displayName,
  };
  if (args.givenName) body.GivenName = args.givenName;
  if (args.familyName) body.FamilyName = args.familyName;
  if (args.companyName) body.CompanyName = args.companyName;
  if (args.email) body.PrimaryEmailAddr = { Address: args.email };

  const r = await qboFetch({
    method: 'POST',
    path: '/v3/company/{realmId}/customer',
    body,
  });
  const c = r?.Customer;
  if (!c?.Id) throw new Error('QBO customer create returned no Id');
  return { Id: c.Id, DisplayName: c.DisplayName };
}

/**
 * Create a Sales Receipt for a donation. Each designation becomes one line
 * item posted to the mapped income account; if there are no designations,
 * the full amount goes to a fallback account (handled by caller).
 */
export async function createSalesReceipt(args: {
  customerRef: string;          // QBO customer Id
  txnDate: string;              // 'YYYY-MM-DD'
  depositAccountId: string;     // bank or Undeposited Funds
  privateNote?: string;
  customerMemo?: string;
  paymentRefNumber?: string;
  lines: Array<{ amount: number; description: string; incomeAccountId: string }>;
}): Promise<{ Id: string; DocNumber?: string; TotalAmt: number }> {
  const body: any = {
    TxnDate: args.txnDate,
    CustomerRef: { value: args.customerRef },
    DepositToAccountRef: { value: args.depositAccountId },
    Line: args.lines.map((ln, i) => ({
      LineNum: i + 1,
      Amount: ln.amount,
      Description: ln.description,
      DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: {
        ItemAccountRef: { value: ln.incomeAccountId },
      },
    })),
  };
  if (args.privateNote) body.PrivateNote = args.privateNote;
  if (args.customerMemo) body.CustomerMemo = { value: args.customerMemo };
  if (args.paymentRefNumber) body.PaymentRefNum = args.paymentRefNumber;

  const r = await qboFetch({
    method: 'POST',
    path: '/v3/company/{realmId}/salesreceipt',
    body,
  });
  const sr = r?.SalesReceipt;
  if (!sr?.Id) throw new Error('QBO sales receipt create returned no Id');
  return { Id: sr.Id, DocNumber: sr.DocNumber, TotalAmt: sr.TotalAmt };
}

/** Lightweight ping — fetch CompanyInfo to verify the token works and surface the company name. */
export async function getCompanyInfo(): Promise<{ companyName: string; legalName: string; country: string } | null> {
  const r = await qboFetch({
    method: 'GET',
    path: '/v3/company/{realmId}/companyinfo/{realmId}',
  });
  const ci = r?.CompanyInfo;
  if (!ci) return null;
  return {
    companyName: ci.CompanyName ?? '',
    legalName:   ci.LegalName ?? '',
    country:     ci.Country ?? '',
  };
}
