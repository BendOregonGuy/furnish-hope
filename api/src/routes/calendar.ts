/**
 * Unified calendar feed. Combines pickups, deliveries, fundraising
 * events, and campaigns into a single date-ranged result set the
 * FullCalendar frontend can consume directly.
 *
 *   GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Shape:
 *   { items: Array<{ id, type, title, start, end, allDay, url, color, meta }> }
 *
 * - `start` / `end` are ISO 8601 strings WITHOUT a timezone suffix so
 *   FullCalendar treats them as local time (which is what users expect
 *   for a regional ops calendar). Pickups/deliveries/events whose row
 *   has no specific time default to a sensible morning slot so the item
 *   is still visible on a timed view.
 * - Campaigns are emitted as all-day multi-day blocks (start_date →
 *   end_date + 1, because FullCalendar treats end as exclusive).
 */

import { Router } from 'express';
import { query } from '../db/pool.js';

export const calendarRouter = Router();

/** Default time defaults applied when only a date is recorded.
 *  Picked so timed views show events somewhere reasonable rather than
 *  bunched at midnight. */
const DEFAULT_PICKUP_START   = '09:00:00';
const DEFAULT_PICKUP_END     = '11:00:00';
const DEFAULT_DELIVERY_START = '10:00:00';
const DEFAULT_DELIVERY_END   = '12:00:00';
const DEFAULT_EVENT_START    = '18:00:00';
const DEFAULT_EVENT_END      = '20:00:00';
const DEFAULT_SHIFT_START    = '08:00:00';
const DEFAULT_SHIFT_END      = '12:00:00';

interface CalendarItem {
  id: string;
  type: 'pickup' | 'delivery' | 'event' | 'campaign' | 'shift';
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  url: string;
  color: string;
  meta: Record<string, any>;
}

