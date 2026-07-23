# Commission Invoice — Document Template

Produces the one‑page, ink‑light **Commission Invoice** PDF for Jasmin Angela Velasco
(white header + teal rule, teal‑topped stat cards, light table header, faint teal total strips).

Input is the **invoice content itself** — you type the line items straight into the `CONFIG`
block. Nothing is parsed or derived from a source document, so any `Description` text works
(Medicaid, Medicare, commercial, mixed — whatever you put in the field is what prints).

> If instead you have a **Remittance Summary PDF** and want the invoice built *from* it
> automatically, use `Remittance_to_Invoice-Build_Guide.md`. This file is the plain document
> template; that one is the extract‑and‑map pipeline.

---

## Anatomy of the invoice (top → bottom)

1. **Header** (white, teal underline): `BILLING SERVICES · INVOICE`, issuer name + address + email,
   the Service & Remittance Period line, and a "Behavioral Health Services · Payer: …" line.
2. **Meta row**: Bill To · Invoice Date · Invoice Number.
3. **Four stat cards**: Total Remittances · Service Lines · Commission Rate · Amount Due.
4. **Invoice Summary table** — the five columns that matter:
   **Date Billed · Description · Amount · EFT · EFT Paid On**, then a Total row.
5. **Total Amount Due** strip.
6. **Commission Calculation** box: Total Remittances → Commission (rate) → **Grand Total**.
7. **Basis of invoice** note, "Thank you for your business!", and the footer.

## Fields you fill

| Field | Meaning |
|---|---|
| `issuer_*` | Jasmin's name / address / email (fixed unless changed) |
| `period` | Service & remittance period, e.g. `06/22/2026 – 07/17/2026` |
| `bill_to_*` | Payer name + city/zip |
| `invoice_date` | Date on the invoice |
| `invoice_no` | `JAV-YYYY-MMDD` (usually the period‑end date) |
| `commission_rate` | Decimal, `0.05` = 5% |
| `service_lines` / `service_lines_note` | Stat card #2 value + caption (e.g. `362`, `claims paid in period`) |
| `total_middle` | Middle cell of the Total row (e.g. `362 claims`; leave `""` for none) |
| `basis_note` | The "Basis of invoice" paragraph (edit the program name to match) |
| `rows[]` | One entry per line: `date_billed, description, amount, eft, eft_paid_on` |

**Computed for you:** Total Amount Due = sum of row `amount`s · Commission = round(Total × rate, 2)
· Grand Total = Commission · "across N EFT payments" = number of rows.

---

## Build

```bash
pip install weasyprint --break-system-packages -q
python3 make_invoice.py
# QA — must be ONE page, everything ink-light
pdftoppm -jpeg -r 120 -f 1 -l 1 "Jasmin_Angela_Velasco-Invoice_Summary.pdf" /tmp/qa && echo open /tmp/qa-1.jpg
```

If a long invoice spills to a 2nd page, trim the `.stats` / `.section` top paddings a few px until it fits — never split across pages.

---

## `make_invoice.py`

