/**
 * Delivery cascade + message logging (COMMUNICATIONS_DESIGN §5).
 *
 * For every send attempt — staff-initiated now, trigger-initiated in
 * Session 2 — walk the cascade:
 *   1. SMS if the contact has a mobile + SMS consent + not opted out.
 *   2. else org email if they have email + email consent + not opted out.
 *   3. else fallback email to the shared inbox + an undeliverable record.
 *
 * Consent is strict: we never cascade onto a channel the contact hasn't
 * consented to. Every attempt (success, fallback) is logged to tbl_message.
 */

import { query, queryOne } from '../db/pool.js';
import { getSmsProvider, isSmsEnabled, getSmsFromPhone } from './sms/index.js';
import { sendOrgEmail, isOrgEmailEnabled } from './email/org-email.js';
import { getOrgEmailSettings, getFallbackInbox } from './settings.js';
import { generateReferenceCode, appendReferenceCode } from './reference.js';

export type Channel = 'sms' | 'email';

export interface ContactChannels {
  contact_id: number;
  first_name: string | null;
  last_name: string | null;
  mobile_phone: string | null;
  email: string | null;
  sms_consent_at: string | null;
  sms_opted_out_at: string | null;
  email_consent_at: string | null;
  email_opted_out_at: string | null;
}

export interface SendToContactInput {
  contactId: number;
  /** Channels the caller allows; the cascade runs within this set. Defaults
   *  to both (full cascade). */
  channels?: Channel[];
  /** Rendered plain-text body (used for SMS and as email text). */
  body: string;
  /** Email subject. Required if an email is actually sent. */
  subject?: string | null;
  /** Optional distinct HTML email body. */
  bodyHtml?: string | null;
  /** Append `Ref: <code>` to the SMS so replies can be threaded. Default true. */
  appendReferenceCode?: boolean;
  context?: { type?: string | null; id?: number | null };
  sentByFacilityStaffId?: number | null;
  sentByTriggerId?: number | null;
  messageTemplateId?: number | null;
}

export interface SendOutcome {
  /** 'sms' | 'email' | 'fallback_email' | 'none' */
  channel: Channel | 'fallback_email' | 'none';
  ok: boolean;
  messageId: number | null;
  status: string;
  referenceCode: string | null;
  undeliverableId: number | null;
  error: string | null;
}

interface LogMessageArgs {
  direction: 'outbound' | 'inbound';
  channel: 'sms' | 'email' | 'fallback_email';
  contactId: number | null;
  toAddress: string;
  fromAddress: string;
  subject: string | null;
  bodyRendered: string;
  sentByFacilityStaffId?: number | null;
  sentByTriggerId?: number | null;
  messageTemplateId?: number | null;
  providerMessageId?: string | null;
  deliveryStatus: string;
  deliveryErrorCode?: string | null;
  deliveryErrorMessage?: string | null;
  contextType?: string | null;
  contextId?: number | null;
  contextConfidence?: 'confirmed' | 'inferred' | 'unlinked';
  contextReferenceCode?: string | null;
  threadId?: number | null;
  replyToMessageId?: number | null;
}

/** Insert a tbl_message row and return its id. For a new outbound with no
 *  parent thread, thread_id is set to the row's own id (thread head). */
export async function logMessage(a: LogMessageArgs): Promise<number> {
  const row = await queryOne<{ message_id: number }>(
    `INSERT INTO tbl_message
       (direction, channel, contact_id, to_address, from_address, subject,
        body_rendered, sent_at, sent_by_facility_staff_id, sent_by_trigger_id,
        message_template_id, provider_message_id, delivery_status,
        delivery_status_updated_at, delivery_error_code, delivery_error_message,
        context_type, context_id, context_confidence, context_reference_code,
        thread_id, reply_to_message_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),$8,$9,$10,$11,$12,NOW(),$13,$14,$15,$16,$17,$18,$19,$20)
     RETURNING message_id`,
    [
      a.direction, a.channel, a.contactId, a.toAddress, a.fromAddress, a.subject,
      a.bodyRendered, a.sentByFacilityStaffId ?? null, a.sentByTriggerId ?? null,
      a.messageTemplateId ?? null, a.providerMessageId ?? null, a.deliveryStatus,
      a.deliveryErrorCode ?? null, a.deliveryErrorMessage ?? null,
      a.contextType ?? null, a.contextId ?? null, a.contextConfidence ?? 'unlinked',
      a.contextReferenceCode ?? null, a.threadId ?? null, a.replyToMessageId ?? null,
    ],
  );
  const id = row!.message_id;
  if (a.threadId == null && a.replyToMessageId == null) {
    await query(`UPDATE tbl_message SET thread_id = $1 WHERE message_id = $1`, [id]);
  }
  return id;
}

