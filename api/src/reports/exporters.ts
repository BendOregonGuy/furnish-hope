/**
 * Format writers: turn an ExportBundle into a PDF / XLSX / DOCX buffer.
 * Each writer is self-contained; adding a new format is one more module
 * that consumes ExportBundle and emits a Buffer + mime type.
 */

import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import {
  Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell,
  WidthType, TextRun, AlignmentType, BorderStyle,
} from 'docx';
import type { ExportBundle, TableSection, KpiSection, Column } from './bundle.js';

export interface WrittenFile {
  buffer: Buffer;
  mime: string;
  ext: 'pdf' | 'xlsx' | 'docx';
}

/* ================================================================= */
/*  PDF                                                                */
/* ================================================================= */

export function toPdf(bundle: ExportBundle): Promise<WrittenFile> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), mime: 'application/pdf', ext: 'pdf' }));
    doc.on('error', reject);

    // Header
    doc.fontSize(20).fillColor('#1a1611').text(bundle.title, { align: 'left' });
    doc.moveDown(0.2).fontSize(11).fillColor('#6b6b6b').text(bundle.subtitle);
    doc.moveDown(0.5);

    if (bundle.headerMeta.length) {
      doc.fontSize(9).fillColor('#6b6b6b');
      const line = bundle.headerMeta.map(m => `${m.label}: ${m.value}`).join('   |   ');
      doc.text(line);
    }
    // Separator
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(562, doc.y).strokeColor('#d8d4cc').stroke();
    doc.moveDown(0.5);

    for (const section of bundle.sections) {
      renderSectionPdf(doc, section);
    }

    doc.end();
  });
}

function renderSectionPdf(doc: PDFKit.PDFDocument, section: TableSection | KpiSection) {
  if (doc.y > 700) doc.addPage();
  // Section heading
  doc.fontSize(13).fillColor('#1a1611').text(section.title, { continued: false });
  if (section.subtitle) {
    doc.fontSize(9).fillColor('#6b6b6b').text(section.subtitle);
  }
  doc.moveDown(0.3);

  if (section.kind === 'kpi') {
    // KPI: 3-per-row grid
    const cols = 3;
    const items = section.items;
    const w = (562 - 50) / cols;
    let startY = doc.y;
    items.forEach((it, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 50 + col * w;
      const y = startY + row * 40;
      doc.fontSize(14).fillColor('#C7704A').text(String(it.value), x, y, { width: w - 8 });
      doc.fontSize(8).fillColor('#6b6b6b').text(it.label.toUpperCase(), x, y + 18, { width: w - 8 });
    });
    doc.y = startY + Math.ceil(items.length / cols) * 40 + 10;
    return;
  }

  renderTablePdf(doc, section);
}

function renderTablePdf(doc: PDFKit.PDFDocument, section: TableSection) {
  const startX = 50;
  const width = 562 - startX;
  const cols = section.columns;
  const colWidth = width / cols.length;
  const rowHeight = 16;

  // Header row
  if (doc.y > 720) doc.addPage();
  doc.fontSize(9).fillColor('#1a1611');
  cols.forEach((c, i) => {
    doc.text(c.label, startX + i * colWidth, doc.y, {
      width: colWidth - 4,
      align: c.align ?? (isNumericColumn(c) ? 'right' : 'left'),
      continued: false,
    });
  });
  const headerY = doc.y;
  doc.moveTo(startX, headerY + 12).lineTo(startX + width, headerY + 12).strokeColor('#d8d4cc').stroke();
  doc.y = headerY + rowHeight;

  // Body
  const bodyRows: Array<Record<string, any>> = [...section.rows];
  if (section.totalRow) bodyRows.push({ __total: true, ...section.totalRow });
  for (const row of bodyRows) {
    if (doc.y > 740) {
      doc.addPage();
      // repeat header on new page
      cols.forEach((c, i) => {
        doc.fontSize(9).fillColor('#1a1611').text(c.label, startX + i * colWidth, doc.y, {
          width: colWidth - 4,
          align: c.align ?? (isNumericColumn(c) ? 'right' : 'left'),
        });
      });
      doc.y += rowHeight;
      doc.moveTo(startX, doc.y - 4).lineTo(startX + width, doc.y - 4).strokeColor('#d8d4cc').stroke();
    }
    const rowY = doc.y;
    cols.forEach((c, i) => {
      const raw = row[c.key];
      const formatted = formatCell(raw, c);
      doc.fontSize(9).fillColor(row.__total ? '#1a1611' : '#333')
        .text(formatted, startX + i * colWidth, rowY, {
          width: colWidth - 4,
          align: c.align ?? (isNumericColumn(c) ? 'right' : 'left'),
        });
    });
    doc.y = rowY + rowHeight;
    if (row.__total) {
      doc.moveTo(startX, rowY - 2).lineTo(startX + width, rowY - 2).strokeColor('#333').stroke();
    }
  }
  doc.moveDown(0.6);
}

