/**
 * Donations — financial gifts (cash, check, credit card, ACH, stock, etc.).
 * Distinct from `tbl_donation_pickup` (the furniture-pickup operations workflow).
 *
 * Models one gift with:
 * - one donor
 * - one donation type (Monetary, In-kind, Stock, Bond, Real estate, ...)
 * - one payment method (Cash, Check, Credit card, ...)
 * - one or more designation splits (which fund(s) it goes to)
 * - optional pledge linkage (fulfills a prior commitment)
 * - optional type-specific sidecar: securities (stock/bond) or check
 *
 *   GET    /api/donations          filter: from, to, donor_id, fund_id, payment_method_id,
 *                                          donation_type_id, status, has_receipt
 *   GET    /api/donations/:id      detail with designations + securities + check + neighbors
 *   POST   /api/donations          create (optionally assigns a receipt number)
 *   PUT    /api/donations/:id      update (diffs designations + sidecars)
 *   DELETE /api/donations/:id      delete (cascades sub-rows; recomputes pledge if linked)
 *   POST   /api/donations/:id/receipt  assign next sequential receipt number
 *
 * Designation splits must sum to the donation's total_value, OR there must
 * be zero designations (then the whole gift is "undesignated" / general).
 */

import { Router } from 'express';
import { query, queryOne, withTransaction } from '../db/pool.js';
import { auditCreate, auditDelete, auditUpdate } from '../auth/audit.js';
import { reserveNextReceiptNumber } from '../lib/receipts.js';
import { recomputePledgeFulfillment } from './pledges.js';

type Tx = Parameters<Parameters<typeof withTransaction>[0]>[0];

export const donationsRouter = Router();

/* ----------------------------------------------------------------- */
/*  Shared shapes                                                     */
/* ----------------------------------------------------------------- */

interface DesignationPayload {
  donation_designation_id?: number | null;
  fund_id: number;
  amount: number;
  description?: string | null;
}

interface SecuritiesPayload {
  security_type: string;          // 'Stock' | 'Bond' | 'Other'
  ticker?: string | null;
  security_description?: string | null;
  shares?: number | null;
  gift_date_fmv?: number | null;
  sale_proceeds?: number | null;
  broker_name?: string | null;
}

interface CheckPayload {
  check_number?: string | null;
  check_date?: string | null;
  bank_name?: string | null;
}

interface DonationWritePayload {
  donor_id: number;
  donation_type_id: number;
  donation_date: string;
  total_value: number;
  payment_method_id?: number | null;
  solicitation_method_id?: number | null;
  tax_deductible_amount?: number | null;
  acknowledgement_status_id?: number | null;
  acknowledgement_sent_date?: string | null;
  pledge_id?: number | null;
  soft_credit_contact_id?: number | null;
  gift_in_honor_of?: string | null;
  external_transaction_id?: string | null;
  received_via?: string | null;
  campaign_id?: number | null;
  description?: string | null;

  designations?: DesignationPayload[];
  securities?: SecuritiesPayload | null;
  check?: CheckPayload | null;

  /** When true, the server auto-assigns the next receipt number. */
  assign_receipt_number?: boolean;
}

/* ----------------------------------------------------------------- */
/*  List                                                              */
/* ----------------------------------------------------------------- */

