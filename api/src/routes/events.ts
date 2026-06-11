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
  /** Legacy free-text RSVP — kept on writes for back-compat readers
   *  but new code should set rsvp_status_id instead. */
  rsvp_status?: string | null;
  /** FK to lkp_rsvp_status. Preferred over the legacy VARCHAR. */
  rsvp_status_id?: number | null;
  attended?: boolean | null;
  amount_contributed?: number | null;
  ticket_count?: number;
  notes?: string | null;
  /** Seating placement, free-text. */
  table_number?: string | null;
  seat_number?: string | null;
  dietary_notes?: string | null;
}

interface SponsorPayload {
  event_sponsor_id?: number | null;
  corporate_id?: number | null;
  contact_id?: number | null;
  sponsor_level_id: number;
  amount_pledged?: number | null;
  amount_paid?: number | null;
  acknowledged?: boolean;
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
  /** Single staff person responsible for running the event. */
  manager_facility_staff_id?: number | null;
  /** Host = a contact OR a corporate sponsor, never both. */
  host_contact_id?: number | null;
  host_corporate_id?: number | null;
  /** Capacity. NULL = no limit. Server enforces a hard block on
   *  pre-registered attendees adding past this number. Walk-ins
   *  can override with `force=true` on the walk-in endpoint. */
  max_attendees?: number | null;
  /** Free-text schedule + day-of staff briefing card content. */
  run_of_show?: string | null;
  staff_briefing?: string | null;
  attendees?: AttendeePayload[];
  sponsors?: SponsorPayload[];
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
        addr.address, addr.address2, city.city, st.state, addr.postalcode,
        -- Joined labels for the new role fields
        (mc.first_name || ' ' || mc.last_name) AS manager_name,
        (hc.first_name || ' ' || hc.last_name) AS host_contact_name,
        hcorp.corp_name AS host_corporate_name
      FROM tbl_event e
      JOIN lkp_event_type et ON et.event_type_id = e.event_type_id
      LEFT JOIN tbl_campaign c ON c.campaign_id = e.campaign_id
      LEFT JOIN tbl_address addr ON addr.address_id = e.address_id
      LEFT JOIN lkp_city city ON city.city_id = addr.city_id
      LEFT JOIN lkp_state st ON st.state_id = addr.state_id
      LEFT JOIN tbl_facility_staff mfs ON mfs.facility_staff_id = e.manager_facility_staff_id
      LEFT JOIN tbl_contact        mc  ON mc.contact_id        = mfs.contact_id
      LEFT JOIN tbl_contact        hc  ON hc.contact_id        = e.host_contact_id
      LEFT JOIN tbl_corporate      hcorp ON hcorp.corporate_id = e.host_corporate_id
      WHERE e.event_id = $1
    `, [id]);

    if (!event) return res.status(404).json({ error: 'Event not found' });

    const attendees = await query(`
      SELECT
        ea.event_attendee_id,
        ea.contact_id,
        ea.rsvp_status,
        ea.rsvp_status_id,
        rs.rsvp_status AS rsvp_status_label,
        ea.attended,
        ea.amount_contributed,
        ea.ticket_count,
        ea.checked_in_at,
        ea.notes,
        ea.table_number,
        ea.seat_number,
        ea.dietary_notes,
        ea.donation_id,
        d.receipt_number AS donation_receipt_number,
        contact.first_name || ' ' || contact.last_name AS name,
        contact.email,
        contact.mobile_phone
      FROM tbl_event_attendee ea
      JOIN tbl_contact contact ON contact.contact_id = ea.contact_id
      LEFT JOIN lkp_rsvp_status rs ON rs.rsvp_status_id = ea.rsvp_status_id
      LEFT JOIN tbl_donation d ON d.donation_id = ea.donation_id
      WHERE ea.event_id = $1
      ORDER BY ea.attended DESC NULLS LAST, contact.last_name
    `, [id]);

    // Sponsors, ordered by tier (Title first → Bronze last) then by
    // pledge amount within tier so the program sheet reads naturally.
    const sponsors = await query(`
      SELECT
        s.event_sponsor_id,
        s.event_id,
        s.corporate_id,
        s.contact_id,
        s.sponsor_level_id,
        sl.sponsor_level AS sponsor_level_label,
        sl.sort_order    AS sponsor_level_sort,
        s.amount_pledged,
        s.amount_paid,
        s.acknowledged,
        s.notes,
        s.donation_id,
        d.receipt_number AS donation_receipt_number,
        corp.corp_name   AS corporate_name,
        (cc.first_name || ' ' || cc.last_name) AS contact_name
      FROM tbl_event_sponsor s
      JOIN lkp_sponsor_level sl ON sl.sponsor_level_id = s.sponsor_level_id
      LEFT JOIN tbl_corporate corp ON corp.corporate_id = s.corporate_id
      LEFT JOIN tbl_contact   cc   ON cc.contact_id    = s.contact_id
      LEFT JOIN tbl_donation  d    ON d.donation_id    = s.donation_id
      WHERE s.event_id = $1
      ORDER BY sl.sort_order, s.amount_pledged DESC NULLS LAST
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

