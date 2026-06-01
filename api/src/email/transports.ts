/**
 * Thin wrappers around imapflow + nodemailer that take an `EmailAccountRow`
 * and produce a configured client. Centralizes timeout / TLS / logging
 * settings so the rest of the app doesn't repeat itself.
 */

import { ImapFlow } from 'imapflow';
import nodemailer, { type Transporter } from 'nodemailer';
import { decryptSecret } from './crypto.js';

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
}

/** Connection options decrypted on-demand from the DB row. */
export function buildImapClient(acct: EmailAccountRow): ImapFlow {
  if (!acct.imap_host || !acct.imap_port) {
    throw new Error('Account is missing IMAP host/port');
  }
  if (!acct.encrypted_password) {
    throw new Error('Account has no stored password');
  }
  return new ImapFlow({
    host: acct.imap_host,
    port: acct.imap_port,
    secure: acct.imap_secure,
    auth: {
      user: acct.username || acct.email_address,
      pass: decryptSecret(acct.encrypted_password),
    },
    logger: false,
    // Reasonable timeouts so a misconfigured account doesn't hang requests.
    socketTimeout: 15000,
    greetingTimeout: 8000,
    connectionTimeout: 10000,
  });
}

export function buildSmtpTransporter(acct: EmailAccountRow): Transporter {
  if (!acct.smtp_host || !acct.smtp_port) {
    throw new Error('Account is missing SMTP host/port');
  }
  if (!acct.encrypted_password) {
    throw new Error('Account has no stored password');
  }
  return nodemailer.createTransport({
    host: acct.smtp_host,
    port: acct.smtp_port,
    secure: acct.smtp_secure, // true → implicit TLS (465); false → STARTTLS upgrade (587)
    auth: {
      user: acct.username || acct.email_address,
      pass: decryptSecret(acct.encrypted_password),
    },
    connectionTimeout: 10000,
    greetingTimeout: 8000,
    socketTimeout: 15000,
  });
}

/** Connect → noop → disconnect, surfacing whichever leg fails. */
export async function testImap(acct: EmailAccountRow): Promise<void> {
  const c = buildImapClient(acct);
  try {
    await c.connect();
    await c.noop();
  } finally {
    try { await c.logout(); } catch { /* ignore */ }
  }
}

export async function testSmtp(acct: EmailAccountRow): Promise<void> {
  const t = buildSmtpTransporter(acct);
  try {
    await t.verify();
  } finally {
    t.close();
  }
}
