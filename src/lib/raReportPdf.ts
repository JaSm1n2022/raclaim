/**
 * raReportPdf.ts
 * -----------------------------------------------------------------------------
 * Generates a professional "Remittance Advice Report" PDF with navy/teal styling
 * matching the Biller Report design.
 *
 * Uses: jsPDF + jspdf-autotable
 * -----------------------------------------------------------------------------
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ParsedClaimData } from '../types';

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
  white:     [255, 255, 255] as [number, number, number],
  paidGreen: [52, 152, 219] as [number, number, number],
  deniedRed: [231, 76, 60] as [number, number, number],
};

/* ============================== Configuration ============================= */
const PAGE = { w: 842, h: 595 }; // A4 landscape
const M = { top: 36, right: 36, bottom: 36, left: 36 };
const CONTENT_W = PAGE.w - M.left - M.right;

const money = (v: number | null | string) => {
  const num = typeof v === 'string' ? parseFloat(v) : v;
  return '$' + (num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const baseCellStyle = () => ({
  font: 'helvetica',
  fontSize: 7.5,
  textColor: C.ink,
  cellPadding: { top: 5, right: 6, bottom: 5, left: 6 },
});

const headStyle = () => ({
  fillColor: C.teal,
  textColor: C.white,
  fontStyle: 'bold',
  fontSize: 8,
});

const zebra = (d: any) => {
  if (d.section === 'body' && d.row.index % 2 === 1) {
    d.cell.styles.fillColor = C.zebra;
  }
};

const finalY = (doc: jsPDF) => (doc as any).lastAutoTable.finalY;

/* ============================ Main PDF Generator =========================== */
export function generateRAReportPDF(data: ParsedClaimData): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const generatedOn = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  // Calculate totals
  const totalPaidCount = data.medicaid.paid.length + data.medicare.paid.length;
  const medicaidPaidAmt = data.medicaid.paid.reduce((sum, claim) => {
    return sum + (parseFloat(claim.srvcPaidAmt) || 0);
  }, 0);
  const medicarePaidAmt = data.medicare.paid.reduce((sum, claim) => {
    return sum + (parseFloat(claim.paidAmt as any) || 0);
  }, 0);
  const totalPaidAmt = medicaidPaidAmt + medicarePaidAmt;

  // Get net earnings - the netEarningsAmount might be a pre-formatted string like "$1,234.56"
  // We need to parse it properly or use the netPayment fallback
  let netEarnings = data.netPayment;
  if (data.remittance.netEarningsAmount) {
    const cleaned = String(data.remittance.netEarningsAmount).replace(/[$,]/g, '');
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed)) {
      netEarnings = parsed;
    }
  }

  /* ----------------------------- Page 1: Cover & Summary --------------------------- */
  drawCover(doc, {
    filename: data.remittance.filename || 'N/A',
    eftNumber: data.remittance.remittanceEftNumber || 'N/A',
    remitDate: data.remittance.remittanceDate || 'N/A',
    eftDate: data.remittance.remittanceEftDate || 'N/A',
    generatedOn,
  });

  let y = M.top + 95 + 20;

  // KPIs
  y = drawKpis(doc, y, [
    {
      label: 'Claims Paid',
      value: String(totalPaidCount),
      foot: money(totalPaidAmt) + ' total paid amount',
      tone: 'teal'
    },
    {
      label: 'Claims Denied',
      value: String(data.totalNumber.denied),
      foot: money(data.deniedAmount) + ' denied amount',
      tone: 'amber'
    },
    {
      label: 'Net Earnings',
      value: money(netEarnings),
      foot: 'from this remittance'
    },
  ]);

  // Remittance Information
  y += 12;
  y = sectionTitle(doc, y, 'Remittance Information');
  y = drawInfoCard(doc, y + 6, [
    { k: 'EFT Number', v: data.remittance.remittanceEftNumber || 'N/A' },
    { k: 'Remittance Date', v: data.remittance.remittanceDate || 'N/A' },
    { k: 'EFT Date', v: data.remittance.remittanceEftDate || 'N/A' },
    { k: 'Net Earnings', v: money(netEarnings), accent: true },
  ]);

  // Program Breakdown (Medicaid vs Medicare)
  y += 16;
  const half = (CONTENT_W - 20) / 2;
  const topY = sectionTitle(doc, y, 'Medicaid Summary', M.left);
  sectionTitle(doc, y, 'Medicare Summary', M.left + half + 20);

  // Medicaid summary table
  autoTable(doc, {
    startY: topY + 6,
    margin: M,
    tableWidth: half,
    theme: 'plain',
    styles: baseCellStyle(),
    headStyles: headStyle(),
    head: [['Status', 'Count', 'Amount']],
    body: [
      ['Paid', String(data.medicaid.paid.length), money(medicaidPaidAmt)],
      ['Denied', String(data.medicaid.denied.length), money(data.medicaidSummary?.denied?.amount || '0.00')],
    ],
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: zebra,
  });
  const medicaidEndY = finalY(doc);

  // Medicare summary table
  autoTable(doc, {
    startY: topY + 6,
    margin: { ...M, left: M.left + half + 20 },
    tableWidth: half,
    theme: 'plain',
    styles: baseCellStyle(),
    headStyles: headStyle(),
    head: [['Status', 'Count', 'Amount']],
    body: [
      ['Paid', String(data.medicare.paid.length), money(medicarePaidAmt)],
      ['Denied', String(data.medicare.denied.length), money(data.medicareSummary?.denied?.amount || '0.00')],
    ],
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: zebra,
  });

  y = Math.max(medicaidEndY, finalY(doc)) + 18;

  // Earning Data section - Make it prominent with styled card
  y = sectionTitle(doc, y, 'Earning Data');

  // Get earning values with proper parsing
  const paymentCurrentAmt = data.remittance.totalClaimsPaymentsAmount
    ? String(data.remittance.totalClaimsPaymentsAmount).replace(/[$,]/g, '')
    : data.netPayment.toFixed(2);
  const claimAdjustments = data.remittance.totalClaimsAdjPaymentsAmount || '0.00';
  const adjFromCurrentCycle = data.remittance.totalClaimAdjFromCurrentCyclePaymentAmount || '0.00';

  // Draw prominent earning data card with NET EARNINGS highlighted
  y = drawEarningDataCard(doc, y + 6, [
    { k: 'Payment Current Amount', v: `$${paymentCurrentAmt}` },
    { k: 'Claim Adjustments', v: `$${claimAdjustments}` },
    { k: 'Adjustments from Current Cycle', v: `$${adjFromCurrentCycle}` },
    { k: 'NET EARNINGS', v: money(netEarnings), accent: true },
  ]);

  y += 18;

  /* ------------------------- Page 2+: Medicaid Paid Claims -------------------------- */
  if (data.medicaid.paid.length > 0) {
    doc.addPage();
    sectionTitle(doc, M.top, 'Medicaid Paid Claims Detail');
    const medicaidPaidBody = data.medicaid.paid.map((claim, index) => {
      const desc = Array.isArray(claim.svDescription)
        ? claim.svDescription.join(', ')
        : String(claim.svDescription || '-');
      const truncDesc = desc.length > 50 ? desc.substring(0, 50) + '...' : desc;

      return [
        String(index + 1),
        claim.samename || '-',
        claim.srvcCode || '-',
        claim.srvcModifierCd || '-',
        claim.srvcFrom || '-',
        claim.srvcTo || '-',
        money(claim.srvcBilledAmt),
        money(claim.srvcPaidAmt),
        truncDesc,
      ];
    });

    medicaidPaidBody.push([
      { content: `Subtotal — ${data.medicaid.paid.length} paid claims`, colSpan: 6 },
      money(data.medicaid.paid.reduce((sum, c) => sum + (parseFloat(c.srvcBilledAmt) || 0), 0)),
      money(medicaidPaidAmt),
      '',
    ]);

    autoTable(doc, {
      startY: M.top + 12,
      margin: M,
      theme: 'plain',
      styles: baseCellStyle(),
      headStyles: headStyle(),
      head: [['#', 'Name', 'Proc Cd', 'Modifier', 'From', 'To', 'Billed', 'Paid', 'Detail']],
      body: medicaidPaidBody,
      columnStyles: {
        0: { cellWidth: 28, halign: 'center' },
        2: { font: 'courier' },
        6: { halign: 'right' },
        7: { halign: 'right' },
      },
      didParseCell: (d) => {
        zebra(d);
        if (d.section === 'body' && d.row.index === data.medicaid.paid.length) {
          d.cell.styles.fillColor = [240, 245, 245];
          d.cell.styles.textColor = C.navy;
          d.cell.styles.fontStyle = 'bold';
        }
      },
    });
  }

  /* ------------------------- Medicaid Denied Claims -------------------------- */
  if (data.medicaid.denied.length > 0) {
    doc.addPage();
    sectionTitle(doc, M.top, 'Medicaid Denied Claims Detail');
    const medicaidDeniedBody = data.medicaid.denied.map((claim, index) => {
      const desc = Array.isArray(claim.svDescription)
        ? claim.svDescription.join(', ')
        : String(claim.svDescription || '-');
      const truncDesc = desc.length > 50 ? desc.substring(0, 50) + '...' : desc;

      return [
        String(index + 1),
        claim.samename || '-',
        claim.srvcCode || '-',
        claim.srvcModifierCd || '-',
        claim.srvcDesc || '-',
        claim.srvcFrom || '-',
        claim.srvcTo || '-',
        money(claim.srvcBilledAmt),
        claim.srvcDetail || '-',
        truncDesc,
      ];
    });

    autoTable(doc, {
      startY: M.top + 12,
      margin: M,
      theme: 'plain',
      styles: baseCellStyle(),
      headStyles: { ...headStyle(), fillColor: C.deniedRed },
      head: [['#', 'Name', 'Proc Cd', 'Modifier', 'Service Desc', 'From', 'To', 'Billed', 'EOB', 'Detail']],
      body: medicaidDeniedBody,
      columnStyles: {
        0: { cellWidth: 28, halign: 'center' },
        2: { font: 'courier' },
        7: { halign: 'right' },
      },
      didParseCell: zebra,
    });
  }

  /* ------------------------- Medicare Paid Claims -------------------------- */
  if (data.medicare.paid.length > 0) {
    doc.addPage();
    sectionTitle(doc, M.top, 'Medicare Paid Claims Detail');

    const medicarePaidBody = data.medicare.paid.map((claim, index) => {
      const desc = Array.isArray(claim.detailDescription)
        ? claim.detailDescription.join(', ')
        : String(claim.detailDescription || '-');
      const truncDesc = desc.length > 50 ? desc.substring(0, 50) + '...' : desc;

      return [
        String(index + 1),
        claim.samename || '-',
        claim.icn || '-',
        claim.dos || '-',
        claim.procCd || '-',
        claim.from || '-',
        claim.to || '-',
        money(claim.billAmount),
        money(claim.paidAmt as any),
        truncDesc,
      ];
    });

    medicarePaidBody.push([
      { content: `Subtotal — ${data.medicare.paid.length} paid claims`, colSpan: 7 },
      money(data.medicare.paid.reduce((sum, c) => sum + (parseFloat(c.billAmount) || 0), 0)),
      money(medicarePaidAmt),
      '',
    ]);

    autoTable(doc, {
      startY: M.top + 12,
      margin: M,
      theme: 'plain',
      styles: baseCellStyle(),
      headStyles: headStyle(),
      head: [['#', 'Name', 'ICN', 'DOS', 'Proc Cd', 'From', 'To', 'Billed', 'Paid', 'Detail']],
      body: medicarePaidBody,
      columnStyles: {
        0: { cellWidth: 28, halign: 'center' },
        4: { font: 'courier' },
        7: { halign: 'right' },
        8: { halign: 'right' },
      },
      didParseCell: (d) => {
        zebra(d);
        if (d.section === 'body' && d.row.index === data.medicare.paid.length) {
          d.cell.styles.fillColor = [240, 245, 245];
          d.cell.styles.textColor = C.navy;
          d.cell.styles.fontStyle = 'bold';
        }
      },
    });
  }

  /* ------------------------- Medicare Denied Claims -------------------------- */
  if (data.medicare.denied.length > 0) {
    doc.addPage();
    sectionTitle(doc, M.top, 'Medicare Denied Claims Detail');

    const medicareDeniedBody = data.medicare.denied.map((claim, index) => {
      return [
        String(index + 1),
        claim.samename || '-',
        claim.icn || '-',
        claim.dos || '-',
        claim.procCd || '-',
        claim.from || '-',
        claim.to || '-',
        money(claim.billAmount),
        claim.detail || '-',
      ];
    });

    autoTable(doc, {
      startY: M.top + 12,
      margin: M,
      theme: 'plain',
      styles: baseCellStyle(),
      headStyles: { ...headStyle(), fillColor: C.deniedRed },
      head: [['#', 'Name', 'ICN', 'DOS', 'Proc Cd', 'From', 'To', 'Billed', 'Detail']],
      body: medicareDeniedBody,
      columnStyles: {
        0: { cellWidth: 28, halign: 'center' },
        4: { font: 'courier' },
        7: { halign: 'right' },
      },
      didParseCell: zebra,
    });
  }

  /* ------------------------- Adjustments Summary -------------------------- */
  if (data.adjustments && data.adjustments.length > 0) {
    doc.addPage();
    sectionTitle(doc, M.top, 'Adjustment Summary');

    const adjustmentBody = data.adjustments.map((adj: any, index) => {
      return [
        String(index + 1),
        adj.samename || adj.memberName || '-',
        adj.srvcCode || adj.service || adj.procCd || '-',
        adj.srvcModifierCd || adj.modifierCd || adj.modifier || '-',
        adj.srvcFrom || adj.srvDateFrom || adj.from || '-',
        adj.srvcTo || adj.srvDateTo || adj.to || '-',
        money(adj.srvcBilledAmt || adj.billedAmt || adj.billAmount || 0),
        money(adj.allowedAmt || 0),
        money(adj.deductible || 0),
        money(adj.coinsurance || 0),
        money(adj.srvcPaidAmt || adj.paidAmt || adj.paidAmount || 0),
        adj.eobCd || '-',
      ];
    });

    autoTable(doc, {
      startY: M.top + 12,
      margin: M,
      theme: 'plain',
      styles: baseCellStyle(),
      headStyles: { ...headStyle(), fillColor: [243, 156, 18] },
      head: [['#', 'Name', 'Proc Cd', 'Modifier', 'From', 'To', 'Billed', 'Allowed', 'Deductible', 'Coinsurance', 'Paid', 'EOB']],
      body: adjustmentBody,
      columnStyles: {
        0: { cellWidth: 28, halign: 'center' },
        2: { font: 'courier' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right' },
        10: { halign: 'right' },
      },
      didParseCell: zebra,
    });
  }

  /* ------------------------- Services Summary -------------------------- */
  if (data.services.length > 0) {
    doc.addPage();
    sectionTitle(doc, M.top, 'Services Summary');

    const servicesBody = data.services.map((service) => [
      service.name,
      service.desc,
      String(service.medicaidPaid),
      String(service.medicaidDenied),
      String(service.medicarePaid),
      String(service.medicareDenied),
      String(service.total),
    ]);

    autoTable(doc, {
      startY: M.top + 12,
      margin: M,
      theme: 'plain',
      styles: baseCellStyle(),
      headStyles: headStyle(),
      head: [['Code', 'Description', 'Med Paid', 'Med Denied', 'Mcare Paid', 'Mcare Denied', 'Total']],
      body: servicesBody,
      columnStyles: {
        0: { font: 'courier' },
        6: { fontStyle: 'bold' },
      },
      didParseCell: zebra,
    });
  }

  /* -------------------------------- Footers -------------------------------- */
  const pages = doc.getNumberOfPages();
  const label = `Remittance Advice Report  ·  ${data.remittance.filename || 'RA Claim Report'}`;
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...C.muted);
    doc.text(label, M.left, PAGE.h - 18);
    doc.text(`Page ${p} of ${pages}`, PAGE.w - M.right, PAGE.h - 18, { align: 'right' });
  }

  return doc;
}

