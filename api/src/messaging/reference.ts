/**
 * Reference codes tie an inbound reply back to the outbound message that
 * prompted it (COMMUNICATIONS_DESIGN §6.3, §7). An SMS optionally gets
 * `\n\nRef: <code>` appended; an org email uses `Reply-To: replies+<code>@...`.
 *
 * Codes are short, URL/SMS-safe, and unique (enforced by a UNIQUE PARTIAL
 * index on tbl_message.context_reference_code). We generate randomly and the
 * caller re-rolls on the rare collision.
 */

import crypto from 'node:crypto';

// Lowercase alphanumerics minus visually ambiguous chars (0/o, 1/l/i).
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const CODE_LEN = 7;

export function generateReferenceCode(): string {
  const bytes = crypto.randomBytes(CODE_LEN);
  let out = '';
  for (let i = 0; i < CODE_LEN; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/** Append the SMS reference footer. Kept tiny to preserve segment budget. */
export function appendReferenceCode(body: string, code: string): string {
  return `${body}\n\nRef: ${code}`;
}

/** Parse a `Ref: <code>` marker out of an inbound SMS body (case-insensitive). */
export function parseReferenceCodeFromSms(body: string): string | null {
  const m = body.match(/ref:\s*([a-z0-9]{4,12})/i);
  return m ? m[1].toLowerCase() : null;
}

/** Parse the reply code from a plus-addressed To header, e.g.
 *  `replies+abc1234@replies.furnishhope.org` → `abc1234`. */
export function parseReferenceCodeFromEmailAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const m = address.match(/\+([a-z0-9]{4,12})@/i);
  return m ? m[1].toLowerCase() : null;
}

/** Build the plus-addressed Reply-To for an org email, or null if no reply
 *  domain is configured. */
export function buildReplyToAddress(replyDomain: string | null, code: string): string | null {
  if (!replyDomain) return null;
  return `replies+${code}@${replyDomain}`;
}
