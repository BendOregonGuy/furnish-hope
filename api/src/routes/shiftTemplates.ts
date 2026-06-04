/**
 * Shift templates + holidays + the Generate-shifts endpoint.
 *
 *   GET    /api/shift-templates
 *   POST   /api/shift-templates
 *   GET    /api/shift-templates/:id
 *   PUT    /api/shift-templates/:id
 *   DELETE /api/shift-templates/:id
 *
 *   POST   /api/shift-templates/generate   { from_date, to_date, template_ids? }
 *
 *   GET    /api/holidays
 *   POST   /api/holidays
 *   PUT    /api/holidays/:id
 *   DELETE /api/holidays/:id
 *
 * The Generate endpoint walks every (active template × matching date)
 * in the requested range and inserts a tbl_volunteer_shift row for
 * each, skipping holidays for templates that opt in. Idempotent via
 * the UNIQUE index on (shift_template_id, shift_date).
 */

import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditCreate, auditUpdate, auditDelete } from '../auth/audit.js';

export const shiftTemplatesRouter = Router();
export const holidaysRouter = Router();

/* ----------------------------------------------------------------- */
/*  Shift templates                                                   */
/* ----------------------------------------------------------------- */

interface TemplatePayload {
  template_name: string;
  shift_type_id: number;
  corp_facility_id?: number | null;
  shift_name?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  capacity_needed: number;
  notes?: string | null;
  day_of_week_mask: number;    // bit 0 = Sun, 1 = Mon, …, 6 = Sat
  skip_holidays?: boolean;
  is_active?: boolean;
}

function validateTemplate(b: TemplatePayload): string[] {
  const errs: string[] = [];
  if (!b.template_name?.trim()) errs.push('Template name is required');
  if (!b.shift_type_id) errs.push('Shift type is required');
  if (!Number.isInteger(b.capacity_needed) || b.capacity_needed < 1) errs.push('Capacity must be at least 1');
  if (!Number.isInteger(b.day_of_week_mask) || b.day_of_week_mask < 0 || b.day_of_week_mask > 127) {
    errs.push('Day-of-week mask must be 0–127');
  }
  if (b.day_of_week_mask === 0) errs.push('Pick at least one day of the week');
  return errs;
}

shiftTemplatesRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await query(`
      SELECT
        t.shift_template_id, t.template_name, t.shift_name,
        t.shift_type_id, st.shift_type,
        t.corp_facility_id, cf.facility_name,
        t.start_time, t.end_time,
        t.capacity_needed, t.notes,
        t.day_of_week_mask, t.skip_holidays, t.is_active,
        t.created_at
      FROM tbl_shift_template t
      JOIN lkp_shift_type st ON st.shift_type_id = t.shift_type_id
      LEFT JOIN tbl_corp_facility cf ON cf.corp_facility_id = t.corp_facility_id
      ORDER BY t.is_active DESC, t.template_name
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

shiftTemplatesRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const row = await queryOne(`SELECT * FROM tbl_shift_template WHERE shift_template_id = $1`, [id]);
    if (!row) return res.status(404).json({ error: 'Template not found' });
    res.json(row);
  } catch (err) { next(err); }
});

shiftTemplatesRouter.post('/', async (req, res, next) => {
  try {
    const b = req.body as TemplatePayload;
    const errs = validateTemplate(b);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    const row = await queryOne<Record<string, any>>(`
      INSERT INTO tbl_shift_template
        (template_name, shift_type_id, corp_facility_id, shift_name,
         start_time, end_time, capacity_needed, notes,
         day_of_week_mask, skip_holidays, is_active,
         created_by_user_account_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      b.template_name.trim(), b.shift_type_id, b.corp_facility_id ?? null,
      b.shift_name?.trim() || null,
      b.start_time || null, b.end_time || null,
      b.capacity_needed, b.notes?.trim() || null,
      b.day_of_week_mask, b.skip_holidays ?? true, b.is_active ?? true,
      req.user!.user_account_id,
    ]);
    await auditCreate(req, 'tbl_shift_template', row!.shift_template_id, row!);
    res.status(201).json({ shift_template_id: row!.shift_template_id });
  } catch (err) { next(err); }
});

