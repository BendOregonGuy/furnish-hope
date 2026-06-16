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
  is_developer: boolean;
  is_active: boolean;
  facility_staff_id: number | null;
  agency_contact_id: number | null;
  display_name: string;
  /** Derived role. Computed in loadUser() so the frontend and every
   *  middleware see the same value:
   *    - 'agency': has agency_contact_id, no facility_staff_id, not admin
   *    - 'staff':  facility_staff_id is set (regardless of agency link)
   *                OR is_admin (admins are super-staff)
   *  Future: 'volunteer' if we ever need to differentiate within staff.
   */
  role: 'staff' | 'agency';
  /** For agency users, the id of the agency they work for. Null for
   *  staff. Used by route scoping so an agency caseworker only sees
   *  their OWN org's referrals, not other agencies'. */
  agency_id: number | null;
  agency_name: string | null;
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

/** Developer — must be both admin AND is_developer. Used for issue
 *  triage + the broadcast-to-all-users endpoints. Run AFTER requireUser. */
export function requireDeveloper(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }
  if (!req.user.is_admin || !req.user.is_developer) {
    res.status(403).json({ error: 'Developer access required.' });
    return;
  }
  next();
}

/** Reject agency-role users. Use this on every endpoint that's
 *  internal-only — donors, internal ops, audit log, settings, etc.
 *  Agency caseworkers are restricted to /api/agency/* via an
 *  explicit allowlist; this middleware enforces the rest. */
export function requireStaff(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }
  if (req.user.role !== 'staff') {
    res.status(403).json({ error: 'This area is for Furnish Hope staff only.' });
    return;
  }
  next();
}

/** Reject anyone who isn't an agency caseworker. Use this on the
 *  /api/agency/* routes so a confused staff user can't accidentally
 *  hit endpoints designed for the trimmed-down caseworker UI. */
export function requireAgency(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }
  if (req.user.role !== 'agency') {
    res.status(403).json({ error: 'This area is for partner-agency caseworkers only.' });
    return;
  }
  next();
}

/** Fetches the user + their display name + derived role + agency
 *  scope. The display-name COALESCE prefers the facility_staff
 *  contact, falls back to the agency_contact, then to username. */
export async function loadUser(userId: number): Promise<CurrentUser | null> {
  const row = await queryOne<Omit<CurrentUser, 'role'>>(`
    SELECT
      ua.user_account_id,
      ua.username,
      ua.is_admin,
      COALESCE(ua.is_developer, false) AS is_developer,
      ua.is_active,
      ua.facility_staff_id,
      ua.agency_contact_id,
      COALESCE(
        staff_contact.first_name || ' ' || staff_contact.last_name,
        agency_contact_person.first_name || ' ' || agency_contact_person.last_name,
        ua.username
      ) AS display_name,
      ag.agency_id,
      ag.agency_name
    FROM tbl_user_account ua
    LEFT JOIN tbl_facility_staff fs        ON fs.facility_staff_id = ua.facility_staff_id
    LEFT JOIN tbl_contact staff_contact    ON staff_contact.contact_id = fs.contact_id
    LEFT JOIN tbl_agency_contact ac        ON ac.agency_contact_id = ua.agency_contact_id
    LEFT JOIN tbl_agency ag                ON ag.agency_id = ac.agency_id
    LEFT JOIN tbl_contact agency_contact_person ON agency_contact_person.contact_id = ac.contact_id
    WHERE ua.user_account_id = $1
  `, [userId]);
  if (!row) return null;
  // Derive the role. Staff > Agency precedence — an admin who happens
  // to ALSO be linked to an agency_contact is still a staff user.
  const isAgencyOnly = !row.is_admin && row.agency_contact_id != null && row.facility_staff_id == null;
  return {
    ...row,
    role: isAgencyOnly ? 'agency' : 'staff',
  };
}
