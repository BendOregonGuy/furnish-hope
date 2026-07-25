/**
 * Generate the signed Client Waiver PDF. One signing → one PDF
 * buffer. Stored as an attachment on the provisioning request so
 * it's immutable, downloadable, and visible in the attachments
 * widget.
 *
 * Layout principles:
 *   - Org letterhead (logo + name + address + phone + email) up top
 *   - Title + subtitle, centered
 *   - Body parsed from the markdown template (## headings + paras)
 *   - Recipient identification block + body of the waiver
 *   - Signature block: typed legal name, embedded signature image,
 *     date, IP + user-agent fingerprint, witness
 *   - Footer with template version label so a future dispute can
 *     find the EXACT text the client agreed to
 *
 * Defensible signing record: the typed name is the legally
 * significant attestation; the drawn signature is visual evidence;
 * everything else is audit trail. Together this is stronger than a
 * CAPTCHA + scribble.
 */

import PDFDocument from 'pdfkit';
import { getOrgLogo } from '../routes/settings.js';

export interface WaiverPdfData {
  org: {
    name: string;
    address_line1: string;
    address_line2: string;
    city: string;
    state: string;
    postalcode: string;
    phone: string;
    email: string;
  };
  client: {
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    postalcode: string | null;
  };
  template: {
    title: string;
    subtitle: string | null;
    body_markdown: string;
    version_label: string | null;
  };
  signing: {
    typed_legal_name: string;
    signature_image_png: Buffer;  // raw PNG bytes
    signed_at: Date;
    ip_address: string | null;
    user_agent: string | null;
    witness_name: string;
  };
  request: {
    request_id: number;
    request_at: Date;
  };
}

