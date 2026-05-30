/**
 * Campaigns — fundraising drives that contain multiple donations,
 * pledges, and events, with a goal amount and timeline.
 *
 *   GET    /api/campaigns                   filter by status/type/fund
 *   GET    /api/campaigns/:id               detail w/ progress + linked rows
 *   POST   /api/campaigns                   create
 *   PUT    /api/campaigns/:id               update
 *   DELETE /api/campaigns/:id               409 if any donations/pledges/events linked
 */

import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditCreate, auditDelete, auditUpdate } from '../auth/audit.js';

export const campaignsRouter = Router();

interface CampaignWrite {
  campaign_name: string;
  campaign_type_id: number;
  campaign_status_id: number;
  fund_id?: number | null;
  goal_amount?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  manager_facility_staff_id?: number | null;
  public_url?: string | null;
  notes?: string | null;
}

/* ----------------------------------------------------------------- */
/*  List                                                              */
/* ----------------------------------------------------------------- */

campaignsRouter.get('/', async (req, res, next) => {
  try {
    const statusId = req.query.status_id ? Number(req.query.status_id) : null;
    const typeId   = req.query.type_id   ? Number(req.query.type_id)   : null;
    const fundId   = req.query.fund_id   ? Number(req.query.fund_id)   : null;

    const conds: string[] = [];
    const params: any[] = [];
    if (statusId) { params.push(statusId); conds.push(`c.campaign_status_id = $${params.length}`); }
    if (typeId)   { params.push(typeId);   conds.push(`c.campaign_type_id = $${params.length}`); }
    if (fundId)   { params.push(fundId);   conds.push(`c.fund_id = $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const rows = await query(`
      SELECT
        c.campaign_id,
        c.campaign_name,
        c.goal_amount,
        c.start_date,
        c.end_date,
        c.public_url,
        ct.campaign_type,
        cs.campaign_status,
        f.fund_name,
        COALESCE(don.raised, 0)::numeric(12,2)   AS raised,
        COALESCE(don.gift_count, 0)::int          AS gift_count,
        COALESCE(pl.outstanding, 0)::numeric(12,2) AS outstanding_pledged
      FROM tbl_campaign c
      JOIN lkp_campaign_type ct ON ct.campaign_type_id = c.campaign_type_id
      JOIN lkp_campaign_status cs ON cs.campaign_status_id = c.campaign_status_id
      LEFT JOIN lkp_fund f ON f.fund_id = c.fund_id
      LEFT JOIN LATERAL (
        SELECT SUM(total_value) AS raised, COUNT(*)::int AS gift_count
          FROM tbl_donation WHERE campaign_id = c.campaign_id
      ) don ON true
      LEFT JOIN LATERAL (
        SELECT SUM(total_pledged_amount - amount_fulfilled) AS outstanding
          FROM tbl_pledge p
          JOIN lkp_pledge_status ps ON ps.pledge_status_id = p.pledge_status_id
         WHERE p.campaign_id = c.campaign_id
           AND ps.pledge_status NOT IN ('Fulfilled', 'Cancelled')
      ) pl ON true
      ${where}
      ORDER BY
        CASE cs.campaign_status WHEN 'Active' THEN 1 WHEN 'Planning' THEN 2 WHEN 'Paused' THEN 3 WHEN 'Completed' THEN 4 ELSE 5 END,
        c.start_date DESC NULLS LAST,
        c.campaign_id DESC
    `, params);
    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Read one                                                          */
/* ----------------------------------------------------------------- */

campaignsRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const campaign = await queryOne(`
      SELECT
        c.*,
        ct.campaign_type,
        cs.campaign_status,
        f.fund_name,
        contact.first_name || ' ' || contact.last_name AS manager_name
      FROM tbl_campaign c
      JOIN lkp_campaign_type ct ON ct.campaign_type_id = c.campaign_type_id
      JOIN lkp_campaign_status cs ON cs.campaign_status_id = c.campaign_status_id
      LEFT JOIN lkp_fund f ON f.fund_id = c.fund_id
      LEFT JOIN tbl_facility_staff fs ON fs.facility_staff_id = c.manager_facility_staff_id
      LEFT JOIN tbl_contact contact ON contact.contact_id = fs.contact_id
      WHERE c.campaign_id = $1
    `, [id]);

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const totals = await queryOne(`
      SELECT
        COALESCE((SELECT SUM(total_value) FROM tbl_donation WHERE campaign_id = $1), 0)::numeric(12,2) AS raised,
        COALESCE((SELECT COUNT(*) FROM tbl_donation WHERE campaign_id = $1), 0)::int AS gift_count,
        COALESCE((SELECT SUM(total_pledged_amount) FROM tbl_pledge WHERE campaign_id = $1), 0)::numeric(12,2) AS total_pledged,
        COALESCE((SELECT SUM(amount_fulfilled) FROM tbl_pledge WHERE campaign_id = $1), 0)::numeric(12,2) AS pledged_fulfilled,
        COALESCE((SELECT SUM(p.total_pledged_amount - p.amount_fulfilled)
                    FROM tbl_pledge p
                    JOIN lkp_pledge_status ps ON ps.pledge_status_id = p.pledge_status_id
                   WHERE p.campaign_id = $1 AND ps.pledge_status NOT IN ('Fulfilled','Cancelled')
                ), 0)::numeric(12,2) AS outstanding_pledged
    `, [id]);

    const donations = await query(`
      SELECT
        d.donation_id, d.donation_date, d.total_value, d.receipt_number,
        dt.donation_type, pm.payment_method,
        contact.first_name || ' ' || contact.last_name AS donor_name
      FROM tbl_donation d
      JOIN lkp_donation_type dt ON dt.donation_type_id = d.donation_type_id
      LEFT JOIN lkp_payment_method pm ON pm.payment_method_id = d.payment_method_id
      JOIN tbl_donor donor ON donor.donor_id = d.donor_id
      JOIN tbl_contact contact ON contact.contact_id = donor.contact_id
      WHERE d.campaign_id = $1
      ORDER BY d.donation_date DESC
      LIMIT 100
    `, [id]);

    const pledges = await query(`
      SELECT
        p.pledge_id, p.pledge_date, p.expected_fulfillment_date,
        p.total_pledged_amount, p.amount_fulfilled,
        (p.total_pledged_amount - p.amount_fulfilled) AS outstanding,
        ps.pledge_status,
        contact.first_name || ' ' || contact.last_name AS donor_name
      FROM tbl_pledge p
      JOIN lkp_pledge_status ps ON ps.pledge_status_id = p.pledge_status_id
      JOIN tbl_donor donor ON donor.donor_id = p.donor_id
      JOIN tbl_contact contact ON contact.contact_id = donor.contact_id
      WHERE p.campaign_id = $1
      ORDER BY p.pledge_date DESC
      LIMIT 100
    `, [id]);

    const events = await query(`
      SELECT
        e.event_id, e.event_name, e.event_date, e.amount_raised, e.goal_amount,
        et.event_type
      FROM tbl_event e
      JOIN lkp_event_type et ON et.event_type_id = e.event_type_id
      WHERE e.campaign_id = $1
      ORDER BY e.event_date DESC
    `, [id]);

    const topDonors = await query(`
      SELECT
        donor.donor_id,
        contact.first_name || ' ' || contact.last_name AS donor_name,
        SUM(d.total_value)::numeric(12,2) AS total,
        COUNT(d.donation_id)::int AS gift_count
      FROM tbl_donation d
      JOIN tbl_donor donor ON donor.donor_id = d.donor_id
      JOIN tbl_contact contact ON contact.contact_id = donor.contact_id
      WHERE d.campaign_id = $1
      GROUP BY donor.donor_id, contact.first_name, contact.last_name
      ORDER BY total DESC
      LIMIT 10
    `, [id]);

    const { prevId, nextId } = await neighborIds(id);

    res.json({ campaign, totals, donations, pledges, events, topDonors, prevId, nextId });
  } catch (err) { next(err); }
});

async function neighborIds(currentId: number): Promise<{ prevId: number | null; nextId: number | null }> {
  const prev = await queryOne<{ id: number }>(
    `SELECT campaign_id AS id FROM tbl_campaign WHERE campaign_id < $1 ORDER BY campaign_id DESC LIMIT 1`, [currentId],
  );
  const next = await queryOne<{ id: number }>(
    `SELECT campaign_id AS id FROM tbl_campaign WHERE campaign_id > $1 ORDER BY campaign_id ASC LIMIT 1`, [currentId],
  );
  return { prevId: prev?.id ?? null, nextId: next?.id ?? null };
}

/* ----------------------------------------------------------------- */
/*  Create / Update / Delete                                          */
/* ----------------------------------------------------------------- */

campaignsRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body as CampaignWrite;
    const errs = validate(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    const userId = req.user!.user_account_id;
    const newId = await withTransaction(async (tx) => {
      const r = await tx.queryOne<Record<string, any>>(`
        INSERT INTO tbl_campaign
          (campaign_name, campaign_type_id, campaign_status_id, fund_id,
           goal_amount, start_date, end_date, manager_facility_staff_id,
           public_url, notes, created_by_user_account_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        body.campaign_name, body.campaign_type_id, body.campaign_status_id,
        body.fund_id ?? null, body.goal_amount ?? null,
        body.start_date ?? null, body.end_date ?? null,
        body.manager_facility_staff_id ?? null,
        body.public_url ?? null, body.notes ?? null, userId,
      ]);
      await auditCreate(req, 'tbl_campaign', r!.campaign_id, r!, tx);
      return r!.campaign_id;
    });
    res.status(201).json({ campaign_id: newId });
  } catch (err) { next(err); }
});

