# Deploying Furnish Hope to DigitalOcean App Platform

This is the v0.8 beta deployment guide. The target stack is DigitalOcean
**App Platform** (Node web service) + **Managed Postgres**, deploying from a
Git repo via auto-deploy on push.

Estimated time end-to-end: **45–90 minutes** the first time.
Estimated cost: **~$20/month** (~$5 App + ~$15 Postgres dev tier).

---

## What's already done in the repo

The code is deployment-ready:

- `package.json` at the repo root with `build` + `start` scripts
- `api/src/index.ts` serves both the REST API and the built React bundle when
  `NODE_ENV=production` (single Express service)
- `.do/app.yaml` describes the App Platform deployment as code
- `engines.node` pinned to 22.x in all package.json files
- `app.set('trust proxy', 1)` set in production so `req.ip` is the real
  client behind DO's load balancer
- Health check at `GET /api/health` (unauthenticated)
- Session cookies become `Secure` automatically when `SESSION_SECURE=true`

Verify locally any time:
```bash
npm run build
NODE_ENV=production PORT=4001 SESSION_SECRET=<32 hex bytes> npm start
# Then browse to http://localhost:4001
```

---

## Step 1 — Create a Git repo (5 min)

App Platform pulls code from GitHub / GitLab / BitBucket. The instructions
below assume GitHub.

1. Create a **private** repo at https://github.com/new — name it `furnish-hope`.
2. Push from the local machine:
   ```bash
   cd C:\Users\prest\furnish-hope
   git add -A
   git commit -m "v0.8 — initial deployment-ready commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/furnish-hope.git
   git push -u origin main
   ```
3. Confirm `.env` is **not** in the push:
   ```bash
   git ls-files | grep "\.env$" || echo "OK: .env not tracked"
   ```

⚠️ The `api/.env` file is in `.gitignore` and must stay local. Production
secrets go through App Platform's encrypted env-vars UI.

---

## Step 2 — Authenticate `doctl` (5 min)

The DigitalOcean CLI is already installed on this machine. Authenticate once:

1. Get an API token: https://cloud.digitalocean.com/account/api/tokens
   - Name: `furnish-hope-cli`
   - Scopes: Read + Write
2. Run:
   ```bash
   doctl auth init --context furnish-hope
   doctl auth switch --context furnish-hope
   doctl account get   # should print your DO email
   ```

---

## Step 3 — Edit `.do/app.yaml` for your repo (1 min)

Open `.do/app.yaml` and replace the placeholder repo URL:

```yaml
git:
  repo_clone_url: https://github.com/<your-username>/furnish-hope.git
  branch: main
```

Commit + push:
```bash
git commit -am "wire app.yaml to my github repo"
git push
```

---

## Step 4 — Create the App + Postgres (10 min)

Two ways. Pick one.

### Option A — Via the web console (recommended first time)

1. Go to https://cloud.digitalocean.com/apps → **Create App**.
2. **Source:** GitHub, pick the `furnish-hope` repo, branch `main`.
   Authorize DO to access the repo if prompted.
3. DO auto-detects a Node service. **Edit** it:
   - Build command: `npm run build`
   - Run command: `npm start`
   - HTTP port: `8080`
4. Add a **Database resource** → Dev DB → PostgreSQL 16 (smallest, $15/mo).
   Leave the name as `db`.
5. **Environment variables** for the web service (most will auto-fill from
   the DB binding — confirm these names):
   - `NODE_ENV=production`
   - `PORT=8080`
   - `SESSION_SECRET=<32 hex bytes>` — mark as encrypted. Generate with:
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `SESSION_SECURE=true`
   - `PGHOST=${db.HOSTNAME}` `PGPORT=${db.PORT}` `PGUSER=${db.USERNAME}`
     `PGPASSWORD=${db.PASSWORD}` `PGDATABASE=${db.DATABASE}` — these
     should pre-fill if you bound the database; verify they're present.
6. Plan: **Basic XXS, 1 instance** ($5/mo).
7. Region: `nyc` (or whichever is closest to your users).
8. **Create Resources.** DO clones the repo, builds, runs the health check,
   and assigns a URL like `furnish-hope-XXXXX.ondigitalocean.app`.

### Option B — Via `doctl` (faster on re-creates)

```bash
doctl apps create --spec .do/app.yaml
# Then set SESSION_SECRET securely:
doctl apps update <APP_ID> --spec .do/app.yaml
# (You'll still need to set the encrypted SESSION_SECRET via the UI or
# `doctl apps config set`.)
```

