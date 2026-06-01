/**
 * Donation → QBO sync engine.
 *
 * Public entry point: syncDonationToQbo(donationId, userId). Idempotent in
 * the sense that re-running on an already-synced donation logs a "skipped"
 * entry rather than creating duplicates. Returns a result describing what
 * happened so the API layer can render success/failure to the user.
 */

import { query, queryOne, withTransaction } from '../db/pool.js';
import {
  findCustomerByName,
  createCustomer,
  createSalesReceipt,
  getActiveConnection,
} from './client.js';

export interface SyncResult {
  status: 'synced' | 'skipped' | 'failed';
  donation_id: number;
  qbo_sales_receipt_id?: string;
  error?: string;
  message: string;
}

/* ----------------------------------------------------------------- */
/*  Data shapes                                                       */
/* ----------------------------------------------------------------- */

interface DonationForSync {
  donation_id: number;
  donor_id: number;
  donation_date: string;
  total_value: number;
  receipt_number: string | null;
  external_transaction_id: string | null;
  description: string | null;
  qbo_current_sync_id: number | null;
  donor_display_name: string;
  donor_first_name: string | null;
  donor_last_name: string | null;
  donor_email: string | null;
  donor_company: string | null;
  donor_type: string | null;
}

interface DesignationForSync {
  fund_id: number;
  fund_name: string;
  amount: number;
  qbo_account_id: string | null;
  qbo_account_name: string | null;
}

/* ----------------------------------------------------------------- */
/*  Main sync function                                                */
/* ----------------------------------------------------------------- */