    res.json({ event, attendees, sponsors, prevId: prev?.id ?? null, nextId: next?.id ?? null });
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
           ticket_price, is_public, notes, description,
           manager_facility_staff_id, host_contact_id, host_corporate_id,
           max_attendees, run_of_show, staff_briefing)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                $14, $15, $16, $17, $18, $19)
        RETURNING *
      `, [
        body.event_type_id, body.event_name, body.event_date,
        body.start_time ?? null, body.end_time ?? null,
        body.address_id ?? null, body.goal_amount ?? null, body.amount_raised ?? null,
        body.campaign_id ?? null, body.ticket_price ?? null,
        body.is_public ?? false, body.notes ?? null, body.description ?? null,
        body.manager_facility_staff_id ?? null,
        body.host_contact_id ?? null, body.host_corporate_id ?? null,
        body.max_attendees ?? null,
        body.run_of_show ?? null, body.staff_briefing ?? null,
      ]);
      const eventId = e!.event_id;

      await assertAttendeeContactsHaveEmail(tx, body.attendees);
      assertWithinCapacity(body.max_attendees ?? null, body.attendees);

      for (const a of body.attendees ?? []) {
        await tx.query(`
          INSERT INTO tbl_event_attendee
            (event_id, contact_id, rsvp_status, rsvp_status_id, attended,
             amount_contributed, ticket_count, notes,
             table_number, seat_number, dietary_notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [eventId, a.contact_id, a.rsvp_status ?? null, a.rsvp_status_id ?? null,
            a.attended ?? null, a.amount_contributed ?? null,
            a.ticket_count ?? 1, a.notes ?? null,
            a.table_number ?? null, a.seat_number ?? null,
            a.dietary_notes ?? null]);
      }

      for (const s of body.sponsors ?? []) {
        validateSponsorRow(s);
        await tx.query(`
          INSERT INTO tbl_event_sponsor
            (event_id, corporate_id, contact_id, sponsor_level_id,
             amount_pledged, amount_paid, acknowledged, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [eventId, s.corporate_id ?? null, s.contact_id ?? null, s.sponsor_level_id,
            s.amount_pledged ?? null, s.amount_paid ?? null,
            s.acknowledged ?? false, s.notes ?? null]);
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
               ticket_price = $10, is_public = $11, notes = $12, description = $13,
               manager_facility_staff_id = $14,
               host_contact_id = $15, host_corporate_id = $16,
               max_attendees = $17,
               run_of_show = $18, staff_briefing = $19
         WHERE event_id = $20
         RETURNING *
      `, [
        body.event_type_id, body.event_name, body.event_date,
        body.start_time ?? null, body.end_time ?? null,
        body.address_id ?? null, body.goal_amount ?? null, body.amount_raised ?? null,
        body.campaign_id ?? null, body.ticket_price ?? null,
        body.is_public ?? false, body.notes ?? null, body.description ?? null,
        body.manager_facility_staff_id ?? null,
        body.host_contact_id ?? null, body.host_corporate_id ?? null,
        body.max_attendees ?? null,
        body.run_of_show ?? null, body.staff_briefing ?? null,
        id,
      ]);
      if (after) await auditUpdate(req, 'tbl_event', id, before, after, tx);

      await assertAttendeeContactsHaveEmail(tx, body.attendees);
      assertWithinCapacity(body.max_attendees ?? null, body.attendees);

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
               SET contact_id = $1, rsvp_status = $2, rsvp_status_id = $3,
                   attended = $4, amount_contributed = $5,
                   ticket_count = $6, notes = $7,
                   table_number = $8, seat_number = $9, dietary_notes = $10
             WHERE event_attendee_id = $11
          `, [a.contact_id, a.rsvp_status ?? null, a.rsvp_status_id ?? null,
              a.attended ?? null, a.amount_contributed ?? null,
              a.ticket_count ?? 1, a.notes ?? null,
              a.table_number ?? null, a.seat_number ?? null, a.dietary_notes ?? null,
              a.event_attendee_id]);
        } else {
          await tx.query(`
            INSERT INTO tbl_event_attendee
              (event_id, contact_id, rsvp_status, rsvp_status_id, attended,
               amount_contributed, ticket_count, notes,
               table_number, seat_number, dietary_notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `, [id, a.contact_id, a.rsvp_status ?? null, a.rsvp_status_id ?? null,
              a.attended ?? null, a.amount_contributed ?? null,
              a.ticket_count ?? 1, a.notes ?? null,
              a.table_number ?? null, a.seat_number ?? null, a.dietary_notes ?? null]);
        }
      }

      // Diff sponsors — same pattern as attendees. Delete rows that
      // were removed, update kept rows, insert new rows.
      const incomingSponsorIds = new Set((body.sponsors ?? [])
        .map(s => s.event_sponsor_id).filter(Boolean) as number[]);
      const existingSponsors = await tx.query<{ event_sponsor_id: number }>(
        `SELECT event_sponsor_id FROM tbl_event_sponsor WHERE event_id = $1`, [id],
      );
      for (const es of existingSponsors) {
        if (!incomingSponsorIds.has(es.event_sponsor_id)) {
          await tx.query(`DELETE FROM tbl_event_sponsor WHERE event_sponsor_id = $1`, [es.event_sponsor_id]);
        }
      }
      for (const s of body.sponsors ?? []) {
        validateSponsorRow(s);
        if (s.event_sponsor_id) {
          await tx.query(`
            UPDATE tbl_event_sponsor
               SET corporate_id = $1, contact_id = $2, sponsor_level_id = $3,
                   amount_pledged = $4, amount_paid = $5,
                   acknowledged = $6, notes = $7, updated_at = NOW()
             WHERE event_sponsor_id = $8
          `, [s.corporate_id ?? null, s.contact_id ?? null, s.sponsor_level_id,
              s.amount_pledged ?? null, s.amount_paid ?? null,
              s.acknowledged ?? false, s.notes ?? null, s.event_sponsor_id]);
        } else {
          await tx.query(`
            INSERT INTO tbl_event_sponsor
              (event_id, corporate_id, contact_id, sponsor_level_id,
               amount_pledged, amount_paid, acknowledged, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [id, s.corporate_id ?? null, s.contact_id ?? null, s.sponsor_level_id,
              s.amount_pledged ?? null, s.amount_paid ?? null,
              s.acknowledged ?? false, s.notes ?? null]);
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

/**
 * Undo a check-in. Mistakes happen — wrong row tapped, wrong person.
 * Clears checked_in_at and sets attended back to NULL ("undetermined"),
 * NOT false. False is a "no-show" assertion; null means "we haven't
 * decided yet." The UI prompts a confirm before calling this.
 */
eventsRouter.delete('/:id/check-in/:attendeeId', async (req, res, next) => {
  try {
    const attendeeId = Number(req.params.attendeeId);
    if (!Number.isInteger(attendeeId) || attendeeId <= 0) return res.status(400).json({ error: 'Invalid attendee id' });

    const before = await queryOne<Record<string, any>>(
      `SELECT * FROM tbl_event_attendee WHERE event_attendee_id = $1`, [attendeeId],
    );
    if (!before) return res.status(404).json({ error: 'Attendee not found' });

    const after = await queryOne<Record<string, any>>(`
      UPDATE tbl_event_attendee
         SET checked_in_at = NULL,
             attended = NULL
       WHERE event_attendee_id = $1
       RETURNING *
    `, [attendeeId]);
    if (after) await auditUpdate(req, 'tbl_event_attendee', attendeeId, before, after);
    res.json({ attendee: after });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Walk-in                                                           */
/*                                                                    */
/*  Day-of attendee creation: the person showed up but wasn't on the */
/*  invite list. Creates a tbl_contact (if needed) + tbl_event_      */
/*  attendee + stamps checked_in_at, all atomically. Email is        */
/*  OPTIONAL here — walk-ins routinely don't volunteer contact info */
/*  at the door, and the staff still needs to capture them.          */
/* ----------------------------------------------------------------- */

interface WalkInPayload {
  first_name: string;
  last_name: string;
  email?: string | null;
  mobile_phone?: string | null;
  contact_type_id: number;
  ticket_count?: number;
  amount_contributed?: number | null;
  notes?: string | null;
  /** Soft override: if the event is at max_attendees capacity, the
   *  walk-in is normally blocked. Set force=true to add anyway.
   *  Mirrors the policy that pre-registration is a HARD block but
   *  door staff can override for last-minute arrivals. */
  force?: boolean;
}

eventsRouter.post('/:id/walk-in', async (req, res, next) => {
  try {
    const eventId = Number(req.params.id);
    if (!Number.isInteger(eventId) || eventId <= 0) return res.status(400).json({ error: 'Invalid event id' });

    const body = req.body as WalkInPayload;
    if (!body?.first_name?.trim()) return res.status(400).json({ error: 'first_name required' });
    if (!body?.last_name?.trim())  return res.status(400).json({ error: 'last_name required' });
    if (!Number.isInteger(body?.contact_type_id) || body.contact_type_id <= 0) {
      return res.status(400).json({ error: 'contact_type_id required' });
    }

    const result = await withTransaction(async (tx) => {
      const eventExists = await tx.queryOne<{ event_id: number; max_attendees: number | null }>(
        `SELECT event_id, max_attendees FROM tbl_event WHERE event_id = $1`, [eventId],
      );
      if (!eventExists) throw withStatus(404, 'Event not found');

      // Capacity check. Pre-registration is a hard block (handled in
      // create/update path via assertWithinCapacity). Walk-ins get a
      // soft warning that the caller can override with force=true.
      if (eventExists.max_attendees != null && !body.force) {
        const cur = await tx.queryOne<{ n: number }>(
          `SELECT COUNT(*)::int AS n FROM tbl_event_attendee WHERE event_id = $1`, [eventId],
        );
        if ((cur?.n ?? 0) >= eventExists.max_attendees) {
          throw withStatus(409, `This event is at capacity (${cur?.n}/${eventExists.max_attendees}). Set force=true to override and add this walk-in anyway.`);
        }
      }

      const contact = await tx.queryOne<{ contact_id: number }>(`
        INSERT INTO tbl_contact
          (contact_type_id, first_name, last_name, email, mobile_phone)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING contact_id
      `, [
        body.contact_type_id,
        body.first_name.trim(),
        body.last_name.trim(),
        body.email?.trim() || null,
        body.mobile_phone?.trim() || null,
      ]);
      const contactId = contact!.contact_id;

      // Find the "Accepted" RSVP status — by definition a walk-in
      // accepted. Falls back to NULL if the lookup row doesn't exist
      // (shouldn't happen post-migration, but defensive).
      const accepted = await tx.queryOne<{ rsvp_status_id: number }>(
        `SELECT rsvp_status_id FROM lkp_rsvp_status WHERE rsvp_status = 'Accepted' LIMIT 1`,
      );

      const att = await tx.queryOne<Record<string, any>>(`
        INSERT INTO tbl_event_attendee
          (event_id, contact_id, rsvp_status_id, attended, amount_contributed,
           ticket_count, notes, checked_in_at)
        VALUES ($1, $2, $3, true, $4, $5, $6, NOW())
        RETURNING *
      `, [
        eventId, contactId, accepted?.rsvp_status_id ?? null,
        body.amount_contributed ?? null,
        body.ticket_count ?? 1,
        body.notes?.trim() || null,
      ]);
      await auditCreate(req, 'tbl_event_attendee', att!.event_attendee_id, att!, tx);
      return att;
    });
    res.status(201).json({ attendee: result });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Promote attendee contribution to a real donation                  */
/*                                                                    */
/*  Click "Convert to donation" on an attendee row → atomic create   */
/*  of a donor (if missing) + a tbl_donation row + link back to the  */
/*  attendee via tbl_event_attendee.donation_id. The donation can be */
/*  edited afterward at /donations/<id>.                              */
/* ----------------------------------------------------------------- */

eventsRouter.post('/:id/attendees/:attendeeId/promote-to-donation', async (req, res, next) => {
  try {
    const eventId = Number(req.params.id);
    const attendeeId = Number(req.params.attendeeId);
    if (!Number.isInteger(eventId) || eventId <= 0) return res.status(400).json({ error: 'Invalid event id' });
    if (!Number.isInteger(attendeeId) || attendeeId <= 0) return res.status(400).json({ error: 'Invalid attendee id' });

    const donationId = await withTransaction(async (tx) => {
      const attendee = await tx.queryOne<{
        event_attendee_id: number;
        event_id: number;
        contact_id: number;
        amount_contributed: number | string | null;
        donation_id: number | null;
      }>(`
        SELECT event_attendee_id, event_id, contact_id, amount_contributed, donation_id
          FROM tbl_event_attendee
         WHERE event_attendee_id = $1 AND event_id = $2
      `, [attendeeId, eventId]);
      if (!attendee) throw withStatus(404, 'Attendee not found on this event');
      if (attendee.donation_id) throw withStatus(409, 'This contribution is already linked to a donation');
      const amount = Number(attendee.amount_contributed ?? 0);
      if (!(amount > 0)) throw withStatus(400, 'No contribution amount on this attendee to convert');

      // Pull the event's campaign + date so the donation inherits them.
      const ev = await tx.queryOne<{ event_name: string; event_date: string; campaign_id: number | null }>(
        `SELECT event_name, event_date, campaign_id FROM tbl_event WHERE event_id = $1`, [eventId],
      );
      if (!ev) throw withStatus(404, 'Event not found');

      // Resolve donor — find existing or create one tied to this contact.
      let donor = await tx.queryOne<{ donor_id: number }>(
        `SELECT donor_id FROM tbl_donor WHERE contact_id = $1 LIMIT 1`, [attendee.contact_id],
      );
      if (!donor) {
        // Default donor_type — the Individual / Person row, or first
        // active row if "Individual" isn't seeded.
        const defaultDonorType = await tx.queryOne<{ donor_type_id: number }>(`
          SELECT donor_type_id FROM lkp_donor_type
           ORDER BY (LOWER(donor_type) = 'individual') DESC, donor_type_id ASC
           LIMIT 1
        `);
        donor = await tx.queryOne<{ donor_id: number }>(`
          INSERT INTO tbl_donor (contact_id, donor_type_id)
          VALUES ($1, $2)
          RETURNING donor_id
        `, [attendee.contact_id, defaultDonorType?.donor_type_id ?? null]);
      }

      // Sensible defaults for donation_type / payment_method — pick
      // the "Cash" row if seeded, else the first active row.
      const donationType = await tx.queryOne<{ donation_type_id: number }>(`
        SELECT donation_type_id FROM lkp_donation_type
         ORDER BY (LOWER(donation_type) = 'cash') DESC, donation_type_id ASC
         LIMIT 1
      `);
      const paymentMethod = await tx.queryOne<{ payment_method_id: number }>(`
        SELECT payment_method_id FROM lkp_payment_method
         ORDER BY (LOWER(payment_method) = 'cash') DESC, payment_method_id ASC
         LIMIT 1
      `).catch(() => null); // lkp_payment_method is optional

      const description = `Contribution at "${ev.event_name}" on ${
        new Date(ev.event_date).toISOString().slice(0, 10)
      }`;

      const donation = await tx.queryOne<{ donation_id: number }>(`
        INSERT INTO tbl_donation
          (donor_id, donation_type_id, donation_date, total_value,
           payment_method_id, tax_deductible_amount, campaign_id, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING donation_id
      `, [
        donor!.donor_id,
        donationType?.donation_type_id ?? null,
        ev.event_date,
        amount,
        paymentMethod?.payment_method_id ?? null,
        amount,
        ev.campaign_id,
        description,
      ]);
      const newDonationId = donation!.donation_id;

      await tx.query(
        `UPDATE tbl_event_attendee SET donation_id = $1 WHERE event_attendee_id = $2`,
        [newDonationId, attendeeId],
      );
      await auditCreate(req, 'tbl_donation', newDonationId, { ...donation, source: 'event_attendee_promote' }, tx);
      return newDonationId;
    });

    res.status(201).json({ donation_id: donationId });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Volunteer roster                                                  */
/*                                                                    */
/*  Powers the day-of "who's working" printable. Matches volunteer   */
/*  shifts by the event's own date — shifts aren't directly FK-      */
/*  linked to events today (shifts predate event-roles), so we use   */
/*  same-day match. If the event ever needs multi-day shifts, this   */
/*  becomes a date range or an explicit event_id on shifts.          */
/* ----------------------------------------------------------------- */

eventsRouter.get('/:id/volunteer-roster', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const event = await queryOne<{ event_id: number; event_name: string; event_date: string }>(
      `SELECT event_id, event_name, event_date FROM tbl_event WHERE event_id = $1`, [id],
    );
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const shifts = await query<{
      shift_id: number;
      shift_name: string | null;
      shift_date: string;
      start_time: string | null;
      end_time: string | null;
      capacity_needed: number;
      notes: string | null;
      shift_type: string | null;
      shift_status: string | null;
    }>(`
      SELECT
        s.shift_id, s.shift_name, s.shift_date,
        s.start_time, s.end_time, s.capacity_needed, s.notes,
        t.shift_type, ss.shift_status
      FROM tbl_volunteer_shift s
      LEFT JOIN lkp_shift_type   t  ON t.shift_type_id   = s.shift_type_id
      LEFT JOIN lkp_shift_status ss ON ss.shift_status_id = s.shift_status_id
      WHERE s.shift_date = $1::date
      ORDER BY s.start_time NULLS LAST, s.shift_name
    `, [event.event_date]);

    // Pull signups for all matching shifts in one query, then bucket
    // by shift_id client-side. Cancelled signups are excluded from
    // the roster (they're not coming).
    const signups = shifts.length > 0 ? await query<{
      shift_id: number;
      signup_id: number;
      facility_staff_id: number;
      name: string;
      email: string | null;
      mobile_phone: string | null;
      signup_status: string | null;
      hours_logged: number | string | null;
      notes: string | null;
    }>(`
      SELECT
        sg.shift_id, sg.signup_id, sg.facility_staff_id,
        (c.first_name || ' ' || c.last_name) AS name,
        c.email, c.mobile_phone,
        sg.signup_status, sg.hours_logged, sg.notes
      FROM tbl_volunteer_shift_signup sg
      JOIN tbl_facility_staff fs ON fs.facility_staff_id = sg.facility_staff_id
      JOIN tbl_contact        c  ON c.contact_id         = fs.contact_id
      WHERE sg.shift_id = ANY($1::int[])
        AND sg.signup_status <> 'cancelled'
      ORDER BY c.last_name, c.first_name
    `, [shifts.map(s => s.shift_id)]) : [];

    const roster = shifts.map(s => ({
      ...s,
      signups: signups.filter(sg => sg.shift_id === s.shift_id),
    }));

    res.json({ event, shifts: roster });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Promote a sponsor commitment to a real donation                   */
/*                                                                    */
/*  Same pattern as attendee promote, but the sponsor side has both  */
/*  a corporate path and a contact path. For a corporate sponsor we  */
/*  look up / create the donor record linked to the contact          */
/*  associated with the corporate org's primary facility (if any),   */
/*  OR fall back to the corporate's name in the donation description.*/
/*  For a contact sponsor we find/create the donor for that contact. */
/* ----------------------------------------------------------------- */

eventsRouter.post('/:id/sponsors/:sponsorId/promote-to-donation', async (req, res, next) => {
  try {
    const eventId   = Number(req.params.id);
    const sponsorId = Number(req.params.sponsorId);
    if (!Number.isInteger(eventId)   || eventId   <= 0) return res.status(400).json({ error: 'Invalid event id' });
    if (!Number.isInteger(sponsorId) || sponsorId <= 0) return res.status(400).json({ error: 'Invalid sponsor id' });

    const donationId = await withTransaction(async (tx) => {
      const s = await tx.queryOne<{
        event_sponsor_id: number;
        corporate_id: number | null;
        contact_id: number | null;
        amount_pledged: number | string | null;
        amount_paid: number | string | null;
        donation_id: number | null;
      }>(`
        SELECT event_sponsor_id, corporate_id, contact_id,
               amount_pledged, amount_paid, donation_id
          FROM tbl_event_sponsor
         WHERE event_sponsor_id = $1 AND event_id = $2
      `, [sponsorId, eventId]);
      if (!s) throw withStatus(404, 'Sponsor not found on this event');
      if (s.donation_id) throw withStatus(409, 'This sponsorship is already linked to a donation');
      // Prefer the actual money received; fall back to pledged.
      const amount = Number(s.amount_paid ?? s.amount_pledged ?? 0);
      if (!(amount > 0)) throw withStatus(400, 'Sponsor has no pledged or paid amount to convert');

      const ev = await tx.queryOne<{ event_name: string; event_date: string; campaign_id: number | null }>(
        `SELECT event_name, event_date, campaign_id FROM tbl_event WHERE event_id = $1`, [eventId],
      );
      if (!ev) throw withStatus(404, 'Event not found');

      // Resolve donor. Two cases.
      let donorId: number;
      let sponsorLabel = '';
      if (s.contact_id) {
        const found = await tx.queryOne<{ donor_id: number }>(
          `SELECT donor_id FROM tbl_donor WHERE contact_id = $1 LIMIT 1`, [s.contact_id],
        );
        if (found) {
          donorId = found.donor_id;
        } else {
          const defaultDonorType = await tx.queryOne<{ donor_type_id: number }>(`
            SELECT donor_type_id FROM lkp_donor_type
             ORDER BY (LOWER(donor_type) = 'individual') DESC, donor_type_id ASC LIMIT 1
          `);
          const created = await tx.queryOne<{ donor_id: number }>(`
            INSERT INTO tbl_donor (contact_id, donor_type_id) VALUES ($1, $2) RETURNING donor_id
          `, [s.contact_id, defaultDonorType?.donor_type_id ?? null]);
          donorId = created!.donor_id;
        }
        const ct = await tx.queryOne<{ name: string }>(
          `SELECT (first_name || ' ' || last_name) AS name FROM tbl_contact WHERE contact_id = $1`,
          [s.contact_id],
        );
        sponsorLabel = ct?.name ?? `contact #${s.contact_id}`;
      } else if (s.corporate_id) {
        // Corporate sponsor — create or find a donor linked to a
        // placeholder contact carrying the corporate name. We
        // don't have a tbl_donor.corporate_id column today, so the
        // contact is the bridge.
        const corp = await tx.queryOne<{ corp_name: string }>(
          `SELECT corp_name FROM tbl_corporate WHERE corporate_id = $1`, [s.corporate_id],
        );
        if (!corp) throw withStatus(404, 'Corporate sponsor not found');
        sponsorLabel = corp.corp_name;
        // Best-effort: see if any existing donor's contact matches
        // the corp name. (Bookkeeping nicety; not strict.)
        const existing = await tx.queryOne<{ donor_id: number }>(`
          SELECT d.donor_id
            FROM tbl_donor d
            JOIN tbl_contact c ON c.contact_id = d.contact_id
           WHERE TRIM(LOWER(c.last_name)) = TRIM(LOWER($1))
              OR TRIM(LOWER(c.first_name || ' ' || c.last_name)) = TRIM(LOWER($1))
           LIMIT 1
        `, [corp.corp_name]);
        if (existing) {
          donorId = existing.donor_id;
        } else {
          const defaultContactType = await tx.queryOne<{ contact_type_id: number }>(`
            SELECT contact_type_id FROM lkp_contact_type
             ORDER BY (LOWER(contact_type) IN ('business','corporate','organization')) DESC,
                      contact_type_id ASC LIMIT 1
          `);
          const newContact = await tx.queryOne<{ contact_id: number }>(`
            INSERT INTO tbl_contact (contact_type_id, first_name, last_name)
            VALUES ($1, '', $2) RETURNING contact_id
          `, [defaultContactType?.contact_type_id ?? null, corp.corp_name]);
          const defaultDonorType = await tx.queryOne<{ donor_type_id: number }>(`
            SELECT donor_type_id FROM lkp_donor_type
             ORDER BY (LOWER(donor_type) IN ('corporate','business','organization')) DESC,
                      donor_type_id ASC LIMIT 1
          `);
          const created = await tx.queryOne<{ donor_id: number }>(`
            INSERT INTO tbl_donor (contact_id, donor_type_id) VALUES ($1, $2) RETURNING donor_id
          `, [newContact!.contact_id, defaultDonorType?.donor_type_id ?? null]);
          donorId = created!.donor_id;
        }
      } else {
        throw withStatus(400, 'Sponsor row has neither corporate nor contact set');
      }

      const donationType = await tx.queryOne<{ donation_type_id: number }>(`
        SELECT donation_type_id FROM lkp_donation_type
         ORDER BY (LOWER(donation_type) = 'cash') DESC, donation_type_id ASC LIMIT 1
      `);
      const paymentMethod = await tx.queryOne<{ payment_method_id: number }>(`
        SELECT payment_method_id FROM lkp_payment_method
         ORDER BY (LOWER(payment_method) = 'check') DESC, payment_method_id ASC LIMIT 1
      `).catch(() => null);

      const description = `Sponsorship from ${sponsorLabel} for "${ev.event_name}" on ${
        new Date(ev.event_date).toISOString().slice(0, 10)
      }`;

      const donation = await tx.queryOne<{ donation_id: number }>(`
        INSERT INTO tbl_donation
          (donor_id, donation_type_id, donation_date, total_value,
           payment_method_id, tax_deductible_amount, campaign_id, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING donation_id
      `, [
        donorId,
        donationType?.donation_type_id ?? null,
        ev.event_date,
        amount,
        paymentMethod?.payment_method_id ?? null,
        amount,
        ev.campaign_id,
        description,
      ]);
      const newDonationId = donation!.donation_id;

      await tx.query(
        `UPDATE tbl_event_sponsor SET donation_id = $1, updated_at = NOW() WHERE event_sponsor_id = $2`,
        [newDonationId, sponsorId],
      );
      await auditCreate(req, 'tbl_donation', newDonationId, { ...donation, source: 'event_sponsor_promote' }, tx);
      return newDonationId;
    });

    res.status(201).json({ donation_id: donationId });
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

/**
 * Hard block: pre-registered attendees can't exceed the event's
 * max_attendees cap. Walk-ins have a separate soft-override path
 * (force=true on POST /walk-in).
 *
 * Counts only non-null attendee rows from the incoming list — we
 * trust the in-memory list because attendees are diffed atomically
 * inside the same transaction.
 */
function assertWithinCapacity(
  maxAttendees: number | null,
  attendees: AttendeePayload[] | undefined,
): void {
  if (maxAttendees == null) return; // unlimited
  const incoming = (attendees ?? []).length;
  if (incoming > maxAttendees) {
    throw withStatus(
      409,
      `This event is capped at ${maxAttendees} attendees but the list has ${incoming}. Increase the Max Attendees field on the event or remove attendees.`,
    );
  }
}

/**
 * Validates one sponsor row before insert/update. The schema CHECK
 * enforces the XOR at the DB level — this returns a friendlier
 * error before the SQL fails.
 */
function validateSponsorRow(s: SponsorPayload): void {
  if (!Number.isInteger(s.sponsor_level_id) || s.sponsor_level_id <= 0) {
    throw withStatus(400, 'Each sponsor needs a sponsor_level_id');
  }
  const hasCorp = s.corporate_id != null;
  const hasContact = s.contact_id != null;
  if (hasCorp === hasContact) {
    throw withStatus(400, 'Each sponsor must be EITHER a corporate org OR an individual contact, not both and not neither');
  }
}
