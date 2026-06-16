# Regenerating the database ERD PDF

This document walks you through everything needed to regenerate
`docs/FurnishHopeERD.pdf` — the multi-page entity-relationship diagram
served from **System → Database Admin → View ERD (PDF)**.

You'll need to regenerate the PDF any time the database schema changes
(new table, new column, new foreign key). Until you regenerate, the PDF
in the repo shows the OLD schema; the app keeps serving that stale PDF
until you commit and push a fresh one.

The whole process is one Python command, but it relies on five
prerequisites that have to be installed once. The first section walks
through the one-time setup; after that, regenerating is two commands.

---

## Audience

Whoever maintains the Furnish Hope app — currently Preston. You don't
have to know Python or SQL. Anyone who can copy-paste a command into a
PowerShell window can do this.

## Operating system

These instructions are written for **Windows 10 or 11**. The script
itself runs on Mac / Linux too, but installation commands differ — if
you ever move to a different machine, the package names and shell
commands are still `graphviz`, `pypdf`, `psycopg2`, plus the Graphviz
binary itself; the install commands change.

---

## Part 1 — One-time setup (only do this once per computer)

You only need to do this section the FIRST time you regenerate the PDF
on a given machine. Once it's done, skip straight to Part 2.

### 1.1 Open PowerShell

PowerShell is the black window you've used for `git push` and `npm run dev`.

- Press the **Windows key**.
- Type `powershell` (no quotes).
- Press **Enter**. A black window with a blinking cursor opens.

Leave this window open for the rest of the setup. Every command below
goes in this window.

### 1.2 Verify Postgres is installed

You already installed Postgres when you first set up Furnish Hope. To
confirm it's still there, paste this command and press Enter:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" --version
```

You should see something like `psql (PostgreSQL) 16.x`. If you get
`The system cannot find the path specified` instead, reinstall Postgres
following the original setup instructions before continuing.

### 1.3 Verify Python is installed

Paste and press Enter:

```powershell
python --version
```

You should see `Python 3.10`, `3.11`, `3.12`, or `3.13`. If you get
`'python' is not recognized`, install it:

1. Go to <https://www.python.org/downloads/>.
2. Click the big yellow **Download Python 3.x.x** button.
3. Open the downloaded installer.
4. **Important:** check the box **Add python.exe to PATH** at the bottom
   of the first installer screen.
5. Click **Install Now**.
6. Close PowerShell. Open a new PowerShell window (Win → "powershell" →
   Enter) so it picks up the new PATH.
7. Re-run `python --version` to confirm.

### 1.4 Install Graphviz

Graphviz is the tool that actually draws the boxes and arrows in the
PDF. Install it with one command:

```powershell
winget install --id Graphviz.Graphviz --source winget -e --silent --accept-source-agreements --accept-package-agreements
```

This downloads about 8 MB and runs the installer silently. When it's
done you'll see `Successfully installed`.

Confirm Graphviz is on PATH:

```powershell
& "C:\Program Files\Graphviz\bin\dot.exe" -V
```

You should see `dot - graphviz version 15.x` or similar. If the path
`C:\Program Files\Graphviz\bin\dot.exe` doesn't exist after install,
the script in Part 2 will try to find it automatically; if all else
fails, see Troubleshooting below.

### 1.5 Install the Python packages

The script needs three Python packages. Install all three with one
command:

```powershell
pip install graphviz pypdf psycopg2
```

This downloads about 5 MB. It's done when the prompt returns. (Warnings
about pip being out of date are harmless — ignore them.)

Confirm they all installed:

```powershell
python -c "import graphviz, pypdf, psycopg2; print('ok')"
```

You should see `ok` printed. If any one fails to import, re-run `pip
install <package_name>` for just that one.

### 1.6 Confirm the local database has the latest schema

The script reads from your **local** Postgres database. It can only
draw what's actually in your local schema, so you need to make sure
that schema matches what's deployed:

1. In PowerShell, go to the repo:

   ```powershell
   cd C:\Users\prest\furnish-hope
   ```

2. Pull the latest code from GitHub:

   ```powershell
   git pull
   ```

3. Start the API once so the migrations run against your local DB. In
   a separate PowerShell window:

   ```powershell
   cd C:\Users\prest\furnish-hope\api
   npm run dev
   ```

   Wait until you see `Furnish Hope API listening on http://localhost:4000`.
   Migrations have now applied. You can leave this window running, or
   stop the API with **Ctrl+C** — it doesn't need to be running while
   you generate the PDF.