async function loadContactChannels(contactId: number): Promise<ContactChannels | null> {
  return queryOne<ContactChannels>(
    `SELECT contact_id, first_name, last_name, mobile_phone, email,
            sms_consent_at, sms_opted_out_at, email_consent_at, email_opted_out_at
       FROM tbl_contact WHERE contact_id = $1`,
    [contactId],
  );
}

function canSms(c: ContactChannels): boolean {
  return !!c.mobile_phone && !!c.sms_consent_at && !c.sms_opted_out_at;
}
function canEmail(c: ContactChannels): boolean {
  return !!c.email && !!c.email_consent_at && !c.email_opted_out_at;
}

/** Generate a reference code not already present on tbl_message. */
async function uniqueReferenceCode(): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const code = generateReferenceCode();
    const clash = await queryOne<{ one: number }>(
      `SELECT 1 AS one FROM tbl_message WHERE context_reference_code = $1`,
      [code],
    );
    if (!clash) return code;
  }
  // Astronomically unlikely; append entropy.
  return generateReferenceCode() + generateReferenceCode().slice(0, 3);
}

function contactName(c: ContactChannels): string {
  return [c.first_name, c.last_name].filter(Boolean).join(' ') || `Contact #${c.contact_id}`;
}

/**
 * Run the cascade for one contact. Never throws for expected failure modes;
 * returns a structured outcome describing what happened.
 */
export async function sendToContact(input: SendToContactInput): Promise<SendOutcome> {
  const allowed = new Set<Channel>(input.channels ?? ['sms', 'email']);
  const contact = await loadContactChannels(input.contactId);
  if (!contact) {
    return { channel: 'none', ok: false, messageId: null, status: 'no_contact', referenceCode: null, undeliverableId: null, error: 'Contact not found' };
  }

  const ctxType = input.context?.type ?? null;
  const ctxId = input.context?.id ?? null;
  const wantRef = input.appendReferenceCode !== false;

  // ---- Step 1: SMS ----
  if (allowed.has('sms') && canSms(contact)) {
    if (await isSmsEnabled()) {
      const provider = await getSmsProvider();
      if (provider) {
        const fromPhone = (await getSmsFromPhone()) ?? '';
        const refCode = wantRef ? await uniqueReferenceCode() : null;
        const smsBody = refCode ? appendReferenceCode(input.body, refCode) : input.body;
        const result = await provider.send(contact.mobile_phone!, smsBody);
        if (result.ok) {
          const messageId = await logMessage({
            direction: 'outbound', channel: 'sms', contactId: contact.contact_id,
            toAddress: contact.mobile_phone!, fromAddress: fromPhone, subject: null,
            bodyRendered: smsBody, sentByFacilityStaffId: input.sentByFacilityStaffId,
            sentByTriggerId: input.sentByTriggerId, messageTemplateId: input.messageTemplateId,
            providerMessageId: result.providerMessageId, deliveryStatus: result.status,
            contextType: ctxType, contextId: ctxId,
            contextConfidence: ctxType ? 'confirmed' : 'unlinked',
            contextReferenceCode: refCode,
          });
          return { channel: 'sms', ok: true, messageId, status: result.status, referenceCode: refCode, undeliverableId: null, error: null };
        }
        // Hard failure — fall through to email per §5.
      }
    }
  }

  // ---- Step 2: Org email ----
  if (allowed.has('email') && canEmail(contact)) {
    if (await isOrgEmailEnabled()) {
      const subject = input.subject ?? 'A message from Furnish Hope';
      const refCode = wantRef ? await uniqueReferenceCode() : null;
      const org = await getOrgEmailSettings();
      const result = await sendOrgEmail({
        to: contact.email!, subject, bodyText: input.body,
        bodyHtml: input.bodyHtml ?? null, replyToCode: refCode,
      });
      if (result.ok) {
        const messageId = await logMessage({
          direction: 'outbound', channel: 'email', contactId: contact.contact_id,
          toAddress: contact.email!, fromAddress: org.from_address ?? '', subject,
          bodyRendered: input.body, sentByFacilityStaffId: input.sentByFacilityStaffId,
          sentByTriggerId: input.sentByTriggerId, messageTemplateId: input.messageTemplateId,
          providerMessageId: result.providerMessageId, deliveryStatus: 'sent',
          contextType: ctxType, contextId: ctxId,
          contextConfidence: ctxType ? 'confirmed' : 'unlinked',
          contextReferenceCode: refCode,
        });
        return { channel: 'email', ok: true, messageId, status: 'sent', referenceCode: refCode, undeliverableId: null, error: null };
      }
    }
  }

  // ---- Step 3: Fallback ----
  return fallback(contact, input, ctxType, ctxId, reasonFor(contact, allowed));
}

