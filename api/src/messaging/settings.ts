/**
 * Organizational messaging configuration, stored as rows in tbl_app_setting.
 *
 * These are NOT schema changes — just keyed config the Communications admin
 * pages manage (see COMMUNICATIONS_DESIGN §3.3). Secrets (Twilio auth token,
 * SMTP password, webhook secret) are encrypted at rest with the SAME helper
 * the per-user email accounts use (email/crypto.ts → EMAIL_ENCRYPTION_KEY,
 * or derived from SESSION_SECRET). No new key management.
 *
 * Reads return decrypted secrets for server-side use. The *public* variants
 * used by the settings API never return secret plaintext — only a boolean
 * saying whether each secret is set.
 */

import { query, queryOne } from '../db/pool.js';
import { encryptSecret, decryptSecret } from '../email/crypto.js';

/* ----------------------------------------------------------------- */
/*  Keys                                                              */
/* ----------------------------------------------------------------- */

export const SMS_KEYS = {
  provider: 'messaging.sms.provider',
  account_sid: 'messaging.sms.twilio.account_sid',
  auth_token: 'messaging.sms.twilio.auth_token',
  from_phone: 'messaging.sms.twilio.from_phone',
  webhook_secret: 'messaging.sms.twilio.webhook_secret',
  enabled: 'messaging.sms.enabled',
} as const;

export const EMAIL_KEYS = {
  smtp_host: 'messaging.email.org.smtp_host',
  smtp_port: 'messaging.email.org.smtp_port',
  smtp_username: 'messaging.email.org.smtp_username',
  smtp_password: 'messaging.email.org.smtp_password',
  smtp_use_tls: 'messaging.email.org.smtp_use_tls',
  from_address: 'messaging.email.org.from_address',
  from_display_name: 'messaging.email.org.from_display_name',
  reply_domain: 'messaging.email.org.reply_domain',
  enabled: 'messaging.email.enabled',
} as const;

export const FALLBACK_INBOX_KEY = 'messaging.fallback_inbox';

/** Keys whose stored value is encrypted at rest. */
const SECRET_KEYS = new Set<string>([
  SMS_KEYS.account_sid,
  SMS_KEYS.auth_token,
  SMS_KEYS.webhook_secret,
  EMAIL_KEYS.smtp_password,
]);

const DESCRIPTIONS: Record<string, string> = {
  [SMS_KEYS.provider]: 'Active SMS provider (twilio).',
  [SMS_KEYS.account_sid]: 'Twilio Account SID (encrypted).',
  [SMS_KEYS.auth_token]: 'Twilio Auth Token (encrypted).',
  [SMS_KEYS.from_phone]: 'Twilio From phone number in E.164, e.g. +15415551234.',
  [SMS_KEYS.webhook_secret]: 'Optional override secret for Twilio webhook signature validation (encrypted). Blank = validate with the Auth Token, which is what Twilio actually signs with.',
  [SMS_KEYS.enabled]: 'Whether outbound SMS is enabled.',
  [EMAIL_KEYS.smtp_host]: 'Org email SMTP host.',
  [EMAIL_KEYS.smtp_port]: 'Org email SMTP port (587 STARTTLS or 465 implicit TLS).',
  [EMAIL_KEYS.smtp_username]: 'Org email SMTP username.',
  [EMAIL_KEYS.smtp_password]: 'Org email SMTP password (encrypted).',
  [EMAIL_KEYS.smtp_use_tls]: 'Require STARTTLS on port 587.',
  [EMAIL_KEYS.from_address]: 'Org email From address, e.g. ops@furnishhope.org.',
  [EMAIL_KEYS.from_display_name]: 'Org email From display name.',
  [EMAIL_KEYS.reply_domain]: 'Reply domain for plus-addressed reply capture, e.g. replies.furnishhope.org.',
  [EMAIL_KEYS.enabled]: 'Whether outbound org email is enabled.',
  [FALLBACK_INBOX_KEY]: 'Shared inbox that receives messages when a contact can not be reached by any consented channel.',
};

/* ----------------------------------------------------------------- */
/*  Low-level read / write                                           */
/* ----------------------------------------------------------------- */

async function readRaw(key: string): Promise<string | null> {
  const row = await queryOne<{ setting_value: string }>(
    `SELECT setting_value FROM tbl_app_setting WHERE setting_key = $1`,
    [key],
  );
  return row?.setting_value ?? null;
}

