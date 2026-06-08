/**
 * Donation receipts — generate the PDF and email it to the donor.
 *
 *   GET    /api/receipts/donation/:id/pdf      stream the PDF (preview/download)
 *   POST   /api/receipts/donation/:id/send     email the donor via the user's
 *                                              connected email account, mark
 *                                              the donation acknowledged
 *   GET    /api/receipts/unsent                list donations missing an
 *                                              acknowledgement (for the batch
 *                                              acknowledgements page)
 *   POST   /api/receipts/send-batch            send receipts for a list of
 *                                              donation_ids
 *
 * Authoritative tax-language source: server-side, not the donor email —
 * means a copy of the IRS-required wording is preserved with every PDF
 * regardless of how the email renders.
 */

import { Router } from 'express';
import { query, queryOne } from '../db/pool.js';
import { generateReceiptPdf, type ReceiptData } from '../receipts/generate.js';
import { buildSmtpTransporter, type EmailAccountRow } from '../email/transports.js';
import { auditUpdate } from '../auth/audit.js';

export const receiptsRouter = Router();

/* ----------------------------------------------------------------- */
/*  Data loader                                                       */
/* ----------------------------------------------------------------- */

async function loadReceiptData(donationId: number): Promise<ReceiptData | null> {
  const donation = await queryOne<any>(`
    SELECT
      d.donation_id, d.donation_date, d.receipt_number,
      d.total_value, d.tax_deductible_amount, d.description,
      dt.donation_type,
      pm.payment_method,
      contact.first_name || ' ' || contact.last_name AS donor_name,
      contact.email AS donor_email,
      addr.address    AS donor_address,
      addr.address2   AS donor_address2,
      city.city       AS donor_city,
      st.state        AS donor_state,
      addr.postalcode AS donor_postalcode
    FROM tbl_donation d
    JOIN tbl_donor donor ON donor.donor_id = d.donor_id
    JOIN tbl_contact contact ON contact.contact_id = donor.contact_id
    JOIN lkp_donation_type dt ON dt.donation_type_id = d.donation_type_id
    LEFT JOIN lkp_payment_method pm ON pm.payment_method_id = d.payment_method_id
    LEFT JOIN tbl_address addr ON addr.address_id = donor.address_id
    LEFT JOIN lkp_city city ON city.city_id = addr.city_id
    LEFT JOIN lkp_state st ON st.state_id = addr.state_id
    WHERE d.donation_id = $1
  `, [donationId]);
  if (!donation) return null;

  const designations = await query<{ fund_name: string; amount: number | string }>(`
    SELECT f.fund_name, dd.amount
    FROM tbl_donation_designation dd
    JOIN lkp_fund f ON f.fund_id = dd.fund_id
    WHERE dd.donation_id = $1
    ORDER BY dd.donation_designation_id
  `, [donationId]);

  // Pull org settings.
  const rawSettings = await query<{ setting_key: string; setting_value: string }>(`
    SELECT setting_key, setting_value FROM tbl_app_setting
    WHERE setting_key IN (
      'org_name','org_address_line1','org_address_line2','org_city','org_state',
      'org_postalcode','org_phone','org_email','org_ein'
    )
  `);
  const s: Record<string, string> = {};
  for (const r of rawSettings) s[r.setting_key] = r.setting_value ?? '';

  return {
    org: {
      name:           s.org_name || 'Furnish Hope',
      address_line1:  s.org_address_line1 ?? '',
      address_line2:  s.org_address_line2 ?? '',
      city:           s.org_city ?? '',
      state:          s.org_state ?? '',
      postalcode:     s.org_postalcode ?? '',
      phone:          s.org_phone ?? '',
      email:          s.org_email ?? '',
      ein:            s.org_ein ?? '',
    },
    donor: {
      name:        donation.donor_name,
      address:     donation.donor_address,
      address2:    donation.donor_address2,
      city:        donation.donor_city,
      state:       donation.donor_state,
      postalcode:  donation.donor_postalcode,
    },
    donation: {
      donation_id:           donation.donation_id,
      donation_date:         String(donation.donation_date).slice(0, 10),
      receipt_number:        donation.receipt_number,
      total_value:           donation.total_value,
      tax_deductible_amount: donation.tax_deductible_amount,
      donation_type:         donation.donation_type,
      payment_method:        donation.payment_method,
      description:           donation.description,
    },
    designations,
  };
}

