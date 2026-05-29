/**
 * Pledges — commitments to give that may be fulfilled by one or more
 * donation payments. Distinct from gifts (`tbl_donation`).
 *
 *   GET    /api/pledges               filter: status, donor_id, fund_id, overdue=true
 *   GET    /api/pledges/:id           detail with linked donations
 *   POST   /api/pledges               create
 *   PUT    /api/pledges/:id           update
 *   DELETE /api/pledges/:id           only if no donations are linked
 *
 * The denormalized `amount_fulfilled` column is kept in sync by the
 * donations route (every insert/update/delete of a donation with a
 * pledge_id triggers a recompute).
 */

import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditCreate, auditDelete, auditUpdate } from '../auth/audit.js';

export const pledgesRouter = Router();

interface PledgeWritePayload {
  donor_id: number;
  fund_id?: number | null;
  total_pledged_amount: number;
  pledge_date: string;
  expected_fulfillment_date?: string | null;
  pledge_status_id: number;
  solicitation_method_id?: number | null;
  campaign_id?: number | null;
  notes?: string | null;
}

/* ----------------------------------------------------------------- */
/*  List                                                              */
/* ----------------------------------------------------------------- */

pledgesRouter.get('/', async (req, res, next) => {
  try {
    const donorId   = req.query.donor_id   ? Number(req.query.donor_id)   : null;
    const fundId    = req.query.fund_id    ? Number(req.query.fund_id)    : null;
    const statusId  = req.query.status_id  ? Number(req.query.status_id)  : null;
    const overdue   = req.query.overdue === 'true';

    const conds: string[] = [];
    const params: any[] = [];
    if (donorId)  { params.push(donorId);   conds.push(`p.donor_id = $${params.length}`); }
    if (fundId)   { params.push(fundId);    conds.push(`p.fund_id = $${params.length}`); }
    if (statusId) { params.push(statusId);  conds.push(`p.pledge_status_id = $${params.length}`); }
    if (overdue) {
      conds.push(`p.expected_fulfillment_date < CURRENT_DATE
                  AND ps.pledge_status NOT IN ('Fulfilled', 'Cancelled')`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const rows = await query(`
      SELECT
        p.pledge_id,
        p.donor_id,
        p.fund_id,
        p.total_pledged_amount,
        p.amount_fulfilled,
        (p.total_pledged_amount - p.amount_fulfilled) AS amount_outstanding,
        p.pledge_date,
        p.expected_fulfillment_date,
        p.pledge_status_id,
        p.solicitation_method_id,
        p.notes,
        ps.pledge_status,
        f.fund_name,
        contact.first_name || ' ' || contact.last_name AS donor_name
      FROM tbl_pledge p
      JOIN lkp_pledge_status ps ON ps.pledge_status_id = p.pledge_status_id
      LEFT JOIN lkp_fund f ON f.fund_id = p.fund_id
      JOIN tbl_donor d ON d.donor_id = p.donor_id
      JOIN tbl_contact contact ON contact.contact_id = d.contact_id
      ${where}
      ORDER BY p.pledge_date DESC, p.pledge_id DESC
      LIMIT 200
    `, params);

    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Read one                                                          */
/* ----------------------------------------------------------------- */

pledgesRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const pledge = await queryOne(`
      SELECT
        p.*,
        (p.total_pledged_amount - p.amount_fulfilled) AS amount_outstanding,
        ps.pledge_status,
        f.fund_name,
        sm.solicitation_method,
        contact.first_name || ' ' || contact.last_name AS donor_name
      FROM tbl_pledge p
      JOIN lkp_pledge_status ps ON ps.pledge_status_id = p.pledge_status_id
      LEFT JOIN lkp_fund f ON f.fund_id = p.fund_id
      LEFT JOIN lkp_solicitation_method sm ON sm.solicitation_method_id = p.solicitation_method_id
      JOIN tbl_donor d ON d.donor_id = p.donor_id
      JOIN tbl_contact contact ON contact.contact_id = d.contact_id
      WHERE p.pledge_id = $1
    `, [id]);

    if (!pledge) return res.status(404).json({ error: 'Pledge not found' });

    const payments = await query(`
      SELECT
        don.donation_id,
        don.donation_date,
        don.total_value,
        don.tax_deductible_amount,
        don.receipt_number,
        dt.donation_type
      FROM tbl_donation don
      JOIN lkp_donation_type dt ON dt.donation_type_id = don.donation_type_id
      WHERE don.pledge_id = $1
      ORDER BY don.donation_date DESC, don.donation_id DESC
    `, [id]);

    res.json({ pledge, payments });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Create                                                            */
/* ----------------------------------------------------------------- */

pledgesRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body as PledgeWritePayload;
    const errs = validatePledge(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    const userId = req.user!.user_account_id;

    const newRow = await withTransaction(async (tx) => {
      const r = await tx.queryOne<Record<string, any>>(`
        INSERT INTO tbl_pledge
          (donor_id, fund_id, total_pledged_amount, pledge_date,
           expected_fulfillment_date, pledge_status_id, solicitation_method_id,
           campaign_id, notes, created_by_user_account_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        body.donor_id,
        body.fund_id ?? null,
        body.total_pledged_amount,
        body.pledge_date,
        body.expected_fulfillment_date ?? null,
        body.pledge_status_id,
        body.solicitation_method_id ?? null,
        body.campaign_id ?? null,
        body.notes ?? null,
        userId,
      ]);
      await auditCreate(req, 'tbl_pledge', r!.pledge_id, r!, tx);
      return r!;
    });

    res.status(201).json({ pledge_id: newRow.pledge_id });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Update                                                            */
/* ----------------------------------------------------------------- */

pledgesRouter.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const body = req.body as PledgeWritePayload;
    const errs = validatePledge(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    await withTransaction(async (tx) => {
      const before = await tx.queryOne<Record<string, any>>(
        `SELECT * FROM tbl_pledge WHERE pledge_id = $1`, [id],
      );
      if (!before) throw withStatus(404, 'Pledge not found');

      const after = await tx.queryOne<Record<string, any>>(`
        UPDATE tbl_pledge
           SET donor_id = $1, fund_id = $2, total_pledged_amount = $3,
               pledge_date = $4, expected_fulfillment_date = $5,
               pledge_status_id = $6, solicitation_method_id = $7,
               campaign_id = $8, notes = $9
         WHERE pledge_id = $10
         RETURNING *
      `, [
        body.donor_id, body.fund_id ?? null, body.total_pledged_amount,
        body.pledge_date, body.expected_fulfillment_date ?? null,
        body.pledge_status_id, body.solicitation_method_id ?? null,
        body.campaign_id ?? null, body.notes ?? null, id,
      ]);
      if (after) await auditUpdate(req, 'tbl_pledge', id, before, after, tx);
    });
    res.json({ pledge_id: id });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Delete                                                            */
/* ----------------------------------------------------------------- */

pledgesRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    await withTransaction(async (tx) => {
      const before = await tx.queryOne<Record<string, any>>(
        `SELECT * FROM tbl_pledge WHERE pledge_id = $1`, [id],
      );
      if (!before) throw withStatus(404, 'Pledge not found');

      const linked = await tx.queryOne<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM tbl_donation WHERE pledge_id = $1`, [id],
      );
      if (Number(linked?.count ?? 0) > 0) {
        throw withStatus(409,
          `Can't delete a pledge with linked donations. Either unlink the donations first or mark the pledge as Cancelled.`);
      }

      await tx.query(`DELETE FROM tbl_pledge WHERE pledge_id = $1`, [id]);
      await auditDelete(req, 'tbl_pledge', id, before, tx);
    });
    res.status(204).end();
  } catch (err) { next(err); }
});

/* ================================================================= */

function validatePledge(b: PledgeWritePayload): string[] {
  const errs: string[] = [];
  if (!Number.isInteger(b?.donor_id) || b.donor_id <= 0) errs.push('donor_id required');
  if (!Number.isFinite(Number(b?.total_pledged_amount)) || Number(b.total_pledged_amount) <= 0) {
    errs.push('total_pledged_amount must be positive');
  }
  if (!b?.pledge_date) errs.push('pledge_date required');
  if (!Number.isInteger(b?.pledge_status_id) || b.pledge_status_id <= 0) errs.push('pledge_status_id required');
  return errs;
}

function withStatus(status: number, message: string): Error {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

/**
 * Recompute and store `amount_fulfilled` on a pledge after a donation
 * linked to it is inserted, updated, or deleted. Also bumps pledge_status
 * to "Fulfilled" / "Partially fulfilled" / "Open" automatically.
 *
 * Exported so the donations route can call it in-transaction.
 */
export async function recomputePledgeFulfillment(
  tx: Parameters<Parameters<typeof withTransaction>[0]>[0],
  pledgeId: number,
): Promise<void> {
  const row = await tx.queryOne<{ total_pledged_amount: string; sum: string }>(`
    SELECT
      p.total_pledged_amount::text AS total_pledged_amount,
      COALESCE(SUM(d.total_value), 0)::text AS sum
    FROM tbl_pledge p
    LEFT JOIN tbl_donation d ON d.pledge_id = p.pledge_id
    WHERE p.pledge_id = $1
    GROUP BY p.total_pledged_amount
  `, [pledgeId]);
  if (!row) return;

  const total = Number(row.total_pledged_amount);
  const fulfilled = Number(row.sum);
  const statusName =
    fulfilled <= 0                          ? 'Open' :
    fulfilled >= total                      ? 'Fulfilled' :
                                              'Partially fulfilled';

  await tx.query(`
    UPDATE tbl_pledge
       SET amount_fulfilled = $1,
           pledge_status_id = (SELECT pledge_status_id FROM lkp_pledge_status WHERE pledge_status = $2)
     WHERE pledge_id = $3
  `, [fulfilled, statusName, pledgeId]);
}
