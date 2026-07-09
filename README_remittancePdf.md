# Remittance Statement PDF — `remittancePdf.ts`

Drop-in module for **raclaim** that turns a parsed RA remittance workbook into the
styled *Medicaid Remittance – Detail Invoice* PDF (navy/teal, Arial/Helvetica).

Built entirely on deps you already have: **`jspdf`**, **`jspdf-autotable`**, **`xlsx`**.
No Python, no server-side headless browser.

```
RA PDF ──(your existing pdf-parse pipeline)──▶ Excel
        └─▶ parseRemittanceWorkbook(excel) ──▶ RemittanceBatch[]
                                             └─▶ generateRemittancePDF(...) ──▶ jsPDF
```

Suggested location: `src/lib/remittancePdf.ts`.

---

## What it renders

- **Cover banner** — title, period, "prepared for / payer / generated".
- **KPI cards** — net paid, service lines (+ denied count), providers, unique clients.
- **Remittance Summary** table (one row per EFT + grand total).
- **By Rendering Provider** and **By Service Code** breakdowns (side by side).
- **Line-item detail** — *each remittance starts on its own page*, with a header band
  (EFT #, Billed/Remit/EFT dates, right-aligned bold **Net Earnings**), zebra rows,
  per-batch subtotal, and **DENIED** rows highlighted amber with the payer reason.
- Footer with period + `Page x of y` on every page.

---

## Data contract

```ts
interface LineItem {
  provider: string;    // Provider Rendering
  client: string;      // Client Name
  dos: string;         // MM/DD/YYYY
  time: string;        // "16:00 - 18:00"
  code: string;        // e.g. H2017
  description: string;
  unit: number;
  billed: number;
  paid: number;        // 0 => treated as DENIED
  status: string;      // "PAID", etc.
  comments: string;    // payer remark / denial reason
}

interface RemittanceBatch {
  eftNumber: string;
  billedOn: string;    // MM/DD/YYYY
  remitDate: string;
  eftDate: string;
  netEarnings: number;
  rows: LineItem[];
}
```

A line is flagged **DENIED** when `paid === 0`; the reason shown is `comments`
(falling back to `status`). Denied lines are excluded from paid totals.

`parseRemittanceWorkbook` expects the workbook layout you already produce:
one sheet per EFT batch, a 6-row metadata block at the top
(`BILLED ON`, `Remittance Date`, `Remittance EFT Number`, `Remittance EFT Date`,
`NET EARNINGS`), then a `DETAILS` table whose header row begins with
`Billed On … Payer … Provider Rendering … Client Name … DOS … Code … Unit …
Billed Amount … Paid Amount … Claim Status … Comments`.

---

## Usage — React (client download)

```tsx
import { parseRemittanceWorkbook, generateRemittancePDF } from '../lib/remittancePdf';
import toast from 'react-hot-toast';

async function handleExportPdf(file: File) {
  try {
    const buf = await file.arrayBuffer();
    const batches = parseRemittanceWorkbook(buf);
    const doc = generateRemittancePDF(batches, {
      period: 'May 25 – June 19, 2026',
      preparedFor: 'Jasmin',
      payer: 'Nevada Medicaid',
    });
    doc.save('Remittance_Detail.pdf');
  } catch (e) {
    toast.error('Could not generate PDF');
    console.error(e);
  }
}
```

If your app already holds parsed rows in state, skip the parser and build the
`RemittanceBatch[]` array yourself, then call `generateRemittancePDF`.

## Usage — Koa API (server, returns the file)

```js
// api/index.cjs (or an ESM route)
import { parseRemittanceWorkbook, getRemittancePDFBuffer } from '../src/lib/remittancePdf';

router.post('/api/remittance/pdf', async (ctx) => {
  const upload = ctx.request.files?.file;        // via koa-body
  const data = await fs.promises.readFile(upload.filepath);
  const batches = parseRemittanceWorkbook(new Uint8Array(data));
  const pdf = getRemittancePDFBuffer(batches, {
    period: ctx.request.body.period,
    preparedFor: ctx.request.body.preparedFor,
    payer: ctx.request.body.payer,
  });
  ctx.set('Content-Type', 'application/pdf');
  ctx.set('Content-Disposition', 'attachment; filename="Remittance_Detail.pdf"');
  ctx.body = pdf;
});
```

> The Koa API mixes CJS (`api/index.cjs`) and this ESM module. Either import it from
> an ESM route file, or pre-bundle with esbuild/tsx. During dev, `tsx api/route.ts`
> works; for a `.cjs` entry, transpile the module first.

---

## API

| Export | Signature | Notes |
|---|---|---|
| `parseRemittanceWorkbook` | `(data: ArrayBuffer \| Uint8Array) => RemittanceBatch[]` | Reads the RA workbook. |
| `generateRemittancePDF` | `(batches, opts?) => jsPDF` | Returns the doc; call `.save()` / `.output()`. |
| `getRemittancePDFBuffer` | `(batches, opts?) => Buffer` | Node Buffer for server responses. |

`RemittanceOptions`: `{ period?, preparedFor?, payer?, generatedOn?, fileName? }`.

---

## Customizing

- **Colors / fonts** live in the `C` palette object and `baseCellStyle()` /
  `headStyle()`. jsPDF's `helvetica` is the Arial-equivalent core font.
- **Service-code labels** are in `CODE_LABEL` — add codes as your service mix grows.
- **Columns** in the detail table are defined in the `autoTable` call inside the
  `batches.forEach(...)` block (currently Client / Provider / Date / Time / Code /
  Units / Paid — Billed intentionally omitted).
- **One page per remittance** is enforced by the `doc.addPage()` at the top of the
  per-batch loop; long batches still paginate internally via autotable.

## Verified

Parsed the sample workbook (4 EFT batches, 292 lines, **$27,593.07**, 3 denials)
and produced a 16-page PDF matching the reference layout.
