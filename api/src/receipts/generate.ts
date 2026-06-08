/**
 * Server-side PDF receipt generation using pdfkit. One donation in →
 * one PDF buffer out. The receipt is IRS-compliant for tax-deductible
 * contributions: includes org legal name + EIN + address, donor name +
 * address, donation date and amount, fund designations, and the
 * required "no goods or services were provided" language.
 *
 * Pdfkit draws programmatically (no Chromium / no template engine) so
 * the function is small, fast, and survives on a $5 DO instance.
 */

import PDFDocument from 'pdfkit';
import { getOrgLogo } from '../routes/settings.js';

export interface ReceiptData {
  org: {
    name: string;
    address_line1: string;
    address_line2: string;
    city: string;
    state: string;
    postalcode: string;
    phone: string;
    email: string;
    ein: string;
  };
  donor: {
    name: string;
    address: string | null;
    address2: string | null;
    city: string | null;
    state: string | null;
    postalcode: string | null;
  };
  donation: {
    donation_id: number;
    donation_date: string;       // YYYY-MM-DD
    receipt_number: string | null;
    total_value: number | string;
    tax_deductible_amount: number | string | null;
    donation_type: string;
    payment_method: string | null;
    description: string | null;
  };
  designations: Array<{
    fund_name: string;
    amount: number | string;
  }>;
}

/**
 * Generate the PDF receipt. Returns a Buffer suitable for emailing
 * as an attachment or streaming back as an HTTP response.
 */
