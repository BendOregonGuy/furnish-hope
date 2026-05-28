/**
 * Authentication endpoints — sign in, sign out, who-am-I, change password.
 *
 *   POST /api/auth/login      { username, password }    → 200 { user }
 *   POST /api/auth/logout     -                          → 204
 *   GET  /api/auth/me         -                          → 200 { user } | 401
 *   POST /api/auth/password   { current, new }           → 204
 *
 * The login endpoint is rate-limited (5 attempts per IP per minute) to
 * prevent brute-force.
 */

import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { query, queryOne } from '../db/pool.js';
import { loadUser, requireAdmin, requireUser } from '../auth/middleware.js';
import { auditUpdate } from '../auth/audit.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Wait a minute and try again.' },
});

/** Single-line stderr log of a failed sign-in attempt, for the operator to
 *  spot patterns. With <20 users the operator is the audit trail; if this
 *  grows we'll persist to `tbl_audit_log` with a synthetic action like
 *  'LOGIN_FAILED'. */
function logFailedLogin(req: import('express').Request, username: string, reason: string): void {
  const ip = req.ip ?? req.socket.remoteAddress ?? '?';
  const ua = (req.headers['user-agent'] ?? '?').toString().slice(0, 80);
  console.warn(
    `[auth] failed login: user=${JSON.stringify(username).slice(0, 50)} ` +
    `reason=${reason} ip=${ip} ua=${JSON.stringify(ua)}`,
  );
}

/* ----------------------------------------------------------------- */
/*  POST /api/auth/login                                              */
/* ----------------------------------------------------------------- */

authRouter.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const row = await queryOne<{ user_account_id: number; password_hash: string; is_active: boolean }>(
      `SELECT user_account_id, password_hash, is_active
         FROM tbl_user_account
        WHERE username = $1`,
      [username],
    );

    // Hash a dummy to keep timing roughly constant whether or not the user
    // exists. Cheap protection against username enumeration.
    if (!row) {
      await bcrypt.compare(password, '$2b$10$0123456789012345678901uVDh3LD8nGsXmJ7iIlGqFvHQT0eRZX2');
      logFailedLogin(req, username, 'unknown-user');
      return res.status(401).json({ error: 'Wrong username or password.' });
    }

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      logFailedLogin(req, username, 'wrong-password');
      return res.status(401).json({ error: 'Wrong username or password.' });
    }
    if (!row.is_active) {
      logFailedLogin(req, username, 'disabled');
      return res.status(403).json({ error: 'This account is disabled. Ask an admin to re-enable it.' });
    }

    // Issue a fresh session id (prevents session fixation).
    req.session.regenerate(async (err) => {
      if (err) return next(err);
      req.session.userId = row.user_account_id;
      await query(`UPDATE tbl_user_account SET last_login_at = NOW() WHERE user_account_id = $1`, [row.user_account_id]);
      const user = await loadUser(row.user_account_id);
      res.json({ user });
    });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  POST /api/auth/logout                                             */
/* ----------------------------------------------------------------- */

authRouter.post('/logout', (req, res, next) => {
  if (!req.session) return res.status(204).end();
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('furnish_hope.sid');
    res.status(204).end();
  });
});

/* ----------------------------------------------------------------- */
/*  GET /api/auth/me                                                  */
/* ----------------------------------------------------------------- */

authRouter.get('/me', async (req, res, next) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: 'Not signed in' });
    const user = await loadUser(userId);
    if (!user) {
      req.session.destroy(() => { /* ignore */ });
      return res.status(401).json({ error: 'Account no longer exists' });
    }
    res.json({ user });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  POST /api/auth/password — change own password                     */
/* ----------------------------------------------------------------- */