export async function syncDonationToQbo(donationId: number, userAccountId: number): Promise<SyncResult> {
  // Hard fail upfront if QBO isn't connected — caller should already check
  // but defensive guard means we never write a half-built sync log entry.
  const conn = await getActiveConnection();
  if (!conn) {
    return {
      status: 'failed', donation_id: donationId,
      error: 'No active QuickBooks connection',
      message: 'Connect QuickBooks in Settings before syncing donations.',
    };
  }

  // Load donation + donor.
  const don = await queryOne<DonationForSync>(`
    SELECT
      d.donation_id, d.donor_id, d.donation_date, d.total_value,
      d.receipt_number, d.external_transaction_id, d.description,
      d.qbo_current_sync_id,
      COALESCE(donor.donor_advised_fund_name,
               TRIM(CONCAT_WS(' ', c.first_name, c.last_name)),
               c.email) AS donor_display_name,
      c.first_name AS donor_first_name,
      c.last_name  AS donor_last_name,
      c.email      AS donor_email,
      donor.donor_advised_fund_name AS donor_company,
      dt.donor_type
    FROM tbl_donation d
    JOIN tbl_donor donor   ON donor.donor_id = d.donor_id
    JOIN tbl_contact c     ON c.contact_id  = donor.contact_id
    LEFT JOIN lkp_donor_type dt ON dt.donor_type_id = donor.donor_type_id
    WHERE d.donation_id = $1
  `, [donationId]);

  if (!don) {
    return { status: 'failed', donation_id: donationId, error: 'Donation not found', message: 'Donation not found' };
  }

  // If the donation already has a current sync_id pointing to a 'synced' row, refuse to re-sync.
  if (don.qbo_current_sync_id) {
    const cur = await queryOne<{ sync_status: string; qbo_sales_receipt_id: string }>(
      `SELECT sync_status, qbo_sales_receipt_id FROM tbl_quickbooks_donation_sync WHERE sync_id = $1`,
      [don.qbo_current_sync_id],
    );
    if (cur?.sync_status === 'synced') {
      await logSync(donationId, 'skipped', userAccountId, null, null, 'Already synced — re-sync skipped to prevent duplicate sales receipt in QuickBooks');
      return {
        status: 'skipped',
        donation_id: donationId,
        qbo_sales_receipt_id: cur.qbo_sales_receipt_id,
        message: 'Already synced to QuickBooks — to re-send, unlink the existing sales receipt first.',
      };
    }
  }

  // Load designations + their mappings.
  const desigs = await query<DesignationForSync>(`
    SELECT
      dd.fund_id,
      f.fund AS fund_name,
      dd.amount,
      m.qbo_account_id,
      m.qbo_account_name
    FROM tbl_donation_designation dd
    JOIN lkp_fund f ON f.fund_id = dd.fund_id
    LEFT JOIN tbl_quickbooks_account_mapping m ON m.fund_id = dd.fund_id
    WHERE dd.donation_id = $1
    ORDER BY dd.donation_designation_id
  `, [donationId]);

  if (desigs.length === 0) {
    return logAndReturn(donationId, userAccountId, 'failed',
      'Donation has no designations',
      'This donation has no fund designations. Add at least one designation (fund + amount) before syncing.');
  }

  const unmapped = desigs.filter(d => !d.qbo_account_id);
  if (unmapped.length > 0) {
    const names = unmapped.map(d => d.fund_name).join(', ');
    return logAndReturn(donationId, userAccountId, 'failed',
      `Unmapped funds: ${names}`,
      `These funds aren't mapped to QuickBooks accounts yet: ${names}. Map them in Settings → QuickBooks → Account mapping.`);
  }

  // Load deposit account from app settings.
  const depositSetting = await queryOne<{ setting_value: string }>(
    `SELECT setting_value FROM tbl_app_setting WHERE setting_key = 'qbo_default_deposit_account_id'`,
  );
  const depositAccountId = depositSetting?.setting_value?.trim();
  if (!depositAccountId) {
    return logAndReturn(donationId, userAccountId, 'failed',
      'No deposit account configured',
      'Pick a default deposit account in Settings → QuickBooks (the bank or "Undeposited Funds" where receipts land).');
  }

  // Ensure donor has a QBO customer link.
  let qboCustomerId: string;
  try {
    qboCustomerId = await ensureDonorLinked(don);
  } catch (err: any) {
    return logAndReturn(donationId, userAccountId, 'failed',
      err.message ?? 'Customer link failed',
      `Couldn't link donor to a QuickBooks customer: ${err.message ?? err}`);
  }

  // Build line items.
  const lines = desigs.map(d => ({
    amount: Number(d.amount),
    description: `${d.fund_name}${don.description ? ' — ' + don.description : ''}`,
    incomeAccountId: d.qbo_account_id!,
  }));

  // Create sales receipt.
  try {
    const sr = await createSalesReceipt({
      customerRef: qboCustomerId,
      txnDate: String(don.donation_date).slice(0, 10),
      depositAccountId,
      privateNote: `Furnish Hope donation #${don.donation_id}` + (don.receipt_number ? ` (receipt ${don.receipt_number})` : ''),
      customerMemo: don.description ?? undefined,
      paymentRefNumber: don.external_transaction_id ?? undefined,
      lines,
    });

    // Persist sync log + update donation pointer in one transaction.
    await withTransaction(async (tx) => {
      const syncRow = await tx.queryOne<{ sync_id: number }>(`
        INSERT INTO tbl_quickbooks_donation_sync
          (donation_id, qbo_sales_receipt_id, sync_status, synced_at, attempted_by_user_account_id, payload_summary)
        VALUES ($1, $2, 'synced', NOW(), $3, $4)
        RETURNING sync_id
      `, [
        donationId, sr.Id, userAccountId,
        `Sales Receipt ${sr.DocNumber ?? sr.Id} for $${sr.TotalAmt.toFixed(2)} across ${lines.length} line(s)`,
      ]);
      await tx.query(`
        UPDATE tbl_donation
           SET qbo_current_sync_id = $1,
               qbo_sync_status     = 'synced',
               qbo_synced_at       = NOW()
         WHERE donation_id = $2
      `, [syncRow!.sync_id, donationId]);
      await tx.query(`
        UPDATE tbl_quickbooks_connection SET last_sync_at = NOW() WHERE is_active = true
      `);
    });

    return {
      status: 'synced',
      donation_id: donationId,
      qbo_sales_receipt_id: sr.Id,
      message: `Synced to QuickBooks as Sales Receipt ${sr.DocNumber ?? sr.Id}`,
    };
  } catch (err: any) {
    const msg = err.message ?? String(err);
    return logAndReturn(donationId, userAccountId, 'failed', msg, `QuickBooks rejected the sales receipt: ${msg}`);
  }
}

