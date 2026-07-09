/**
 * billingReportPdf.ts
 * -----------------------------------------------------------------------------
 * Generates the "Behavioral Health Billing Report" PDF (navy/teal, Arial/Helvetica)
 * for a single-EFT Medicaid billing workbook whose primary sheet contains several
 * stacked sections:
 *
 *   REMITTANCE INFORMATION  (EFT #, remit date, EFT date, net earnings)
 *   MEMBER MEDICAID Paid Summary  ->  paid claims detail table
 *   ISSUE/NOT BILLED             ->  pending claims table (no paid amount)
 *   SERVICES SUMMARY             ->  per-code paid counts (Medicare / Medicaid)
 *
 * Stack: jspdf ^4 + jspdf-autotable ^5 + xlsx ^0.18 (already in package.json).
 *
 * Browser:  const doc = generateBillingReportPDF(report, opts); doc.save('name.pdf');
 * Server:   const buf = getBillingReportPDFBuffer(report, opts); // Node Buffer
 * -----------------------------------------------------------------------------
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

/* ============================== Data contract ============================== */

export interface ClaimLine {
  provider: string;
  client: string;
  dos: string;          // MM/DD/YYYY
  time: string;
  code: string;
  description: string;
  unit: number;
  billed: number;
  paid: number | null;  // null => not paid (pending)
  status: string;       // '', 'Adjustment from previous billed', 'Pending', ...
  comments: string;     // payer remarks, denial reasons, etc.
}

export interface ServiceSummaryRow {
  code: string;
  medicare: number;
  medicaid: number;
}

export interface BillingReport {
  eftNumber: string;
  remitDate: string;    // MM/DD/YYYY
  eftDate: string;      // MM/DD/YYYY
  netEarnings: number;
  paid: ClaimLine[];
  notBilled: ClaimLine[];
  summary: ServiceSummaryRow[];
  summaryTotal: number;
}

export interface BillingOptions {
  period?: string;      // "06/23/2026 – 06/26/2026" (Billed On range)
  payer?: string;       // "Nevada Medicaid"
  billerName?: string;  // "Jasmin Angela Velasco, CPB"
  preparedFor?: string; // optional
  generatedOn?: string; // defaults to today
  fileName?: string;
}

/* ============================== Configuration ============================= */

/**
 * Set to true to show the Services Summary section (paid claim counts by code).
 * Set to false to hide it (since By Service Code section already shows this data).
 */
export const SHOW_SERVICES_SUMMARY = false;

/* ================================ Palette ================================= */

const C = {
  navy:      [20, 49, 79] as [number, number, number],
  teal:      [46, 139, 139] as [number, number, number],
  tealDark:  [20, 96, 96] as [number, number, number],
  tealLabel: [33, 128, 128] as [number, number, number],
  band:      [238, 244, 244] as [number, number, number],
  ink:       [27, 42, 58] as [number, number, number],
  muted:     [125, 142, 160] as [number, number, number],
  label:     [130, 152, 170] as [number, number, number],
  zebra:     [247, 250, 252] as [number, number, number],
  border:    [226, 233, 240] as [number, number, number],
  amber:     [154, 106, 0] as [number, number, number],
  amberFlag: [192, 138, 42] as [number, number, number],
  pendingBg: [253, 244, 236] as [number, number, number],
  white:     [255, 255, 255] as [number, number, number],
};

const CODE_LABEL: Record<string, string> = {
  H0002: 'Alcohol / Drug Screening',
  H0004: 'Alcohol / Drug Services',
  H0031: 'MH Health Assessment (non-MD)',
  H2014: 'Skills Training & Development (BST)',
  H2017: 'Psychosocial Rehab Service (PSR)',
  '90837': 'Psychotherapy, 60 min',
  '90839': 'Psychotherapy Crisis, 60 min',
  '90876': 'Biofeedback w/ Psychotherapy',
  '90853': 'Group Psychotherapy',
  '90791': 'Psychiatric Diagnostic Eval',
};

/* ================================ Helpers ================================= */

