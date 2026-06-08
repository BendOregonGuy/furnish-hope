/**
 * OAuth 2.0 for email — Google (Gmail) and Microsoft (Outlook /
 * Office 365). Lets users connect their inbox without generating an
 * app-specific password.
 *
 * Flow (standard authorization-code with PKCE-free secret):
 *   1. Frontend → GET /api/email/oauth/:provider/start
 *        Server stashes a random `state` in the session, returns the
 *        provider's authorize URL.
 *   2. User redirects to provider, signs in, approves scopes.
 *   3. Provider → redirects back to GET /api/email/oauth/callback
 *        with ?code=… &state=…
 *   4. Server verifies state, exchanges code for { access_token,
 *        refresh_token, expires_in }, fetches user email via
 *        provider userinfo endpoint, and INSERTs / UPDATEs the
 *        tbl_email_account row.
 *
 * Token refresh: every IMAP/SMTP operation goes through
 * ensureFreshToken(), which refreshes the access_token if it's within
 * 5 minutes of expiry. The refresh_token is long-lived; if it ever
 * stops working, the user has to redo the OAuth dance (the UI will
 * flag the account as "needs reauthorization").
 */

import { encryptSecret, decryptSecret } from './crypto.js';
import { query, queryOne } from '../db/pool.js';

export type OAuthProviderId = 'google' | 'microsoft';

export interface OAuthProvider {
  id: OAuthProviderId;
  label: string;
  /** OAuth 2.0 authorize endpoint (the URL we redirect the user to). */
  authorizeUrl: string;
  /** Token endpoint — POST to exchange code or refresh. */
  tokenUrl: string;
  /** Profile / userinfo endpoint that returns the email address. */
  userInfoUrl: string;
  /** Field in the userinfo response that holds the email. */
  userInfoEmailField: string;
  /** OAuth scopes the user has to consent to. */
  scopes: string[];
  /** IMAP host / port for this provider. */
  imap: { host: string; port: number; secure: boolean };
  /** SMTP host / port for this provider. */
  smtp: { host: string; port: number; secure: boolean };
  /** Internal "provider" string we put in tbl_email_account.provider. */
  accountProvider: string;
}

/** Returns the provider config + reads env-var credentials. Throws if
 *  the env vars aren't set, so callers can tell the user clearly that
 *  OAuth isn't configured yet rather than failing somewhere downstream. */
export function getOAuthCredentials(provider: OAuthProviderId): { clientId: string; clientSecret: string } {
  if (provider === 'google') {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID ?? '';
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '';
    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.');
    }
    return { clientId, clientSecret };
  }
  if (provider === 'microsoft') {
    const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID ?? '';
    const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET ?? '';
    if (!clientId || !clientSecret) {
      throw new Error('Microsoft OAuth is not configured. Set MICROSOFT_OAUTH_CLIENT_ID and MICROSOFT_OAUTH_CLIENT_SECRET.');
    }
    return { clientId, clientSecret };
  }
  throw new Error(`Unknown OAuth provider: ${provider}`);
}

export const OAUTH_PROVIDERS: Record<OAuthProviderId, OAuthProvider> = {
  google: {
    id: 'google',
    label: 'Google',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    userInfoEmailField: 'email',
    // Full Gmail IMAP/SMTP via XOAUTH2 requires this scope. openid +
    // email are needed to read back the user's address.
    scopes: ['openid', 'email', 'https://mail.google.com/'],
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
    accountProvider: 'gmail',
  },
  microsoft: {
    id: 'microsoft',
    label: 'Microsoft',
    // "common" tenant supports both personal (outlook.com) and work
    // (org-tenant) accounts. Single-tenant orgs can swap in their
    // tenant id later if needed.
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    userInfoEmailField: 'userPrincipalName', // mail can be null on some tenants; UPN is always present
    // IMAP + SMTP via XOAUTH2 against outlook.office365.com.
    // offline_access is required to get a refresh_token. openid +
    // profile lets us call Graph /me.
    scopes: [
      'openid',
      'profile',
      'offline_access',
      'https://outlook.office.com/IMAP.AccessAsUser.All',
      'https://outlook.office.com/SMTP.Send',
    ],
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp.office365.com', port: 587, secure: false }, // STARTTLS on 587
    accountProvider: 'outlook',
  },
};