/* ============================ Drawing primitives ========================== */

function drawCover(
  doc: jsPDF,
  o: { filename: string; eftNumber: string; remitDate: string; eftDate: string; generatedOn: string },
) {
  const x = M.left, y = M.top, w = CONTENT_W, h = 95;
  doc.setFillColor(...C.navy).roundedRect(x, y, w, h, 10, 10, 'F');
  doc.setFillColor(...C.teal).setGState(new (doc as any).GState({ opacity: 0.18 }));
  doc.roundedRect(x + w * 0.62, y, w * 0.38, h, 10, 10, 'F');
  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  doc.setTextColor(169, 214, 214).setFont('helvetica', 'bold').setFontSize(8.5);
  doc.text('REMITTANCE ADVICE · BILLING REPORT', x + 22, y + 26, { charSpace: 2 });
  doc.setTextColor(...C.white).setFontSize(22);
  doc.text('Claims Processing Summary', x + 22, y + 50);
  doc.setFont('helvetica', 'normal').setFontSize(10.5).setTextColor(215, 228, 239);
  doc.text(`Source File: ${o.filename}`, x + 22, y + 68);
  doc.setFontSize(9).setTextColor(207, 224, 238);
  doc.text(`EFT #${o.eftNumber}   ·   Remittance Date: ${o.remitDate}   ·   Generated ${o.generatedOn}`, x + 22, y + 84);
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
    const col = c.tone === 'teal' ? C.tealDark : c.tone === 'amber' ? [154, 106, 0] as [number, number, number] : C.navy;
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

function drawEarningDataCard(
  doc: jsPDF, y: number,
  cells: { k: string; v: string; accent?: boolean }[],
): number {
  const h = 56;
  const w = CONTENT_W / cells.length;

  // Draw card with border and background
  doc.setDrawColor(...C.border).setFillColor(...C.white).roundedRect(M.left, y, CONTENT_W, h, 8, 8, 'FD');

  // Draw teal accent bar at top
  doc.setFillColor(...C.teal).rect(M.left, y, CONTENT_W, 4, 'F');

  cells.forEach((c, i) => {
    const x = M.left + i * w;

    // Highlight NET EARNINGS cell with accent background
    if (c.accent) {
      doc.setFillColor(...C.band);
      doc.rect(x, y + 4, w - 1, h - 4, 'F');
    }

    // Draw vertical separators between cells
    if (i > 0) doc.setDrawColor(...[238, 242, 246] as [number, number, number]).line(x, y + 10, x, y + h - 10);

    // Draw label
    doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(...C.label);
    doc.text(c.k.toUpperCase(), x + 16, y + 22, { charSpace: 0.6 });

    // Draw value - larger and more prominent for NET EARNINGS
    if (c.accent) {
      doc.setFontSize(15).setTextColor(...C.tealDark).setFont('helvetica', 'bold');
    } else {
      doc.setFontSize(13).setTextColor(...C.navy).setFont('helvetica', 'bold');
    }
    doc.text(c.v, x + 16, y + 44);
  });

  return y + h;
}
