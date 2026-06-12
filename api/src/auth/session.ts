/**
 * Session middleware configuration. Sessions live in Postgres via
 * connect-pg-simple — no separate Redis needed.
 *
 * Cookie config:
 * - httpOnly: JS can't read the cookie (mitigates XSS theft)
 * - sameSite=strict: cross-origin requests don't carry the cookie (mitigates
 *   CSRF without needing csurf tokens, since our API only takes JSON)
 * - secure: set automatically when SESSION_SECURE=true (production / HTTPS)
 * - maxAge: 12 hours of inactivity = forced re-login
 */

import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import crypto from 'node:crypto';
import { pool } from '../db/pool.js';

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

export function createSessionMiddleware() {
  const PgStore = connectPgSimple(session);

  const envSecret = process.env.SESSION_SECRET;
  const isProd = process.env.NODE_ENV === 'production';

  // In prod, refuse to start without a real SESSION_SECRET. Common
  // mistake: leaving the literal placeholder from .do/app.yaml.
  if (isProd) {
    if (!envSecret || envSecret === 'REPLACE_ME_BEFORE_FIRST_DEPLOY' || envSecret.length < 32) {
      throw new Error(
        '[auth] SESSION_SECRET is missing, set to the placeholder, or too short ' +
        '(must be >= 32 chars). Generate one with `node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"` ' +
        'and set it as a SECRET env var in the DigitalOcean app config.',
      );
    }
  }

  const secret = envSecret || generateRuntimeSecret();
  if (!envSecret) {
    console.warn(
      '[auth] SESSION_SECRET not set — using an in-memory secret. Sessions ' +
      'will NOT survive an API restart. Set SESSION_SECRET in your environment.',
    );
  }

  return session({
    name: 'furnish_hope.sid',
    secret,
    resave: false,
    saveUninitialized: false,
    rolling: true, // slide the expiry forward on each request
    cookie: {
      httpOnly: true,
      sameSite: 'lax', // 'strict' would block links from email; 'lax' is the
                       // standard compromise for first-party apps
      secure: process.env.SESSION_SECURE === 'true',
      maxAge: TWELVE_HOURS_MS,
    },
    store: new PgStore({
      pool,
      tableName: 'session',
      createTableIfMissing: false, // migrations.ts handles this
    }),
  });
}

function generateRuntimeSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Augment Express's session type so we can typesafely set req.session.userId. */
declare module 'express-session' {
  interface SessionData {
    userId?: number;
  }
}