---

## Step 5 — Load the schema (5 min)

The auto-migrations module handles incremental schema changes, but the
**original 85-table DDL** needs to run once on the empty managed DB.

1. In the DO console → Databases → your `db` cluster → **Connection
   Details**. Copy the connection string (looks like
   `postgresql://doadmin:<pw>@<host>:25060/defaultdb?sslmode=require`).

2. Load schema + seed from local:
   ```bash
   $env:PGPASSWORD = "<the password from the connection string>"
   psql "postgresql://doadmin@<host>:25060/defaultdb?sslmode=require" -f db/01_schema.sql
   psql "postgresql://doadmin@<host>:25060/defaultdb?sslmode=require" -f db/02_seed.sql
   ```

   The seed includes demo clients/donors/etc. For a customer beta you may
   want a stripped-down seed — say so and I'll generate a `02_seed_minimal.sql`.

3. (Optional but recommended) Trigger a re-deploy of the App service so the
   startup `runAuthMigrations()` runs against the freshly-loaded schema.
   The migrations are idempotent so re-running on a fresh schema is safe.

---

## Step 6 — First login (2 min)

1. Open the app URL DO assigned (e.g. `furnish-hope-abc12.ondigitalocean.app`).
2. Watch the **Runtime Logs** in the DO console — on first start, the API
   prints a banner with the initial admin's temp password:
   ```
   ************************************************************************
   INITIAL ADMIN ACCOUNT CREATED
     Username: admin
     Temporary password: <something like cas-mor-len-742>
     CHANGE THIS PASSWORD on first login.
   ************************************************************************
   ```
3. Log in as `admin`, go to **Settings**, change the password.

🎉 The beta is live.

---

## Ongoing access

### Both of us — view the app
Browse to the app URL. Sign in. Same flow as local.

### You — see live logs
DO console → Apps → furnish-hope → **Runtime Logs** (live stream).
Or via CLI:
```bash
doctl apps list                       # find the app id
doctl apps logs <app-id> --type=run --follow
```
You can copy/paste this output for me when something breaks.

### You — connect to the prod database
DO console → Databases → `db` → Connection Details → **psql command** (copies
to clipboard). Or via CLI:
```bash
doctl databases connection <db-id> --format URI    # prints the connection string
```

### Deploy new code
```bash
git add -A
git commit -m "describe what changed"
git push
```
DO sees the push, runs `npm run build`, deploys. Usually 2–4 minutes.

### Roll back a bad deploy
DO console → Apps → Deployments → click the previous good one → **Rollback**.
One-click revert.

### Update the deployment spec (env vars, instance size, etc.)
Edit `.do/app.yaml`, commit, push. Or use the DO console UI — but committing
keeps the spec reproducible.

---

## What's deliberately deferred to v1.0

- **Custom domain.** Add via DO console → Settings → Domains. Free TLS
  via Let's Encrypt is automatic once DNS is pointed.
- **Production-tier Postgres** with read replica + 7-day point-in-time recovery
  ($60/mo vs the current $15 dev tier). Worth upgrading before real PII.
- **Backup verification cron.** DO does automatic daily backups; we should
  add a monthly restore drill once the data matters.
- **Docker handoff to Furnish Hope.** Separate concern, handled when v1.0
  is ready — Dockerfile + docker-compose.yml that runs anywhere.

---

## Troubleshooting

**Deploy fails at build step**
Check the build log in DO console. The most common causes:
- TypeScript error (run `npm run typecheck` locally first)
- Missing dependency (run `npm run build` locally — it should succeed)

**Deploy succeeds but health check fails**
The migrations may be failing. Check Runtime Logs for the actual error.

**Login screen never loads (blank page)**
Browser dev tools → Network: check that `/` returns the React index.html and
that `/assets/index-*.js` loads (200). If the JS 404s, the static-file path
in `api/src/index.ts` is wrong — likely the `web/dist` directory wasn't
included in the build output.

**Session lost on every API restart**
`SESSION_SECRET` is missing or being regenerated. Confirm it's set as a
SECRET env var in App Platform (not committed to git).

**`/api/clients` returns 401 even though logged in**
The session cookie isn't being sent. With App Platform's HTTPS, this happens
if `SESSION_SECURE=true` is set but the user is hitting an HTTP URL — DO's
URLs are HTTPS by default, so this only bites if you've set up a custom HTTP
domain. Force HTTPS in the DO console.
