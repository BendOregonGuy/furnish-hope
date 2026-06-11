/**
 * Events — fundraising galas, awareness events, volunteer days, etc.
 * Each event can be linked to a campaign and tracks attendees with
 * RSVP / contribution / check-in state.
 *
 *   GET    /api/events                  filter by campaign, upcoming
 *   GET    /api/events/:id              detail w/ attendees + neighbors
 *   POST   /api/events                  create w/ attendees subform
 *   PUT    /api/events/:id              update; diffs attendees
 *   DELETE /api/events/:id              cascades attendees
 *   POST   /api/events/:id/check-in     stamp checked_in_at on an attendee
 */

import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditCreate, auditDelete, auditUpdate } from '../auth/audit.js';

export const eventsRouter = Router();

interface AttendeePayload {
  event_attendee_id?: number | null;
  contact_id: number;
  rsvp_status?: string | null;
  attended?: boolean | null;
  amount_contributed?: number | null;
  ticket_count?: number;
  notes?: string | null;
}

interface EventWritePayload {
  event_name: string;
  event_type_id: number;
  event_date: string;
  start_time?: string | null;
  end_time?: string | null;
  address_id?: number | null;
  campaign_id?: number | null;
  goal_amount?: number | null;
  amount_raised?: number | null;
  ticket_price?: number | null;
  is_public?: boolean;
  notes?: string | null;
  description?: string | null;
  attendees?: AttendeePayload[];
}

/* ----------------------------------------------------------------- */
/*  List                                                              */
/* ----------------------------------------------------------------- */