/** Decrypt a stored secret, tolerating a legacy/blank value. */
function readSecret(stored: string | null): string | null {
  if (!stored) return null;
  try {
    return decryptSecret(stored);
  } catch {
    // If it isn't in the encrypted envelope format, treat as absent rather
    // than crashing a send. Admin can re-enter it in the settings UI.
    return null;
  }
}

/** Upsert one setting row. Pass `null` to leave the value untouched. Secret
 *  keys are encrypted before storage. Empty string clears a value. */
async function writeRaw(
  key: string,
  value: string | null,
  userId: number | null,
): Promise<void> {
  if (value === null) return; // "not provided" — leave as-is
  const toStore = SECRET_KEYS.has(key) && value !== '' ? encryptSecret(value) : value;
  await query(
    `INSERT INTO tbl_app_setting (setting_key, setting_value, description, updated_at, updated_by_user_account_id)
     VALUES ($1, $2, $3, NOW(), $4)
     ON CONFLICT (setting_key)
       DO UPDATE SET setting_value = EXCLUDED.setting_value,
                     updated_at = NOW(),
                     updated_by_user_account_id = EXCLUDED.updated_by_user_account_id`,
    [key, toStore, DESCRIPTIONS[key] ?? null, userId],
  );
}

function boolOf(v: string | null): boolean {
  return v === 'true' || v === '1';
}

/* ----------------------------------------------------------------- */
/*  SMS settings                                                     */
/* ----------------------------------------------------------------- */

export interface SmsSettings {
  provider: string;
  account_sid: string | null;
  auth_token: string | null;
  from_phone: string | null;
  webhook_secret: string | null;
  enabled: boolean;
}

export async function getSmsSettings(): Promise<SmsSettings> {
  const [provider, sid, token, from, secret, enabled] = await Promise.all([
    readRaw(SMS_KEYS.provider),
    readRaw(SMS_KEYS.account_sid),
    readRaw(SMS_KEYS.auth_token),
    readRaw(SMS_KEYS.from_phone),
    readRaw(SMS_KEYS.webhook_secret),
    readRaw(SMS_KEYS.enabled),
  ]);
  return {
    provider: provider ?? 'twilio',
    account_sid: readSecret(sid),
    auth_token: readSecret(token),
    from_phone: from,
    webhook_secret: readSecret(secret),
    enabled: boolOf(enabled),
  };
}

export interface SmsSettingsPublic {
  provider: string;
  from_phone: string | null;
  enabled: boolean;
  account_sid_set: boolean;
  auth_token_set: boolean;
  webhook_secret_set: boolean;
}

export async function getSmsSettingsPublic(): Promise<SmsSettingsPublic> {
  const s = await getSmsSettings();
  return {
    provider: s.provider,
    from_phone: s.from_phone,
    enabled: s.enabled,
    account_sid_set: !!s.account_sid,
    auth_token_set: !!s.auth_token,
    webhook_secret_set: !!s.webhook_secret,
  };
}

export interface SmsSettingsUpdate {
  provider?: string;
  account_sid?: string | null;
  auth_token?: string | null;
  from_phone?: string | null;
  webhook_secret?: string | null;
  enabled?: boolean;
}

export async function setSmsSettings(u: SmsSettingsUpdate, userId: number | null): Promise<void> {
  if (u.provider !== undefined) await writeRaw(SMS_KEYS.provider, u.provider, userId);
  if (u.from_phone !== undefined) await writeRaw(SMS_KEYS.from_phone, u.from_phone ?? '', userId);
  if (u.enabled !== undefined) await writeRaw(SMS_KEYS.enabled, u.enabled ? 'true' : 'false', userId);
  // Secrets: only overwrite when a non-null value is supplied. An empty string
  // explicitly clears; undefined leaves the existing secret in place.
  if (u.account_sid !== undefined && u.account_sid !== null) await writeRaw(SMS_KEYS.account_sid, u.account_sid, userId);
  if (u.auth_token !== undefined && u.auth_token !== null) await writeRaw(SMS_KEYS.auth_token, u.auth_token, userId);
  if (u.webhook_secret !== undefined && u.webhook_secret !== null) await writeRaw(SMS_KEYS.webhook_secret, u.webhook_secret, userId);
}

/* ----------------------------------------------------------------- */
/*  Org email settings                                               */
/* ----------------------------------------------------------------- */

