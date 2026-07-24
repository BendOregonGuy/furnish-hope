/**
 * Provider webhooks (COMMUNICATIONS_DESIGN §7.1, §13.1). Mounted BEFORE
 * requireUser in index.ts — Twilio can't authenticate as a user — with an
 * express.urlencoded parser scoped to the path (Twilio POSTs form-encoded).
 *
 *   POST /api/webhooks/twilio/inbound   inbound SMS (replies, STOP/HELP)
 *   POST /api/webhooks/twilio/status    delivery-status callbacks
 *
 * Both verify Twilio's X-Twilio-Signature before trusting the payload. Set
 * MESSAGING_SKIP_WEBHOOK_VALIDATION=1 ONLY for local development behind a
 * tunnel where the public URL is hard to reproduce.
 */

import { Router } from 'express';
import type { Request } from 'express';
import { query, queryOne } from '../db/pool.js';
import { getSmsProvider } from '../messaging/sms/index.js';
import { logMessage } from '../messaging/send.js';
import { parseReferenceCodeFromSms } from '../messaging/reference.js';

export const twilioWebhooksRouter = Router();

const SKIP_VALIDATION = process.env.MESSAGING_SKIP_WEBHOOK_VALIDATION === '1';
const OPT_OUT_KEYWORDS = new Set(['stop', 'unsubscribe', 'cancel', 'quit', 'end', 'stopall', 'revoke']);

const TWIML_OK = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
function twiml(res: import('express').Response) {
  res.set('Content-Type', 'text/xml').status(200).send(TWIML_OK);
}

/** The exact public URL Twilio POSTed to (for signature validation). Prefer an
 *  explicit PUBLIC_BASE_URL; otherwise reconstruct from proxy-aware headers. */
function publicUrl(req: Request): string {
  const base = process.env.PUBLIC_BASE_URL;
  if (base) return base.replace(/\/$/, '') + req.originalUrl;
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] || req.protocol;
  const host = req.get('host');
  return `${proto}://${host}${req.originalUrl}`;
}

function digits10(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const d = phone.replace(/[^0-9]/g, '');
  return d.length >= 10 ? d.slice(-10) : d || null;
}

/* ----------------------------------------------------------------- */
/*  POST /twilio/inbound                                              */
/* ----------------------------------------------------------------- */

twilioWebhooksRouter.post('/inbound', async (req, res, next) => {
  try {
    const provider = await getSmsProvider();
    if (!provider) return twiml(res); // not configured — ack so Twilio stops retrying

    if (!SKIP_VALIDATION && !provider.validateSignature(req, publicUrl(req))) {
      return res.status(403).json({ error: 'Invalid Twilio signature' });
    }

    const inbound = provider.parseInboundWebhook(req);
    const fromDigits = digits10(inbound.from);

    // Match the sender to a contact by trailing-10-digit phone.
    const contact = fromDigits
      ? await queryOne<{ contact_id: number }>(
          `SELECT contact_id FROM tbl_contact
            WHERE RIGHT(regexp_replace(COALESCE(mobile_phone,''), '[^0-9]', '', 'g'), 10) = $1
            ORDER BY contact_id LIMIT 1`,
          [fromDigits],
        )
      : null;

    // STOP / opt-out handling — record opt-out, do not notify. Twilio sends the
    // compliance auto-reply itself.
    const firstWord = inbound.body.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
    const isOptOut = OPT_OUT_KEYWORDS.has(firstWord);
    if (isOptOut && contact) {
      await query(
        `UPDATE tbl_contact SET sms_opted_out_at = NOW() WHERE contact_id = $1 AND sms_opted_out_at IS NULL`,
        [contact.contact_id],
      );
    }

    // Thread the reply back to its source: reference code first, then the most
    // recent outbound to this number within 72h, else unlinked.
    let source: {
      message_id: number; thread_id: number | null; context_type: string | null;
      context_id: number | null; sent_by_facility_staff_id: number | null;
    } | null = null;
    let confidence: 'confirmed' | 'inferred' | 'unlinked' = 'unlinked';

    const code = parseReferenceCodeFromSms(inbound.body);
    if (code) {
      source = await queryOne(
        `SELECT message_id, thread_id, context_type, context_id, sent_by_facility_staff_id
           FROM tbl_message
          WHERE context_reference_code = $1 ORDER BY sent_at DESC LIMIT 1`,
        [code],
      );
      if (source) confidence = 'confirmed';
    }
    if (!source && fromDigits) {
      source = await queryOne(
        `SELECT message_id, thread_id, context_type, context_id, sent_by_facility_staff_id
           FROM tbl_message
          WHERE direction = 'outbound' AND channel = 'sms'
            AND RIGHT(regexp_replace(COALESCE(to_address,''), '[^0-9]', '', 'g'), 10) = $1
            AND sent_at > NOW() - INTERVAL '72 hours'
          ORDER BY sent_at DESC LIMIT 1`,
        [fromDigits],
      );
      if (source) confidence = 'inferred';
    }

    const messageId = await logMessage({
      direction: 'inbound',
      channel: 'sms',
      contactId: contact?.contact_id ?? null,
      toAddress: inbound.to,
      fromAddress: inbound.from,
      subject: null,
      bodyRendered: inbound.body,
      providerMessageId: inbound.providerMessageId,
      deliveryStatus: 'delivered',
      contextType: source?.context_type ?? null,
      contextId: source?.context_id ?? null,
      contextConfidence: confidence,
      // NOTE: do not copy the source's reference code onto the inbound row —
      // context_reference_code has a UNIQUE partial index (one owner per code,
      // the outbound). The reply links via reply_to_message_id + thread_id.
      contextReferenceCode: null,
      threadId: source?.thread_id ?? source?.message_id ?? null,
      replyToMessageId: source?.message_id ?? null,
    });

    // Notify the original sender for a staff-initiated outbound (not for STOP).
    if (!isOptOut && source?.sent_by_facility_staff_id) {
      await query(
        `INSERT INTO tbl_message_notification (facility_staff_id, message_id) VALUES ($1, $2)`,
        [source.sent_by_facility_staff_id, messageId],
      );
    }

    return twiml(res);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  POST /twilio/status                                               */
/* ----------------------------------------------------------------- */

twilioWebhooksRouter.post('/status', async (req, res, next) => {
  try {
    const provider = await getSmsProvider();
    if (!provider) return twiml(res);

    if (!SKIP_VALIDATION && !provider.validateSignature(req, publicUrl(req))) {
      return res.status(403).json({ error: 'Invalid Twilio signature' });
    }

    const update = provider.parseStatusWebhook(req);
    if (update.providerMessageId) {
      await query(
        `UPDATE tbl_message
            SET delivery_status = $2,
                delivery_status_updated_at = NOW(),
                delivery_error_code = COALESCE($3, delivery_error_code),
                delivery_error_message = COALESCE($4, delivery_error_message)
          WHERE provider_message_id = $1`,
        [update.providerMessageId, update.status, update.errorCode, update.errorMessage],
      );
    }
    return twiml(res);
  } catch (err) { next(err); }
});