const money = (v: number | null) =>
  '$' + (v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const titleCase = (s: string) =>
  s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

/* ============================ Workbook parser ============================= */
/**
 * Parses the billing workbook's primary sheet (default "Sheet1") into a
 * BillingReport. Robust to the row offsets of each section by scanning for the
 * section marker text rather than hard-coding row numbers.
 *
 * Accepts an ArrayBuffer (browser File) or Uint8Array/Buffer (Node).
 */
export function parseBillingWorkbook(
  data: ArrayBuffer | Uint8Array,
  sheetName?: string,
): BillingReport {
  const wb = XLSX.read(data, { type: 'array', cellDates: true });
  const name = sheetName ?? wb.SheetNames[0];
  const ws = wb.Sheets[name];
  const grid: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null });

  const cell = (r: number, c: number) => grid[r]?.[c];
  const str = (v: unknown) => (v == null ? '' : String(v).trim());
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  };
  const asDate = (v: unknown): string => {
    if (v instanceof Date) {
      const mm = String(v.getMonth() + 1).padStart(2, '0');
      const dd = String(v.getDate()).padStart(2, '0');
      return `${mm}/${dd}/${v.getFullYear()}`;
    }
    const s = str(v);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[2]}/${m[3]}/${m[1]}` : s;
  };

  // ---- locate rows by first-column marker ----
  const findRow = (pred: (c0: string, row: unknown[]) => boolean) =>
    grid.findIndex((row) => pred(str(row?.[0]), row));

  const metaLabel = (label: string): unknown => {
    const i = findRow((c0) => c0.toLowerCase().startsWith(label.toLowerCase()));
    return i >= 0 ? cell(i, 1) : null;
  };

  const meta = {
    eftNumber: str(metaLabel('Remittance EFT Number')),
    remitDate: asDate(metaLabel('Remittance Date')),
    eftDate: asDate(metaLabel('Remittance EFT Date')),
    netEarnings: num(metaLabel('NET EARNINGS')) || 0,
  };

  // detail header row(s): col0 === 'Payer' && col1 === 'Provider Rendering'
  const headerRows: number[] = [];
  grid.forEach((row, i) => {
    if (str(row?.[0]) === 'Payer' && str(row?.[1]) === 'Provider Rendering') headerRows.push(i);
  });
  const issueRow = findRow((c0) => c0 === 'ISSUE/NOT BILLED');
  const summaryRow = findRow((c0) => c0 === 'SERVICES SUMMARY');
  const svcCodeRow = findRow((c0) => c0 === 'Service Code');
  const totalRow = findRow((c0) => c0 === 'TOTAL');

  const readClaims = (headerIdx: number, endExclusive: number): ClaimLine[] => {
    const cols = grid[headerIdx].map((c) => str(c));
    const ix = (label: string) => cols.indexOf(label);
    const idx = {
      provider: ix('Provider Rendering'), client: ix('Client Name'), dos: ix('DOS'),
      time: ix('Time'), code: ix('Code'), desc: ix('Description'), unit: ix('Unit'),
      billed: ix('Billed Amount'), paid: ix('Paid Amount'),
      status: ix('Claim Status'), comments: ix('COMMENTS'),
    };
    const out: ClaimLine[] = [];
    for (let r = headerIdx + 1; r < endExclusive; r++) {
      const row = grid[r];
      if (str(row?.[0]) !== 'Medicaid') continue; // skip totals / blanks / section markers
      const paidRaw = row?.[idx.paid];
      out.push({
        provider: titleCase(str(row?.[idx.provider])),
        client: str(row?.[idx.client]),
        dos: asDate(row?.[idx.dos]),
        time: str(row?.[idx.time]),
        code: str(row?.[idx.code]),
        description: titleCase(str(row?.[idx.desc])),
        unit: num(row?.[idx.unit]) || 0,
        billed: num(row?.[idx.billed]) || 0,
        paid: paidRaw == null || paidRaw === '' ? null : num(paidRaw),
        status: str(row?.[idx.status]),
        comments: str(row?.[idx.comments]),
      });
    }
    return out;
  };

  const paidEnd = issueRow >= 0 ? issueRow : headerRows[1] ?? grid.length;
  const paid = headerRows.length ? readClaims(headerRows[0], paidEnd) : [];

  const notBilledHeader = headerRows.find((h) => issueRow >= 0 && h > issueRow) ?? -1;
  const notBilledEnd = summaryRow >= 0 ? summaryRow : grid.length;
  const notBilled = notBilledHeader >= 0 ? readClaims(notBilledHeader, notBilledEnd) : [];

  const summary: ServiceSummaryRow[] = [];
  let summaryTotal = 0;
  if (svcCodeRow >= 0) {
    const end = totalRow > svcCodeRow ? totalRow : grid.length;
    for (let r = svcCodeRow + 1; r < end; r++) {
      const code = str(cell(r, 0));
      if (!code) continue;
      summary.push({ code, medicare: num(cell(r, 1)) || 0, medicaid: num(cell(r, 2)) || 0 });
    }
    if (totalRow >= 0) summaryTotal = num(cell(totalRow, 2)) || 0;
  }

  return { ...meta, paid, notBilled, summary, summaryTotal };
}

/* ============================ PDF generation ============================== */

const PAGE = { w: 792, h: 612 };
const M = { top: 40, left: 36, right: 36, bottom: 42 };
const CONTENT_W = PAGE.w - M.left - M.right;

export function generateBillingReportPDF(report: BillingReport, opts: BillingOptions = {}): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });

  const period = opts.period ?? '';
  const payer = opts.payer ?? 'Medicaid';
  const generatedOn =
    opts.generatedOn ??
    new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' });

  const paidLines = report.paid;
  const totalPaid = paidLines.reduce((a, r) => a + (r.paid || 0), 0);
  const billedPaid = paidLines.reduce((a, r) => a + (r.billed || 0), 0);
  const totalUnits = paidLines.reduce((a, r) => a + (r.unit || 0), 0);
  const nbBilled = report.notBilled.reduce((a, r) => a + (r.billed || 0), 0);
  const nbUnits = report.notBilled.reduce((a, r) => a + (r.unit || 0), 0);
  const totalBilled = billedPaid + nbBilled;
  const clients = new Set(paidLines.filter((r) => r.client).map((r) => r.client));

  const prov = new Map<string, { lines: number; paid: number }>();
  const code = new Map<string, { lines: number; units: number; paid: number }>();
  for (const r of paidLines) {
    const p = prov.get(r.provider) ?? { lines: 0, paid: 0 };
    p.lines++; p.paid += r.paid || 0; prov.set(r.provider, p);
    const c = code.get(r.code) ?? { lines: 0, units: 0, paid: 0 };
    c.lines++; c.units += r.unit; c.paid += r.paid || 0; code.set(r.code, c);
  }

  /* ----------------------------- Page 1: summary --------------------------- */
  drawCover(doc, { period, payer, eft: report.eftNumber, generatedOn, preparedFor: opts.preparedFor, billerName: opts.billerName });
  let y = M.top + 95 + 20;
  y = drawKpis(doc, y, [
    { label: 'Net Earnings (Paid)', value: money(totalPaid), foot: `${paidLines.length} paid claim lines`, tone: 'teal' },
    { label: 'Not Billed (Pending)', value: money(nbBilled), foot: `${report.notBilled.length} lines under review`, tone: 'amber' },
    { label: 'Providers / Clients', value: `${prov.size} / ${clients.size}`, foot: 'rendering · served' },
  ]);

  y = sectionTitle(doc, y + 12, 'Remittance Information');
  y = drawInfoCard(doc, y + 6, [
    { k: 'Remittance EFT Number', v: report.eftNumber },
    { k: 'Remittance Date', v: report.remitDate },
    { k: 'EFT Deposit Date', v: report.eftDate },
    { k: 'Net Earnings', v: money(report.netEarnings), accent: true },
  ]);

  // Provider & Code breakdowns side by side
  const half = (CONTENT_W - 20) / 2;
  y += 10;
  const topY = sectionTitle(doc, y, 'By Rendering Provider', M.left);
  sectionTitle(doc, y, 'By Service Code (Paid)', M.left + half + 20);
  autoTable(doc, {
    startY: topY + 6, margin: M, tableWidth: half, theme: 'plain',
    styles: baseCellStyle(), headStyles: headStyle(),
    head: [['Provider', '# Claims', 'Paid']],
    body: [...prov.entries()].sort().map(([n, v]) => [n, String(v.lines), money(v.paid)]),
    columnStyles: {},
    didParseCell: zebra,
  });
  const provEndY = finalY(doc);
  autoTable(doc, {
    startY: topY + 6, margin: { ...M, left: M.left + half + 20 }, tableWidth: half, theme: 'plain',
    styles: baseCellStyle(), headStyles: headStyle(),
    head: [['Code', 'Description', '# Claims', 'Units', 'Paid']],
    body: [...code.entries()].sort().map(([c, v]) => [
      c, CODE_LABEL[c] ?? '', String(v.lines), String(v.units), money(v.paid),
    ]),
    columnStyles: {
      0: { font: 'courier', cellWidth: 42 },
    },
    didParseCell: zebra,
  });
  y = Math.max(provEndY, finalY(doc)) + 18;

  // Services summary (paid counts) — own page for a clean full-width table
  if (SHOW_SERVICES_SUMMARY) {
    doc.addPage();
    y = sectionTitle(doc, M.top, 'Services Summary — Paid Claim Counts');
    const summaryBody: any[] = report.summary
      .filter((s) => s.medicaid !== 0 || s.medicare !== 0)
      .map((s) => [s.code, CODE_LABEL[s.code] ?? '', String(s.medicare), String(s.medicaid)]);
    summaryBody.push([{ content: 'TOTAL PAID CLAIMS', colSpan: 2 }, '0', String(report.summaryTotal)]);
    autoTable(doc, {
      startY: y, margin: M, theme: 'plain',
      styles: baseCellStyle(), headStyles: headStyle(),
      head: [['Code', 'Description', 'Medicare Paid', 'Medicaid Paid']],
      body: summaryBody,
      columnStyles: { 0: { font: 'courier', cellWidth: 60 } },
      didParseCell: (d) => {
        zebra(d);
        if (d.section === 'body' && d.row.index === summaryBody.length - 1) {
          d.cell.styles.fillColor = [234, 242, 242];
          d.cell.styles.textColor = C.navy;
          d.cell.styles.fontStyle = 'bold';
          d.cell.styles.font = 'helvetica';
        }
      },
    });
  }

  /* ------------------------- Page 2+: paid claims -------------------------- */
  doc.addPage();
  sectionTitle(doc, M.top, 'Paid Claims Detail');
  const afterBand = drawReportHeader(doc, M.top + 22, report, totalPaid);

  const paidBody = paidLines.map((r) => {
    let status = '';
    if (/^adjust/i.test(r.status)) {
      status = 'ADJUSTMENT';
    } else if (!r.status || r.status.trim() === '') {
      status = 'PAID';
    } else {
      status = r.status;
    }
    return [
      r.client, r.provider, r.dos, r.time, r.code, String(r.unit),
      money(r.billed), money(r.paid), status,
    ];
  });
  paidBody.push([
    `Subtotal — ${paidLines.length} paid lines`, '', '', '', '', String(totalUnits),
    money(billedPaid), money(totalPaid), '',
  ]);

  autoTable(doc, {
    startY: afterBand, margin: { ...M, top: M.top }, theme: 'plain',
    styles: baseCellStyle(), headStyles: headStyle(),
    head: [['Client', 'Provider', 'Date of Service', 'Time', 'Code', 'Units', 'Billed', 'Paid', 'Status']],
    body: paidBody,
    columnStyles: {
      4: { font: 'courier' },
    },
    didParseCell: (d) => {
      zebra(d);
      const last = d.row.index === paidLines.length;
      if (d.section === 'body' && last) {
        d.cell.styles.fillColor = [240, 245, 245];
        d.cell.styles.textColor = C.navy;
        d.cell.styles.fontStyle = 'bold';
      } else if (d.section === 'body' && d.column.index === 8 && d.cell.raw === 'ADJUSTMENT') {
        d.cell.styles.textColor = C.amber;
        d.cell.styles.fontStyle = 'bold';
        d.cell.styles.fontSize = 6.8;
      }
    },
  });

  /* ---------------------- Page: issue / not billed ------------------------- */
  doc.addPage();
  sectionTitle(doc, M.top, 'Issue / Not Billed — Pending Review');
  const nbBody = report.notBilled.map((r) => {
    // Combine claim status and comments for pending claims
    const statusParts: string[] = [];
    if (r.status && r.status.trim()) {
      statusParts.push(r.status.trim());
    }
    if (r.comments && r.comments.trim()) {
      statusParts.push(r.comments.trim());
    }
    const combinedStatus = statusParts.length > 0 ? statusParts.join(' - ') : 'PENDING';

    return [
      r.client, r.provider, r.dos, r.time, r.code, String(r.unit), money(r.billed), combinedStatus,
    ];
  });
  nbBody.push([`Subtotal — ${report.notBilled.length} pending lines`, '', '', '', '', String(nbUnits), money(nbBilled), '']);

  autoTable(doc, {
    startY: M.top + 12, margin: M, theme: 'plain',
    styles: baseCellStyle(), headStyles: headStyle(),
    head: [['Client', 'Provider', 'Date of Service', 'Time', 'Code', 'Units', 'Billed', 'Status']],
    body: nbBody,
    columnStyles: {
      4: { font: 'courier' },
    },
    didParseCell: (d) => {
      const last = d.row.index === report.notBilled.length;
      if (d.section === 'body' && last) {
        d.cell.styles.fillColor = [240, 245, 245];
        d.cell.styles.textColor = C.navy;
        d.cell.styles.fontStyle = 'bold';
      } else if (d.section === 'body' && !last) {
        d.cell.styles.fillColor = C.pendingBg;
        if (d.column.index === 7) {
          d.cell.styles.textColor = C.amberFlag;
          d.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // reconciliation note
  const ry = finalY(doc) + 10;
  doc.setFillColor(...C.zebra).setDrawColor(...C.border).roundedRect(M.left, ry, CONTENT_W, 30, 6, 6, 'FD');
  doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...C.navy);
  doc.text('Reconciliation:', M.left + 14, ry + 18);
  const rw = doc.getTextWidth('Reconciliation:');
  doc.setFont('helvetica', 'normal').setTextColor(61, 85, 104);
  doc.text(
    ` Total billed ${money(totalBilled)} = Paid ${money(totalPaid)} (net earnings) + Pending ${money(nbBilled)}` +
      ` (${report.notBilled.length} lines held for review, not yet remitted).`,
    M.left + 14 + rw + 2, ry + 18,
  );

  /* -------------------------------- Footers -------------------------------- */
  const label = `Behavioral Health Billing Report${period ? '  ·  Billed On ' + period : ''}`;
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...C.muted);
    doc.text(label, M.left, PAGE.h - 18);
    doc.text(`Page ${p} of ${pages}`, PAGE.w - M.right, PAGE.h - 18, { align: 'right' });
  }

  return doc;
}

/** Convenience: return a Node Buffer (server-side use). */
export function getBillingReportPDFBuffer(report: BillingReport, opts?: BillingOptions): Buffer {
  return Buffer.from(generateBillingReportPDF(report, opts).output('arraybuffer'));
}

/* ============================ Drawing primitives ========================== */

function drawCover(
  doc: jsPDF,
  o: { period: string; payer: string; eft: string; generatedOn: string; preparedFor?: string; billerName?: string },
) {
  const x = M.left, y = M.top, w = CONTENT_W, h = 95;
  doc.setFillColor(...C.navy).roundedRect(x, y, w, h, 10, 10, 'F');
  doc.setFillColor(...C.teal).setGState(new (doc as any).GState({ opacity: 0.18 }));
  doc.roundedRect(x + w * 0.62, y, w * 0.38, h, 10, 10, 'F');
  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  doc.setTextColor(169, 214, 214).setFont('helvetica', 'bold').setFontSize(8.5);
  doc.text('BEHAVIORAL HEALTH · BILLING REPORT', x + 22, y + 26, { charSpace: 2 });
  doc.setTextColor(...C.white).setFontSize(22);
  doc.text('Medicaid Claims & Remittance', x + 22, y + 50);
  doc.setFont('helvetica', 'normal').setFontSize(10.5).setTextColor(215, 228, 239);
  doc.text(o.period ? `Billed On · ${o.period}` : 'Billing Report', x + 22, y + 68);
  doc.setFontSize(9).setTextColor(207, 224, 238);
  const prep = o.preparedFor ? `Prepared for ${o.preparedFor}   ·   ` : '';
  const biller = o.billerName ? `Biller: ${o.billerName}   ·   ` : '';
  doc.text(`${prep}${biller}Payer: ${o.payer}   ·   Remittance EFT #${o.eft}   ·   Generated ${o.generatedOn}`, x + 22, y + 84);
}