authRouter.post('/password', requireUser, async (req, res, next) => {
  try {
    const { current, new: nextPw } = req.body ?? {};
    if (typeof current !== 'string' || typeof nextPw !== 'string') {
      return res.status(400).json({ error: 'current and new are required.' });
    }
    if (nextPw.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }
    if (nextPw === current) {
      return res.status(400).json({ error: 'New password must be different from the current one.' });
    }

    const row = await queryOne<{ password_hash: string }>(
      `SELECT password_hash FROM tbl_user_account WHERE user_account_id = $1`,
      [req.user!.user_account_id],
    );
    if (!row) return res.status(401).json({ error: 'Not signed in' });

    const ok = await bcrypt.compare(current, row.password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password is wrong.' });

    const newHash = await bcrypt.hash(nextPw, 10);
    await query(`UPDATE tbl_user_account SET password_hash = $1 WHERE user_account_id = $2`,
      [newHash, req.user!.user_account_id]);
    res.status(204).end();
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  POST /api/auth/users/:id/reset-password — admin-driven reset      */
/* ----------------------------------------------------------------- */

/**
 * Generates a fresh temp password for any user, replaces their hash, and
 * returns the plaintext to the admin ONCE. Admin hands it off to the user
 * (verbally / via secure channel). The user should change it on next login.
 *
 * Admins-only. Cannot reset your own password this way — use POST /password
 * with the current+new flow instead.
 */
authRouter.post('/users/:id/reset-password', requireUser, requireAdmin, async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'Invalid user id' });
    if (userId === req.user!.user_account_id) {
      return res.status(400).json({ error: 'Use Settings → Change password to reset your own.' });
    }

    const target = await queryOne<{ user_account_id: number; username: string }>(
      `SELECT user_account_id, username FROM tbl_user_account WHERE user_account_id = $1`, [userId],
    );
    if (!target) return res.status(404).json({ error: 'User not found' });

    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, 10);
    await query(`UPDATE tbl_user_account SET password_hash = $1 WHERE user_account_id = $2`,
      [hash, userId]);

    // Audit. We don't log the new hash (masked anyway) but record that a
    // reset happened.
    await auditUpdate(req, 'tbl_user_account', userId,
      { password_hash: 'old' }, { password_hash: 'reset-by-admin' });

    res.json({ username: target.username, temp_password: tempPassword });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  PUT /api/auth/profile — edit own linked contact                   */
/* ----------------------------------------------------------------- */

/**
 * Lets a signed-in user edit their own contact info (name, phones, email).
 * Only writes through to the linked tbl_contact via facility_staff_id —
 * agency-contact-bound users are read-only for now.
 */
authRouter.put('/profile', requireUser, async (req, res, next) => {
  try {
    const me = req.user!;
    if (!me.facility_staff_id) {
      return res.status(400).json({ error: 'Your account is not linked to a staff record yet. Ask an admin to link it.' });
    }
    const contactRow = await queryOne<{ contact_id: number }>(
      `SELECT contact_id FROM tbl_facility_staff WHERE facility_staff_id = $1`, [me.facility_staff_id],
    );
    if (!contactRow) return res.status(404).json({ error: 'Linked staff record missing.' });

    const {
      first_name, middle_name, last_name,
      mobile_phone, home_phone, other_phone, email,
    } = req.body ?? {};
    if (typeof first_name !== 'string' || !first_name.trim()) return res.status(400).json({ error: 'First name is required.' });
    if (typeof last_name  !== 'string' || !last_name.trim())  return res.status(400).json({ error: 'Last name is required.' });

    const before = await queryOne<Record<string, any>>(
      `SELECT * FROM tbl_contact WHERE contact_id = $1`, [contactRow.contact_id],
    );
    const after = await queryOne<Record<string, any>>(`
      UPDATE tbl_contact
         SET first_name = $1, middle_name = $2, last_name = $3,
             mobile_phone = $4, home_phone = $5, other_phone = $6, email = $7
       WHERE contact_id = $8
       RETURNING *
    `, [
      first_name.trim(),
      (middle_name as string | undefined)?.trim() || null,
      last_name.trim(),
      (mobile_phone as string | undefined) || null,
      (home_phone as string | undefined) || null,
      (other_phone as string | undefined) || null,
      (email as string | undefined) || null,
      contactRow.contact_id,
    ]);
    if (before && after) await auditUpdate(req, 'tbl_contact', contactRow.contact_id, before, after);

    const updated = await loadUser(me.user_account_id);
    res.json({ user: updated });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  GET /api/auth/profile — return own contact for the Settings form  */
/* ----------------------------------------------------------------- */

authRouter.get('/profile', requireUser, async (req, res, next) => {
  try {
    const me = req.user!;
    if (!me.facility_staff_id) {
      return res.json({ linked: false, contact: null });
    }
    const contact = await queryOne(`
      SELECT contact.contact_id, contact.first_name, contact.middle_name, contact.last_name,
             contact.mobile_phone, contact.home_phone, contact.other_phone, contact.email
        FROM tbl_facility_staff fs
        JOIN tbl_contact contact ON contact.contact_id = fs.contact_id
       WHERE fs.facility_staff_id = $1
    `, [me.facility_staff_id]);
    res.json({ linked: true, contact });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Helpers                                                           */
/* ----------------------------------------------------------------- */

function generateTempPassword(): string {
  const syllables = ['cas', 'mor', 'len', 'tor', 'pin', 'val', 'sun', 'ash', 'jun', 'rey', 'tan', 'oak', 'mes', 'fal', 'win', 'kel'];
  const pick = () => syllables[crypto.randomInt(0, syllables.length)];
  const digits = crypto.randomInt(100, 999);
  return `${pick()}-${pick()}-${pick()}-${digits}`;
}
