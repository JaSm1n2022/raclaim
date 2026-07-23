/**
 * remittancePdf.ts
 * -----------------------------------------------------------------------------
 * Generates the "Medicaid Remittance – Detail Invoice" statement PDF that mirrors
 * the finished HaloesTouch/RA-Claim design (navy/teal, Arial/Helvetica).
 *
 * Stack: jspdf ^4 + jspdf-autotable ^5 + xlsx ^0.18 (all already in package.json).
 *
 * Pipeline:  RA PDF --(your existing parser)--> Excel --(parseRemittanceWorkbook)-->
 *            RemittanceBatch[] --(generateRemittancePDF)--> jsPDF document.
 *
 * Browser:  const doc = generateRemittancePDF(batches, opts); doc.save('name.pdf');
 * Server:   const buf = getRemittancePDFBuffer(batches, opts); // Node Buffer
 * -----------------------------------------------------------------------------
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

/* ============================== Data contract ============================== */

export interface LineItem {
  provider: string;   // Provider Rendering
  client: string;     // Client Name
  dos: string;        // Date of Service (MM/DD/YYYY)
  time: string;       // e.g. "16:00 - 18:00"
  code: string;       // HCPCS, e.g. H2017
  description: string;
  unit: number;
  billed: number;
  paid: number;
  status: string;     // e.g. "PAID"
  comments: string;   // payer remark / denial reason
}

export interface RemittanceBatch {
  eftNumber: string;
  billedOn: string;   // MM/DD/YYYY
  remitDate: string;  // MM/DD/YYYY
  eftDate: string;    // MM/DD/YYYY
  netEarnings: number;
  rows: LineItem[];
}

export interface RemittanceOptions {
  period?: string;      // "May 25 – June 19, 2026"
  preparedFor?: string; // "Jasmin"
  payer?: string;       // "Nevada Medicaid"
  generatedOn?: string; // defaults to today
  fileName?: string;
}

export interface CommissionInvoiceOptions {
  period: string;         // "06/22/2026 – 07/17/2026"
  preparedFor: string;    // "Jasmin Angela Velasco"
  payer: string;          // "Nevada Medicaid" or "Best Choice Health Partners"
  invoiceDate: string;    // "07/19/2026"
  invoiceNo: string;      // "JAV-2026-0717"
  commissionRate: number; // 0.05 = 5%
  issuerAddress?: string; // "875 E Silverado Ranch Blvd, Apt 1120, Las Vegas, NV 89183"
  issuerEmail?: string;   // "jasminangelav10@gmail.com"
  payerAddress?: string;  // "Las Vegas, NV 89119"
}

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
  deniedBg:  [253, 244, 236] as [number, number, number],
  deniedInk: [160, 86, 31] as [number, number, number],
  flag:      [192, 86, 42] as [number, number, number],
  white:     [255, 255, 255] as [number, number, number],
};

const CODE_LABEL: Record<string, string> = {
  H0002: 'Alcohol / Drug Screening',
  H0004: 'Alcohol / Drug Services',
  H0031: 'MH Health Assessment (non-MD)',
  H2014: 'Skills Training & Development (BST)',
  H2017: 'Psychosocial Rehab Service (PSR)',
};

/* ================================ Helpers ================================= */

