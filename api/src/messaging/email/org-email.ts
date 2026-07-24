/**
 * Organizational email send path (COMMUNICATIONS_DESIGN §2, §7.2, §15).
 *
 * Distinct from the per-user Mailbox email (email/transports.ts) — that
 * authenticates as an individual staff member's connected inbox. This one
 * sends AS the organization, from the org SMTP settings in tbl_app_setting,
 * for automated + staff-initiated org messages. It reuses nodemailer the same
 * way buildSmtpTransporter does, just against org-level config.
 */

import nodemailer, { type Transporter } from 'nodemailer';
import { getOrgEmailSettings, type OrgEmailSettings } from '../settings.js';
import { buildReplyToAddress } from '../reference.js';

export interface OrgEmailSendResult {
  ok: boolean;
  providerMessageId: string | null;
  errorMessage: string | null;
}

export interface SendOrgEmailInput {
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
  /** When set with a configured reply domain, adds a plus-addressed Reply-To
   *  so inbound replies can be threaded back to the source message. */
  replyToCode?: string | null;
}

function buildTransporter(s: OrgEmailSettings): Transporter {
  if (!s.smtp_host || !s.smtp_port) throw new Error('Org email SMTP host/port not configured');
  // secure=true → implicit TLS (465); false → STARTTLS upgrade (587), matching
  // the per-user transport convention.
  const secure = s.smtp_port === 465;
  const auth = s.smtp_username
    ? { user: s.smtp_username, pass: s.smtp_password ?? '' }
    : undefined;
  return nodemailer.createTransport({
    host: s.smtp_host,
    port: s.smtp_port,
    secure,
    requireTLS: !secure && s.smtp_use_tls,
    auth,
    connectionTimeout: 10000,
    greetingTimeout: 8000,
    socketTimeout: 15000,
  });
}

function fromHeader(s: OrgEmailSettings): string {
  const addr = s.from_address ?? '';
  return s.from_display_name ? `"${s.from_display_name}" <${addr}>` : addr;
}

export async function sendOrgEmail(input: SendOrgEmailInput): Promise<OrgEmailSendResult> {
  const s = await getOrgEmailSettings();
  if (!s.enabled) {
    return { ok: false, providerMessageId: null, errorMessage: 'Org email is disabled in settings.' };
  }
  if (!s.smtp_host || !s.smtp_port || !s.from_address) {
    return { ok: false, providerMessageId: null, errorMessage: 'Org email is not fully configured.' };
  }

  try {
    const transporter = buildTransporter(s);
    const replyTo = input.replyToCode ? buildReplyToAddress(s.reply_domain, input.replyToCode) : null;
    // CAN-SPAM friendly unsubscribe affordance.
    const listUnsub = `<mailto:${s.from_address}?subject=unsubscribe>`;

    const info = await transporter.sendMail({
      from: fromHeader(s),
      to: input.to,
      subject: input.subject,
      text: input.bodyText,
      html: input.bodyHtml ?? undefined,
      replyTo: replyTo ?? undefined,
      headers: { 'List-Unsubscribe': listUnsub },
    });
    transporter.close();
    return { ok: true, providerMessageId: info.messageId ?? null, errorMessage: null };
  } catch (err: any) {
    return { ok: false, providerMessageId: null, errorMessage: err?.message ?? 'Org email send failed.' };
  }
}

/** Verify the org SMTP connection (used by the "Send test" button when no
 *  recipient is given). Throws on failure so the route can surface the error. */
export async function verifyOrgEmail(): Promise<void> {
  const s = await getOrgEmailSettings();
  if (!s.smtp_host || !s.smtp_port) throw new Error('Org email SMTP host/port not configured');
  const transporter = buildTransporter(s);
  try {
    await transporter.verify();
  } finally {
    transporter.close();
  }
}

/** Whether org email is turned on AND minimally configured. */
export async function isOrgEmailEnabled(): Promise<boolean> {
  const s = await getOrgEmailSettings();
  return s.enabled && !!s.smtp_host && !!s.smtp_port && !!s.from_address;
}
