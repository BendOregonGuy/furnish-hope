/**
 * Resolves the active SMS provider from tbl_app_setting
 * (COMMUNICATIONS_DESIGN §15). Returns null when no provider is fully
 * configured, so callers can degrade gracefully (banners, email-only sends).
 */

import type { SmsProvider } from './provider.js';
import { TwilioProvider } from './twilio.js';
import { getSmsSettings } from '../settings.js';

/**
 * A provider instance if credentials are present, else null. Note this does
 * NOT gate on the `enabled` flag — webhook signature validation still needs
 * the provider even when outbound is paused. The send path checks `enabled`
 * separately via {@link isSmsEnabled}.
 */
export async function getSmsProvider(): Promise<SmsProvider | null> {
  const s = await getSmsSettings();
  if (s.provider === 'twilio') {
    if (!s.account_sid || !s.auth_token || !s.from_phone) return null;
    return new TwilioProvider({
      accountSid: s.account_sid,
      authToken: s.auth_token,
      fromPhone: s.from_phone,
      webhookSecret: s.webhook_secret,
    });
  }
  return null;
}

/** Whether outbound SMS is turned on AND a provider is configured. */
export async function isSmsEnabled(): Promise<boolean> {
  const s = await getSmsSettings();
  return s.enabled && !!s.account_sid && !!s.auth_token && !!s.from_phone;
}

/** The configured Twilio From number (for logging from_address), or null. */
export async function getSmsFromPhone(): Promise<string | null> {
  const s = await getSmsSettings();
  return s.from_phone;
}