shiftTemplatesRouter.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const b = req.body as TemplatePayload;
    const errs = validateTemplate(b);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    const before = await queryOne(`SELECT * FROM tbl_shift_template WHERE shift_template_id = $1`, [id]);
    if (!before) return res.status(404).json({ error: 'Template not found' });

    const after = await queryOne(`
      UPDATE tbl_shift_template SET
        template_name = $1, shift_type_id = $2, corp_facility_id = $3,
        shift_name = $4, start_time = $5, end_time = $6,
        capacity_needed = $7, notes = $8,
        day_of_week_mask = $9, skip_holidays = $10, is_active = $11
      WHERE shift_template_id = $12
      RETURNING *
    `, [
      b.template_name.trim(), b.shift_type_id, b.corp_facility_id ?? null,
      b.shift_name?.trim() || null,
      b.start_time || null, b.end_time || null,
      b.capacity_needed, b.notes?.trim() || null,
      b.day_of_week_mask, b.skip_holidays ?? true, b.is_active ?? true,
      id,
    ]);
    if (after) await auditUpdate(req, 'tbl_shift_template', id, before, after);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

shiftTemplatesRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const before = await queryOne(`SELECT * FROM tbl_shift_template WHERE shift_template_id = $1`, [id]);
    if (!before) return res.status(404).json({ error: 'Template not found' });
    await query(`DELETE FROM tbl_shift_template WHERE shift_template_id = $1`, [id]);
    await auditDelete(req, 'tbl_shift_template', id, before);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Generate                                                          */
/* ----------------------------------------------------------------- */

interface GeneratePayload {
  from_date: string;             // YYYY-MM-DD inclusive
  to_date:   string;             // YYYY-MM-DD inclusive
  template_ids?: number[];       // omit to use all active templates
  default_status_id?: number;    // shift_status when generated; defaults to 'Open'
}