You're done with one-time setup. Don't repeat any of Part 1 unless you
switch to a new computer.

---

## Part 2 — Regenerate the PDF (every time)

This is the part you'll do whenever the schema changes. Three
commands total.

### 2.1 Open PowerShell and go to the repo

```powershell
cd C:\Users\prest\furnish-hope
```

### 2.2 Make sure your local DB has the latest schema

If you haven't started the API since the last `git pull`, do that now
so migrations run. (See step 1.6 above for the commands.) Otherwise,
skip to 2.3.

### 2.3 Run the generator

```powershell
python scripts\generate_erd_pdf.py
```

You should see output like:

```
Connecting to postgres://postgres@localhost:5432/furnish_hope ...
  found 139 tables, 211 foreign keys
  [01] Contacts & Addresses: 11 tables -> 01_contacts_and_addresses.pdf
  [02] Clients & Households: 24 tables -> 02_clients_and_households.pdf
  ...
  [11] System: Auth, Audit, Issues, Settings: 8 tables -> 11_system_...pdf

Wrote C:\Users\prest\furnish-hope\docs\FurnishHopeERD.pdf  (549 KB, 12 pages)
```

The script takes about 30 seconds. The new PDF replaces the old one at
`docs\FurnishHopeERD.pdf`.

### 2.4 Verify the PDF looks right (optional)

Double-click `C:\Users\prest\furnish-hope\docs\FurnishHopeERD.pdf` to
open it in your PDF viewer. Page 1 is the cover; pages 2–12 are the
themed diagrams. Spot-check a couple of pages — every table should
have an orange or green header, columns listed, and PK/FK badges where
applicable.

### 2.5 Commit and push

This is the step that makes the new PDF show up in the live app on the
DigitalOcean dev server.

```powershell
cd C:\Users\prest\furnish-hope
git add docs\FurnishHopeERD.pdf
git commit -m "docs: refresh ERD"
git push
```

DigitalOcean will rebuild the app in 3–5 minutes. Once it's done, the
**View ERD (PDF)** button on Database Admin will serve the new PDF.

---

## Troubleshooting

### "python is not recognized as an internal or external command"

You either didn't install Python or didn't check the "Add to PATH" box
during install. Re-run the Python installer (see 1.3) and make sure
that checkbox is on. Then close and reopen PowerShell.

### "winget: command not found"

You're on an older Windows or winget hasn't been enabled. Open the
Microsoft Store, search for **App Installer**, and install/update it.
Then close and reopen PowerShell.

### "Failed building wheel for psycopg2"

Use the pre-built binary version instead:

```powershell
pip install psycopg2-binary
```

The script will use whichever one is installed.

### "ERROR: the Graphviz 'dot' binary is not on PATH"

The script will say this if Graphviz isn't installed or isn't where it
expects. First, confirm Graphviz really did install:

```powershell
Test-Path "C:\Program Files\Graphviz\bin\dot.exe"
```

If `True`, Graphviz is installed but PATH doesn't have it. The script
auto-adds that folder to PATH for its own run, so this should "just
work" — but if you see this error anyway, manually add it to PATH:

1. Press Win key, type "environment variables", Enter.
2. Click **Environment Variables…** at the bottom right.
3. Under **User variables**, find **Path** and click **Edit…**.
4. Click **New**, paste `C:\Program Files\Graphviz\bin`, click **OK**
   on every dialog.