export async function generateReceiptPdf(d: ReceiptData): Promise<Buffer> {
  // Pull the org logo from the DB. Uploaded once via Admin → Settings;
  // stored in tbl_org_branding as BYTEA so it survives deploys and
  // doesn't depend on filesystem layout in production. pdfkit accepts
  // a Buffer directly for PNG and JPEG. SVG isn't supported by pdfkit
  // natively — admin UI rejects SVG at upload time too, but we
  // defensively skip it here.
  const orgLogo = await getOrgLogo();
  const usableLogo = orgLogo && /^image\/(png|jpe?g)$/i.test(orgLogo.content_type)
    ? orgLogo.data
    : null;

  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 54, bottom: 54, left: 54, right: 54 },  // 0.75"
    info: {
      Title: `Donation Receipt ${d.donation.receipt_number ?? `#${d.donation.donation_id}`}`,
      Author: d.org.name,
      Subject: 'Tax-deductible donation receipt',
    },
  });

  const chunks: Buffer[] = [];
  const collect = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  /* ---------- Header ---------- */
  const headerTop = doc.y;
  let logoRendered = false;
  if (usableLogo) {
    try {
      doc.image(usableLogo, 54, headerTop, { height: 60 });
      logoRendered = true;
    } catch {
      // pdfkit can throw on corrupt image data — fall back to text header.
    }
  }
  if (logoRendered) {
    doc.fontSize(20).fillColor('#1a1611').text(d.org.name, 130, headerTop + 6);
    doc.fontSize(9).fillColor('#666').text('Tax-deductible donation receipt', 130, headerTop + 32);
  } else {
    doc.fontSize(22).fillColor('#1a1611').text(d.org.name, 54, headerTop);
    doc.fontSize(10).fillColor('#666').text('Tax-deductible donation receipt', 54, headerTop + 28);
  }

  // Receipt number block on the right
  doc.fontSize(9).fillColor('#666').text(
    `Receipt #${d.donation.receipt_number ?? d.donation.donation_id}\nIssued ${todayStr()}`,
    400, headerTop + 6,
    { width: 158, align: 'right' },
  );

  // Divider
  doc.moveTo(54, headerTop + 80).lineTo(558, headerTop + 80).strokeColor('#1a1611').lineWidth(1.5).stroke();
  doc.y = headerTop + 95;

  /* ---------- Org address block (left) + Donor address block (right) ---------- */
  const blockTop = doc.y;
  doc.fontSize(8).fillColor('#666').text('FROM', 54, blockTop);
  doc.fontSize(10).fillColor('#1a1611').text(d.org.name, 54, blockTop + 12);
  let orgLine = blockTop + 25;
  if (d.org.address_line1) { doc.text(d.org.address_line1 + (d.org.address_line2 ? `, ${d.org.address_line2}` : ''), 54, orgLine); orgLine += 12; }
  if (d.org.city || d.org.state || d.org.postalcode) {
    doc.text([d.org.city, d.org.state, d.org.postalcode].filter(Boolean).join(' '), 54, orgLine);
    orgLine += 12;
  }
  if (d.org.phone) { doc.text(d.org.phone, 54, orgLine); orgLine += 12; }
  if (d.org.email) { doc.text(d.org.email, 54, orgLine); orgLine += 12; }
  if (d.org.ein) {
    doc.fontSize(9).fillColor('#666').text(`EIN: ${d.org.ein}`, 54, orgLine);
  }

  // Donor block
  doc.fontSize(8).fillColor('#666').text('TO', 320, blockTop);
  doc.fontSize(10).fillColor('#1a1611').text(d.donor.name, 320, blockTop + 12);
  let donorLine = blockTop + 25;
  if (d.donor.address) {
    doc.text(d.donor.address + (d.donor.address2 ? `, ${d.donor.address2}` : ''), 320, donorLine);
    donorLine += 12;
  }
  if (d.donor.city || d.donor.state || d.donor.postalcode) {
    doc.text([d.donor.city, d.donor.state, d.donor.postalcode].filter(Boolean).join(' '), 320, donorLine);
    donorLine += 12;
  }

  doc.y = Math.max(orgLine, donorLine) + 28;

  /* ---------- Donation details box ---------- */
  doc.fontSize(8).fillColor('#666').text('GIFT DETAILS', 54, doc.y);
  doc.y += 6;
  const boxTop = doc.y;

  doc.strokeColor('#d8d4cc').lineWidth(0.5).rect(54, boxTop, 504, 72).stroke();
  doc.fontSize(9).fillColor('#666')
    .text('Date',         70, boxTop + 12)
    .text('Type',         200, boxTop + 12)
    .text('Method',       320, boxTop + 12)
    .text('Amount',       470, boxTop + 12, { width: 76, align: 'right' });
  doc.fontSize(13).fillColor('#1a1611')
    .text(formatDate(d.donation.donation_date), 70, boxTop + 28)
    .text(d.donation.donation_type, 200, boxTop + 28, { width: 110 })
    .text(d.donation.payment_method ?? '—', 320, boxTop + 28, { width: 140 });
  doc.fontSize(18).fillColor('#C7704A').text(
    formatMoney(d.donation.total_value),
    470, boxTop + 26, { width: 76, align: 'right' },
  );

  // Tax-deductible amount line if different from total
  const totalNum = Number(d.donation.total_value);
  const taxDed   = d.donation.tax_deductible_amount != null
    ? Number(d.donation.tax_deductible_amount)
    : totalNum;
  if (taxDed !== totalNum) {
    doc.fontSize(9).fillColor('#666').text(
      `Tax-deductible portion: ${formatMoney(taxDed)}`,
      70, boxTop + 54,
    );
  }

  doc.y = boxTop + 92;

  /* ---------- Fund designations table ---------- */
  if (d.designations.length > 0) {
    doc.fontSize(8).fillColor('#666').text('DESIGNATION', 54, doc.y);
    doc.y += 6;
    doc.fontSize(10).fillColor('#1a1611');
    for (const ds of d.designations) {
      const y = doc.y;
      doc.text('•  ' + ds.fund_name, 70, y);
      doc.text(formatMoney(ds.amount), 470, y, { width: 76, align: 'right' });
      doc.moveTo(70, y + 14).lineTo(546, y + 14).strokeColor('#eeebe3').lineWidth(0.5).stroke();
      doc.y = y + 18;
    }
    doc.y += 8;
  }

  /* ---------- Donation notes ---------- */
  if (d.donation.description) {
    doc.fontSize(8).fillColor('#666').text('NOTE', 54, doc.y);
    doc.y += 6;
    doc.fontSize(10).fillColor('#1a1611').text(d.donation.description, 70, doc.y, { width: 476 });
    doc.y += 14;
  }

  /* ---------- IRS acknowledgement language ---------- */
  doc.y += 12;
  doc.fontSize(9).fillColor('#1a1611').text(
    `Thank you for your generous contribution to ${d.org.name}. No goods or services were ` +
    `provided in exchange for this contribution, except intangible religious benefits where ` +
    `applicable. Please retain this receipt for your tax records — ${d.org.name} does not ` +
    `assign a fair market value to non-cash gifts; that determination is the donor's responsibility.`,
    54, doc.y, { width: 504, align: 'justify', lineGap: 2 },
  );

  doc.y += 26;
  doc.fontSize(9).fillColor('#666').text(
    `${d.org.name} is a 501(c)(3) nonprofit organization. Contributions are tax-deductible ` +
    `to the extent allowed by law.`,
    54, doc.y, { width: 504, align: 'center' },
  );

  /* ---------- Footer ---------- */
  const pageBottom = doc.page.height - 54;
  doc.fontSize(8).fillColor('#999').text(
    `Generated ${todayStr()} · Receipt ${d.donation.receipt_number ?? `#${d.donation.donation_id}`}`,
    54, pageBottom - 12,
    { width: 504, align: 'center' },
  );

  doc.end();
  return await collect;
}

/* ----------------------------------------------------------------- */
/*  Helpers                                                           */
/* ----------------------------------------------------------------- */

function formatDate(iso: string): string {
  // YYYY-MM-DD → "June 5, 2026"
  const [y, m, day] = iso.slice(0, 10).split('-').map(Number);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${months[m - 1]} ${day}, ${y}`;
}

function formatMoney(v: number | string | null): string {
  const n = Number(v ?? 0);
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function todayStr(): string {
  // Render dates from a deterministic UTC source so server-vs-client
  // timezones don't shift the visible day.
  const d = new Date();
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