shiftTemplatesRouter.post('/generate', async (req, res, next) => {
  try {
    const b = req.body as GeneratePayload;
    if (!b.from_date || !b.to_date) return res.status(400).json({ error: 'from_date and to_date are required' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.from_date) || !/^\d{4}-\d{2}-\d{2}$/.test(b.to_date)) {
      return res.status(400).json({ error: 'Dates must be YYYY-MM-DD' });
    }
    if (b.from_date > b.to_date) return res.status(400).json({ error: 'from_date must be ≤ to_date' });

    // Load templates and holiday set.
    const templates = await query<{
      shift_template_id: number; template_name: string;
      shift_type_id: number; corp_facility_id: number | null; shift_name: string | null;
      start_time: string | null; end_time: string | null;
      capacity_needed: number; notes: string | null;
      day_of_week_mask: number; skip_holidays: boolean;
    }>(b.template_ids?.length
      ? `SELECT * FROM tbl_shift_template WHERE is_active = true AND shift_template_id = ANY($1)`
      : `SELECT * FROM tbl_shift_template WHERE is_active = true`,
      b.template_ids?.length ? [b.template_ids] : [],
    );

    if (templates.length === 0) {
      return res.status(400).json({ error: 'No active templates to generate from. Create a template first.' });
    }

    const holidayRows = await query<{ holiday_date: string }>(
      `SELECT to_char(holiday_date, 'YYYY-MM-DD') AS holiday_date
         FROM tbl_holiday WHERE is_active = true
          AND holiday_date BETWEEN $1::date AND $2::date`,
      [b.from_date, b.to_date],
    );
    const holidaySet = new Set(holidayRows.map(h => h.holiday_date));

    // Status id — default to "Open" if not provided.
    const statusId = b.default_status_id ?? (await queryOne<{ id: number }>(
      `SELECT shift_status_id AS id FROM lkp_shift_status WHERE shift_status = 'Open' LIMIT 1`,
    ))?.id;
    if (!statusId) return res.status(500).json({ error: "Couldn't find 'Open' shift_status" });

    // Walk dates from→to inclusive, build the (template, date) cross-product.
    const dates = enumerateDates(b.from_date, b.to_date);

    const result = await withTransaction(async (tx) => {
      let created = 0;
      let skippedHoliday = 0;
      let skippedExisting = 0;
      const createdShifts: number[] = [];

      for (const t of templates) {
        for (const dateStr of dates) {
          const dow = dayOfWeekFromIsoDate(dateStr);   // 0 = Sun … 6 = Sat
          if (((t.day_of_week_mask >> dow) & 1) === 0) continue;
          if (t.skip_holidays && holidaySet.has(dateStr)) {
            skippedHoliday++;
            continue;
          }
          try {
            const row = await tx.queryOne<{ shift_id: number }>(`
              INSERT INTO tbl_volunteer_shift
                (shift_type_id, shift_status_id, corp_facility_id, shift_name,
                 shift_date, start_time, end_time, capacity_needed, notes,
                 shift_template_id, created_by_user_account_id)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              RETURNING shift_id
            `, [
              t.shift_type_id, statusId, t.corp_facility_id,
              t.shift_name ?? t.template_name,
              dateStr,
              t.start_time, t.end_time,
              t.capacity_needed, t.notes,
              t.shift_template_id, req.user!.user_account_id,
            ]);
            createdShifts.push(row!.shift_id);
            created++;
          } catch (err: any) {
            // Duplicate (already generated for this template+date) — skip silently.
            if (err.code === '23505') {
              skippedExisting++;
            } else {
              throw err;
            }
          }
        }
      }
      return { created, skippedHoliday, skippedExisting, createdShifts };
    });

    res.json({
      ok: true,
      summary: {
        templates_used: templates.length,
        dates_scanned: dates.length,
        shifts_created: result.created,
        skipped_holiday: result.skippedHoliday,
        skipped_already_generated: result.skippedExisting,
      },
    });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Holidays                                                          */
/* ----------------------------------------------------------------- */

interface HolidayPayload {
  holiday_date: string;
  holiday_name: string;
  is_active?: boolean;
  notes?: string | null;
}

holidaysRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await query(`
      SELECT holiday_id, to_char(holiday_date, 'YYYY-MM-DD') AS holiday_date,
             holiday_name, is_active, notes
      FROM tbl_holiday
      ORDER BY holiday_date
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

holidaysRouter.post('/', async (req, res, next) => {
  try {
    const b = req.body as HolidayPayload;
    if (!b.holiday_date || !/^\d{4}-\d{2}-\d{2}$/.test(b.holiday_date)) {
      return res.status(400).json({ error: 'holiday_date must be YYYY-MM-DD' });
    }
    if (!b.holiday_name?.trim()) return res.status(400).json({ error: 'holiday_name is required' });
    try {
      const row = await queryOne<{ holiday_id: number }>(`
        INSERT INTO tbl_holiday (holiday_date, holiday_name, is_active, notes)
        VALUES ($1, $2, $3, $4)
        RETURNING holiday_id
      `, [b.holiday_date, b.holiday_name.trim().slice(0, 120), b.is_active ?? true, b.notes?.trim() || null]);
      await auditCreate(req, 'tbl_holiday', row!.holiday_id, b);
      res.status(201).json({ holiday_id: row!.holiday_id });
    } catch (err: any) {
      if (err.code === '23505') return res.status(409).json({ error: 'A holiday already exists on that date.' });
      throw err;
    }
  } catch (err) { next(err); }
});

holidaysRouter.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const b = req.body as HolidayPayload;
    const before = await queryOne(`SELECT * FROM tbl_holiday WHERE holiday_id = $1`, [id]);
    if (!before) return res.status(404).json({ error: 'Holiday not found' });
    const after = await queryOne(`
      UPDATE tbl_holiday
         SET holiday_date = $1, holiday_name = $2, is_active = $3, notes = $4
       WHERE holiday_id = $5
       RETURNING *
    `, [b.holiday_date, b.holiday_name?.trim().slice(0, 120), b.is_active ?? true, b.notes?.trim() || null, id]);
    if (after) await auditUpdate(req, 'tbl_holiday', id, before, after);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

holidaysRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const before = await queryOne(`SELECT * FROM tbl_holiday WHERE holiday_id = $1`, [id]);
    if (!before) return res.status(404).json({ error: 'Holiday not found' });
    await query(`DELETE FROM tbl_holiday WHERE holiday_id = $1`, [id]);
    await auditDelete(req, 'tbl_holiday', id, before);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Date helpers — UTC-safe                                           */
/* ----------------------------------------------------------------- */

function enumerateDates(fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  const from = new Date(fromIso + 'T00:00:00Z');
  const to   = new Date(toIso   + 'T00:00:00Z');
  const cur = new Date(from);
  while (cur.getTime() <= to.getTime()) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function dayOfWeekFromIsoDate(iso: string): number {
  return new Date(iso + 'T00:00:00Z').getUTCDay();    // 0 = Sun … 6 = Sat
}