function drawKpis(
  doc: jsPDF, y: number,
  cards: { label: string; value: string; foot: string; tone?: 'teal' | 'amber' }[],
): number {
  const gap = 14;
  const w = (CONTENT_W - gap * (cards.length - 1)) / cards.length;
  const h = 64;
  cards.forEach((c, i) => {
    const x = M.left + i * (w + gap);
    doc.setDrawColor(...C.border).setFillColor(...C.white).roundedRect(x, y, w, h, 6, 6, 'FD');
    doc.setFillColor(...C.teal).rect(x, y, w, 3, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(7.8).setTextColor(...C.muted);
    doc.text(c.label.toUpperCase(), x + 12, y + 18, { charSpace: 0.5 });
    const col = c.tone === 'teal' ? C.tealDark : c.tone === 'amber' ? C.amber : C.navy;
    doc.setFontSize(19).setTextColor(...col);
    doc.text(c.value, x + 12, y + 40);
    doc.setFont('helvetica', 'normal').setFontSize(7.8).setTextColor(...C.muted);
    doc.text(c.foot, x + 12, y + 54);
  });
  return y + h;
}

function drawInfoCard(
  doc: jsPDF, y: number,
  cells: { k: string; v: string; accent?: boolean }[],
): number {
  const h = 46;
  const w = CONTENT_W / cells.length;
  doc.setDrawColor(...C.border).setFillColor(...C.white).roundedRect(M.left, y, CONTENT_W, h, 8, 8, 'FD');
  cells.forEach((c, i) => {
    const x = M.left + i * w;
    if (c.accent) { doc.setFillColor(...C.band); doc.rect(x, y + 1, w - 1, h - 2, 'F'); }
    if (i > 0) doc.setDrawColor(...[238, 242, 246] as [number, number, number]).line(x, y + 8, x, y + h - 8);
    doc.setFont('helvetica', 'bold').setFontSize(7.2).setTextColor(...C.label);
    doc.text(c.k.toUpperCase(), x + 16, y + 18, { charSpace: 0.6 });
    doc.setFontSize(12).setTextColor(...(c.accent ? C.tealDark : C.navy));
    doc.text(c.v, x + 16, y + 36);
  });
  return y + h;
}

function sectionTitle(doc: jsPDF, y: number, text: string, x = M.left): number {
  doc.setFillColor(...C.teal).rect(x, y - 8, 4, 14, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...C.navy);
  doc.text(text, x + 9, y + 3);
  return y + 12;
}

/** Header band above the paid-claims table (Remit / EFT / Net, right-aligned). */
function drawReportHeader(doc: jsPDF, y: number, r: BillingReport, netPaid: number): number {
  const x = M.left, w = CONTENT_W, h = 44;
  doc.setFillColor(...C.band).roundedRect(x, y, w, h, 6, 6, 'F');
  doc.setFillColor(...C.teal).rect(x, y, 4, h, 'F');

  doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(...C.muted);
  doc.text('MEMBER MEDICAID · PAID SUMMARY', x + 14, y + 16, { charSpace: 1.2 });
  doc.setFontSize(12.5).setTextColor(...C.navy);
  doc.text(`EFT #${r.eftNumber}`, x + 14, y + 33);

  const cols = [
    { label: 'REMIT DATE', value: r.remitDate },
    { label: 'EFT DATE', value: r.eftDate },
    { label: 'NET EARNINGS', value: money(netPaid), net: true },
  ];
  let rightX = x + w - 22;
  for (let i = cols.length - 1; i >= 0; i--) {
    const c = cols[i];
    doc.setFont('helvetica', 'bold').setFontSize(6.8);
    const labelW = doc.getTextWidth(c.label);
    doc.setFontSize(8);
    const valueW = doc.getTextWidth(c.value);
    const colW = Math.max(labelW, valueW);
    doc.setFontSize(6.8).setTextColor(...(c.net ? C.tealLabel : C.label));
    doc.text(c.label, rightX, y + 18, { align: 'right' });
    doc.setFont('helvetica', c.net ? 'bold' : 'normal').setFontSize(8).setTextColor(...(c.net ? C.tealDark : C.ink));
    doc.text(c.value, rightX, y + 32, { align: 'right' });
    rightX -= colW + 18;
  }
  return y + h;
}

/* ------------------------------ autotable glue ---------------------------- */

function baseCellStyle() {
  return {
    font: 'helvetica' as const,
    fontSize: 8.6,
    cellPadding: { top: 4, right: 8, bottom: 4, left: 8 },
    textColor: C.ink,
    lineColor: [238, 242, 246] as [number, number, number],
    lineWidth: { bottom: 0.5, top: 0, left: 0, right: 0 },
    valign: 'top' as const,
  };
}
function headStyle() {
  return {
    fillColor: C.navy, textColor: C.white, fontStyle: 'bold' as const, fontSize: 8,
    cellPadding: { top: 6, right: 8, bottom: 6, left: 8 }, lineWidth: 0,
  };
}
function zebra(d: any) {
  if (d.section === 'body' && d.row.index % 2 === 1) d.cell.styles.fillColor = C.zebra;
}
function finalY(doc: jsPDF): number {
  return (doc as any).lastAutoTable?.finalY ?? M.top;
}