5. Close and reopen PowerShell.
6. Run `dot -V` to confirm.

If `Test-Path` returned `False`, repeat 1.4.

### "FATAL: password authentication failed for user postgres"

The script uses the default postgres/postgres credentials. If you
changed your local Postgres password, tell the script what to use:

```powershell
$env:PGPASSWORD = "your-actual-password"
python scripts\generate_erd_pdf.py
```

That sets the password for the current PowerShell window only — close
the window and it's forgotten.

### "could not connect to server: Connection refused"

Postgres isn't running. Start it:

```powershell
Start-Service postgresql-x64-16
```

If you see "Cannot find any service…", the Postgres service is named
something else; check installed services with:

```powershell
Get-Service postgresql-*
```

…and use whatever name appears.

### "WARNING: N table(s) not assigned to any theme"

A new table was added since the script's theme list was written. The
PDF was still generated, but the new tables are missing. To fix:

1. Open `scripts\generate_erd_pdf.py` in any text editor.
2. Find the `THEMES` list near the top.
3. Add the new table name to the theme that fits best (or create a new
   theme).
4. Re-run the script.

### The committed PDF is huge and `git push` is slow

The PDF is around 500–700 KB, which is fine. If you see something in
the tens of megabytes, the script probably wrote intermediate files
into `docs\` by mistake. Confirm only `FurnishHopeERD.pdf` is in
`docs\`:

```powershell
ls docs\*.pdf
```

If you see numbered PDFs (`01_…`, `02_…`), delete them — they're meant
to live in `build\` (which is gitignored). Re-run the script.

---

## What the script actually does (background)

Skip this if you just want to regenerate. Here's what's happening
behind `python scripts\generate_erd_pdf.py`:

1. **Connect to Postgres** at `localhost:5432`, database `furnish_hope`,
   user `postgres`. Reads connection info from environment variables if
   set (`PGHOST`, `PGUSER`, etc.).
2. **Query `information_schema`** to pull every table that starts with
   `tbl_` or `lkp_`, all their columns, primary keys, and foreign keys.
3. **Group tables into themes** using a hand-curated list at the top of
   the script. Each theme becomes one landscape page.
4. **Generate a DOT file** per theme using the Graphviz Python library.
   Each table becomes a record-shaped node with one row per column; PK
   columns get a `PK` badge, FK columns get an `FK` badge and an arrow
   to the referenced table. Foreign keys that point OUT of the current
   theme are annotated under the source column instead of drawing a
   cross-page arrow.
5. **Render each DOT file** to a single-page PDF using the `dot` binary.
6. **Merge** the cover page + every theme page into the final
   `docs/FurnishHopeERD.pdf` using the `pypdf` library.

The intermediate per-theme PDFs land in `build\erd\` (which is
gitignored) so they don't clutter the repo. Only the merged final PDF
is committed.

---

## Where this PDF is served from

The Express route is `GET /api/admin/erd` (defined in
`api/src/routes/admin.ts`). It streams the file at
`docs/FurnishHopeERD.pdf` with `Content-Type: application/pdf` and a
`Cache-Control: private, max-age=300` header (5-minute browser cache).
The route is mounted under `/api/admin/*`, which enforces
`requireAdmin` — so only admin users can open the PDF.

The **View ERD (PDF)** button on `/admin` (file
`web/src/pages/admin/AdminIndex.tsx`) points at that endpoint with
`target="_blank"` so it opens in a new tab.

---

## Quick reference card

When the schema changes:

```powershell
cd C:\Users\prest\furnish-hope
git pull                              # latest code
cd api ; npm run dev                  # let migrations run; Ctrl+C when ready
cd ..
python scripts\generate_erd_pdf.py    # regenerate
git add docs\FurnishHopeERD.pdf
git commit -m "docs: refresh ERD"
git push                              # DO rebuilds in ~5 min
```

That's it. Anyone who can copy-paste those lines can keep the ERD
current.