const money = (v: number) =>
  '$' + (v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const isDenied = (r: LineItem) => (r.paid || 0) === 0;

const denialReason = (r: LineItem) => {
  for (const t of [r.comments, r.status]) {
    const s = (t || '').trim();
    if (s && s.toUpperCase() !== 'PAID') return s;
  }
  return 'Adjusted to $0.00';
};

const sum = (rows: LineItem[], key: 'paid' | 'billed' | 'unit') =>
  rows.reduce((a, r) => a + (Number(r[key]) || 0), 0);

/* ============================ Workbook parser ============================= */
/**
 * Reads the RA remittance workbook (one sheet per EFT batch) into RemittanceBatch[].
 * Accepts an ArrayBuffer (browser File) or Buffer/Uint8Array (Node).
 */
export function parseRemittanceWorkbook(data: ArrayBuffer | Uint8Array): RemittanceBatch[] {
  const wb = XLSX.read(data, { type: 'array', cellDates: true });
  const batches: RemittanceBatch[] = [];

  const asDate = (v: unknown): string => {
    if (v instanceof Date) {
      const mm = String(v.getMonth() + 1).padStart(2, '0');
      const dd = String(v.getDate()).padStart(2, '0');
      return `${mm}/${dd}/${v.getFullYear()}`;
    }
    const s = v == null ? '' : String(v).trim();
    // normalize "YYYY-MM-DD" (optionally with a time part) to MM/DD/YYYY
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[2]}/${m[3]}/${m[1]}` : s;
  };

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const grid: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null });

    // ---- metadata block (rows 0..5) ----
    const meta: Record<string, unknown> = {};
    for (let i = 0; i < Math.min(6, grid.length); i++) {
      const k = grid[i]?.[0];
      if (k != null) meta[String(k).trim()] = grid[i]?.[1];
    }

    // ---- locate the DETAILS header row ----
    let hdr = -1;
    for (let i = 0; i < grid.length; i++) {
      const c0 = String(grid[i]?.[0] ?? '').trim();
      const c4 = String(grid[i]?.[4] ?? '').trim();
      if (c0 === 'Billed On' && c4 === 'Payer') { hdr = i; break; }
    }
    if (hdr < 0) continue;

    const cols = grid[hdr].map((c) => String(c ?? '').trim());
    const idx = (label: string) => cols.indexOf(label);
    const col = {
      provider: idx('Provider Rendering'),
      client: idx('Client Name'),
      dos: idx('DOS'),
      time: idx('Time'),
      code: idx('Code'),
      desc: idx('Description'),
      unit: idx('Unit'),
      billed: idx('Billed Amount'),
      paid: idx('Paid Amount'),
      status: idx('Claim Status'),
      comments: idx('Comments'),
    };

    const rows: LineItem[] = [];
    for (let i = hdr + 1; i < grid.length; i++) {
      const r = grid[i];
      const prov = r?.[col.provider];
      const client = r?.[col.client];
      if (prov == null && client == null) continue; // totals / blank row
      const titleCase = (s: string) =>
        s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
      rows.push({
        provider: prov != null ? titleCase(String(prov).trim()) : '',
        client: client != null ? String(client).trim() : '',
        dos: asDate(r?.[col.dos]),
        time: r?.[col.time] != null ? String(r[col.time]).trim() : '',
        code: r?.[col.code] != null ? String(r[col.code]).trim() : '',
        description: r?.[col.desc] != null ? String(r[col.desc]).trim() : '',
        unit: Number(r?.[col.unit]) || 0,
        billed: Number(r?.[col.billed]) || 0,
        paid: Number(r?.[col.paid]) || 0,
        status: r?.[col.status] != null ? String(r[col.status]).trim() : '',
        comments: col.comments >= 0 && r?.[col.comments] != null ? String(r[col.comments]).trim() : '',
      });
    }

    batches.push({
      eftNumber: String(meta['Remittance EFT Number'] ?? '').trim(),
      billedOn: asDate(meta['BILLED ON'] ?? meta['Billed On']),
      remitDate: asDate(meta['Remittance Date']),
      eftDate: asDate(meta['Remittance EFT Date']),
      netEarnings: Number(meta['NET EARNINGS']) || sum(rows, 'paid'),
      rows,
    });
  }
  return batches;
}

/* ============================ PDF generation ============================== */

const PAGE = { w: 792, h: 612 };          // Letter landscape, points
const M = { top: 40, left: 36, right: 36, bottom: 42 };
const CONTENT_W = PAGE.w - M.left - M.right;

export function generateRemittancePDF(
  batches: RemittanceBatch[],
  opts: RemittanceOptions = {},
): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });

  const period = opts.period ?? 'Remittance Period';
  const preparedFor = opts.preparedFor ?? '—';
  const payer = opts.payer ?? 'Medicaid';
  const generatedOn =
    opts.generatedOn ??
    new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' });

  const all = batches.flatMap((b) => b.rows);
  const grandPaid = sum(all, 'paid');
  const nLines = all.length;
  const nDenied = all.filter(isDenied).length;
  const clients = new Set(all.filter((r) => r.client).map((r) => r.client));

  const prov = new Map<string, { lines: number; paid: number }>();
  const code = new Map<string, { lines: number; units: number; paid: number }>();
  for (const r of all) {
    const p = prov.get(r.provider) ?? { lines: 0, paid: 0 };
    p.lines++; p.paid += r.paid; prov.set(r.provider, p);
    const c = code.get(r.code) ?? { lines: 0, units: 0, paid: 0 };
    c.lines++; c.units += r.unit; c.paid += r.paid; code.set(r.code, c);
  }

  /* ---------------------------- Page 1: summary ---------------------------- */
  drawCover(doc, { period, preparedFor, payer, generatedOn });
  let y = M.top + 95 + 20;
  y = drawKpis(doc, y, [
    { label: 'Net Earnings (Paid)', value: money(grandPaid), foot: `across ${batches.length} EFT remittances`, teal: true },
    { label: 'Service Lines', value: String(nLines), foot: `${nDenied} adjusted to $0.00` },
    { label: 'Rendering Providers', value: String(prov.size), foot: 'licensed clinicians' },
    { label: 'Unique Clients', value: String(clients.size), foot: 'served in period' },
  ]);

  y = sectionTitle(doc, y + 12, 'Remittance Summary');
  autoTable(doc, {
    startY: y + 6,
    margin: M,
    theme: 'plain',
    styles: baseCellStyle(),
    headStyles: headStyle(),
    head: [['EFT Number', 'Billed On', 'Remittance Date', 'EFT Date', '# Claims', 'Net Paid']],
    body: [
      ...batches.map((b) => [
        b.eftNumber, b.billedOn, b.remitDate, b.eftDate,
        String(b.rows.length), money(sum(b.rows, 'paid')),
      ]),
      [`TOTAL — ${batches.length} REMITTANCES`, '', '', '', String(nLines), money(grandPaid)],
    ],
    columnStyles: { 0: { font: 'courier' } },
    didParseCell: (d) => {
      zebra(d);
      if (d.section === 'body' && d.row.index === batches.length) {
        d.cell.styles.fillColor = [234, 242, 242];
        d.cell.styles.textColor = C.navy;
        d.cell.styles.fontStyle = 'bold';
      }
    },
  });
  y = finalY(doc) + 22;

  // Provider & Code breakdowns, side by side
  const half = (CONTENT_W - 20) / 2;
  const topY = sectionTitle(doc, y, 'By Rendering Provider', M.left, half);
  sectionTitle(doc, y, 'By Service Code', M.left + half + 20, half);
  autoTable(doc, {
    startY: topY + 6, margin: M, tableWidth: half, theme: 'plain',
    styles: baseCellStyle(), headStyles: headStyle(),
    head: [['Provider', '# Claims', 'Paid']],
    body: [...prov.entries()].sort().map(([n, v]) => [n, String(v.lines), money(v.paid)]),
    columnStyles: {},
    didParseCell: zebra,
  });
  const leftEnd = finalY(doc);
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
  void leftEnd;

  /* ------------------------ Detail: one page per batch --------------------- */
  batches.forEach((b, i) => {
    doc.addPage();
    if (i === 0) sectionTitle(doc, M.top, 'Line-Item Detail by Remittance');
    const bandTop = i === 0 ? M.top + 26 : M.top;
    const afterBand = drawBatchHeader(doc, bandTop, b, i + 1, batches.length);

    const body = b.rows.map((r) => {
      const denied = isDenied(r);
      return [
        denied ? `${r.client}\n${denialReason(r)}` : r.client,
        r.provider, r.dos, r.time, r.code, String(r.unit),
        denied ? 'DENIED' : money(r.paid),
      ];
    });
    body.push([`Subtotal — ${b.rows.length} lines`, '', '', '', '', '', money(sum(b.rows, 'paid'))]);

    autoTable(doc, {
      startY: afterBand + 8,
      margin: { ...M, top: M.top },
      theme: 'plain',
      styles: baseCellStyle(),
      headStyles: headStyle(),
      head: [['Client', 'Provider', 'Date of Service', 'Time', 'Code', 'Units', 'Paid']],
      body,
      columnStyles: {
        0: { cellWidth: 180 }, // Client
        1: { cellWidth: 180 }, // Provider
        2: { cellWidth: 85 },  // Date of Service
        3: { cellWidth: 100 }, // Time
        4: { font: 'courier', cellWidth: 55 }, // Code
        5: { cellWidth: 50 }, // Units
        6: { cellWidth: 70 }, // Paid
      },
      didParseCell: (d) => {
        zebra(d);
        const last = d.row.index === b.rows.length;
        if (d.section === 'body' && last) {
          d.cell.styles.fillColor = [240, 245, 245];
          d.cell.styles.textColor = C.navy;
          d.cell.styles.fontStyle = 'bold';
          return;
        }
        if (d.section === 'body' && !last && isDenied(b.rows[d.row.index])) {
          d.cell.styles.fillColor = C.deniedBg;
          if (d.column.index === 0) d.cell.styles.textColor = C.ink;
          if (d.column.index === 6) {
            d.cell.styles.textColor = C.flag;
            d.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });
  });

  /* -------------------------------- Footers -------------------------------- */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...C.muted);
    doc.text(`Medicaid Remittance Detail  ·  ${period}`, M.left, PAGE.h - 18);
    doc.text(`Page ${p} of ${pages}`, PAGE.w - M.right, PAGE.h - 18, { align: 'right' });
  }

  return doc;
}

/** Convenience: return a Node Buffer (server-side use). */
export function getRemittancePDFBuffer(batches: RemittanceBatch[], opts?: RemittanceOptions): Buffer {
  const ab = generateRemittancePDF(batches, opts).output('arraybuffer');
  return Buffer.from(ab);
}

/* ======================== Commission Invoice PDF ========================== */

/**
 * Generates a Commission Invoice PDF (summary style, ink-light design).
 * This produces a one-page invoice with commission calculation.
 */
export function generateCommissionPDF(
  batches: RemittanceBatch[],
  opts: CommissionInvoiceOptions,
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });

  // Portrait dimensions: 612 x 792 pt
  const W = 612, H = 792;
  const M2 = { top: 0, left: 46, right: 46, bottom: 40 };
  const contentW = W - M2.left - M2.right;

  // Defaults
  const issuerName = opts.preparedFor || 'Jasmin Angela Velasco';
  const issuerAddr = opts.issuerAddress || '875 E Silverado Ranch Blvd, Apt 1120, Las Vegas, NV 89183';
  const issuerEmail = opts.issuerEmail || 'jasminangelav10@gmail.com';
  const billToName = opts.payer || 'Best Choice Health Partners';
  const billToAddr = opts.payerAddress || 'Las Vegas, NV 89119';
  const commissionRate = opts.commissionRate || 0.05;

  // Calculate totals
  const all = batches.flatMap((b) => b.rows);
  const totalAmt = sum(all, 'paid');
  const commission = Math.round(totalAmt * commissionRate * 100) / 100;
  const serviceLinesCount = all.length;
  const ratePct = `${commissionRate * 100}%`;

  // Colors for commission invoice (ink-light teal theme)
  const tealPrimary: [number, number, number] = [31, 184, 166];   // #1fb8a6
  const tealDark: [number, number, number] = [15, 157, 140];      // #0f9d8c
  const darkNavy: [number, number, number] = [21, 36, 47];        // #15242f
  const lightGray: [number, number, number] = [247, 249, 250];    // #f7f9fa
  const borderGray: [number, number, number] = [228, 233, 238];   // #e4e9ee

  let y = M2.top;

  /* ----------------------------- Header Section ----------------------------- */
  // White header with teal underline
  doc.setFillColor(255, 255, 255);
  doc.rect(0, y, W, 180, 'F');

  // Teal bottom border
  doc.setFillColor(...tealPrimary);
  doc.rect(0, y + 177, W, 3, 'F');

  y += 34;

  // Kicker: BILLING SERVICES (teal/green) · INVOICE (black)
  doc.setFont('helvetica', 'bold').setFontSize(11);

  // Calculate where color changes occur
  const billingText = 'BILLING SERVICES';
  const dotText = ' · ';
  const invoiceText = 'INVOICE';

  // Set letter spacing
  const letterSpacing = 2.4;

  // Render BILLING SERVICES in teal
  doc.setTextColor(...tealDark);
  doc.text(billingText, M2.left, y, { charSpace: letterSpacing });

  // Calculate actual width with letter spacing
  const billingWidth = doc.getTextWidth(billingText) + (billingText.length - 1) * letterSpacing;

  // Render dot in gray
  doc.setTextColor(154, 168, 180);
  doc.text(dotText, M2.left + billingWidth, y, { charSpace: letterSpacing });

  const dotWidth = doc.getTextWidth(dotText) + (dotText.length - 1) * letterSpacing;

  // Render INVOICE in black
  doc.setTextColor(...darkNavy);
  doc.text(invoiceText, M2.left + billingWidth + dotWidth, y, { charSpace: letterSpacing });

  y += 20;  // Increased gap from 15 to 20

  // Issuer name - ALL CAPS with reduced size
  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(...darkNavy);
  doc.text(issuerName.toUpperCase(), M2.left, y);

  y += 15;

  // Issuer address & email
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(95, 112, 128);
  doc.text(issuerAddr, M2.left, y);
  y += 12;
  doc.text(issuerEmail, M2.left, y);

  y += 16;

  // Period line
  doc.setFont('helvetica', 'bold').setFontSize(10.5).setTextColor(...tealDark);
  doc.text(`Service & Remittance Period · ${opts.period}`, M2.left, y, { charSpace: 0.4 });

  y += 12;

  // Behavioral Health Services line - CAPS with reduced font size
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(139, 154, 168);
  doc.text(`BEHAVIORAL HEALTH SERVICES · PAYER: ${billToName}`, M2.left, y);

  y += 22;

  // Meta row: Bill To | Invoice Date | Invoice Number
  const metaY = y;

  // Bill To (left)
  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(139, 154, 168);
  doc.text('BILL TO', M2.left, metaY, { charSpace: 1.6 });
  doc.setFont('helvetica', 'bold').setFontSize(10.5).setTextColor(...darkNavy);
  doc.text(billToName, M2.left, metaY + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(billToAddr, M2.left, metaY + 25);

  // Invoice Date (center-right)
  const dateX = W - M2.right - 150;
  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(139, 154, 168);
  doc.text('INVOICE DATE', dateX, metaY, { charSpace: 1.6 });
  doc.setFont('helvetica', 'normal').setFontSize(10.5).setTextColor(...darkNavy);
  doc.text(opts.invoiceDate, dateX, metaY + 12);

  // Invoice Number (right)
  const noX = W - M2.right;
  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(139, 154, 168);
  doc.text('INVOICE NUMBER', noX, metaY, { align: 'right', charSpace: 1.6 });
  doc.setFont('helvetica', 'normal').setFontSize(10.5).setTextColor(...darkNavy);
  doc.text(opts.invoiceNo, noX, metaY + 12, { align: 'right' });

  y = metaY + 65;  // Increased gap to prevent overlap with header border

  /* ---------------------------- Stat Cards Section --------------------------- */
  // Calculate exact table width from column widths (90+200+90+80+90 = 550pt)
  // This will be used for alignment throughout the document
  const tableWidth = 550;

  // Match the table width exactly for stat cards
  const cardGap = 12;  // Slightly reduced gap
  const cardW = (tableWidth - cardGap * 3) / 4;
  const cardH = 68;  // Increased height to give more room for labels

  const cards = [
    { label: 'TOTAL REMITTANCES', value: money(totalAmt), note: `across ${batches.length} EFT payments`, teal: true },
    { label: 'SERVICE LINES', value: String(serviceLinesCount), note: 'claims paid in period', teal: false },
    { label: 'COMMISSION RATE', value: ratePct, note: 'of net remittances', teal: false },
    { label: 'AMOUNT DUE', value: money(commission), note: 'commission invoiced', teal: true },
  ];

  cards.forEach((card, i) => {
    const x = M2.left + i * (cardW + cardGap);

    // Card border
    doc.setDrawColor(...borderGray).setLineWidth(1);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, cardW, cardH, 5, 5, 'FD');

    // Top teal accent
    doc.setFillColor(...tealPrimary);
    doc.rect(x, y, cardW, 3, 'F');

    // Label - more spacing with increased card height
    doc.setFont('helvetica', 'bold').setFontSize(7.8).setTextColor(107, 124, 139);
    doc.text(card.label, x + 12, y + 24, { charSpace: 1.4 });

    // Value - CSS uses 22px but we need smaller for jsPDF to prevent overflow
    doc.setFontSize(16).setTextColor(...(card.teal ? tealDark : darkNavy));
    doc.text(card.value, x + 12, y + 42, { charSpace: -0.3 });

    // Note
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(139, 154, 168);
    doc.text(card.note, x + 12, y + 58);
  });

  y += cardH + 18;

  /* ------------------------- Invoice Summary Section ------------------------- */
  // Section title
  doc.setFillColor(...tealPrimary);
  doc.rect(M2.left, y - 8, 4, 14, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(12.5).setTextColor(...darkNavy);
  doc.text('Invoice Summary', M2.left + 9, y + 3);

  y += 18;

  // Table
  const tableBody = batches.map((b) => {
    const claimCount = b.rows.length;
    const paidAmt = sum(b.rows, 'paid');
    return [
      b.billedOn,
      `Medicaid Remittance · ${claimCount} claims`,
      money(paidAmt),
      b.eftNumber,
      b.eftDate,
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: M2,
    tableWidth: tableWidth,  // Explicitly set table width
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: { top: 8, right: 10, bottom: 8, left: 10 },
      textColor: [43, 58, 72],
      lineColor: [233, 237, 241],
      lineWidth: { bottom: 1, top: 0, left: 0, right: 0 },
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: darkNavy,
      fontStyle: 'bold',
      fontSize: 8.4,
      cellPadding: { top: 8, right: 10, bottom: 8, left: 10 },
      lineWidth: { bottom: 2 },
      lineColor: tealPrimary,
    },
    head: [['Date Billed', 'Description', 'Amount', 'EFT', 'EFT Paid On']],
    body: [
      ...tableBody,
      [`Total — ${batches.length}`, `${serviceLinesCount} claims`, money(totalAmt), '', ''],
    ],
    columnStyles: {
      0: { cellWidth: 90, font: 'courier' },
      1: { cellWidth: 200 },
      2: { cellWidth: 90, halign: 'left', font: 'courier' },  // Changed to left-align
      3: { cellWidth: 80, font: 'courier' },
      4: { cellWidth: 90, font: 'courier' },
    },
    didParseCell: (data) => {
      // Zebra striping
      if (data.section === 'body' && data.row.index < tableBody.length && data.row.index % 2 === 1) {
        data.cell.styles.fillColor = lightGray;
      }
      // Total row
      if (data.section === 'body' && data.row.index === tableBody.length) {
        data.cell.styles.fillColor = [238, 247, 245];
        data.cell.styles.textColor = [15, 109, 97];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.lineWidth = { top: 2, bottom: 0 };
        data.cell.styles.lineColor = tealPrimary;
      }
    },
  });

  y = finalY(doc) + 12;

  // Calculate table right edge for alignment - using actual table width
  const tableRightEdge = M2.left + tableWidth;  // 46 + 550 = 596pt

  /* ----------------------- Total Amount Due Strip --------------------------- */
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(85, 105, 122);
  const dueLabel = 'TOTAL AMOUNT DUE';
  const dueLabelWidth = doc.getTextWidth(dueLabel);

  doc.setFontSize(12);
  const amountWidth = doc.getTextWidth(money(totalAmt));

  // Position label and amount so the amount aligns with table right edge
  doc.setFontSize(9);
  doc.text(dueLabel, tableRightEdge - amountWidth - 20 - dueLabelWidth, y, { charSpace: 1.2 });

  doc.setFontSize(12).setTextColor(...darkNavy);
  doc.text(money(totalAmt), tableRightEdge, y, { align: 'right' });

  y += 12;

  /* ---------------------- Commission Calculation Section -------------------- */
  // Section title
  doc.setFillColor(...tealPrimary);
  doc.rect(M2.left, y - 8, 4, 14, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(12.5).setTextColor(...darkNavy);
  doc.text('Commission Calculation', M2.left + 9, y + 3);

  y += 18;

  // Box - right edge must align exactly with table's right edge (reuse tableRightEdge)
  const boxW = 320;
  const boxX = tableRightEdge - boxW;
  let boxY = y;

  doc.setDrawColor(...borderGray).setLineWidth(1);
  doc.rect(boxX, boxY, boxW, 90, 'S');

  // Header
  doc.setFillColor(255, 255, 255);
  doc.rect(boxX, boxY, boxW, 26, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...darkNavy);
  doc.text(`COMMISSION RATE · ${ratePct}`, boxX + 16, boxY + 15, { charSpace: 1.4 });

  // Teal line
  doc.setFillColor(...tealPrimary);
  doc.rect(boxX, boxY + 26, boxW, 2, 'F');

  boxY += 28;

  // Total Remittances row
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(85, 105, 122);
  doc.text('Total Remittances', boxX + 16, boxY + 13);
  doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(31, 43, 56);
  doc.text(money(totalAmt), boxX + boxW - 16, boxY + 13, { align: 'right' });

  boxY += 22;
  doc.setDrawColor(238, 241, 244).setLineWidth(1);
  doc.line(boxX, boxY, boxX + boxW, boxY);

  // Commission row
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(85, 105, 122);
  doc.text(`Commission (${ratePct} of total)`, boxX + 16, boxY + 13);
  doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(31, 43, 56);
  doc.text(money(commission), boxX + boxW - 16, boxY + 13, { align: 'right' });

  boxY += 22;

  // Grand Total strip
  doc.setFillColor(238, 247, 245);
  doc.rect(boxX, boxY, boxW, 20, 'F');
  doc.setFillColor(...tealPrimary);
  doc.rect(boxX, boxY, boxW, 2, 'F');

  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(15, 109, 97);
  doc.text('GRAND TOTAL', boxX + 16, boxY + 14, { charSpace: 1.2 });
  doc.setFontSize(13).setTextColor(...tealDark);
  doc.text(money(commission), boxX + boxW - 16, boxY + 14, { align: 'right' });

  y = boxY + 34;

  /* -------------------------- Basis Note & Thanks --------------------------- */
  doc.setFont('helvetica', 'normal').setFontSize(8.6).setTextColor(122, 137, 150);
  const basisNote = `Basis of invoice: Amounts reflect net remittances (EFT payments) received for behavioral health services rendered during the service period. Commission is calculated at ${ratePct} of total net remittances. The Grand Total represents the commission payable.`;
  const lines = doc.splitTextToSize(basisNote, contentW);
  doc.text(lines, M2.left, y);

  y += lines.length * 10 + 14;

  doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...darkNavy);
  doc.text('Thank you for your business!', M2.left, y);

  /* --------------------------------- Footer --------------------------------- */
  const footerY = H - 30;
  doc.setDrawColor(...borderGray).setLineWidth(1);
  doc.line(M2.left, footerY, W - M2.right, footerY);

  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(154, 168, 180);
  doc.text(`Invoice · ${issuerName} · ${opts.period}`, M2.left, footerY + 12);
  doc.text(`${opts.invoiceNo} · Page 1 of 1`, W - M2.right, footerY + 12, { align: 'right' });

  return doc;
}

/* ============================ Drawing primitives ========================== */

function drawCover(
  doc: jsPDF,
  o: { period: string; preparedFor: string; payer: string; generatedOn: string },
) {
  const x = M.left, y = M.top, w = CONTENT_W, h = 95;
  doc.setFillColor(...C.navy).roundedRect(x, y, w, h, 10, 10, 'F');
  // subtle teal accent panel on the right
  doc.setFillColor(...C.teal).setGState(new (doc as any).GState({ opacity: 0.18 }));
  doc.roundedRect(x + w * 0.62, y, w * 0.38, h, 10, 10, 'F');
  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  doc.setTextColor(169, 214, 214).setFont('helvetica', 'bold').setFontSize(8.5);
  doc.text('MEDICAID REMITTANCE · DETAIL INVOICE', x + 22, y + 26, { charSpace: 2 });
  doc.setTextColor(...C.white).setFontSize(22);
  doc.text('Behavioral Health Services Statement', x + 22, y + 50);
  doc.setFont('helvetica', 'normal').setFontSize(10.5).setTextColor(215, 228, 239);
  doc.text(`Service & Remittance Period · ${o.period}`, x + 22, y + 68);
  doc.setFontSize(9).setTextColor(207, 224, 238);
  doc.text(
    `Prepared for ${o.preparedFor}   ·   Payer: ${o.payer}   ·   Generated ${o.generatedOn}`,
    x + 22, y + 84,
  );
}

function drawKpis(
  doc: jsPDF, y: number,
  cards: { label: string; value: string; foot: string; teal?: boolean }[],
): number {
  const gap = 14;
  const w = (CONTENT_W - gap * (cards.length - 1)) / cards.length;
  const h = 64;
  cards.forEach((c, i) => {
    const x = M.left + i * (w + gap);
    doc.setDrawColor(...C.border).setFillColor(...C.white).roundedRect(x, y, w, h, 6, 6, 'FD');
    doc.setFillColor(...C.teal).rect(x, y, w, 3, 'F'); // top accent
    doc.setFont('helvetica', 'bold').setFontSize(7.8).setTextColor(...C.muted);
    doc.text(c.label.toUpperCase(), x + 12, y + 18, { charSpace: 0.5 });
    doc.setFontSize(19).setTextColor(...(c.teal ? C.tealDark : C.navy));
    doc.text(c.value, x + 12, y + 40);
    doc.setFont('helvetica', 'normal').setFontSize(7.8).setTextColor(...C.muted);
    doc.text(c.foot, x + 12, y + 54);
  });
  return y + h;
}

function sectionTitle(doc: jsPDF, y: number, text: string, x = M.left, _w?: number): number {
  doc.setFillColor(...C.teal).rect(x, y - 8, 4, 14, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...C.navy);
  doc.text(text, x + 9, y + 3);
  return y + 12;
}

function drawBatchHeader(
  doc: jsPDF, y: number, b: RemittanceBatch, idx: number, total: number,
): number {
  // Table column widths: 155+155+85+100+55+50+70 = 670pt
  // Add padding (8pt left + 8pt right per column = 16pt * 7 columns = 112pt)
  // Total table width ≈ 782pt, but we'll use CONTENT_W for consistency
  const x = M.left, w = CONTENT_W, h = 44;
  doc.setFillColor(...C.band).roundedRect(x, y, w, h, 6, 6, 'F');
  doc.setFillColor(...C.teal).rect(x, y, 4, h, 'F'); // left accent

  // left: eyebrow + EFT number
  doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(...C.muted);
  doc.text(`REMITTANCE ${idx} OF ${total}`, x + 14, y + 16, { charSpace: 1.2 });
  doc.setFontSize(12.5).setTextColor(...C.navy);
  doc.text(`EFT #${b.eftNumber}`, x + 14, y + 33);

  // right: 4 label/value columns, all right-aligned to their own edge
  const cols = [
    { label: 'BILLED ON', value: b.billedOn },
    { label: 'REMIT DATE', value: b.remitDate },
    { label: 'EFT DATE', value: b.eftDate },
    { label: 'NET EARNINGS', value: money(b.netEarnings), net: true },
  ];
  let rightX = x + w - 22;
  for (let i = cols.length - 1; i >= 0; i--) {
    const c = cols[i];
    doc.setFont('helvetica', 'bold').setFontSize(6.8);
    doc.setTextColor(...(c.net ? C.tealLabel : C.label));
    const labelW = doc.getTextWidth(c.label);
    doc.setFontSize(8);
    const valueW = doc.getTextWidth(c.value);
    const colW = Math.max(labelW, valueW);
    doc.setFontSize(6.8);
    doc.text(c.label, rightX, y + 18, { align: 'right' });
    doc.setFont('helvetica', c.net ? 'bold' : 'normal').setFontSize(8);
    doc.setTextColor(...(c.net ? C.tealDark : C.ink));
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
    fillColor: C.navy,
    textColor: C.white,
    fontStyle: 'bold' as const,
    fontSize: 8,
    cellPadding: { top: 6, right: 8, bottom: 6, left: 8 },
    lineWidth: 0,
  };
}

/** Zebra striping for body rows. */
function zebra(d: any) {
  if (d.section === 'body' && d.row.index % 2 === 1) {
    d.cell.styles.fillColor = C.zebra;
  }
}

/** jspdf-autotable stores the last table's end Y here. */
function finalY(doc: jsPDF): number {
  return (doc as any).lastAutoTable?.finalY ?? M.top;
}