donationsRouter.get('/', async (req, res, next) => {
  try {
    const from   = (req.query.from as string | undefined) || null;
    const to     = (req.query.to   as string | undefined) || null;
    const donorId         = req.query.donor_id         ? Number(req.query.donor_id)         : null;
    const fundId          = req.query.fund_id          ? Number(req.query.fund_id)          : null;
    const paymentMethodId = req.query.payment_method_id ? Number(req.query.payment_method_id) : null;
    const donationTypeId  = req.query.donation_type_id ? Number(req.query.donation_type_id) : null;
    const ackStatusId     = req.query.acknowledgement_status_id ? Number(req.query.acknowledgement_status_id) : null;
    const hasReceipt      = req.query.has_receipt === 'true' ? true
                          : req.query.has_receipt === 'false' ? false : null;

    const conds: string[] = [];
    const params: any[] = [];
    if (from)             { params.push(from);             conds.push(`d.donation_date >= $${params.length}::date`); }
    if (to)               { params.push(to);               conds.push(`d.donation_date <= $${params.length}::date`); }
    if (donorId)          { params.push(donorId);          conds.push(`d.donor_id = $${params.length}`); }
    if (paymentMethodId)  { params.push(paymentMethodId);  conds.push(`d.payment_method_id = $${params.length}`); }
    if (donationTypeId)   { params.push(donationTypeId);   conds.push(`d.donation_type_id = $${params.length}`); }
    if (ackStatusId)      { params.push(ackStatusId);      conds.push(`d.acknowledgement_status_id = $${params.length}`); }
    if (hasReceipt === true)  conds.push(`d.receipt_number IS NOT NULL`);
    if (hasReceipt === false) conds.push(`d.receipt_number IS NULL`);
    if (fundId) {
      params.push(fundId);
      conds.push(`EXISTS (SELECT 1 FROM tbl_donation_designation dd WHERE dd.donation_id = d.donation_id AND dd.fund_id = $${params.length})`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const rows = await query(`
      SELECT
        d.donation_id,
        d.donation_date,
        d.total_value,
        d.tax_deductible_amount,
        d.receipt_number,
        d.acknowledgement_status_id,
        d.donor_id,
        d.qbo_sync_status,
        d.qbo_synced_at,
        contact.first_name || ' ' || contact.last_name AS donor_name,
        dt.donation_type,
        pm.payment_method,
        ackst.acknowledgement_status
      FROM tbl_donation d
      JOIN tbl_donor donor ON donor.donor_id = d.donor_id
      JOIN tbl_contact contact ON contact.contact_id = donor.contact_id
      JOIN lkp_donation_type dt ON dt.donation_type_id = d.donation_type_id
      LEFT JOIN lkp_payment_method pm ON pm.payment_method_id = d.payment_method_id
      LEFT JOIN lkp_acknowledgement_status ackst ON ackst.acknowledgement_status_id = d.acknowledgement_status_id
      ${where}
      ORDER BY d.donation_date DESC, d.donation_id DESC
      LIMIT 500
    `, params);

    res.json(rows);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Read one                                                          */
/* ----------------------------------------------------------------- */

donationsRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const donation = await queryOne(`
      SELECT
        d.*,
        contact.first_name || ' ' || contact.last_name AS donor_name,
        dt.donation_type,
        pm.payment_method,
        sm.solicitation_method,
        ackst.acknowledgement_status,
        soft.first_name || ' ' || soft.last_name AS soft_credit_name
      FROM tbl_donation d
      JOIN tbl_donor donor ON donor.donor_id = d.donor_id
      JOIN tbl_contact contact ON contact.contact_id = donor.contact_id
      JOIN lkp_donation_type dt ON dt.donation_type_id = d.donation_type_id
      LEFT JOIN lkp_payment_method pm ON pm.payment_method_id = d.payment_method_id
      LEFT JOIN lkp_solicitation_method sm ON sm.solicitation_method_id = d.solicitation_method_id
      LEFT JOIN lkp_acknowledgement_status ackst ON ackst.acknowledgement_status_id = d.acknowledgement_status_id
      LEFT JOIN tbl_contact soft ON soft.contact_id = d.soft_credit_contact_id
      WHERE d.donation_id = $1
    `, [id]);

    if (!donation) return res.status(404).json({ error: 'Donation not found' });

    const designations = await query(`
      SELECT dd.*, f.fund_name
        FROM tbl_donation_designation dd
        JOIN lkp_fund f ON f.fund_id = dd.fund_id
       WHERE dd.donation_id = $1
       ORDER BY dd.donation_designation_id
    `, [id]);

    const securities = await queryOne(
      `SELECT * FROM tbl_donation_securities WHERE donation_id = $1`, [id],
    );
    const check = await queryOne(
      `SELECT * FROM tbl_donation_check WHERE donation_id = $1`, [id],
    );

    const { prevId, nextId } = await neighborIds(id);

    res.json({ donation, designations, securities, check, prevId, nextId });
  } catch (err) { next(err); }
});

async function neighborIds(currentId: number): Promise<{ prevId: number | null; nextId: number | null }> {
  const cur = await queryOne<{ donation_date: string }>(
    `SELECT donation_date FROM tbl_donation WHERE donation_id = $1`, [currentId],
  );
  if (!cur) return { prevId: null, nextId: null };

  const prev = await queryOne<{ id: number }>(`
    SELECT donation_id AS id FROM tbl_donation
     WHERE donation_date > $1 OR (donation_date = $1 AND donation_id > $2)
     ORDER BY donation_date ASC, donation_id ASC LIMIT 1
  `, [cur.donation_date, currentId]);
  const next = await queryOne<{ id: number }>(`
    SELECT donation_id AS id FROM tbl_donation
     WHERE donation_date < $1 OR (donation_date = $1 AND donation_id < $2)
     ORDER BY donation_date DESC, donation_id DESC LIMIT 1
  `, [cur.donation_date, currentId]);

  return { prevId: prev?.id ?? null, nextId: next?.id ?? null };
}

/* ----------------------------------------------------------------- */
/*  Create                                                            */
/* ----------------------------------------------------------------- */

donationsRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body as DonationWritePayload;
    const errs = validate(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    const newId = await withTransaction(async (tx) => {
      const receiptNumber = body.assign_receipt_number
        ? await reserveNextReceiptNumber(tx, new Date(body.donation_date))
        : null;

      const donation = await tx.queryOne<Record<string, any>>(`
        INSERT INTO tbl_donation
          (donor_id, donation_type_id, donation_date, total_value,
           payment_method_id, solicitation_method_id, tax_deductible_amount,
           acknowledgement_status_id, acknowledgement_sent_date,
           receipt_number, pledge_id, soft_credit_contact_id,
           gift_in_honor_of, external_transaction_id, received_via,
           campaign_id, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *
      `, [
        body.donor_id, body.donation_type_id, body.donation_date, body.total_value,
        body.payment_method_id ?? null, body.solicitation_method_id ?? null,
        body.tax_deductible_amount ?? body.total_value,
        body.acknowledgement_status_id ?? null, body.acknowledgement_sent_date ?? null,
        receiptNumber, body.pledge_id ?? null, body.soft_credit_contact_id ?? null,
        body.gift_in_honor_of ?? null, body.external_transaction_id ?? null,
        body.received_via ?? null, body.campaign_id ?? null, body.description ?? null,
      ]);
      const donId = donation!.donation_id;

      for (const d of body.designations ?? []) {
        await tx.query(`
          INSERT INTO tbl_donation_designation (donation_id, fund_id, amount, description)
          VALUES ($1, $2, $3, $4)
        `, [donId, d.fund_id, d.amount, d.description ?? null]);
      }
      if (body.securities) {
        const s = body.securities;
        await tx.query(`
          INSERT INTO tbl_donation_securities
            (donation_id, security_type, ticker, security_description, shares,
             gift_date_fmv, sale_proceeds, broker_name)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [donId, s.security_type, s.ticker ?? null, s.security_description ?? null,
            s.shares ?? null, s.gift_date_fmv ?? null, s.sale_proceeds ?? null, s.broker_name ?? null]);
      }
      if (body.check) {
        const c = body.check;
        await tx.query(`
          INSERT INTO tbl_donation_check (donation_id, check_number, check_date, bank_name)
          VALUES ($1, $2, $3, $4)
        `, [donId, c.check_number ?? null, c.check_date ?? null, c.bank_name ?? null]);
      }

      if (body.pledge_id) await recomputePledgeFulfillment(tx, body.pledge_id);

      await auditCreate(req, 'tbl_donation', donId, donation!, tx);
      return donId;
    });

    res.status(201).json({ donation_id: newId });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Update                                                            */
/* ----------------------------------------------------------------- */

donationsRouter.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const body = req.body as DonationWritePayload;
    const errs = validate(body);
    if (errs.length) return res.status(400).json({ error: errs.join('; ') });

    await withTransaction(async (tx) => {
      const before = await tx.queryOne<Record<string, any>>(
        `SELECT * FROM tbl_donation WHERE donation_id = $1`, [id],
      );
      if (!before) throw withStatus(404, 'Donation not found');

      // Preserve receipt_number on update (don't blow away existing).
      const after = await tx.queryOne<Record<string, any>>(`
        UPDATE tbl_donation
           SET donor_id = $1, donation_type_id = $2, donation_date = $3,
               total_value = $4, payment_method_id = $5,
               solicitation_method_id = $6, tax_deductible_amount = $7,
               acknowledgement_status_id = $8, acknowledgement_sent_date = $9,
               pledge_id = $10, soft_credit_contact_id = $11,
               gift_in_honor_of = $12, external_transaction_id = $13,
               received_via = $14, campaign_id = $15, description = $16
         WHERE donation_id = $17
         RETURNING *
      `, [
        body.donor_id, body.donation_type_id, body.donation_date, body.total_value,
        body.payment_method_id ?? null, body.solicitation_method_id ?? null,
        body.tax_deductible_amount ?? body.total_value,
        body.acknowledgement_status_id ?? null, body.acknowledgement_sent_date ?? null,
        body.pledge_id ?? null, body.soft_credit_contact_id ?? null,
        body.gift_in_honor_of ?? null, body.external_transaction_id ?? null,
        body.received_via ?? null, body.campaign_id ?? null, body.description ?? null,
        id,
      ]);
      if (after) await auditUpdate(req, 'tbl_donation', id, before, after, tx);

      // Diff designations.
      const incomingIds = new Set((body.designations ?? [])
        .map(d => d.donation_designation_id).filter(Boolean) as number[]);
      const existing = await tx.query<{ donation_designation_id: number }>(
        `SELECT donation_designation_id FROM tbl_donation_designation WHERE donation_id = $1`, [id],
      );
      for (const e of existing) {
        if (!incomingIds.has(e.donation_designation_id)) {
          await tx.query(`DELETE FROM tbl_donation_designation WHERE donation_designation_id = $1`, [e.donation_designation_id]);
        }
      }
      for (const d of body.designations ?? []) {
        if (d.donation_designation_id) {
          await tx.query(`
            UPDATE tbl_donation_designation
               SET fund_id = $1, amount = $2, description = $3
             WHERE donation_designation_id = $4
          `, [d.fund_id, d.amount, d.description ?? null, d.donation_designation_id]);
        } else {
          await tx.query(`
            INSERT INTO tbl_donation_designation (donation_id, fund_id, amount, description)
            VALUES ($1, $2, $3, $4)
          `, [id, d.fund_id, d.amount, d.description ?? null]);
        }
      }

      // Securities upsert (1:1).
      await upsertSecurities(tx, id, body.securities ?? null);
      // Check upsert (1:1).
      await upsertCheck(tx, id, body.check ?? null);

      // Recompute pledge fulfillment for OLD pledge and NEW pledge if either set.
      const oldPledgeId = before.pledge_id as number | null;
      const newPledgeId = body.pledge_id ?? null;
      if (oldPledgeId && oldPledgeId !== newPledgeId) await recomputePledgeFulfillment(tx, oldPledgeId);
      if (newPledgeId) await recomputePledgeFulfillment(tx, newPledgeId);
    });

    res.json({ donation_id: id });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Delete                                                            */
/* ----------------------------------------------------------------- */

donationsRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    await withTransaction(async (tx) => {
      const before = await tx.queryOne<Record<string, any>>(
        `SELECT * FROM tbl_donation WHERE donation_id = $1`, [id],
      );
      if (!before) throw withStatus(404, 'Donation not found');

      // FK ON DELETE CASCADE handles designations/securities/check.
      await tx.query(`DELETE FROM tbl_donation WHERE donation_id = $1`, [id]);
      await auditDelete(req, 'tbl_donation', id, before, tx);

      if (before.pledge_id) await recomputePledgeFulfillment(tx, before.pledge_id as number);
    });
    res.status(204).end();
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Assign receipt number to an existing donation                     */
/* ----------------------------------------------------------------- */

donationsRouter.post('/:id/receipt', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const updated = await withTransaction(async (tx) => {
      const row = await tx.queryOne<{ donation_date: string; receipt_number: string | null }>(
        `SELECT donation_date, receipt_number FROM tbl_donation WHERE donation_id = $1`, [id],
      );
      if (!row) throw withStatus(404, 'Donation not found');
      if (row.receipt_number) {
        // Idempotent: just return what's there.
        return row.receipt_number;
      }
      const num = await reserveNextReceiptNumber(tx, new Date(row.donation_date));
      await tx.query(`UPDATE tbl_donation SET receipt_number = $1 WHERE donation_id = $2`, [num, id]);
      return num;
    });
    res.json({ receipt_number: updated });
  } catch (err) { next(err); }
});

/* ================================================================= */

async function upsertSecurities(tx: Tx, donationId: number, payload: SecuritiesPayload | null): Promise<void> {
  const existing = await tx.queryOne<{ id: number }>(
    `SELECT donation_securities_id AS id FROM tbl_donation_securities WHERE donation_id = $1`, [donationId],
  );
  if (!payload) {
    if (existing) await tx.query(`DELETE FROM tbl_donation_securities WHERE donation_securities_id = $1`, [existing.id]);
    return;
  }
  if (existing) {
    await tx.query(`
      UPDATE tbl_donation_securities
         SET security_type = $1, ticker = $2, security_description = $3,
             shares = $4, gift_date_fmv = $5, sale_proceeds = $6, broker_name = $7
       WHERE donation_securities_id = $8
    `, [
      payload.security_type, payload.ticker ?? null, payload.security_description ?? null,
      payload.shares ?? null, payload.gift_date_fmv ?? null, payload.sale_proceeds ?? null,
      payload.broker_name ?? null, existing.id,
    ]);
  } else {
    await tx.query(`
      INSERT INTO tbl_donation_securities
        (donation_id, security_type, ticker, security_description, shares,
         gift_date_fmv, sale_proceeds, broker_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      donationId, payload.security_type, payload.ticker ?? null, payload.security_description ?? null,
      payload.shares ?? null, payload.gift_date_fmv ?? null, payload.sale_proceeds ?? null,
      payload.broker_name ?? null,
    ]);
  }
}

async function upsertCheck(tx: Tx, donationId: number, payload: CheckPayload | null): Promise<void> {
  const existing = await tx.queryOne<{ id: number }>(
    `SELECT donation_check_id AS id FROM tbl_donation_check WHERE donation_id = $1`, [donationId],
  );
  if (!payload) {
    if (existing) await tx.query(`DELETE FROM tbl_donation_check WHERE donation_check_id = $1`, [existing.id]);
    return;
  }
  if (existing) {
    await tx.query(`
      UPDATE tbl_donation_check
         SET check_number = $1, check_date = $2, bank_name = $3
       WHERE donation_check_id = $4
    `, [payload.check_number ?? null, payload.check_date ?? null, payload.bank_name ?? null, existing.id]);
  } else {
    await tx.query(`
      INSERT INTO tbl_donation_check (donation_id, check_number, check_date, bank_name)
      VALUES ($1, $2, $3, $4)
    `, [donationId, payload.check_number ?? null, payload.check_date ?? null, payload.bank_name ?? null]);
  }
}

function validate(b: DonationWritePayload): string[] {
  const errs: string[] = [];
  if (!Number.isInteger(b?.donor_id) || b.donor_id <= 0) errs.push('donor_id required');
  if (!Number.isInteger(b?.donation_type_id) || b.donation_type_id <= 0) errs.push('donation_type_id required');
  if (!b?.donation_date) errs.push('donation_date required');
  const total = Number(b?.total_value);
  if (!Number.isFinite(total) || total <= 0) errs.push('total_value must be a positive number');

  // Designations must sum to total_value (or be absent).
  const designations = b?.designations ?? [];
  if (designations.length > 0) {
    const sum = designations.reduce((s, d) => s + Number(d.amount || 0), 0);
    if (Math.abs(sum - total) > 0.01) {
      errs.push(`designation amounts (${sum.toFixed(2)}) must sum to total_value (${total.toFixed(2)})`);
    }
    for (const d of designations) {
      if (!Number.isInteger(d.fund_id) || d.fund_id <= 0) errs.push('every designation needs a fund_id');
      if (!Number.isFinite(Number(d.amount)) || Number(d.amount) <= 0) errs.push('every designation amount must be positive');
    }
  }

  // Securities sanity (only when present).
  if (b?.securities) {
    if (!b.securities.security_type) errs.push('securities.security_type required when securities is provided');
  }

  return errs;
}

function withStatus(status: number, message: string): Error {
  const e: any = new Error(message);
  e.status = status;
  return e;
}