/* ----------------------------------------------------------------- */
/*  GET PDF (preview/download)                                        */
/* ----------------------------------------------------------------- */

receiptsRouter.get('/donation/:id/pdf', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const data = await loadReceiptData(id);
    if (!data) return res.status(404).json({ error: 'Donation not found' });

    const pdf = await generateReceiptPdf(data);
    const filename = `receipt-${data.donation.receipt_number ?? id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdf);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  POST send a single receipt                                        */
/* ----------------------------------------------------------------- */

interface SendReceiptResult {
  donation_id: number;
  status: 'sent' | 'skipped' | 'failed';
  message: string;
  recipient?: string;
  message_id?: string;
}

async function sendOne(donationId: number, userId: number, accountIdOverride?: number): Promise<SendReceiptResult> {
  const data = await loadReceiptData(donationId);
  if (!data) return { donation_id: donationId, status: 'failed', message: 'Donation not found' };

  // Need a donor email to send anywhere.
  const donorEmail = await queryOne<{ email: string | null }>(`
    SELECT c.email FROM tbl_donor d JOIN tbl_contact c ON c.contact_id = d.contact_id
    WHERE d.donor_id = (SELECT donor_id FROM tbl_donation WHERE donation_id = $1)
  `, [donationId]);
  if (!donorEmail?.email) {
    return { donation_id: donationId, status: 'skipped', message: 'Donor has no email address on file' };
  }

  // Find which connected email account to send from. Either explicit override
  // (user picked one) or the requester's default-send account, or any one
  // they have.
  let acct: EmailAccountRow | null = null;
  if (accountIdOverride) {
    acct = await queryOne<EmailAccountRow>(
      `SELECT * FROM tbl_email_account WHERE email_account_id = $1 AND user_account_id = $2`,
      [accountIdOverride, userId],
    );
  }
  if (!acct) {
    acct = await queryOne<EmailAccountRow>(`
      SELECT * FROM tbl_email_account
      WHERE user_account_id = $1
      ORDER BY is_default_send DESC, email_account_id ASC
      LIMIT 1
    `, [userId]);
  }
  if (!acct) {
    return {
      donation_id: donationId, status: 'failed',
      message: 'No email account connected. Connect one at Email → Accounts first.',
    };
  }

  // Generate PDF.
  const pdf = await generateReceiptPdf(data);
  const filename = `receipt-${data.donation.receipt_number ?? donationId}.pdf`;

  // Compose the email body — plain text + tasteful HTML.
  const orgName = data.org.name || 'Furnish Hope';
  const amt = Number(data.donation.total_value).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const dateLabel = data.donation.donation_date;
  const receiptRef = data.donation.receipt_number ?? `#${donationId}`;

  const subject = `Your donation receipt from ${orgName} — ${receiptRef}`;
  const plain = [
    `Hi ${data.donor.name},`,
    ``,
    `Thank you for your generous gift of ${amt} on ${dateLabel}.`,
    `Your tax-deductible donation receipt is attached as a PDF — please retain it for your records.`,
    ``,
    `No goods or services were provided in exchange for this contribution.`,
    ``,
    `With gratitude,`,
    `${orgName}`,
    data.org.ein ? `EIN: ${data.org.ein}` : '',
  ].filter(Boolean).join('\n');

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1611;max-width:560px;">
      <p>Hi ${escapeHtml(data.donor.name)},</p>
      <p>Thank you for your generous gift of <strong>${amt}</strong> on ${escapeHtml(dateLabel)}.</p>
      <p>Your tax-deductible donation receipt is attached as a PDF — please retain it for your records.</p>
      <p style="color:#666;font-size:13px;">No goods or services were provided in exchange for this contribution.</p>
      <p>With gratitude,<br/><strong>${escapeHtml(orgName)}</strong>
      ${data.org.ein ? `<br/><span style="color:#666;font-size:12px;">EIN: ${escapeHtml(data.org.ein)}</span>` : ''}
      </p>
    </div>`.trim();

  // Send.
  try {
    const transporter = await buildSmtpTransporter(acct);
    const info = await transporter.sendMail({
      from: acct.email_address,
      to: donorEmail.email,
      subject,
      text: plain,
      html,
      attachments: [{ filename, content: pdf, contentType: 'application/pdf' }],
    });

    // Mark donation acknowledged. Pull the "Sent" acknowledgement_status if
    // there is one; otherwise just stamp acknowledgement_sent_date.
    const sentStatus = await queryOne<{ acknowledgement_status_id: number }>(
      `SELECT acknowledgement_status_id FROM lkp_acknowledgement_status
       WHERE acknowledgement_status = 'Sent' LIMIT 1`,
    );
    const before = await queryOne(`SELECT * FROM tbl_donation WHERE donation_id = $1`, [donationId]);
    await query(`
      UPDATE tbl_donation
         SET acknowledgement_status_id = COALESCE($1, acknowledgement_status_id),
             acknowledgement_sent_date = CURRENT_DATE
       WHERE donation_id = $2
    `, [sentStatus?.acknowledgement_status_id ?? null, donationId]);
    const after = await queryOne(`SELECT * FROM tbl_donation WHERE donation_id = $1`, [donationId]);
    if (before && after) await auditUpdate({ user: { user_account_id: userId } } as any, 'tbl_donation', donationId, before, after);

    return {
      donation_id: donationId,
      status: 'sent',
      recipient: donorEmail.email,
      message_id: info.messageId,
      message: `Sent to ${donorEmail.email}`,
    };
  } catch (err: any) {
    return {
      donation_id: donationId,
      status: 'failed',
      message: shortErr(err),
    };
  }
}

receiptsRouter.post('/donation/:id/send', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const accountId = req.body?.email_account_id ? Number(req.body.email_account_id) : undefined;
    const result = await sendOne(id, req.user!.user_account_id, accountId);
    const code = result.status === 'sent' ? 200 : (result.status === 'skipped' ? 200 : 400);
    res.status(code).json(result);
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Batch — list unsent + send a list                                 */
/* ----------------------------------------------------------------- */

receiptsRouter.get('/unsent', async (req, res, next) => {
  try {
    const fromDate = (req.query.from as string | undefined) ?? null;
    const conds: string[] = ['d.acknowledgement_sent_date IS NULL'];
    const params: any[] = [];
    if (fromDate) { params.push(fromDate); conds.push(`d.donation_date >= $${params.length}::date`); }
    const where = `WHERE ${conds.join(' AND ')}`;

    const rows = await query(`
      SELECT
        d.donation_id, d.donation_date, d.total_value, d.receipt_number,
        contact.first_name || ' ' || contact.last_name AS donor_name,
        contact.email AS donor_email,
        dt.donation_type
      FROM tbl_donation d
      JOIN tbl_donor donor ON donor.donor_id = d.donor_id
      JOIN tbl_contact contact ON contact.contact_id = donor.contact_id
      JOIN lkp_donation_type dt ON dt.donation_type_id = d.donation_type_id
      ${where}
      ORDER BY d.donation_date DESC, d.donation_id DESC
      LIMIT 500
    `, params);
    res.json(rows);
  } catch (err) { next(err); }
});

receiptsRouter.post('/send-batch', async (req, res, next) => {
  try {
    const ids = req.body?.donation_ids as number[] | undefined;
    const accountId = req.body?.email_account_id ? Number(req.body.email_account_id) : undefined;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'donation_ids array is required' });
    }
    if (ids.length > 100) return res.status(400).json({ error: 'Max 100 receipts per batch' });

    const results: SendReceiptResult[] = [];
    for (const id of ids) {
      if (!Number.isInteger(id) || id <= 0) {
        results.push({ donation_id: id, status: 'failed', message: 'Invalid id' });
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      results.push(await sendOne(id, req.user!.user_account_id, accountId));
    }
    res.json({
      results,
      summary: {
        sent:    results.filter(r => r.status === 'sent').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        failed:  results.filter(r => r.status === 'failed').length,
      },
    });
  } catch (err) { next(err); }
});

/* ----------------------------------------------------------------- */
/*  Helpers                                                           */
/* ----------------------------------------------------------------- */

function shortErr(err: any): string {
  const m = (err?.message ?? String(err)).replace(/\s+/g, ' ').trim();
  return m.length > 280 ? m.slice(0, 277) + '…' : m;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