campaignsRouter.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const body = req.body as CampaignWrite;
    const errs = validate(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    await withTransaction(async (tx) => {
      const before = await tx.queryOne<Record<string, any>>(
        `SELECT * FROM tbl_campaign WHERE campaign_id = $1`, [id],
      );
      if (!before) throw withStatus(404, 'Campaign not found');

      const after = await tx.queryOne<Record<string, any>>(`
        UPDATE tbl_campaign
           SET campaign_name = $1, campaign_type_id = $2, campaign_status_id = $3,
               fund_id = $4, goal_amount = $5, start_date = $6, end_date = $7,
               manager_facility_staff_id = $8, public_url = $9, notes = $10
         WHERE campaign_id = $11
         RETURNING *
      `, [
        body.campaign_name, body.campaign_type_id, body.campaign_status_id,
        body.fund_id ?? null, body.goal_amount ?? null,
        body.start_date ?? null, body.end_date ?? null,
        body.manager_facility_staff_id ?? null,
        body.public_url ?? null, body.notes ?? null, id,
      ]);
      if (after) await auditUpdate(req, 'tbl_campaign', id, before, after, tx);
    });
    res.json({ campaign_id: id });
  } catch (err) { next(err); }
});

campaignsRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    await withTransaction(async (tx) => {
      const before = await tx.queryOne<Record<string, any>>(
        `SELECT * FROM tbl_campaign WHERE campaign_id = $1`, [id],
      );
      if (!before) throw withStatus(404, 'Campaign not found');

      const linked = await tx.queryOne<{ donations: string; pledges: string; events: string }>(`
        SELECT
          (SELECT COUNT(*)::text FROM tbl_donation WHERE campaign_id = $1) AS donations,
          (SELECT COUNT(*)::text FROM tbl_pledge   WHERE campaign_id = $1) AS pledges,
          (SELECT COUNT(*)::text FROM tbl_event    WHERE campaign_id = $1) AS events
      `, [id]);
      const counts = [
        Number(linked?.donations ?? 0),
        Number(linked?.pledges ?? 0),
        Number(linked?.events ?? 0),
      ];
      if (counts.some(n => n > 0)) {
        const parts: string[] = [];
        if (counts[0]) parts.push(`${counts[0]} donation${counts[0] === 1 ? '' : 's'}`);
        if (counts[1]) parts.push(`${counts[1]} pledge${counts[1] === 1 ? '' : 's'}`);
        if (counts[2]) parts.push(`${counts[2]} event${counts[2] === 1 ? '' : 's'}`);
        throw withStatus(409,
          `Can't delete a campaign with linked records (${parts.join(', ')}). Mark it Cancelled instead, or unlink the records first.`);
      }

      await tx.query(`DELETE FROM tbl_campaign WHERE campaign_id = $1`, [id]);
      await auditDelete(req, 'tbl_campaign', id, before, tx);
    });
    res.status(204).end();
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */

function validate(b: CampaignWrite): string[] {
  const errs: string[] = [];
  if (!b?.campaign_name?.trim()) errs.push('campaign_name required');
  if (!Number.isInteger(b?.campaign_type_id) || b.campaign_type_id <= 0) errs.push('campaign_type_id required');
  if (!Number.isInteger(b?.campaign_status_id) || b.campaign_status_id <= 0) errs.push('campaign_status_id required');
  if (b?.goal_amount != null && !Number.isFinite(Number(b.goal_amount))) errs.push('goal_amount must be a number');
  if (b?.start_date && b?.end_date && new Date(b.end_date) < new Date(b.start_date)) {
    errs.push('end_date cannot be before start_date');
  }
  return errs;
}

function withStatus(status: number, message: string): Error {
  const e: any = new Error(message);
  e.status = status;
  return e;
}
