/**
 * SMS provider abstraction (COMMUNICATIONS_DESIGN §15). Twilio is the only
 * implementation in Phase 1; a second provider is a new class + a settings
 * dropdown entry, nothing else changes.
 */

import type { Request } from 'express';

/** Normalized delivery states we persist on tbl_message.delivery_status. */
export type DeliveryStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered';

export interface SendResult {
  ok: boolean;
  /** Provider's message id (Twilio SID), if the send was accepted. */
  providerMessageId: string | null;
  /** Normalized status at accept time (usually 'queued' or 'sent'). */
  status: DeliveryStatus;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface InboundMessage {
  from: string;
  to: string;
  body: string;
  providerMessageId: string | null;
}

export interface StatusUpdate {
  providerMessageId: string;
  status: DeliveryStatus;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface SmsProvider {
  /** Send an SMS. Resolves with ok=false (never throws) on provider error. */
  send(to: string, body: string): Promise<SendResult>;
  /** Extract the inbound message fields from a provider webhook request. */
  parseInboundWebhook(req: Request): InboundMessage;
  /** Extract a delivery-status update from a provider webhook request. */
  parseStatusWebhook(req: Request): StatusUpdate;
  /**
   * Verify the provider's webhook signature.
   * @param req      the Express request (headers + parsed form body)
   * @param fullUrl  the exact public URL the provider POSTed to
   */
  validateSignature(req: Request, fullUrl: string): boolean;
}