/* ----------------------------------------------------------------- */
/*  Donor → QBO customer linking                                      */
/* ----------------------------------------------------------------- */

/**
 * Return a QBO customer Id for the donor, creating one if needed and
 * persisting the link in tbl_quickbooks_donor_link.
 *
 *   1. If a link already exists, return its qbo_customer_id.
 *   2. Otherwise try to find a customer in QBO with the same display name
 *      and reuse it (helps when the donor was already entered manually).
 *   3. Otherwise create a fresh customer and link.
 */
async function ensureDonorLinked(don: DonationForSync): Promise<string> {
  const existing = await queryOne<{ qbo_customer_id: string }>(
    `SELECT qbo_customer_id FROM tbl_quickbooks_donor_link WHERE donor_id = $1`,
    [don.donor_id],
  );
  if (existing) return existing.qbo_customer_id;

  const displayName = (don.donor_display_name || `Donor #${don.donor_id}`).trim();

  // Try to match an existing QBO customer by display name first.
  let qboCustomer = await findCustomerByName(displayName);
  if (!qboCustomer) {
    qboCustomer = await createCustomer({
      displayName,
      email: don.donor_email ?? undefined,
      givenName: don.donor_first_name ?? undefined,
      familyName: don.donor_last_name ?? undefined,
      companyName: don.donor_company ?? undefined,
    });
  }

  await query(`
    INSERT INTO tbl_quickbooks_donor_link (donor_id, qbo_customer_id, qbo_customer_display_name, last_synced_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (donor_id) DO UPDATE
      SET qbo_customer_id = EXCLUDED.qbo_customer_id,
          qbo_customer_display_name = EXCLUDED.qbo_customer_display_name,
          last_synced_at = NOW()
  `, [don.donor_id, qboCustomer.Id, qboCustomer.DisplayName]);

  return qboCustomer.Id;
}

/* ----------------------------------------------------------------- */
/*  Sync log helpers                                                  */
/* ----------------------------------------------------------------- */

async function logSync(
  donationId: number,
  status: 'synced' | 'failed' | 'skipped',
  userId: number,
  qboReceiptId: string | null,
  errorMsg: string | null,
  payloadSummary: string | null,
): Promise<number> {
  const r = await queryOne<{ sync_id: number }>(`
    INSERT INTO tbl_quickbooks_donation_sync
      (donation_id, qbo_sales_receipt_id, sync_status,
       synced_at, attempted_by_user_account_id, error_message, payload_summary)
    VALUES ($1, $2, $3, CASE WHEN $3 = 'synced' THEN NOW() END, $4, $5, $6)
    RETURNING sync_id
  `, [donationId, qboReceiptId, status, userId, errorMsg, payloadSummary]);
  // Update the denormalized status pointer (but don't touch qbo_current_sync_id for skipped — keep the prior successful link).
  if (status !== 'skipped') {
    await query(`
      UPDATE tbl_donation
         SET qbo_current_sync_id = $1, qbo_sync_status = $2
       WHERE donation_id = $3
    `, [r!.sync_id, status, donationId]);
  }
  return r!.sync_id;
}

async function logAndReturn(
  donationId: number,
  userId: number,
  status: 'failed',
  errorMsg: string,
  userMessage: string,
): Promise<SyncResult> {
  await logSync(donationId, status, userId, null, errorMsg, null);
  return { status, donation_id: donationId, error: errorMsg, message: userMessage };
}