function reasonFor(c: ContactChannels, allowed: Set<Channel>): string {
  const smsAllowed = allowed.has('sms');
  const emailAllowed = allowed.has('email');
  const hasSmsConsent = canSms(c);
  const hasEmailConsent = canEmail(c);
  if (!hasSmsConsent && !hasEmailConsent) return 'no_channels';
  if (smsAllowed && hasSmsConsent && !(emailAllowed && hasEmailConsent)) return 'sms_failed_no_email';
  if (smsAllowed && hasSmsConsent && emailAllowed && hasEmailConsent) return 'sms_failed_email_failed';
  if (!hasSmsConsent && !(emailAllowed && hasEmailConsent)) return 'no_sms_consent_no_email';
  return 'delivery_failed';
}

async function fallback(
  contact: ContactChannels,
  input: SendToContactInput,
  ctxType: string | null,
  ctxId: number | null,
  reason: string,
): Promise<SendOutcome> {
  const inbox = await getFallbackInbox();
  const name = contactName(contact);
  const subject = `[Furnish Hope] Couldn't reach ${name}`;
  const org = await getOrgEmailSettings();
  const body =
    `Furnish Hope tried to send a message but couldn't reach ${name} on any consented channel.\n\n` +
    `Reason: ${reason}\n` +
    `Contact ID: ${contact.contact_id}\n` +
    (ctxType ? `Related to: ${ctxType} #${ctxId ?? '—'}\n` : '') +
    `\n--- Intended message ---\n${input.subject ? 'Subject: ' + input.subject + '\n' : ''}${input.body}\n`;

  let messageId: number | null = null;
  let sentOk = false;
  if (inbox && (await isOrgEmailEnabled())) {
    const result = await sendOrgEmail({ to: inbox, subject, bodyText: body });
    sentOk = result.ok;
    messageId = await logMessage({
      direction: 'outbound', channel: 'fallback_email', contactId: contact.contact_id,
      toAddress: inbox, fromAddress: org.from_address ?? '', subject, bodyRendered: body,
      sentByFacilityStaffId: input.sentByFacilityStaffId, sentByTriggerId: input.sentByTriggerId,
      messageTemplateId: input.messageTemplateId, providerMessageId: result.providerMessageId,
      deliveryStatus: result.ok ? 'sent' : 'failed',
      deliveryErrorMessage: result.errorMessage,
      contextType: ctxType, contextId: ctxId, contextConfidence: 'unlinked',
    });
  }

  const undel = await queryOne<{ message_undeliverable_id: number }>(
    `INSERT INTO tbl_message_undeliverable
       (contact_id, trigger_id, sent_by_facility_staff_id, intended_body, intended_subject,
        reason, context_type, context_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING message_undeliverable_id`,
    [
      contact.contact_id, input.sentByTriggerId ?? null, input.sentByFacilityStaffId ?? null,
      input.body, input.subject ?? null, reason, ctxType, ctxId,
    ],
  );

  return {
    channel: 'fallback_email',
    ok: sentOk,
    messageId,
    status: sentOk ? 'sent' : 'logged_only',
    referenceCode: null,
    undeliverableId: undel?.message_undeliverable_id ?? null,
    error: inbox ? null : 'No fallback inbox configured; logged as undeliverable only.',
  };
}
