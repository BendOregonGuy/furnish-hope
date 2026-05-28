# Furnish Hope — Internal Ops Platform

A full-stack starter for the Furnish Hope internal operations platform. Three pieces:

```
furnish-hope/
├── db/      PostgreSQL schema (85 tables) + seed data
├── api/     Node + Express + TypeScript REST API
└── web/     React + Vite + Tailwind frontend
```

The starter is wired for the **Operations Coordinator** role and exercises three
new workflows beyond the original mockup: donation pickup scheduling, delivery
execution + recipient sign-off, and volunteer onboarding & hours.

---

## What's here

### Database (`/db`)

- `01_schema.sql` — 85 tables, 115 FK constraints, 115 indexes. Generated from
  ERD v5.
- `02_seed.sql` — populates all lookup tables (geography, item categories,
  statuses, vehicle types, etc.) plus a curated demo dataset:
  - 1 corporate entity (Furnish Hope), 2 facilities (Bend Warehouse, Redmond Storage)
  - 5 clients spanning client types (refugee family, veteran, recovery
    graduate, DV survivor)
  - 5 partner agencies (Latino Community Association, NeighborImpact, Saving
    Grace, COVO, BestCare)
  - 6 facility staff (3 paid, 3 volunteers) with onboarding profiles, skills,
    and YTD hours
  - 3 donors, 3 donations, 9 donation items, ~16 inventory items
  - 3 vehicles with mileage logs and maintenance history
  - A full provisioning request for the Navarro family with 10 reserved items
  - A scheduled delivery for Devon Kelley with crew assigned
  - A scheduled donation pickup

### API (`/api`)

Express + TypeScript. Routes:

| Path | Purpose |
|---|---|
| `GET /api/dashboard` | Headline metrics + pending requests + recent donations |
| `GET /api/clients` | List clients (filterable: `search`, `status`, `type`) |
| `GET /api/clients/:id` | Client detail + provisioning request history |
| `GET /api/requests` | List provisioning requests with match progress |
| `GET /api/requests/:id` | Request detail + items + reserved inventory |
| `GET /api/inventory` | Filterable inventory list (`status`, `category`, `condition`, `facility`, `search`) |
| `GET /api/inventory/suggestions?category=…` | Items matching a request category, not yet reserved |
| `GET /api/deliveries` | Delivery list (filter: `upcoming`, `status`) |
| `GET /api/deliveries/:id` | Delivery + crew + items + receipt |
| `POST /api/deliveries/:id/receipt` | Record recipient sign-off (transactional) |
| `GET /api/pickups` | Donation pickup list |
| `GET /api/pickups/:id` | Pickup detail |
| `POST /api/pickups` | Schedule a new pickup |
| `GET /api/volunteers` | Volunteer list with hours + skills |
| `GET /api/volunteers/:id` | Volunteer detail + hours log + totals |
| `POST /api/volunteers/:id/hours` | Log volunteer hours |
| `GET /api/lookups/:name` | Generic lookup tables for select boxes (whitelisted) |

**Deliberately deferred:** auth/sessions, file uploads, pagination on every
list, complex search/filter UIs, audit log writes. The `tbl_user_account` and
`tbl_audit_log` tables exist but aren't wired up.

### Web (`/web`)

React 18 + Vite + TypeScript + Tailwind + TanStack Query + React Router.

Pages: Dashboard, Clients (list + detail), Provisioning Requests (list +
detail), Inventory, Deliveries (list + detail with sign-off form), Donation
Pickups, Volunteers (list + detail with log-hours form).

The recipient sign-off workflow is the headline new piece — opens a modal,
collects the three booleans (`all_items_received`, `condition_acceptable`,
`photo_release_granted`) plus optional notes, and on submit transactionally
marks the delivery `Delivered`, dispositions the inventory items, and fulfills
the reservations.

---

## Local setup

### 1. Database

Requires PostgreSQL 14 or newer.

```bash
createdb furnish_hope
psql -d furnish_hope -f db/01_schema.sql
psql -d furnish_hope -f db/02_seed.sql
```

### 2. API

```bash
cd api
npm install
PGDATABASE=furnish_hope PGUSER=$USER npm run dev
```

The API listens on `http://localhost:4000`. Connection settings are read from
env vars:

| Var | Default |
|---|---|
| `PGHOST` | `localhost` |
| `PGPORT` | `5432` |
| `PGDATABASE` | `furnish_hope` |
| `PGUSER` | `postgres` |
| `PGPASSWORD` | `postgres` |
| `PORT` | `4000` |
| `WEB_ORIGIN` | `http://localhost:5173` (for CORS) |

### 3. Web

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api/*` to
`http://localhost:4000` so CORS is a non-issue in dev.

---

## Typecheck

Both packages typecheck cleanly:

```bash
cd api && npm run typecheck
cd web && npm run typecheck
```

---

## Design notes

- **Brand palette** lives in `web/tailwind.config.js` as named tokens
  (`cream`, `ink`, `terracotta`, `sage`, `gold`, `slate`). Components use these
  rather than generic Tailwind colors so a rebrand is a one-file change.
- **Component classes** in `web/src/index.css` (`.pill`, `.btn-primary`,
  `.card`, `.field-input`) keep markup consistent without component sprawl.
- **API shape**: every endpoint returns JSON; errors use `{ error: string }`
  with appropriate HTTP code. The frontend wraps fetch in
  `web/src/lib/api.ts` for centralized handling.
- **Status pills** auto-colorize via `pillClassFor()` in
  `web/src/components/ui.tsx`. Add a new status, and the pill picks a sensible
  color family without site-wide edits.
- **TanStack Query** keys follow `[resource, ...params]` —
  `['clients', search]`, `['delivery', id]`, etc. Mutations
  `invalidateQueries` on the entities they touch so the UI stays in sync.

---

## What to build next

Logical next slices, in rough priority order:

1. **Authentication** — `tbl_user_account` exists; wire JWT/session +
   middleware that hangs `req.user` off the staff record.
2. **New referral wizard** — re-implement the 4-step intake form from the
   original HTML mockup as a real React flow that POSTs to a new
   `/api/referrals` endpoint.
3. **Match & reserve UI** — currently inventory matching happens in seed data;
   the request detail page should let an ops coordinator browse suggestions
   (`/api/inventory/suggestions`) and reserve them directly.
4. **File uploads** — `tbl_attachment` storage for delivery photos, signatures,
   waiver scans. Probably S3 + signed URLs.
5. **Audit log** — wrap mutating endpoints to write `tbl_audit_log` rows.
6. **Agency portal** — separate user role with restricted views (only their
   own referrals).
