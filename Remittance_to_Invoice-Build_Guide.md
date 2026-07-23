# Remittance Summary → Commission Invoice — Build Guide

**Purpose.** When a **Remittance Summary PDF** is uploaded, produce a one‑page, ink‑light
**Commission Invoice** PDF for Jasmin Angela Velasco in the house style
(white header + teal rule, teal‑topped stat cards, light table header, teal total strips).

This works for **any payer/program**. The remittance's own header decides the wording:

| Remittance header says… | Description used on the invoice |
|---|---|
| **Medicaid Remittance** | `Medicaid Remittance` |
| **Medicare Remittance** | `Medicare Remittance` |
| *(other, e.g. Commercial)* | use whatever the header names it |

---

## 1. What to read from the uploaded PDF

Only the **Remittance Summary** block matters. It looks like this:

```
Remittance Summary
EFT Number   Billed On    Remittance Date   EFT Date     # Claims   Net Paid
002335431    06/22/2026   06/26/2026        07/03/2026   105        $8,369.60
002338686    06/29/2026   07/03/2026        07/10/2026   107        $9,737.12
002341765    07/06/2026   07/10/2026        07/17/2026    72        $6,934.40
002344834    07/13/2026   07/17/2026        07/24/2026    78        $7,720.48
TOTAL — 4 REMITTANCES                                    362        $32,761.60
```

Also grab these one‑line facts from the top of the remittance for the header:

- **Remittance type** — from the big header line (`MEDICAID REMITTANCE …` → *Medicaid*, `MEDICARE REMITTANCE …` → *Medicare*).
- **Service & Remittance Period** — e.g. `06/22/2026 – 07/17/2026`.
- **Prepared‑for line** — issuer name (Jasmin Angela Velasco), **Payer** (→ Bill To), and **Generated** date (→ Invoice Date).

> Extraction tip: `pdftotext -layout remittance.pdf out.txt` then read the Remittance Summary
> table. Ignore the per‑EFT line‑item detail pages — they aren't needed for the invoice.

---

## 2. Field mapping (Remittance Summary → Invoice "Bill Invoice" table)

The invoice table has exactly five columns. Map them like this:

| Invoice column | Comes from |
|---|---|
| **Date Billed** | `Billed On` |
| **Description** | `<Remittance type> Remittance · <# Claims> claims` |
| **Amount** | `Net Paid` |
| **EFT** | `EFT Number` |
| **EFT Paid On** | `EFT Date` |

One invoice row per remittance line. Then a **Total** row = totals of the `# Claims` and `Net Paid` columns.

---

## 3. Derived values (money logic)

