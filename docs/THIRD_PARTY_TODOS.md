# Third-party / external-service to-do list

Running log of action items that have to be done OUTSIDE the codebase — in
DigitalOcean, Google Cloud, Azure, QuickBooks Online, the domain registrar,
etc. Add to the bottom as new ones come up; check off when done.

Format: `[ ]` pending → `[x]` done. Date checked off in parentheses.
Anything time-sensitive or pre-production goes in the **Pre-production**
section so it doesn't get lost.

---

## Pre-production (do before the nonprofit goes live)

### DigitalOcean — Managed Postgres
- [ ] **Enable slow query logging.** Set `log_min_duration_statement = 500`
      under the database's *Settings → Database Configuration*. Captures any
      query slower than 500ms.
- [ ] **Verify `pg_stat_statements` is on.** It's enabled by default on DO
      Managed PG. Confirm via the *Insights → Slow Queries* dashboard
      showing data. If empty, file a support ticket.
- [ ] **Confirm autovacuum is enabled** (default yes). Check
      `pg_settings` for `autovacuum = on`.
- [ ] **Set up alerts.** *Alerts* tab → CPU > 80% for 5min, disk > 80%,
      connection-pool > 80% utilization. Route to Preston's email
      (preston@getreality.com) for now.
- [ ] **Decide on backup retention.** DO defaults to 7 days of daily
      backups. Bump to 30 if budget allows — restore-from-backup is the
      disaster recovery story.
- [ ] **Generate a fresh DB password.** The initial-deploy password should
      be rotated before real user data lands.

### DigitalOcean — App Platform
- [ ] **Set `NODE_ENV=production`** as an env var on the App component.
- [ ] **Pin Node version** in `engines` (already done?) so DO build doesn't
      drift to a newer Node mid-quarter.
- [ ] **Set up a custom domain** (e.g. app.furnishhope.org) + Let's
      Encrypt cert. Currently on the ondigitalocean.app subdomain.
- [ ] **Enable HTTP -> HTTPS redirect** on the App settings.
- [ ] **Configure deploy notifications** — at least email Preston on
      failed deploys.

### Google Cloud Console (OAuth for Gmail accounts)
- [ ] **Move OAuth consent screen from Testing -> Production.** Until
      published, only test-users on the allowlist can sign in.
      Requires privacy policy URL + ToS URL.
- [ ] **Add production redirect URI** (the app's real domain) to the
      OAuth 2.0 Client.
- [ ] **Justify sensitive scopes** if Google flags `gmail.send` /
      `gmail.modify` during the verification review.
- [ ] **Set up a service account** for any future server-to-server
      Google work (e.g. Calendar conflict-check feature).

### Microsoft Entra / Azure AD (OAuth for Outlook accounts)
- [ ] **Add production redirect URI** to the App Registration.
- [ ] **Multi-tenant setting:** confirm if nonprofit staff use a single
      tenant (just theirs) or multi-tenant (any work email). Set
      `signInAudience` accordingly.
- [ ] **Add `offline_access` scope** to ensure refresh tokens are issued.
- [ ] **Grant admin consent** for any tenant-restricted scopes if their
      IT admin requires it.

### QuickBooks Online (Intuit Developer)
- [ ] **Flip from Sandbox to Production** on the Intuit Developer app
      when ready to sync real books. Requires re-OAuth — clients lose
      their sandbox connection.
- [ ] **Submit for Production review** — Intuit requires app review
      before granting prod access. Allow 1-2 weeks.
- [ ] **Set production redirect URI** in the Intuit app settings.

### Domain / email DNS
- [ ] **Set up SPF / DKIM / DMARC** for the sending domain. Without these,
      receipts and notifications will hit spam folders. Provider-specific
      (e.g. Google Workspace publishes a DKIM key).
- [ ] **MX records** if the nonprofit will receive mail at a custom domain.

### Storage (when traffic justifies moving off pg_blob)
- [ ] **Create a DO Spaces bucket** for attachments. Cheap, S3-compatible.
- [ ] **Set up CORS** on the bucket (signed-URL downloads need it).
- [ ] **Run the storage-provider migration script** to move existing
      attachments from pg_blob -> do_spaces.

---

## Nice-to-have / later

- [ ] **Sentry or similar error tracker** — wired into the API server,
      tagged with the user account so we can see what staff member hit
      what error. ~30 min wire-up; free tier handles this volume.
- [ ] **Uptime monitoring** — UptimeRobot or Better Stack on the public
      URL. Free, 5-min checks, email + SMS on outage.
- [ ] **Google Workspace for Nonprofits** — if they're not already
      using it, $0/yr eligible. Means proper org email instead of
      gmail.com personal accounts for staff.

---

## Workflow notes

- **Current dev loop:** changes get tested on the live DO app
  (`hammerhead-app-tk838.ondigitalocean.app`), not on localhost. The DO
  app rebuilds automatically from GitHub on every push to `main` —
  takes ~3-5 minutes. The local-dev workflow (Vite on :5173 + API on
  :4000) is documented in [DEPLOY.md](../DEPLOY.md) for when faster
  iteration is needed; the test-on-prod loop is fine while it's just
  Preston.
- **Migrations run on API startup**, so any change to
  `api/src/auth/migrations.ts` applies against production Postgres on
  the next deploy. All idempotent — safe to re-run.

---

## Done

(empty — move items here as they're completed)