/* ================================================================= */
/*  XLSX                                                               */
/* ================================================================= */

export async function toXlsx(bundle: ExportBundle): Promise<WrittenFile> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Furnish Hope';
  wb.created = new Date();

  // Summary sheet — header + KPIs + metadata
  const summary = wb.addWorksheet('Summary');
  summary.getColumn(1).width = 30;
  summary.getColumn(2).width = 24;
  summary.mergeCells('A1:C1');
  const titleCell = summary.getCell('A1');
  titleCell.value = bundle.title;
  titleCell.font = { name: 'Arial', size: 16, bold: true };
  summary.mergeCells('A2:C2');
  const subCell = summary.getCell('A2');
  subCell.value = bundle.subtitle;
  subCell.font = { name: 'Arial', size: 11, color: { argb: 'FF6B6B6B' } };

  let row = 4;
  for (const m of bundle.headerMeta) {
    summary.getCell(`A${row}`).value = m.label;
    summary.getCell(`A${row}`).font = { name: 'Arial', bold: true };
    summary.getCell(`B${row}`).value = m.value;
    row++;
  }
  row++;

  // KPIs on the summary sheet
  const kpiSections = bundle.sections.filter(s => s.kind === 'kpi') as KpiSection[];
  for (const k of kpiSections) {
    summary.getCell(`A${row}`).value = k.title;
    summary.getCell(`A${row}`).font = { name: 'Arial', size: 12, bold: true };
    row++;
    for (const it of k.items) {
      summary.getCell(`A${row}`).value = it.label;
      summary.getCell(`B${row}`).value = typeof it.value === 'number' ? it.value : String(it.value);
      summary.getCell(`B${row}`).alignment = { horizontal: 'right' };
      row++;
    }
    row++;
  }

  // One sheet per table section
  const tableSections = bundle.sections.filter(s => s.kind === 'table') as TableSection[];
  for (const s of tableSections) {
    const sheet = wb.addWorksheet(sanitizeSheetName(s.title));
    sheet.columns = s.columns.map(c => ({
      header: c.label,
      key: c.key,
      width: Math.max(14, c.label.length + 4),
      style: { alignment: { horizontal: c.align ?? (isNumericColumn(c) ? 'right' : 'left') } },
    }));
    sheet.getRow(1).font = { name: 'Arial', bold: true };
    for (const r of s.rows) {
      sheet.addRow(r);
    }
    if (s.totalRow) {
      const tr = sheet.addRow(s.totalRow);
      tr.font = { name: 'Arial', bold: true };
      tr.border = { top: { style: 'thin' } };
    }
    // Apply number/money formats
    s.columns.forEach((c, i) => {
      if (c.format === 'money') {
        sheet.getColumn(i + 1).numFmt = '"$"#,##0.00;("$"#,##0.00);"-"';
      } else if (c.format === 'number') {
        sheet.getColumn(i + 1).numFmt = '#,##0;(#,##0);"-"';
      }
    });
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return {
    buffer,
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ext: 'xlsx',
  };
}