- **Total Amount Due** = sum of `Net Paid` (matches the remittance TOTAL row).
- **Commission Rate** = **5%** (constant unless told otherwise).
- **Commission** = round(Total Amount Due × 0.05, 2).
- **Grand Total** = **Commission** *(this is what Jasmin is actually owed; the $32k is money collected on the payer's behalf).*
- Stat card **Service Lines** = total `# Claims`.

---

## 4. Fixed issuer constants (don't extract — these are Jasmin's)

```
Name:    Jasmin Angela Velasco
Address: 875 E Silverado Ranch Blvd, Apt 1120, Las Vegas, NV 89183
Email:   jasminangelav10@gmail.com
Commission rate: 5%
```

- **Invoice Number** = `JAV-YYYY-MMDD` using the **period‑end** date (e.g. period end `07/17/2026` → `JAV-2026-0717`).
- **Invoice Date** = the remittance's *Generated* date. If absent, use today.
- **Bill To** = the Payer from the prepared‑for line (e.g. `Best Choice Health Partners`, `Las Vegas, NV 89119`).

---

## 5. Build it

Save the script below as `build_invoice.py`, fill the `CONFIG` block with the values read in
steps 1–4, then run it. The styling is baked in and matches the approved final version exactly.

```bash
pip install weasyprint --break-system-packages -q
python3 build_invoice.py
# QA: confirm ONE page, header/table/commission are light-ink
pdftoppm -jpeg -r 120 -f 1 -l 1 "Jasmin_Angela_Velasco-Invoice_Summary.pdf" /tmp/qa && echo open /tmp/qa-1.jpg
```

Output file: `Jasmin_Angela_Velasco-Invoice_Summary.pdf` (one page).

---

## 6. `build_invoice.py`

```python
#!/usr/bin/env python3
"""Remittance Summary -> Commission Invoice (ink-light house style)."""
from weasyprint import HTML

# ============================ CONFIG — EDIT THESE ============================
CONFIG = {
    # --- header / meta ---
    "issuer_name":  "Jasmin Angela Velasco",
    "issuer_addr":  "875 E Silverado Ranch Blvd, Apt 1120, Las Vegas, NV 89183",
    "issuer_email": "jasminangelav10@gmail.com",
    "remittance_type": "Medicaid",           # "Medicaid" | "Medicare" | ...
    "period":       "06/22/2026 – 07/17/2026",
    "bill_to_name": "Best Choice Health Partners",
    "bill_to_addr": "Las Vegas, NV 89119",
    "invoice_date": "07/19/2026",            # remittance "Generated" date
    "invoice_no":   "JAV-2026-0717",         # JAV-YYYY-MMDD from period end
    "commission_rate": 0.05,                 # 5%

    # --- one entry per Remittance Summary row (order preserved) ---
    "rows": [
        {"billed_on": "06/22/2026", "claims": 105, "amount": 8369.60, "eft": "002335431", "eft_paid_on": "07/03/2026"},
        {"billed_on": "06/29/2026", "claims": 107, "amount": 9737.12, "eft": "002338686", "eft_paid_on": "07/10/2026"},
        {"billed_on": "07/06/2026", "claims":  72, "amount": 6934.40, "eft": "002341765", "eft_paid_on": "07/17/2026"},
        {"billed_on": "07/13/2026", "claims":  78, "amount": 7720.48, "eft": "002344834", "eft_paid_on": "07/24/2026"},
    ],
}
OUTFILE = "Jasmin_Angela_Velasco-Invoice_Summary.pdf"
# ============================================================================

def money(x): return "${:,.2f}".format(x)

def build_html(c):
    rows = c["rows"]
    rtype = c["remittance_type"]
    total_amt = round(sum(r["amount"] for r in rows), 2)
    total_claims = sum(r["claims"] for r in rows)
    commission = round(total_amt * c["commission_rate"], 2)
    rate_pct = "{:g}%".format(c["commission_rate"] * 100)

    body_rows = ""
    for r in rows:
        body_rows += (
            "<tr>"
            f'<td class="mono">{r["billed_on"]}</td>'
            f'<td>{rtype} Remittance · {r["claims"]} claims</td>'
            f'<td class="num mono">{money(r["amount"])}</td>'
            f'<td class="mono">{r["eft"]}</td>'
            f'<td class="mono">{r["eft_paid_on"]}</td>'
            "</tr>"
        )
    total_row = (
        '<tr class="total-row">'
        f'<td>Total — {len(rows)} remittances</td>'
        f'<td>{total_claims} claims</td>'
        f'<td class="num mono">{money(total_amt)}</td>'
        "<td></td><td></td></tr>"
    )

    return TEMPLATE.format(
        issuer_name=c["issuer_name"], issuer_addr=c["issuer_addr"], issuer_email=c["issuer_email"],
        period=c["period"], rtype=rtype,
        bill_to_name=c["bill_to_name"], bill_to_addr=c["bill_to_addr"],
        invoice_date=c["invoice_date"], invoice_no=c["invoice_no"],
        total_amt=money(total_amt), total_claims=total_claims,
        rate_pct=rate_pct, commission=money(commission),
        n_efts=len(rows), body_rows=body_rows, total_row=total_row,
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
    <div class="card"><div class="card-label">Service Lines</div><div class="card-value dark">{total_claims}</div><div class="card-note">claims paid in period</div></div>
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
  <div class="note"><strong>Basis of invoice:</strong> Amounts reflect net {rtype} remittances (EFT payments)
    received for behavioral health services rendered during the service period. Commission is calculated at
    {rate_pct} of total net remittances. The Grand Total represents the commission payable.</div>
  <div class="thanks">Thank you for your business!</div>
  <div class="footer"><span>Invoice · {issuer_name} · {period}</span><span>{invoice_no} · Page 1 of 1</span></div>
</div></body></html>"""

if __name__ == "__main__":
    HTML(string=build_html(CONFIG)).write_pdf(OUTFILE)
    print("Wrote", OUTFILE)
```

---

## 7. Conventions locked in (so output stays consistent)

- **One page.** If a remittance has many EFT rows and it spills, reduce the section paddings
  (`.stats`, `.section`) by a few px until it fits — never split the invoice across pages.
- **Ink‑light.** Header, stat cards, table header, and commission header are all white with a
  teal rule. The only fills are the three faint light‑teal total strips (Total row, Total Amount
  Due, Grand Total). Keep it that way.
- **Money never invented.** Amounts, claim counts, and the total come straight from the
  remittance's own Remittance Summary — including its TOTAL row, which the script's computed
  total must match. If they don't match, stop and re‑check the extraction.
- **Description follows the header.** Medicaid remittance → "Medicaid Remittance"; Medicare
  remittance → "Medicare Remittance". Don't relabel.
- **Grand Total = commission (5%)**, not the full remittance total.
