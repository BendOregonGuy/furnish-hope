/**
 * Thin wrappers around imapflow + nodemailer that take an `EmailAccountRow`
 * and produce a configured client. Centralizes timeout / TLS / logging
 * settings so the rest of the app doesn't repeat itself.
 */

import { ImapFlow } from 'imapflow';
import nodemailer, { type Transporter } from 'nodemailer';
import { decryptSecret } from './crypto.js';
import { ensureFreshAccessToken } from './oauth.js';

export interface EmailAccountRow {
  email_account_id: number;
  email_address: string;
  username: string | null;
  imap_host: string | null;
  imap_port: number | null;
  imap_secure: boolean;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: boolean;
  encrypted_password: string | null;
  /** When 'oauth', authenticate via XOAUTH2 instead of password. */
  auth_type?: string | null;
}

/** Connection options for IMAP — picks between password (XOAUTH2 if
 *  the account is OAuth-connected). Token refresh happens inside
 *  ensureFreshAccessToken so the caller doesn't have to worry. */
export async function buildImapClient(acct: EmailAccountRow): Promise<ImapFlow> {
  if (!acct.imap_host || !acct.imap_port) {
    throw new Error('Account is missing IMAP host/port');
  }

  const user = acct.username || acct.email_address;
  let auth: { user: string; pass?: string; accessToken?: string };

  if (acct.auth_type === 'oauth') {
    const accessToken = await ensureFreshAccessToken(acct.email_account_id);
    auth = { user, accessToken };
  } else {
    if (!acct.encrypted_password) throw new Error('Account has no stored password');
    auth = { user, pass: decryptSecret(acct.encrypted_password) };
  }

  return new ImapFlow({
    host: acct.imap_host,
    port: acct.imap_port,
    secure: acct.imap_secure,
    auth,
    logger: false,
    // Reasonable timeouts so a misconfigured account doesn't hang requests.
    socketTimeout: 15000,
    greetingTimeout: 8000,
    connectionTimeout: 10000,
  });
}

export async function buildSmtpTransporter(acct: EmailAccountRow): Promise<Transporter> {
  if (!acct.smtp_host || !acct.smtp_port) {
    throw new Error('Account is missing SMTP host/port');
  }

  const auth: Record<string, any> = {
    user: acct.username || acct.email_address,
  };

  if (acct.auth_type === 'oauth') {
    auth.type = 'OAuth2';
    auth.accessToken = await ensureFreshAccessToken(acct.email_account_id);
  } else {
    if (!acct.encrypted_password) throw new Error('Account has no stored password');
    auth.pass = decryptSecret(acct.encrypted_password);
  }

  return nodemailer.createTransport({
    host: acct.smtp_host,
    port: acct.smtp_port,
    secure: acct.smtp_secure, // true → implicit TLS (465); false → STARTTLS upgrade (587)
    auth,
    connectionTimeout: 10000,
    greetingTimeout: 8000,
    socketTimeout: 15000,
  });
}

/** Connect → noop → disconnect, surfacing whichever leg fails. */
export async function testImap(acct: EmailAccountRow): Promise<void> {
  const c = await buildImapClient(acct);
  try {
    await c.connect();
    await c.noop();
  } finally {
    try { await c.logout(); } catch { /* ignore */ }
  }
}

export async function testSmtp(acct: EmailAccountRow): Promise<void> {
  const t = await buildSmtpTransporter(acct);
  try {
    await t.verify();
  } finally {
    t.close();
  }
}