calendarRouter.get('/', async (req, res, next) => {
  try {
    const fromRaw = String(req.query.from ?? '').trim();
    const toRaw   = String(req.query.to ?? '').trim();
    // Light validation — must be YYYY-MM-DD. If absent or malformed, default
    // to a wide window centered on today so an unparameterized hit still
    // returns something useful.
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const from = datePattern.test(fromRaw) ? fromRaw : defaultFrom();
    const to   = datePattern.test(toRaw)   ? toRaw   : defaultTo();

    /* ---------- pickups ---------- */
    const pickups = await query<{
      id: number; title: string; date: string;
      start_time: string | null; end_time: string | null;
      status: string;
      address: string | null; city: string | null;
    }>(`
      SELECT
        p.donation_pickup_id AS id,
        contact.first_name || ' ' || contact.last_name AS title,
        p.scheduled_date::text AS date,
        p.time_window_start::text AS start_time,
        p.time_window_end::text   AS end_time,
        ps.pickup_status AS status,
        addr.address,
        city.city
      FROM tbl_donation_pickup p
      JOIN tbl_donor donor ON donor.donor_id = p.donor_id
      JOIN tbl_contact contact ON contact.contact_id = donor.contact_id
      JOIN lkp_pickup_status ps ON ps.pickup_status_id = p.pickup_status_id
      LEFT JOIN tbl_address addr ON addr.address_id = p.pickup_address_id
      LEFT JOIN lkp_city city ON city.city_id = addr.city_id
      WHERE p.scheduled_date BETWEEN $1::date AND $2::date
      ORDER BY p.scheduled_date, p.time_window_start
    `, [from, to]);

    /* ---------- deliveries ---------- */
    const deliveries = await query<{
      id: number; title: string; date: string;
      start_time: string | null; end_time: string | null;
      status: string;
      address: string | null; city: string | null;
    }>(`
      SELECT
        d.client_deliveries_id AS id,
        contact.first_name || ' ' || contact.last_name AS title,
        d.delivery_date::text AS date,
        d.time_arrival_earliest::text AS start_time,
        d.time_arrival_latest::text   AS end_time,
        s.delivery_status AS status,
        addr.address,
        city.city
      FROM tbl_client_deliveries d
      JOIN lkp_delivery_status s ON s.delivery_status_id = d.delivery_status_id
      JOIN tbl_client_provisioning_request r ON r.client_provisioning_request_id = d.client_provisioning_request_id
      JOIN tbl_client c ON c.client_id = r.client_id
      JOIN tbl_contact contact ON contact.contact_id = c.contact_id
      LEFT JOIN tbl_address addr ON addr.address_id = contact.address_id
      LEFT JOIN lkp_city city ON city.city_id = addr.city_id
      WHERE d.delivery_date BETWEEN $1::date AND $2::date
      ORDER BY d.delivery_date, d.time_arrival_earliest
    `, [from, to]);

    /* ---------- fundraising events ---------- */
    const events = await query<{
      id: number; title: string; date: string;
      start_time: string | null; end_time: string | null;
      event_type: string;
    }>(`
      SELECT
        e.event_id AS id,
        e.event_name AS title,
        e.event_date::text AS date,
        e.start_time::text AS start_time,
        e.end_time::text   AS end_time,
        et.event_type
      FROM tbl_event e
      JOIN lkp_event_type et ON et.event_type_id = e.event_type_id
      WHERE e.event_date BETWEEN $1::date AND $2::date
      ORDER BY e.event_date, e.start_time
    `, [from, to]);

    /* ---------- volunteer shifts ---------- */
    const shifts = await query<{
      id: number; title: string; date: string;
      start_time: string | null; end_time: string | null;
      status: string;
      capacity_needed: number; filled_count: number;
    }>(`
      SELECT
        s.shift_id AS id,
        COALESCE(s.shift_name, st.shift_type) AS title,
        s.shift_date::text AS date,
        s.start_time::text AS start_time,
        s.end_time::text   AS end_time,
        ss.shift_status AS status,
        s.capacity_needed,
        (SELECT COUNT(*)::int FROM tbl_volunteer_shift_signup
          WHERE shift_id = s.shift_id
            AND signup_status IN ('signed_up','attended')) AS filled_count
      FROM tbl_volunteer_shift s
      JOIN lkp_shift_type st   ON st.shift_type_id   = s.shift_type_id
      JOIN lkp_shift_status ss ON ss.shift_status_id = s.shift_status_id
      WHERE s.shift_date BETWEEN $1::date AND $2::date
      ORDER BY s.shift_date, s.start_time
    `, [from, to]);

    /* ---------- campaigns (multi-day banners) ---------- */
    // Campaigns can span months; surface any campaign whose range
    // intersects the requested window.
    const campaigns = await query<{
      id: number; title: string;
      start_date: string; end_date: string | null;
      status: string;
    }>(`
      SELECT
        c.campaign_id AS id,
        c.campaign_name AS title,
        c.start_date::text AS start_date,
        c.end_date::text   AS end_date,
        cs.campaign_status AS status
      FROM tbl_campaign c
      JOIN lkp_campaign_status cs ON cs.campaign_status_id = c.campaign_status_id
      WHERE c.start_date IS NOT NULL
        AND COALESCE(c.end_date, c.start_date) >= $1::date
        AND c.start_date <= $2::date
      ORDER BY c.start_date
    `, [from, to]);

    /* ---------- merge ---------- */
    const items: CalendarItem[] = [];

    for (const p of pickups) {
      items.push({
        id: `pickup:${p.id}`,
        type: 'pickup',
        title: `Pickup · ${p.title}`,
        start: combine(p.date, p.start_time, DEFAULT_PICKUP_START),
        end:   combine(p.date, p.end_time,   DEFAULT_PICKUP_END),
        allDay: false,
        url: `/pickups/${p.id}`,
        color: '#C7704A', // terracotta
        meta: { status: p.status, address: p.address, city: p.city },
      });
    }

    for (const d of deliveries) {
      items.push({
        id: `delivery:${d.id}`,
        type: 'delivery',
        title: `Delivery · ${d.title}`,
        start: combine(d.date, d.start_time, DEFAULT_DELIVERY_START),
        end:   combine(d.date, d.end_time,   DEFAULT_DELIVERY_END),
        allDay: false,
        url: `/deliveries/${d.id}`,
        color: '#7C8B5E', // sage
        meta: { status: d.status, address: d.address, city: d.city },
      });
    }

    for (const e of events) {
      items.push({
        id: `event:${e.id}`,
        type: 'event',
        title: e.title,
        start: combine(e.date, e.start_time, DEFAULT_EVENT_START),
        end:   combine(e.date, e.end_time,   DEFAULT_EVENT_END),
        allDay: false,
        url: `/events/${e.id}`,
        color: '#C9A24E', // gold
        meta: { event_type: e.event_type },
      });
    }

    for (const s of shifts) {
      items.push({
        id: `shift:${s.id}`,
        type: 'shift',
        title: `${s.title} (${s.filled_count}/${s.capacity_needed})`,
        start: combine(s.date, s.start_time, DEFAULT_SHIFT_START),
        end:   combine(s.date, s.end_time,   DEFAULT_SHIFT_END),
        allDay: false,
        url: `/shifts/${s.id}`,
        color: '#8E6C95', // soft purple — visually distinct from terracotta/sage/gold/slate
        meta: { status: s.status, capacity_needed: s.capacity_needed, filled_count: s.filled_count },
      });
    }

    for (const c of campaigns) {
      // FullCalendar treats end-of-allDay as EXCLUSIVE — bump by one day so
      // a "June 1 → June 30" campaign actually paints through June 30.
      const exclusiveEnd = c.end_date ? bumpDay(c.end_date) : bumpDay(c.start_date);
      items.push({
        id: `campaign:${c.id}`,
        type: 'campaign',
        title: c.title,
        start: c.start_date,
        end: exclusiveEnd,
        allDay: true,
        url: `/campaigns/${c.id}`,
        color: '#5B6478', // slate
        meta: { status: c.status },
      });
    }

    res.json({ items });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  helpers                                                           */
/* ----------------------------------------------------------------- */

/** Combine a YYYY-MM-DD date and an HH:MM:SS time (nullable) into an
 *  ISO local datetime. Falls back to the provided default time when
 *  the row's time is null. */
function combine(date: string, time: string | null, defaultTime: string): string {
  const t = time ?? defaultTime;
  return `${date}T${t}`;
}

/** Add one day to a YYYY-MM-DD string (string-safe, no timezone math). */
function bumpDay(date: string): string {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function defaultFrom(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 10);
}

function defaultTo(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 3);
  return d.toISOString().slice(0, 10);
}