/* ================================================================= */
/*  DOCX                                                               */
/* ================================================================= */

export async function toDocx(bundle: ExportBundle): Promise<WrittenFile> {
  const children: Paragraph[] | any[] = [];

  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text: bundle.title, bold: true, font: 'Arial', size: 40 })],
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: bundle.subtitle, font: 'Arial', size: 22, color: '6B6B6B' })],
    spacing: { after: 200 },
  }));

  if (bundle.headerMeta.length) {
    const line = bundle.headerMeta.map(m => `${m.label}: ${m.value}`).join('  |  ');
    children.push(new Paragraph({
      children: [new TextRun({ text: line, font: 'Arial', size: 18, color: '6B6B6B' })],
      spacing: { after: 200 },
    }));
  }

  for (const section of bundle.sections) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: section.title, bold: true, font: 'Arial', size: 26 })],
      spacing: { before: 300, after: 100 },
    }));
    if (section.subtitle) {
      children.push(new Paragraph({
        children: [new TextRun({ text: section.subtitle, font: 'Arial', size: 18, color: '6B6B6B', italics: true })],
        spacing: { after: 150 },
      }));
    }
    if (section.kind === 'kpi') {
      for (const it of section.items) {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: `${it.label}: `, font: 'Arial', size: 22 }),
            new TextRun({ text: String(it.value), font: 'Arial', size: 22, bold: true, color: 'C7704A' }),
          ],
        }));
      }
      continue;
    }
    children.push(buildDocxTable(section));
  }

  const doc = new Document({
    creator: 'Furnish Hope',
    title: bundle.title,
    sections: [{
      properties: {},
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  return {
    buffer,
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ext: 'docx',
  };
}

function buildDocxTable(section: TableSection): Table {
  const cols = section.columns;
  const headerRow = new TableRow({
    children: cols.map(c => new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text: c.label, bold: true, font: 'Arial', size: 20 })],
        alignment: c.align === 'right' ? AlignmentType.RIGHT : c.align === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
      })],
      shading: { fill: 'F5F0E8' },
    })),
  });

  const bodyRows = section.rows.map(r => new TableRow({
    children: cols.map(c => new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text: formatCell(r[c.key], c), font: 'Arial', size: 20 })],
        alignment: (c.align ?? (isNumericColumn(c) ? 'right' : 'left')) === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT,
      })],
    })),
  }));

  const rows = [headerRow, ...bodyRows];
  if (section.totalRow) {
    rows.push(new TableRow({
      children: cols.map(c => new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: formatCell(section.totalRow![c.key], c), bold: true, font: 'Arial', size: 20 })],
          alignment: (c.align ?? (isNumericColumn(c) ? 'right' : 'left')) === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT,
        })],
        borders: {
          top:    { style: BorderStyle.SINGLE, size: 6, color: '333333' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          left:   { style: BorderStyle.SINGLE, size: 2, color: 'EEEEEE' },
          right:  { style: BorderStyle.SINGLE, size: 2, color: 'EEEEEE' },
        },
      })),
    }));
  }

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

/* ================================================================= */
/*  Shared helpers                                                     */
/* ================================================================= */

function isNumericColumn(c: Column): boolean {
  return c.format === 'money' || c.format === 'number';
}

function formatCell(raw: string | number | null | undefined, c: Column): string {
  if (raw === null || raw === undefined || raw === '') return '';
  if (c.format === 'money') {
    const n = Number(raw);
    if (isNaN(n)) return String(raw);
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (c.format === 'number') {
    const n = Number(raw);
    if (isNaN(n)) return String(raw);
    return n.toLocaleString();
  }
  if (c.format === 'date') {
    const d = new Date(String(raw));
    if (isNaN(d.getTime())) return String(raw);
    return d.toISOString().slice(0, 10);
  }
  return String(raw);
}

function sanitizeSheetName(name: string): string {
  // Excel: max 31 chars, no []:*?/\
  return name.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31).trim() || 'Sheet';
}
