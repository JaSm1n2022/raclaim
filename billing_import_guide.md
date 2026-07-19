# Billing Excel → Supabase Import Guide

How to get a nine-column behavioral-health billing log (`.xlsx`) into your database table, with a **review before you insert**.

---

## 1. What the Excel looks like

Sheet name: **Billing**

| NAME | DOS | START | END | DURATION | CODE | SERVICE | LOCATION | EMPLOYEE |
|------|-----|-------|-----|----------|------|---------|----------|----------|
| Ira Little | 06/15/2026 | 13:00 | 15:00 | 0 | F20.9; F41.9; F31.64 | H2014 | Home | Cristian Flaviani |

---

## 2. Column mapping

| Excel column | → DB column | Transform |
|---|---|---|
| NAME | `client_name` | as-is |
| DOS | `date_of_service` | `MM/DD/YYYY` → `YYYY-MM-DD` |
| START | `dos_start` | keep as text |
| END | `dos_end` | keep as text |
| DURATION | `unit` | integer (H2014 / H2017 = 0) |
| CODE | `primary_dx_cd` | keep the full dx string verbatim |
| SERVICE | `service_code` | as-is |
| LOCATION | `service_location` | as-is |
| EMPLOYEE | `employee` **and** `provider` | same value in both |
| *(derived)* | `service_desc` | look up from service code (see below) |

**Service code → description**

- `H2014` → BST (Skills Training and Development)
- `H2017` → PSR (Psychosocial Rehabilitation)

**Set at Save time (not from the Excel):** `billed_on` — from the "Billed On" date prompt shown when Save is clicked (see section 3); same value on every row in the batch.

**Left to database defaults:** `id`, `created_at`, `companyId`, `status`.

**Left null:** `client_id`, `client_code` — the Excel has no client identifiers, so don't guess. Fill them only if you look the client up by name and get exactly one match.

---

## 3. The review modal (the ONLY way to insert)

**Rule: nothing is written to the database except from the review modal, and only for rows the user has checked.** Uploading the Excel never auto-inserts. The flow is always: upload → parse → show modal → user selects → Save.

### Modal behavior

1. **Upload parses, it does not save.** Selecting the `.xlsx` reads and maps the rows (section 2) into memory only — no DB call yet.
2. **Every row gets a checkbox.** The modal lists all parsed rows, each with a checkbox and its mapped preview (name, DOS, times, service code + desc, unit, dx).
3. **Default checked state:**
   - Clean rows → **checked** by default.
   - Rows with a **blocking** issue → **unchecked and disabled** (can't be selected until fixed): missing NAME, unparseable DOS, missing SERVICE, or a detected duplicate.
   - Rows with a **soft** warning → checked but visibly flagged (unknown service code, duration mismatch): user decides.
4. **Select-all / clear-all** at the top, plus a live count: *"3 of 5 rows selected."*
5. **Save button** inserts **only the checked rows**. It is disabled when zero rows are checked.
6. **On Save, prompt for a "Billed On" date.** Clicking Save first asks for a single **Billed On** date (a date picker; defaults to today, editable). The confirm on that prompt is what actually runs the insert. The chosen date is applied to `billed_on` on **every** row being saved — one value for the whole batch, not per row.
7. After Save, show how many inserted and re-run the duplicate check so the same file can't double-post on a second Save.

### Per-row checks that drive the flags

- **Bad / unparseable DOS** — blocking. Must resolve to a real `YYYY-MM-DD`.
- **Missing NAME or SERVICE** — blocking. Both required.
- **Possible duplicate** — blocking. Same `client_name` + `date_of_service` + `service_code` already in the table.
- **Unknown service code** — soft. Not in the map → `service_desc` null; confirm it's real.
- **Duration mismatch** — soft. `H2014` / `H2017` should be `0`.

---

## 4. Doing the insert (for the selected rows only)

Whatever tool you use, build the `INSERT` from the **checked rows only** — the modal is the gate.

### Supabase SQL Editor (bulk paste)

Translate the checked rows into one `INSERT` and run it. Example for the two sample rows:

```sql
insert into efts (
  client_name, date_of_service, dos_start, dos_end, unit,
  primary_dx_cd, service_code, service_desc, service_location,
  employee, provider, billed_on
) values
  ('Ira Little', '2026-06-15', '13:00', '15:00', 0,
   'F20.9; F41.9; F31.64', 'H2014', 'BST (Skills Training and Development)', 'Home',
   'Cristian Flaviani', 'Cristian Flaviani', '2026-06-22'),
  ('Ira Little', '2026-06-16', '10:30', '12:30', 0,
   'F20.9; F41.9; F31.64', 'H2017', 'PSR (Psychosocial Rehabilitation)', 'Home',
   'Cristian Flaviani', 'Cristian Flaviani', '2026-06-22');
```

> Replace `efts` with your actual table name, and `2026-06-22` with the date chosen in the "Billed On" prompt (same value on every row). Add one `(...)` line per selected row.

Optional — check for duplicates first:

```sql
select client_name, date_of_service, service_code, count(*)
from efts
where client_name = 'Ira Little'
  and date_of_service in ('2026-06-15', '2026-06-16')
group by 1, 2, 3;
```

---

## 5. Open item

- **`unit` vs. DURATION** — the table has no duration column, so DURATION maps to `unit`. If `unit` means billing units rather than minutes, decide what value it should hold before inserting.
- **`client_id` / `client_code`** — still unresolved from the Excel alone. Populate from a client lookup only, never a guess.