export async function generateWaiverPdf(d: WaiverPdfData): Promise<Buffer> {
  const orgLogo = await getOrgLogo();
  const usableLogo = orgLogo && /^image\/(png|jpe?g)$/i.test(orgLogo.content_type)
    ? orgLogo.data
    : null;

  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 54, bottom: 54, left: 54, right: 54 },
    info: {
      Title: `Furniture Waiver — ${d.client.name}`,
      Author: d.org.name,
      Subject: 'Furniture Waiver — signed by recipient',
    },
  });

  const chunks: Buffer[] = [];
  const collect = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  /* ---------- Header (letterhead) ---------- */
  const headerTop = doc.y;
  let logoRendered = false;
  if (usableLogo) {
    try { doc.image(usableLogo, 54, headerTop, { height: 56 }); logoRendered = true; }
    catch { /* fall through */ }
  }

  // Right side: org address block
  const orgRightX = 320;
  doc.fontSize(11).fillColor('#1a1611').font('Helvetica-Bold').text(d.org.name, orgRightX, headerTop, { width: 240, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor('#666');
  let addrY = headerTop + 16;
  if (d.org.address_line1) {
    doc.text(d.org.address_line1 + (d.org.address_line2 ? `, ${d.org.address_line2}` : ''), orgRightX, addrY, { width: 240, align: 'right' });
    addrY += 11;
  }
  if (d.org.city || d.org.state || d.org.postalcode) {
    doc.text([d.org.city, d.org.state, d.org.postalcode].filter(Boolean).join(' '), orgRightX, addrY, { width: 240, align: 'right' });
    addrY += 11;
  }
  if (d.org.phone) { doc.text(d.org.phone, orgRightX, addrY, { width: 240, align: 'right' }); addrY += 11; }
  if (d.org.email) { doc.text(d.org.email, orgRightX, addrY, { width: 240, align: 'right' }); }

  doc.y = Math.max(headerTop + (logoRendered ? 64 : 60), addrY + 14);

  // Divider
  doc.moveTo(54, doc.y).lineTo(558, doc.y).strokeColor('#1a1611').lineWidth(1.5).stroke();
  doc.y += 18;

  /* ---------- Title + subtitle ---------- */
  doc.fontSize(20).fillColor('#1a1611').font('Helvetica-Bold').text(d.template.title.toUpperCase(), 54, doc.y, { width: 504, align: 'center' });
  doc.y += 6;
  if (d.template.subtitle) {
    doc.fontSize(10).fillColor('#666').font('Helvetica-Oblique').text(d.template.subtitle, 54, doc.y, { width: 504, align: 'center' });
    doc.y += 4;
  }
  doc.y += 14;

  /* ---------- Recipient identification ---------- */
  doc.font('Helvetica').fontSize(8).fillColor('#666').text('RECIPIENT', 54, doc.y);
  doc.y += 4;
  doc.fontSize(11).fillColor('#1a1611').font('Helvetica-Bold').text(d.client.name, 54, doc.y);
  doc.y += 14;
  if (d.client.address) {
    doc.font('Helvetica').fontSize(10).fillColor('#1a1611').text(
      [d.client.address, [d.client.city, d.client.state, d.client.postalcode].filter(Boolean).join(' ')].filter(Boolean).join(', '),
      54, doc.y,
    );
    doc.y += 12;
  }
  doc.fontSize(9).fillColor('#666').text(`Packing List #${d.request.request_id} · Opened ${formatDate(d.request.request_at)}`, 54, doc.y);
  doc.y += 22;

  /* ---------- Body (parsed from markdown template) ---------- */
  renderMarkdownBody(doc, d.template.body_markdown);

  /* ---------- Signature block ---------- */
  doc.y += 20;
  doc.moveTo(54, doc.y).lineTo(558, doc.y).strokeColor('#d8d4cc').lineWidth(0.5).stroke();
  doc.y += 14;

  doc.fontSize(10).fillColor('#1a1611').font('Helvetica-Bold').text('SIGNED BY RECIPIENT', 54, doc.y);
  doc.y += 14;

  // Two-column: typed name + signed_at on left; embedded signature image on right
  const sigBlockTop = doc.y;

  doc.font('Helvetica').fontSize(9).fillColor('#666').text('Printed name', 54, sigBlockTop);
  doc.fontSize(13).fillColor('#1a1611').font('Helvetica-Bold').text(d.signing.typed_legal_name, 54, sigBlockTop + 12);

  doc.font('Helvetica').fontSize(9).fillColor('#666').text('Date signed', 54, sigBlockTop + 44);
  doc.fontSize(11).fillColor('#1a1611').text(formatDateTime(d.signing.signed_at), 54, sigBlockTop + 56);

  // Signature image — bounded to fit a reasonable signature line.
  const sigBoxX = 320;
  const sigBoxY = sigBlockTop;
  const sigBoxW = 220;
  const sigBoxH = 70;
  doc.font('Helvetica').fontSize(9).fillColor('#666').text('Signature', sigBoxX, sigBoxY);
  try {
    doc.image(d.signing.signature_image_png, sigBoxX, sigBoxY + 12, { fit: [sigBoxW, sigBoxH] });
  } catch {
    doc.fontSize(10).fillColor('#a00').text('(signature image failed to render)', sigBoxX, sigBoxY + 12);
  }
  doc.moveTo(sigBoxX, sigBoxY + 12 + sigBoxH).lineTo(sigBoxX + sigBoxW, sigBoxY + 12 + sigBoxH).strokeColor('#1a1611').lineWidth(0.5).stroke();

  doc.y = sigBlockTop + 90;

  /* ---------- Witness + audit trail ---------- */
  doc.fontSize(9).fillColor('#666').text(
    `Witnessed by ${d.signing.witness_name} (Furnish Hope staff).`,
    54, doc.y,
    { width: 504 },
  );
  doc.y += 14;

  // Audit trail in tiny print — present but not loud.
  const audit: string[] = [];
  if (d.signing.ip_address) audit.push(`IP ${d.signing.ip_address}`);
  if (d.signing.user_agent) audit.push(`UA ${d.signing.user_agent.slice(0, 80)}${d.signing.user_agent.length > 80 ? '…' : ''}`);
  audit.push(`Server timestamp ${d.signing.signed_at.toISOString()}`);
  doc.fontSize(7).fillColor('#999').text(audit.join(' · '), 54, doc.y, { width: 504 });

  /* ---------- Footer ---------- */
  const pageBottom = doc.page.height - 54;
  doc.fontSize(7).fillColor('#999').text(
    `${d.org.name} · Furniture Waiver ${d.template.version_label ?? ''} · Request #${d.request.request_id} · Generated ${formatDate(new Date())}`,
    54, pageBottom - 8,
    { width: 504, align: 'center' },
  );

  doc.end();
  return await collect;
}

/** Render the markdown body — supports ## headings and blank-line
 *  paragraph breaks. Keeps the formatter dumb on purpose; if we ever
 *  need richer markup the template body becomes structured JSON. */
function renderMarkdownBody(doc: PDFKit.PDFDocument, body: string) {
  const blocks = body.split(/\n\n+/);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('## ')) {
      doc.y += 4;
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#9C3A1F').text(trimmed.slice(3).trim(), 54, doc.y, { width: 504 });
      doc.y += 4;
    } else {
      doc.font('Helvetica').fontSize(10).fillColor('#1a1611').text(trimmed, 54, doc.y, { width: 504, align: 'justify', lineGap: 2 });
      doc.y += 6;
    }
  }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateTime(d: Date): string {
  return d.toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}
