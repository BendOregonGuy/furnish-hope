# Import templates

`furnish-hope-import-templates.xlsx` is a Microsoft Excel workbook
with one sheet per importable database table. Open it in Excel,
Google Sheets, or LibreOffice — fill in the rows under the header,
hand the file to your admin, and they bulk-load it.

## What's in the workbook

- **Instructions tab (first)** — overview of how to read each sheet,
  what the fill colors mean, and how to handle foreign-key columns.
- **One tab per table** — 52 tables total. Sheet names match the
  database table names with the `tbl_` prefix removed (so `tbl_donor`
  becomes `donor`).

Each table tab has:

- **Row 1** — column names. **Light terracotta** = REQUIRED.
  **Light blue** = foreign key (must reference an existing record).
  **Cream** = optional with sensible default.
- **Row 2** — type hint (text length cap, date format, etc.).
- **Row 3** — for FKs, the target table + column. For required
  columns, a `REQUIRED` tag.
- **Row 4** — a divider you should delete before importing.
- **Rows 5 and below** — your data.

## What's intentionally excluded

- All `lkp_*` lookup tables — they hold dropdown values seeded by
  the system. Edit them at `/admin/<table>` if needed.
- System tables (`tbl_audit_log`, `tbl_session`, etc.).
- Binary or encrypted tables (`tbl_attachment_blob`,
  `tbl_email_account`, etc.) — use the in-app upload flows.
- Auto-managed singletons (`tbl_org_branding`,
  `tbl_quickbooks_connection`, `tbl_receipt_counter`).

The full list with reasons is in `EXCLUDED_TABLES` at the top of
[`scripts/generate_import_templates.py`](../../scripts/generate_import_templates.py).

## Regenerating

Whenever the schema changes (new tables, new columns), regenerate:

```
cd C:\Users\prest\furnish-hope
python scripts/generate_import_templates.py
```

The script reads the live local Postgres, so your local DB must be
up to date — easiest way is to start the API once
(`cd api && npm run dev`), which runs all idempotent migrations.

Output overwrites this `xlsx` file.
