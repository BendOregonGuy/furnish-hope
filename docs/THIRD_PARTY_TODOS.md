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

## Internal feature backlog

### Event attendee workflow upgrades — all shipped 2026-06-10
- [x] `lkp_rsvp_status` lookup (seed: Invited, Accepted, Declined,
      Maybe, No response). Hard-coded dropdown replaced with FkSelect.
- [x] Manual-RSVP UI on each attendee row.
- [x] "Convert to donation" button on attendee row — promotes
      contribution to a real `tbl_donation`, auto-creates donor if
      missing, links via `tbl_event_attendee.donation_id`.
- [x] Dedicated day-of check-in view at `/events/:id/check-in`
      (tablet-optimized, tap-to-check-in, search filter).
- [x] "+ Walk-in" button on the check-in view — atomic create of
      contact + attendee + check-in. Email optional for walk-ins.

(Deferred: emailed invite links that auto-update RSVPs; inbound email
parsing for RSVPs. Pick up when there's real demand.)

### Event roles + capacity + sponsorships (requested 2026-06-10)

- [ ] **Event Manager** field on `tbl_event`. FK to
      `tbl_facility_staff` filtered to `is_volunteer = false`. Single
      value, optional, displayed prominently on event detail.
      Design note: shipping this is straightforward — schema change
      + FkSelect on the form.

- [ ] **Event Host** field on `tbl_event`. Trickier: a host can be
      a staff person, a volunteer, a donor, OR a corporate sponsor.
      Two options:
      - **(a)** Polymorphic: `host_entity_type` + `host_entity_id`
        columns. Frontend picks a type then picks the entity.
      - **(b)** Single FK to `tbl_contact` (covers staff, volunteer,
        donor); separate optional FK to `tbl_corporate` for corporate
        hosts. UI: a single field with a type-toggle.
      Recommend (b) — simpler, fewer foot-guns, and corporate hosts
      are a distinct enough flavor to warrant their own slot.

- [ ] **Max Attendees** field on `tbl_event`. `max_attendees INTEGER`
      NULL by default = no limit. Behavior at the limit:
      - Server REJECTS attempts to add more attendees (POST to
        attendees + POST /walk-in both check).
      - In-app alert to the Event Manager (if set) when the count
        reaches the limit — leverage the audit log + a new
        notification surface, OR send an email via the user's
        configured email account.
      - "Increase limit" affordance: just an edit on the event
        form. No separate workflow needed for v1.
      Open question: should the rejection be a HARD block or a SOFT
      warning ("You're over the cap — confirm to add anyway")? Soft
      is more forgiving for last-minute door arrivals. Recommend
      soft warn for walk-ins, hard block for pre-registration.

- [ ] **Corporate Sponsors for an event** — new feature with three
      pieces:
      - **Lookup table** `lkp_sponsor_level` seeded with common
        nonprofit tiers. Recommend Title, Presenting, Platinum,
        Gold, Silver, Bronze as defaults — covers most galas and
        the user can rename/add/remove via the admin UI. (Avoid
        Diamond — less common in nonprofit world than Platinum.)
      - **Join table** `tbl_event_sponsor`:
        - `event_id` FK
        - `corporate_id` FK to `tbl_corporate` (most common case)
        - `contact_id` FK to `tbl_contact` (for individual sponsors)
        - exactly one of the two should be non-null (CHECK constraint)
        - `sponsor_level_id` FK to `lkp_sponsor_level`
        - `amount_pledged` NUMERIC(12,2)
        - `amount_paid` NUMERIC(12,2) — for partial pulls
        - `acknowledged` BOOLEAN — has thank-you been sent?
        - `notes` TEXT
      - **UI**: subform on the event edit page (similar pattern to
        attendees). Event detail shows a "Sponsors" card grouped by
        level (Platinum first, Bronze last), with logo placeholders
        from the corporate record (uploaded via attachments) for the
        future event-program PDF.
      Open question: should sponsorships auto-promote to `tbl_donation`
      the same way attendee contributions do? Probably yes — a
      sponsorship IS a donation for accounting/QBO purposes. Default
      to auto-creating donations on save and linking back via
      `tbl_event_sponsor.donation_id`.

### Event printable forms (requested 2026-06-10)

All forms follow the existing manifest-print pattern (`ManifestShell`
+ `/manifest` route) — a dedicated print-optimized view at
`/events/:id/<form-name>` with a "Print" button that opens the
browser print dialog. Default to letter-size, but offer half-letter
or Avery-template layouts where it makes sense (badges, table
tents). All assume the **event roles + sponsorships backlog**
above ships first for forms that depend on that data.

**Tier 1 — high value, builds on existing data**

- [ ] **Door check-in roster** — printable alphabetical list of all
      RSVP'd attendees: name, RSVP status, table # (if assigned),
      contribution due, signature/check-in box. Door staff marks
      paper if WiFi dies; sync back later. **Operational risk
      mitigation — recommend prioritizing.** No new schema; pure
      print view.
- [ ] **Run-of-show timeline** — minute-by-minute schedule for the
      event team (cocktails 5:00, program 6:30, paddle raise 7:45,
      etc.). v1: free-text `run_of_show TEXT` column on `tbl_event`,
      formatted as a printable card. v2: dedicated
      `tbl_event_schedule_item` with start_time + title +
      responsible_party.
- [ ] **Volunteer shift roster** — who's working what time slot, with
      phone + role. Volunteers grab one as they arrive. Pulls from
      existing `tbl_volunteer_shift_signup`. Pure print view.
- [ ] **Sponsor recognition sheet** — sponsors grouped by level
      (Platinum first → Bronze last), formatted for emcee scripts +
      program inserts. **Depends on Corporate Sponsors backlog
      item.**
- [ ] **Nametag / badge sheets** — Avery-template-compatible layouts
      (Avery 5395 / 5384 / 5392 are common). Name + role pill
      (Staff, Volunteer, Board, Donor, VIP). Print on peel-and-stick
      sheet stock.

**Tier 2 — useful, modest data additions**

- [ ] **Table cards (numbered table tents)** — big number on both
      sides, foldable, printed N-up on cardstock. Pure layout work.
      No schema.
- [ ] **Place cards by table** — one sheet per table with each seat:
      name, dietary tag, plus-one notation. Requires **seat / table
      assignment on attendees** — add `table_number INT` and
      `seat_number INT` (or VARCHAR) columns to `tbl_event_attendee`
      plus optional `dietary_notes`.
- [ ] **Seating chart / map** — overview page showing the venue
      layout with table numbers and the people at each table. Uses
      the same seat-assignment data. v1: auto-generated grid
      based on table count; v2: drag-drop layout editor (much
      bigger effort, defer).
- [ ] **Silent auction bid sheets** — one per item: item name +
      description + photo space + starting bid + minimum increment
      + numbered rows for bidder# + amount. Requires a new feature:
      `tbl_auction_item` (event_id, name, description, starting_bid,
      bid_increment, donor / source, value, photo via attachments)
      + `tbl_auction_bid` for tracking winners. Scope: ~half a day
      for the data model + admin + print sheet.
- [ ] **Pledge cards** — for the paddle raise / appeal. Pre-filled
      with donor name + suggested giving levels ($25 / $100 / $500
      / $1,000 / $5,000 / other) + check boxes + signature line.
      Uses existing donor + giving history.

**Tier 3 — nice-to-have, lower urgency**

- [ ] **Walk-in registration paper form** — blank form mirroring
      the walk-in modal fields. Captures first/last/email/phone/
      type/$/notes. For the rare case the iPad is busy and walk-ins
      stack up at the door. Pure print template, no schema.
- [ ] **Event program** (multi-page printed booklet) — cover,
      schedule, sponsor pages, board listing, mission statement,
      photo spread. PDF generated server-side via pdfkit (same
      stack as receipts). Needs design + photo upload — bigger
      project. Defer until there's a specific upcoming event.
- [ ] **Save-the-date / formal invitation templates** — mail-merge
      from an invitee list. Probably best done by exporting to CSV
      and letting the user use their existing letterhead in Word,
      rather than building a templating engine. Consider just
      providing a CSV export of "people to invite" instead of
      printing.
- [ ] **Day-of staff briefing card** — emergency contacts, venue
      addresses, vendor phone numbers, evacuation plan, master
      schedule, key contacts (caterer, AV, photographer). One-page
      handout. Free-text `staff_briefing TEXT` field on `tbl_event`
      + a print view. Cheap to ship, often forgotten.
- [ ] **Thank-you letter templates** — mail-merge to attendees
      with their contribution + tax-deductible amount + receipt
      number. Overlaps with existing donation acknowledgement
      flow; consider extending that instead of building a new
      template engine.
- [ ] **Acknowledgement / commitment confirmation slip** — given
      to attendees who pledge during the appeal. Confirms what
      they wrote on the pledge card. Print at the back of the
      house and hand them out before they leave.
- [ ] **Will-call envelope labels** — printed envelopes for
      attendees who pre-paid but want to pick up materials at the
      door (program, name tag, swag). Avery 5160 labels with name
      + table # + amount paid.

**Suggested phasing**

The four high-ROI items for a furniture-to-housing nonprofit's
typical gala: door check-in roster, run-of-show printable, sponsor
recognition sheet, nametag sheets. Probably half a day combined.
Pledge cards + table cards are the next-most-used items at fundraising
galas — bring them in for the gala-prep push.


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
