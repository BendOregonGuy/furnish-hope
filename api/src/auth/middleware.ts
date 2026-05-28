/**
 * Authentication + authorization middleware.
 *
 *   requireUser  — rejects unauthenticated requests with 401. Loads the
 *                  user from the DB and hangs it off `req.user`.
 *   requireAdmin — additionally requires is_admin=true on the user.
 *
 * Mount `requireUser` before any router that needs auth. The auth router
 * itself (login/logout/me) does NOT use this — login obviously can't, and
 * logout/me handle "no user" themselves.
 */

import type { Request, Response, NextFunction } from 'express';
import { queryOne } from '../db/pool.js';

export interface CurrentUser {
  user_account_id: number;
  username: string;
  is_admin: boolean;
  is_active: boolean;
  facility_staff_id: number | null;
  agency_contact_id: number | null;
  display_name: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: CurrentUser;
  }
}

/** Loads the current user from the session into `req.user`. Returns 401 if
 *  the session isn't authenticated, or the user is disabled / deleted. */
export async function requireUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }

  const user = await loadUser(userId);
  if (!user || !user.is_active) {
    // Stale session — clear it so the client lands cleanly on /login.
    req.session?.destroy(() => { /* ignore */ });
    res.status(401).json({ error: 'Account is disabled or no longer exists' });
    return;
  }

  req.user = user;
  next();
}

/** Like requireUser, but also requires admin. Run AFTER requireUser. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }
  if (!req.user.is_admin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

/** Fetches the user + their display name (joined through facility_staff →
 *  contact when available; otherwise just the username). */
export async function loadUser(userId: number): Promise<CurrentUser | null> {
  return queryOne<CurrentUser>(`
    SELECT
      ua.user_account_id,
      ua.username,
      ua.is_admin,
      ua.is_active,
      ua.facility_staff_id,
      ua.agency_contact_id,
      COALESCE(
        contact.first_name || ' ' || contact.last_name,
        ua.username
      ) AS display_name
    FROM tbl_user_account ua
    LEFT JOIN tbl_facility_staff fs ON fs.facility_staff_id = ua.facility_staff_id
    LEFT JOIN tbl_contact contact   ON contact.contact_id = fs.contact_id
    WHERE ua.user_account_id = $1
  `, [userId]);
}
