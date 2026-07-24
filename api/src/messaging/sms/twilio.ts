/**
 * Twilio implementation of SmsProvider (COMMUNICATIONS_DESIGN §15, §7.1).
 *
 * Uses the REST API directly via global fetch — no SDK dependency to add.
 * Signature validation follows Twilio's documented algorithm:
 * base64(HMAC-SHA1(authToken, fullUrl + sortedConcat(paramName + paramValue))).
 *
 * Twilio signs webhooks with the account Auth Token. The design also allows a
 * separate `webhook_secret`; if the admin sets one we use it as the signing
 * key, otherwise we fall back to the Auth Token (the correct default).
 */

import crypto from 'node:crypto';
import type { Request } from 'express';
import type {
  SmsProvider, SendResult, InboundMessage, StatusUpdate, DeliveryStatus,
} from './provider.js';

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromPhone: string;
  /** Optional override key for webhook signature validation. */
  webhookSecret?: string | null;
}

/** Map a Twilio message status onto our normalized set. */
export function mapTwilioStatus(status: string | undefined): DeliveryStatus {
  switch ((status ?? '').toLowerCase()) {
    case 'delivered':
      return 'delivered';
    case 'undelivered':
      return 'undelivered';
    case 'failed':
      return 'failed';
    case 'sent':
    case 'sending':
    case 'receiving':
    case 'received':
      return 'sent';
    default:
      // queued | accepted | scheduling | '' etc.
      return 'queued';
  }
}

export class TwilioProvider implements SmsProvider {
  constructor(private readonly cfg: TwilioConfig) {}

  async send(to: string, body: string): Promise<SendResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.cfg.accountSid)}/Messages.json`;
    const form = new URLSearchParams({ To: to, From: this.cfg.fromPhone, Body: body });
    const authHeader = 'Basic ' + Buffer.from(`${this.cfg.accountSid}:${this.cfg.authToken}`).toString('base64');

    try {
      // Hard timeout so a slow/blocked network never hangs the request past
      // the platform gateway (which would surface as a 504). Fail fast with a
      // real error instead.
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
        signal: AbortSignal.timeout(15000),
      });
      const data = (await res.json().catch(() => ({}))) as {
        sid?: string; status?: string; error_code?: number | string | null; message?: string;
      };
      if (!res.ok) {
        return {
          ok: false,
          providerMessageId: data.sid ?? null,
          status: 'failed',
          errorCode: data.error_code != null ? String(data.error_code) : String(res.status),
          errorMessage: data.message ?? `Twilio HTTP ${res.status}`,
        };
      }
      return {
        ok: true,
        providerMessageId: data.sid ?? null,
        status: mapTwilioStatus(data.status),
        errorCode: data.error_code != null ? String(data.error_code) : null,
        errorMessage: null,
      };
    } catch (err: any) {
      const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      return {
        ok: false,
        providerMessageId: null,
        status: 'failed',
        errorCode: timedOut ? 'timeout' : 'network_error',
        errorMessage: timedOut
          ? 'Timed out contacting Twilio after 15s — check network egress and that the credentials/From number are valid.'
          : (err?.message ?? 'Network error contacting Twilio'),
      };
    }
  }

  parseInboundWebhook(req: Request): InboundMessage {
    const b = (req.body ?? {}) as Record<string, string>;
    return {
      from: b.From ?? '',
      to: b.To ?? '',
      body: b.Body ?? '',
      providerMessageId: b.MessageSid ?? b.SmsSid ?? null,
    };
  }

  parseStatusWebhook(req: Request): StatusUpdate {
    const b = (req.body ?? {}) as Record<string, string>;
    return {
      providerMessageId: b.MessageSid ?? b.SmsSid ?? '',
      status: mapTwilioStatus(b.MessageStatus ?? b.SmsStatus),
      errorCode: b.ErrorCode ? String(b.ErrorCode) : null,
      errorMessage: b.ErrorMessage ? String(b.ErrorMessage) : null,
    };
  }

  validateSignature(req: Request, fullUrl: string): boolean {
    const provided = req.get('X-Twilio-Signature');
    if (!provided) return false;

    const key = this.cfg.webhookSecret || this.cfg.authToken;
    if (!key) return false;

    const params = (req.body ?? {}) as Record<string, string>;
    // Twilio: concatenate the full URL, then each POST param sorted by name,
    // name immediately followed by value, no separators.
    let data = fullUrl;
    for (const name of Object.keys(params).sort()) {
      data += name + String(params[name] ?? '');
    }
    const expected = crypto.createHmac('sha1', key).update(Buffer.from(data, 'utf-8')).digest('base64');

    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }
}