/** Build the URL we redirect the user to in step 1 of the dance.
 *  state is a one-time random nonce that the callback verifies. */
export function buildAuthorizeUrl(
  provider: OAuthProvider,
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: provider.scopes.join(' '),
    state,
    // Google: get a refresh_token even on subsequent connects.
    // Microsoft ignores these; harmless.
    access_type: 'offline',
    prompt: 'consent',
  });
  return `${provider.authorizeUrl}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;       // seconds
  scope?: string;
  token_type?: string;
}

/** Exchange an authorization code for tokens. Step 3 of the dance. */
export async function exchangeCodeForTokens(
  provider: OAuthProvider,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  code: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return await res.json() as TokenResponse;
}

/** Use a refresh_token to mint a new access_token. */
export async function refreshAccessToken(
  provider: OAuthProvider,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return await res.json() as TokenResponse;
}

/** Hit the provider's userinfo endpoint to learn the user's email. */
export async function fetchUserInfo(
  provider: OAuthProvider,
  accessToken: string,
): Promise<{ email: string }> {
  const res = await fetch(provider.userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Userinfo fetch failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json() as Record<string, any>;
  const email = data[provider.userInfoEmailField] || data.email || data.userPrincipalName;
  if (typeof email !== 'string' || !email.includes('@')) {
    throw new Error('Provider did not return an email address.');
  }
  return { email };
}

/** Returns a valid access_token for the given email account row,
 *  refreshing it on the fly if it's about to expire. Persists the
 *  refreshed token back to the DB. Throws if refresh fails — caller
 *  should surface that as "needs reauthorization". */
export async function ensureFreshAccessToken(accountId: number): Promise<string> {
  const row = await queryOne<{
    oauth_provider: OAuthProviderId | null;
    oauth_access_token_enc: string | null;
    oauth_refresh_token_enc: string | null;
    oauth_expires_at: string | null;
  }>(`
    SELECT oauth_provider, oauth_access_token_enc, oauth_refresh_token_enc, oauth_expires_at
    FROM tbl_email_account
    WHERE email_account_id = $1
  `, [accountId]);

  if (!row || !row.oauth_provider || !row.oauth_access_token_enc) {
    throw new Error('Account is not OAuth-connected.');
  }
  const provider = OAUTH_PROVIDERS[row.oauth_provider];
  if (!provider) throw new Error(`Unknown OAuth provider: ${row.oauth_provider}`);

  const accessToken = decryptSecret(row.oauth_access_token_enc);
  const expiresAt = row.oauth_expires_at ? new Date(row.oauth_expires_at) : null;
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);

  // Token still valid for > 5 minutes? Use it.
  if (expiresAt && expiresAt > fiveMinFromNow) return accessToken;

  // Otherwise refresh.
  if (!row.oauth_refresh_token_enc) {
    throw new Error('Access token expired and no refresh_token available — please reconnect the account.');
  }
  const refreshToken = decryptSecret(row.oauth_refresh_token_enc);
  const { clientId, clientSecret } = getOAuthCredentials(row.oauth_provider);
  const fresh = await refreshAccessToken(provider, clientId, clientSecret, refreshToken);

  const newExpiresAt = new Date(Date.now() + fresh.expires_in * 1000);
  await query(`
    UPDATE tbl_email_account
       SET oauth_access_token_enc = $1,
           oauth_expires_at = $2,
           oauth_refresh_token_enc = COALESCE($3, oauth_refresh_token_enc)
     WHERE email_account_id = $4
  `, [
    encryptSecret(fresh.access_token),
    newExpiresAt,
    fresh.refresh_token ? encryptSecret(fresh.refresh_token) : null,
    accountId,
  ]);

  return fresh.access_token;
}