export interface OrgEmailSettings {
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_password: string | null;
  smtp_use_tls: boolean;
  from_address: string | null;
  from_display_name: string | null;
  reply_domain: string | null;
  enabled: boolean;
}

export async function getOrgEmailSettings(): Promise<OrgEmailSettings> {
  const [host, port, user, pass, tls, from, name, replyDomain, enabled] = await Promise.all([
    readRaw(EMAIL_KEYS.smtp_host),
    readRaw(EMAIL_KEYS.smtp_port),
    readRaw(EMAIL_KEYS.smtp_username),
    readRaw(EMAIL_KEYS.smtp_password),
    readRaw(EMAIL_KEYS.smtp_use_tls),
    readRaw(EMAIL_KEYS.from_address),
    readRaw(EMAIL_KEYS.from_display_name),
    readRaw(EMAIL_KEYS.reply_domain),
    readRaw(EMAIL_KEYS.enabled),
  ]);
  const portNum = port ? Number(port) : null;
  return {
    smtp_host: host,
    smtp_port: portNum && Number.isFinite(portNum) ? portNum : null,
    smtp_username: user,
    smtp_password: readSecret(pass),
    smtp_use_tls: tls === null ? true : boolOf(tls),
    from_address: from,
    from_display_name: name,
    reply_domain: replyDomain,
    enabled: boolOf(enabled),
  };
}

export interface OrgEmailSettingsPublic {
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_use_tls: boolean;
  from_address: string | null;
  from_display_name: string | null;
  reply_domain: string | null;
  enabled: boolean;
  smtp_password_set: boolean;
}

export async function getOrgEmailSettingsPublic(): Promise<OrgEmailSettingsPublic> {
  const s = await getOrgEmailSettings();
  return {
    smtp_host: s.smtp_host,
    smtp_port: s.smtp_port,
    smtp_username: s.smtp_username,
    smtp_use_tls: s.smtp_use_tls,
    from_address: s.from_address,
    from_display_name: s.from_display_name,
    reply_domain: s.reply_domain,
    enabled: s.enabled,
    smtp_password_set: !!s.smtp_password,
  };
}

export interface OrgEmailSettingsUpdate {
  smtp_host?: string | null;
  smtp_port?: number | string | null;
  smtp_username?: string | null;
  smtp_password?: string | null;
  smtp_use_tls?: boolean;
  from_address?: string | null;
  from_display_name?: string | null;
  reply_domain?: string | null;
  enabled?: boolean;
}

export async function setOrgEmailSettings(u: OrgEmailSettingsUpdate, userId: number | null): Promise<void> {
  if (u.smtp_host !== undefined) await writeRaw(EMAIL_KEYS.smtp_host, u.smtp_host ?? '', userId);
  if (u.smtp_port !== undefined) await writeRaw(EMAIL_KEYS.smtp_port, u.smtp_port === null || u.smtp_port === '' ? '' : String(u.smtp_port), userId);
  if (u.smtp_username !== undefined) await writeRaw(EMAIL_KEYS.smtp_username, u.smtp_username ?? '', userId);
  if (u.smtp_use_tls !== undefined) await writeRaw(EMAIL_KEYS.smtp_use_tls, u.smtp_use_tls ? 'true' : 'false', userId);
  if (u.from_address !== undefined) await writeRaw(EMAIL_KEYS.from_address, u.from_address ?? '', userId);
  if (u.from_display_name !== undefined) await writeRaw(EMAIL_KEYS.from_display_name, u.from_display_name ?? '', userId);
  if (u.reply_domain !== undefined) await writeRaw(EMAIL_KEYS.reply_domain, u.reply_domain ?? '', userId);
  if (u.enabled !== undefined) await writeRaw(EMAIL_KEYS.enabled, u.enabled ? 'true' : 'false', userId);
  if (u.smtp_password !== undefined && u.smtp_password !== null) await writeRaw(EMAIL_KEYS.smtp_password, u.smtp_password, userId);
}

/* ----------------------------------------------------------------- */
/*  Fallback inbox                                                   */
/* ----------------------------------------------------------------- */

export async function getFallbackInbox(): Promise<string | null> {
  return readRaw(FALLBACK_INBOX_KEY);
}

export async function setFallbackInbox(email: string | null, userId: number | null): Promise<void> {
  await writeRaw(FALLBACK_INBOX_KEY, email ?? '', userId);
}