eventsRouter.get('/', async (req, res, next) => {
  try {
    const campaignId = req.query.campaign_id ? Number(req.query.campaign_id) : null;
    const upcoming = req.query.upcoming === 'true';

    const conds: string[] = [];
    const params: any[] = [];
    if (campaignId) { params.push(campaignId); conds.push(`e.campaign_id = $${params.length}`); }
    if (upcoming) conds.push(`e.event_date >= CURRENT_DATE`);
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const rows = await query(`
      SELECT
        e.event_id, e.event_name, e.event_date, e.start_time, e.end_time,
        e.goal_amount, e.amount_raised, e.ticket_price, e.is_public,
        et.event_type,
        c.campaign_name,
        addr.address || (CASE WHEN city.city IS NOT NULL THEN ', ' || city.city ELSE '' END) AS venue,
        (SELECT COUNT(*)::int FROM tbl_event_attendee WHERE event_id = e.event_id) AS attendee_count,
        (SELECT COUNT(*)::int FROM tbl_event_attendee WHERE event_id = e.event_id AND attended = true) AS attended_count
      FROM tbl_event e
      JOIN lkp_event_type et ON et.event_type_id = e.event_type_id
      LEFT JOIN tbl_campaign c ON c.campaign_id = e.campaign_id
      LEFT JOIN tbl_address addr ON addr.address_id = e.address_id
      LEFT JOIN lkp_city city ON city.city_id = addr.city_id
      ${where}
      ORDER BY e.event_date DESC, e.start_time
      LIMIT 200
    `, params);

    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Read one                                                          */
/* ----------------------------------------------------------------- */

eventsRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const event = await queryOne(`
      SELECT
        e.*,
        et.event_type,
        c.campaign_name,
        addr.address, addr.address2, city.city, st.state, addr.postalcode
      FROM tbl_event e
      JOIN lkp_event_type et ON et.event_type_id = e.event_type_id
      LEFT JOIN tbl_campaign c ON c.campaign_id = e.campaign_id
      LEFT JOIN tbl_address addr ON addr.address_id = e.address_id
      LEFT JOIN lkp_city city ON city.city_id = addr.city_id
      LEFT JOIN lkp_state st ON st.state_id = addr.state_id
      WHERE e.event_id = $1
    `, [id]);

    if (!event) return res.status(404).json({ error: 'Event not found' });

    const attendees = await query(`
      SELECT
        ea.event_attendee_id,
        ea.contact_id,
        ea.rsvp_status,
        ea.attended,
        ea.amount_contributed,
        ea.ticket_count,
        ea.checked_in_at,
        ea.notes,
        contact.first_name || ' ' || contact.last_name AS name,
        contact.email,
        contact.mobile_phone
      FROM tbl_event_attendee ea
      JOIN tbl_contact contact ON contact.contact_id = ea.contact_id
      WHERE ea.event_id = $1
      ORDER BY ea.attended DESC NULLS LAST, contact.last_name
    `, [id]);

    // Neighbor IDs sorted by event_date DESC (matches list).
    const cur = await queryOne<{ event_date: string }>(
      `SELECT event_date FROM tbl_event WHERE event_id = $1`, [id],
    );
    const prev = cur ? await queryOne<{ id: number }>(`
      SELECT event_id AS id FROM tbl_event
       WHERE event_date > $1 OR (event_date = $1 AND event_id > $2)
       ORDER BY event_date ASC, event_id ASC LIMIT 1
    `, [cur.event_date, id]) : null;
    const next = cur ? await queryOne<{ id: number }>(`
      SELECT event_id AS id FROM tbl_event
       WHERE event_date < $1 OR (event_date = $1 AND event_id < $2)
       ORDER BY event_date DESC, event_id DESC LIMIT 1
    `, [cur.event_date, id]) : null;

    res.json({ event, attendees, prevId: prev?.id ?? null, nextId: next?.id ?? null });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Create                                                            */
/* ----------------------------------------------------------------- */

eventsRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body as EventWritePayload;
    const errs = validateEvent(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    const newId = await withTransaction(async (tx) => {
      const e = await tx.queryOne<Record<string, any>>(`
        INSERT INTO tbl_event
          (event_type_id, event_name, event_date, start_time, end_time,
           address_id, goal_amount, amount_raised, campaign_id,
           ticket_price, is_public, notes, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        body.event_type_id, body.event_name, body.event_date,
        body.start_time ?? null, body.end_time ?? null,
        body.address_id ?? null, body.goal_amount ?? null, body.amount_raised ?? null,
        body.campaign_id ?? null, body.ticket_price ?? null,
        body.is_public ?? false, body.notes ?? null, body.description ?? null,
      ]);
      const eventId = e!.event_id;

      await assertAttendeeContactsHaveEmail(tx, body.attendees);

      for (const a of body.attendees ?? []) {
        await tx.query(`
          INSERT INTO tbl_event_attendee
            (event_id, contact_id, rsvp_status, attended, amount_contributed,
             ticket_count, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [eventId, a.contact_id, a.rsvp_status ?? null, a.attended ?? null,
            a.amount_contributed ?? null, a.ticket_count ?? 1, a.notes ?? null]);
      }
      await auditCreate(req, 'tbl_event', eventId, e!, tx);
      return eventId;
    });
    res.status(201).json({ event_id: newId });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Update                                                            */
/* ----------------------------------------------------------------- */

eventsRouter.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const body = req.body as EventWritePayload;
    const errs = validateEvent(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    await withTransaction(async (tx) => {
      const before = await tx.queryOne<Record<string, any>>(
        `SELECT * FROM tbl_event WHERE event_id = $1`, [id],
      );
      if (!before) throw withStatus(404, 'Event not found');

      const after = await tx.queryOne<Record<string, any>>(`
        UPDATE tbl_event
           SET event_type_id = $1, event_name = $2, event_date = $3,
               start_time = $4, end_time = $5, address_id = $6,
               goal_amount = $7, amount_raised = $8, campaign_id = $9,
               ticket_price = $10, is_public = $11, notes = $12, description = $13
         WHERE event_id = $14
         RETURNING *
      `, [
        body.event_type_id, body.event_name, body.event_date,
        body.start_time ?? null, body.end_time ?? null,
        body.address_id ?? null, body.goal_amount ?? null, body.amount_raised ?? null,
        body.campaign_id ?? null, body.ticket_price ?? null,
        body.is_public ?? false, body.notes ?? null, body.description ?? null, id,
      ]);
      if (after) await auditUpdate(req, 'tbl_event', id, before, after, tx);

      await assertAttendeeContactsHaveEmail(tx, body.attendees);

      // Diff attendees.
      const incomingIds = new Set((body.attendees ?? [])
        .map(a => a.event_attendee_id).filter(Boolean) as number[]);
      const existing = await tx.query<{ event_attendee_id: number }>(
        `SELECT event_attendee_id FROM tbl_event_attendee WHERE event_id = $1`, [id],
      );
      for (const e of existing) {
        if (!incomingIds.has(e.event_attendee_id)) {
          await tx.query(`DELETE FROM tbl_event_attendee WHERE event_attendee_id = $1`, [e.event_attendee_id]);
        }
      }
      for (const a of body.attendees ?? []) {
        if (a.event_attendee_id) {
          await tx.query(`
            UPDATE tbl_event_attendee
               SET contact_id = $1, rsvp_status = $2, attended = $3,
                   amount_contributed = $4, ticket_count = $5, notes = $6
             WHERE event_attendee_id = $7
          `, [a.contact_id, a.rsvp_status ?? null, a.attended ?? null,
              a.amount_contributed ?? null, a.ticket_count ?? 1, a.notes ?? null,
              a.event_attendee_id]);
        } else {
          await tx.query(`
            INSERT INTO tbl_event_attendee
              (event_id, contact_id, rsvp_status, attended, amount_contributed,
               ticket_count, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [id, a.contact_id, a.rsvp_status ?? null, a.attended ?? null,
              a.amount_contributed ?? null, a.ticket_count ?? 1, a.notes ?? null]);
        }
      }
    });
    res.json({ event_id: id });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Delete                                                            */
/* ----------------------------------------------------------------- */

eventsRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    await withTransaction(async (tx) => {
      const before = await tx.queryOne<Record<string, any>>(
        `SELECT * FROM tbl_event WHERE event_id = $1`, [id],
      );
      if (!before) throw withStatus(404, 'Event not found');

      await tx.query(`DELETE FROM tbl_event_attendee WHERE event_id = $1`, [id]);
      await tx.query(`DELETE FROM tbl_event WHERE event_id = $1`, [id]);
      await auditDelete(req, 'tbl_event', id, before, tx);
    });
    res.status(204).end();
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Check-in helper                                                   */
/* ----------------------------------------------------------------- */

eventsRouter.post('/:id/check-in/:attendeeId', async (req, res, next) => {
  try {
    const attendeeId = Number(req.params.attendeeId);
    if (!Number.isInteger(attendeeId) || attendeeId <= 0) return res.status(400).json({ error: 'Invalid attendee id' });

    const before = await queryOne<Record<string, any>>(
      `SELECT * FROM tbl_event_attendee WHERE event_attendee_id = $1`, [attendeeId],
    );
    if (!before) return res.status(404).json({ error: 'Attendee not found' });

    const after = await queryOne<Record<string, any>>(`
      UPDATE tbl_event_attendee
         SET checked_in_at = COALESCE(checked_in_at, NOW()),
             attended = true
       WHERE event_attendee_id = $1
       RETURNING *
    `, [attendeeId]);
    if (after) await auditUpdate(req, 'tbl_event_attendee', attendeeId, before, after);
    res.json({ attendee: after });
  } catch (err) { next(err); }
});

/* ================================================================= */

function validateEvent(b: EventWritePayload): string[] {
  const errs: string[] = [];
  if (!b?.event_name?.trim()) errs.push('event_name required');
  if (!Number.isInteger(b?.event_type_id) || b.event_type_id <= 0) errs.push('event_type_id required');
  if (!b?.event_date) errs.push('event_date required');
  return errs;
}

function withStatus(status: number, message: string): Error {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

/**
 * Reject the request if any attendee's linked contact is missing an
 * email. Required because event-related comms (invites, day-of
 * updates, thank-you / receipt emails) target attendees by email.
 *
 * Mobile phone is intentionally NOT required — some people don't
 * want to share a cell number, and email alone is sufficient for
 * the invite/ack flows we've committed to.
 *
 * Runs INSIDE the transaction so the validation rolls back cleanly
 * if it fails and the partial insert never lands.
 */
async function assertAttendeeContactsHaveEmail(
  tx: { query: <T>(sql: string, params?: any[]) => Promise<T[]> },
  attendees: AttendeePayload[] | undefined,
): Promise<void> {
  const ids = (attendees ?? [])
    .map(a => a.contact_id)
    .filter((n): n is number => Number.isInteger(n) && n > 0);
  if (ids.length === 0) return;
  const missing = await tx.query<{ contact_id: number; name: string }>(`
    SELECT contact_id,
           TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) AS name
    FROM tbl_contact
    WHERE contact_id = ANY($1::int[])
      AND (email IS NULL OR email = '')
  `, [ids]);
  if (missing.length === 0) return;
  const names = missing
    .map(m => m.name?.trim() || `contact #${m.contact_id}`)
    .join(', ');
  throw withStatus(
    400,
    `Each attendee needs an email on their contact record. Missing email on: ${names}. Edit the contact to add an email, then save again.`,
  );
}
