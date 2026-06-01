/**
 * Symmetric encryption for storing email-account passwords at rest.
 *
 * Uses AES-256-GCM. Key comes from `EMAIL_ENCRYPTION_KEY` env var (32 bytes
 * hex = 64 chars), or falls back to a key derived from SESSION_SECRET so we
 * still work in dev where the operator hasn't set a dedicated key.
 *
 * Encoded format (single string): `<iv-b64>:<tag-b64>:<ciphertext-b64>`.
 * The IV is random per encryption (12 bytes), the auth tag is 16 bytes.
 *
 * Why GCM: authenticated encryption catches tampering. Without that, an
 * attacker with DB write could swap ciphertext and we wouldn't notice on
 * decrypt.
 */

import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const fromEnv = process.env.EMAIL_ENCRYPTION_KEY;
  if (fromEnv && /^[0-9a-fA-F]{64}$/.test(fromEnv)) {
    cachedKey = Buffer.from(fromEnv, 'hex');
    return cachedKey;
  }

  // Fall back: derive from SESSION_SECRET. Warn loudly because the operator
  // really should set EMAIL_ENCRYPTION_KEY explicitly so rotating one secret
  // doesn't accidentally invalidate the other.
  const sessionSecret = process.env.SESSION_SECRET;
  if (sessionSecret && sessionSecret.length >= 32) {
    console.warn(
      '[email] EMAIL_ENCRYPTION_KEY not set — deriving from SESSION_SECRET. ' +
      'Set EMAIL_ENCRYPTION_KEY explicitly so the two can rotate independently. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
    cachedKey = crypto.createHash('sha256').update('furnish-hope:email:' + sessionSecret).digest();
    return cachedKey;
  }

  throw new Error(
    'No EMAIL_ENCRYPTION_KEY or sufficient SESSION_SECRET available. ' +
    'Set EMAIL_ENCRYPTION_KEY to a 64-char hex string before storing email credentials.',
  );
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

export function decryptSecret(encoded: string): string {
  const key = getKey();
  const [ivB64, tagB64, ctB64] = encoded.split(':');
  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error('Malformed encrypted secret');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}