```python
#!/usr/bin/env python3
"""Commission Invoice document template (ink-light house style)."""
from weasyprint import HTML

# =============================== CONFIG — EDIT ===============================
CONFIG = {
    "issuer_name":  "Jasmin Angela Velasco",
    "issuer_addr":  "875 E Silverado Ranch Blvd, Apt 1120, Las Vegas, NV 89183",
    "issuer_email": "jasminangelav10@gmail.com",
    "period":       "06/22/2026 – 07/17/2026",
    "bill_to_name": "Best Choice Health Partners",
    "bill_to_addr": "Las Vegas, NV 89119",
    "invoice_date": "07/19/2026",
    "invoice_no":   "JAV-2026-0717",
    "commission_rate": 0.05,

    "service_lines":      "362",
    "service_lines_note": "claims paid in period",
    "total_middle":       "362 claims",     # middle cell of the Total row ("" for blank)
    "basis_note": ("Amounts reflect net Medicaid remittances (EFT payments) received for "
                   "behavioral health services rendered during the service period. Commission "
                   "is calculated at 5% of total net remittances. The Grand Total represents "
                   "the commission payable."),

    # one dict per invoice line (Date Billed / Description / Amount / EFT / EFT Paid On)
    "rows": [
        {"date_billed": "06/22/2026", "description": "Medicaid Remittance · 105 claims", "amount": 8369.60, "eft": "002335431", "eft_paid_on": "07/03/2026"},
        {"date_billed": "06/29/2026", "description": "Medicaid Remittance · 107 claims", "amount": 9737.12, "eft": "002338686", "eft_paid_on": "07/10/2026"},
        {"date_billed": "07/06/2026", "description": "Medicaid Remittance · 72 claims",  "amount": 6934.40, "eft": "002341765", "eft_paid_on": "07/17/2026"},
        {"date_billed": "07/13/2026", "description": "Medicaid Remittance · 78 claims",  "amount": 7720.48, "eft": "002344834", "eft_paid_on": "07/24/2026"},
    ],
}
OUTFILE = "Jasmin_Angela_Velasco-Invoice_Summary.pdf"
# ============================================================================

def money(x): return "${:,.2f}".format(x)

def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))

def build_html(c):
    rows = c["rows"]
    total_amt = round(sum(r["amount"] for r in rows), 2)
    commission = round(total_amt * c["commission_rate"], 2)
    rate_pct = "{:g}%".format(c["commission_rate"] * 100)

    body = ""
    for r in rows:
        body += ("<tr>"
                 f'<td class="mono">{esc(r["date_billed"])}</td>'
                 f'<td>{esc(r["description"])}</td>'
                 f'<td class="num mono">{money(r["amount"])}</td>'
                 f'<td class="mono">{esc(r["eft"])}</td>'
                 f'<td class="mono">{esc(r["eft_paid_on"])}</td></tr>')
    total_row = ('<tr class="total-row">'
                 f'<td>Total — {len(rows)} remittances</td>'
                 f'<td>{esc(c.get("total_middle",""))}</td>'
                 f'<td class="num mono">{money(total_amt)}</td>'
                 "<td></td><td></td></tr>")

    return TEMPLATE.format(
        issuer_name=esc(c["issuer_name"]), issuer_addr=esc(c["issuer_addr"]),
        issuer_email=esc(c["issuer_email"]), period=esc(c["period"]),
        bill_to_name=esc(c["bill_to_name"]), bill_to_addr=esc(c["bill_to_addr"]),
        invoice_date=esc(c["invoice_date"]), invoice_no=esc(c["invoice_no"]),
        total_amt=money(total_amt), service_lines=esc(c["service_lines"]),
        service_lines_note=esc(c["service_lines_note"]), rate_pct=rate_pct,
        commission=money(commission), n_efts=len(rows),
        basis_note=esc(c["basis_note"]), body_rows=body, total_row=total_row,
    )

TEMPLATE = r"""<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><style>
@page {{ size: Letter; margin: 0; }}
* {{ margin:0; padding:0; box-sizing:border-box; }}
html {{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }}
body {{ font-family:"Helvetica Neue",Helvetica,Arial,"DejaVu Sans",sans-serif; color:#1f2b38; font-size:10.5px; line-height:1.45; }}
.page {{ padding:0 0 40px 0; }}
.header {{ background:#fff; color:#15242f; padding:34px 46px 24px 46px; border-bottom:3px solid #1fb8a6; }}
.kicker {{ font-size:11px; letter-spacing:2.4px; font-weight:700; margin-bottom:12px; color:#15242f; }}
.kicker .accent {{ color:#0f9d8c; }} .kicker .muted {{ color:#9aa8b4; }}
.issuer-name {{ font-size:25px; font-weight:700; letter-spacing:0.3px; margin-bottom:3px; color:#15242f; }}
.issuer-sub {{ font-size:10px; color:#5f7080; margin-bottom:2px; }}
.period {{ color:#0f9d8c; font-size:10.5px; font-weight:600; letter-spacing:0.4px; margin-top:12px; }}
.prepared {{ color:#8b9aa8; font-size:9.5px; margin-top:4px; }}
.meta-row {{ display:flex; justify-content:space-between; margin-top:22px; gap:30px; }}
.meta-label {{ color:#8b9aa8; font-size:8px; letter-spacing:1.6px; font-weight:700; text-transform:uppercase; margin-bottom:4px; }}
.meta-value {{ color:#15242f; font-size:10.5px; line-height:1.5; }} .meta-value strong {{ font-weight:700; }}
.stats {{ display:flex; gap:14px; padding:20px 46px 2px 46px; }}
.card {{ flex:1; background:#fff; border:1px solid #e4e9ee; border-top:3px solid #1fb8a6; border-radius:5px; padding:14px 15px 15px 15px; }}
.card-label {{ color:#6b7c8b; font-size:7.8px; letter-spacing:1.4px; font-weight:700; text-transform:uppercase; margin-bottom:8px; }}
.card-value {{ font-size:22px; font-weight:700; color:#0f9d8c; letter-spacing:-0.3px; line-height:1; }}
.card-value.dark {{ color:#15242f; }} .card-note {{ color:#8b9aa8; font-size:8px; margin-top:7px; }}
.section {{ padding:18px 46px 0 46px; }}
.section-title {{ font-size:12.5px; font-weight:700; color:#15242f; padding-bottom:6px; border-bottom:2px solid #1fb8a6; margin-bottom:12px; display:inline-block; }}
table {{ width:100%; border-collapse:collapse; }}
.inv-table th {{ background:#fff; color:#15242f; font-size:8.4px; letter-spacing:0.8px; text-transform:uppercase; font-weight:700; padding:8px 10px; text-align:left; border-bottom:2px solid #1fb8a6; }}
.inv-table th.num, .inv-table td.num {{ text-align:right; }}
.inv-table td {{ padding:8px 10px; font-size:10px; border-bottom:1px solid #e9edf1; color:#2b3a48; }}
.inv-table tbody tr:nth-child(even) td {{ background:#f7f9fa; }}
.inv-table .total-row td {{ background:#eef7f5 !important; font-weight:700; color:#0f6d61; border-top:2px solid #1fb8a6; border-bottom:none; font-size:10.5px; }}
.mono {{ font-variant-numeric:tabular-nums; }}
.amount-due-strip {{ display:flex; justify-content:flex-end; align-items:center; gap:16px; padding:12px 46px 0 46px; }}
.amount-due-strip .lbl {{ font-size:9px; letter-spacing:1.2px; text-transform:uppercase; font-weight:700; color:#55697a; }}
.amount-due-strip .val {{ font-size:15px; font-weight:700; color:#15242f; }}
.totals-wrap {{ display:flex; justify-content:flex-end; padding:12px 46px 0 46px; }}
.totals-box {{ width:320px; border:1px solid #e4e9ee; border-radius:6px; overflow:hidden; }}
.totals-box .th {{ background:#fff; color:#15242f; font-size:9px; letter-spacing:1.4px; font-weight:700; text-transform:uppercase; padding:9px 16px; border-bottom:2px solid #1fb8a6; }}
.totals-box .row {{ display:flex; justify-content:space-between; padding:9px 16px; font-size:10.5px; border-bottom:1px solid #eef1f4; }}
.totals-box .row .lbl {{ color:#55697a; }} .totals-box .row .val {{ font-weight:600; color:#1f2b38; }}
.totals-box .grand {{ display:flex; justify-content:space-between; align-items:center; padding:13px 16px; background:#eef7f5; border-top:2px solid #1fb8a6; }}
.totals-box .grand .lbl {{ font-size:9px; letter-spacing:1.2px; text-transform:uppercase; font-weight:700; color:#0f6d61; }}
.totals-box .grand .val {{ font-size:18px; font-weight:700; color:#0f9d8c; }}
.note {{ padding:14px 46px 0 46px; color:#7a8996; font-size:8.6px; line-height:1.5; }} .note strong {{ color:#55697a; }}
.thanks {{ padding:18px 46px 0 46px; color:#15242f; font-size:12px; font-weight:600; }}
.footer {{ margin-top:20px; padding:12px 46px; border-top:1px solid #e4e9ee; display:flex; justify-content:space-between; color:#9aa8b4; font-size:8px; letter-spacing:0.5px; }}
</style></head><body><div class="page">
  <div class="header">
    <div class="kicker"><span class="accent">BILLING SERVICES</span> <span class="muted">·</span> INVOICE</div>
    <div class="issuer-name">{issuer_name}</div>
    <div class="issuer-sub">{issuer_addr}</div>
    <div class="issuer-sub">{issuer_email}</div>
    <div class="period">Service &amp; Remittance Period · {period}</div>
    <div class="prepared">Behavioral Health Services · Payer: {bill_to_name}</div>
    <div class="meta-row">
      <div class="meta-block"><div class="meta-label">Bill To</div>
        <div class="meta-value"><strong>{bill_to_name}</strong><br>{bill_to_addr}</div></div>
      <div class="meta-block" style="text-align:right;"><div class="meta-label">Invoice Date</div>
        <div class="meta-value">{invoice_date}</div></div>
      <div class="meta-block" style="text-align:right;"><div class="meta-label">Invoice Number</div>
        <div class="meta-value">{invoice_no}</div></div>
    </div>
  </div>
  <div class="stats">
    <div class="card"><div class="card-label">Total Remittances</div><div class="card-value">{total_amt}</div><div class="card-note">across {n_efts} EFT payments</div></div>
    <div class="card"><div class="card-label">Service Lines</div><div class="card-value dark">{service_lines}</div><div class="card-note">{service_lines_note}</div></div>
    <div class="card"><div class="card-label">Commission Rate</div><div class="card-value dark">{rate_pct}</div><div class="card-note">of net remittances</div></div>
    <div class="card"><div class="card-label">Amount Due</div><div class="card-value">{commission}</div><div class="card-note">commission invoiced</div></div>
  </div>
  <div class="section"><div class="section-title">Invoice Summary</div>
    <table class="inv-table"><thead><tr>
      <th>Date Billed</th><th>Description</th><th class="num">Amount</th><th>EFT</th><th>EFT Paid On</th>
    </tr></thead><tbody>{body_rows}{total_row}</tbody></table>
  </div>
  <div class="amount-due-strip"><span class="lbl">Total Amount Due</span><span class="val mono">{total_amt}</span></div>
  <div class="section" style="padding-bottom:0;"><div class="section-title">Commission Calculation</div></div>
  <div class="totals-wrap"><div class="totals-box">
    <div class="th">Commission Rate · {rate_pct}</div>
    <div class="row"><span class="lbl">Total Remittances</span><span class="val mono">{total_amt}</span></div>
    <div class="row sub"><span class="lbl">Commission ({rate_pct} of total)</span><span class="val mono">{commission}</span></div>
    <div class="grand"><span class="lbl">Grand Total</span><span class="val mono">{commission}</span></div>
  </div></div>
  <div class="note"><strong>Basis of invoice:</strong> {basis_note}</div>
  <div class="thanks">Thank you for your business!</div>
  <div class="footer"><span>Invoice · {issuer_name} · {period}</span><span>{invoice_no} · Page 1 of 1</span></div>
</div></body></html>"""

if __name__ == "__main__":
    HTML(string=build_html(CONFIG)).write_pdf(OUTFILE)
    print("Wrote", OUTFILE)
```

---

## House rules (keep output consistent)

- **One page.** Trim paddings before ever allowing a page break.
- **Ink‑light.** Header, cards, table header, and commission header are white with a teal rule;
  the only fills are the three faint light‑teal total strips. Don't reintroduce dark bands.
- **Grand Total = the commission** (5% of the total), not the full remittance amount.
- **Don't invent numbers.** `Amount` values and the total come from real remittance data; the
  script's summed total must equal what you expect. If it doesn't, re‑check the `rows`.
