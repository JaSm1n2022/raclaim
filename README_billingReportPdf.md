# Billing Report PDF — `billingReportPdf.ts`

Drop-in module for **raclaim** that turns a single-EFT Medicaid **billing workbook**
into the styled *Behavioral Health Billing Report* PDF (navy/teal, Arial/Helvetica).

Companion to `remittancePdf.ts`. Same stack, no Python: **`jspdf`**, **`jspdf-autotable`**, **`xlsx`**.

```
Billing workbook (Sheet1, multi-section)
  └─▶ parseBillingWorkbook(xlsx) ──▶ BillingReport
                                  └─▶ generateBillingReportPDF(...) ──▶ jsPDF
```

Suggested location: `src/lib/billingReportPdf.ts`.

---

## Source workbook layout

The parser reads **one sheet** (default the first, or pass a name) containing these
stacked sections, located by their first-column marker text (not fixed rows):

| Marker (column A) | Meaning |
|---|---|
| `REMITTANCE INFORMATION` | metadata: `Remittance EFT Number`, `Remittance Date`, `Remittance EFT Date`, `NET EARNINGS` (label in col A, value in col B) |
| `MEMBER MEDICAID Paid Summary` → `Payer` header row | **paid claims** table |
| `ISSUE/NOT BILLED` → `Payer` header row | **pending / not-billed** claims (no `Paid Amount`) |
| `SERVICES SUMMARY` → `Service Code` header row … `TOTAL` | per-code counts: `Medicare Paid Count`, `Medicaid Paid Count` |

Detail tables use the header: `Payer · Provider Rendering · Client Name · DOS · Time ·
Code · Description · Unit · Billed Amount · Paid Amount · Claim Status · COMMENTS`.
Only rows whose Payer is `Medicaid` are treated as data; totals/blank rows are skipped.

> Other tabs in the file (e.g. free-text history lists or unpriced service dumps) are
> ignored — only the structured report sheet is parsed.

---

## What it renders

- **Cover banner** — title, "Billed On" period, payer / EFT # / generated date.
- **KPI cards** — Net Earnings (Paid), Total Billed, Not Billed (Pending), Providers/Clients.
- **Remittance Information** card — EFT #, remit date, EFT deposit date, net earnings.
- **By Rendering Provider** + **By Service Code (Paid)** breakdowns (side by side).
- **Services Summary** — Medicare vs Medicaid paid counts by code (own page, with total).
- **Paid Claims Detail** — header band (Remit/EFT/Net, right-aligned) + all paid lines;
  lines adjusted from a prior claim get an amber **ADJUSTMENT** tag.
- **Issue / Not Billed** — pending lines highlighted amber with a **PENDING** tag, plus a
  **Reconciliation** note: `Total billed = Paid (net earnings) + Pending`.
- Footer with period + `Page x of y` on every page.

---

## Data contract

```ts
interface ClaimLine {
  provider: string; client: string; dos: string;   // MM/DD/YYYY
  time: string; code: string; description: string;
  unit: number; billed: number;
  paid: number | null;      // null => pending / not paid
  status: string;           // '', 'Adjustment from previous billed', 'Pending'
}

interface ServiceSummaryRow { code: string; medicare: number; medicaid: number; }

interface BillingReport {
  eftNumber: string; remitDate: string; eftDate: string; netEarnings: number;
  paid: ClaimLine[];
  notBilled: ClaimLine[];
  summary: ServiceSummaryRow[];
  summaryTotal: number;
}
```

A paid line shows an **ADJUSTMENT** tag when `status` starts with "adjust".
`notBilled` lines render as **PENDING** (their `paid` is `null`).
Totals: `totalPaid = Σ paid`, `totalBilled = Σ billed (paid) + Σ billed (notBilled)`.

---

## Usage — React (client download)

```tsx
import { parseBillingWorkbook, generateBillingReportPDF } from '../lib/billingReportPdf';
import toast from 'react-hot-toast';

async function handleExportBillingPdf(file: File) {
  try {
    const report = parseBillingWorkbook(await file.arrayBuffer());
    const doc = generateBillingReportPDF(report, {
      period: '06/23/2026 – 06/26/2026',   // "Billed On" range (often derivable from the filename)
      payer: 'Nevada Medicaid',
    });
    doc.save('Billing_Report.pdf');
  } catch (e) {
    toast.error('Could not generate billing report');
    console.error(e);
  }
}
```

## Usage — Koa API (server response)

```js
import { parseBillingWorkbook, getBillingReportPDFBuffer } from '../src/lib/billingReportPdf';

router.post('/api/billing/pdf', async (ctx) => {
  const upload = ctx.request.files?.file;               // via koa-body
  const data = await fs.promises.readFile(upload.filepath);
  const report = parseBillingWorkbook(new Uint8Array(data));
  const pdf = getBillingReportPDFBuffer(report, {
    period: ctx.request.body.period,
    payer: ctx.request.body.payer ?? 'Nevada Medicaid',
  });
  ctx.set('Content-Type', 'application/pdf');
  ctx.set('Content-Disposition', 'attachment; filename="Billing_Report.pdf"');
  ctx.body = pdf;
});
```

> `api/index.cjs` is CommonJS while this module is ESM — import it from an ESM route,
> or pre-bundle with esbuild/tsx (same note as `remittancePdf.ts`).

---

## API

| Export | Signature | Notes |
|---|---|---|
| `parseBillingWorkbook` | `(data: ArrayBuffer \| Uint8Array, sheetName?) => BillingReport` | Reads the report sheet (defaults to the first). |
| `generateBillingReportPDF` | `(report, opts?) => jsPDF` | Returns the doc; call `.save()` / `.output()`. |
| `getBillingReportPDFBuffer` | `(report, opts?) => Buffer` | Node Buffer for server responses. |

`BillingOptions`: `{ period?, payer?, preparedFor?, generatedOn?, fileName? }`.

## Customizing

- **Colors / fonts** — `C` palette + `baseCellStyle()` / `headStyle()`.
- **Service-code labels** — `CODE_LABEL` (includes 90837/90839/90853/90791 for the
  psychotherapy codes that appear in the pending section).
- **Columns** — paid detail is Client / Provider / Date / Time / Code / Units / Billed /
  Paid / Status; pending drops Paid. Change in the two `autoTable(...)` calls.
- **Tags** — ADJUSTMENT / PENDING are styled via `didParseCell` (colored bold text).

## Verified

Parsed the sample workbook (EFT #002335431) → 105 paid lines (**$8,369.60**),
3 pending lines (**$324.45**), 7 adjustments, services-summary total 98 — and produced
a 7-page PDF matching the reference layout, with `Billed = Paid + Pending` reconciling to
**$8,694.05**.
