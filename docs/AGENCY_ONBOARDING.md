# Onboarding a partner agency

A partner agency wants their caseworkers to submit referrals directly. As of the self-serve rollout, this happens through a public application form + a Furnish Hope review queue + emailed caseworker invitation links — no SQL, no admin table entry, and no temporary passwords to hand out.

This doc covers both the current self-serve flow (default) and the legacy manual flow (still supported for one-off situations).

---

## The self-serve flow — end to end

```
[public]                  [Furnish Hope]                    [caseworker]
    |                           |                                 |
    | 1. Apply at               |                                 |
    |    /apply-to-refer  ---->  |                                 |
    |                           |                                 |
    |                            | 2. Program Manager reviews at  |
    |                            |    /agencies/applications      |
    |                            |    → Approve or Reject         |
    |                            |                                |
    |                            | 3. On Approve: system creates  |
    |                            |    the agency + caseworker     |
    |                            |    invitation tokens           |
    |                            |                                |
    |                            | 4. PM copies the invite link   |
    |                            |    from the review page and    |
    |                            |    emails it to the caseworker |
    |                            |                                |
    |                            |                                | 5. Caseworker
    |                            |                                |    opens
    |                            |                                |    /caseworker-register/:token
    |                            |                                |    → sets username +
    |                            |                                |      password → lands
    |                            |                                |      in /agency
    |                            |                                |
```

### 1. Agency applies at `/apply-to-refer`

Anyone can visit `https://<host>/apply-to-refer` — no login. The form collects:

- Agency name, legal name (optional), EIN, website, main phone/email
- Physical address + service area
- One-line public description (shown on `/referring-agencies`)
- What kinds of clients they serve (checkboxes: Veteran, Domestic violence survivor, etc.)
- Typical needs filled, approximate clients/month
- **Initial caseworker(s)** — repeatable block of name + email + title
- Executive director name, other info

Rate-limited to 5 submissions per 15 minutes per IP; honeypot-guarded ("company_slogan" field is hidden and expected to stay empty). Submissions atomically write:

- `tbl_agency_application` — the application itself, `status='pending'`
- `tbl_agency_application_caseworker` — one row per initial caseworker
- `tbl_agency_application_client_type` — one row per checked population served

A submission does NOT create a `tbl_agency` row or any user accounts. Those happen only when a PM approves.

### 2. Program Manager reviews at `/agencies/applications`

Anyone with either `is_admin = true` **or** `is_program_manager = true` sees the "Applications" entry under **Partner Agencies** in the sidebar (badge count = pending applications). Clicking through opens the review queue.

The queue has three actions per pending row:

- **Approve** — atomically:
  - Inserts a `tbl_address` row for the agency's physical address
  - Inserts `tbl_agency` with `is_approved = true`, `approval_date = now()`, `approved_by_user_account_id = <the PM>`
  - Inserts `tbl_agency_client_type` rows mirroring the populations the applicant checked
  - For each caseworker on the application:
    - Inserts `tbl_contact` + `tbl_agency_contact` linking them to the new agency
    - Inserts `tbl_caseworker_invitation` with a fresh 64-hex random token and `expires_at = now() + 14 days`
  - Flips the application's `status` to `approved` and back-links `approved_agency_id`
- **Reject** — writes `status='rejected'` + a mandatory note explaining why. No agency or invitations created.
- **Preview** an invitation — for each caseworker, the review page has a **Copy invitation** button that returns the URL, subject, plaintext body, and HTML body. The PM pastes it into their own email client (Gmail, Outlook, whatever) and sends it.

Emails are intentionally NOT auto-sent yet. Furnish Hope will connect a shared `Agency_Onboarding@Furnish-Hope.com` mailbox for the production launch; until then, PM copy-paste is the interim.

### 3. Caseworker signs up at `/caseworker-register/:token`

The invitation link points at `https://<host>/caseworker-register/<64-hex-token>`. Loading that URL:

- Fetches the invitation preview (server-side; no auth required — the token IS the auth)
- Shows the caseworker's name / email / agency name pre-filled + read-only
- Presents a form: **Username** (defaults to `firstinitial+lastname`, editable) + **Password** + **Confirm password**
- On submit, the server atomically:
  - Creates a `tbl_user_account` bound to the invitation's `agency_contact_id`
  - Flips the invitation's `status` to `accepted` and stamps `accepted_at`, `user_account_id`
  - Regenerates the session (fixation defense) and signs the user in
- The SPA refreshes its auth context and navigates the caseworker to `/agency` — the enhanced partner dashboard

Tokens are one-shot: reusing an accepted token returns "already used." Expired or bad tokens return a friendly 404 page with instructions to ask their PM to reissue.

### 4. Caseworker uses `/agency/*`

The enhanced dashboard (Phase F) surfaces:

- **KPIs** — this-month referrals, total, open requests, delivered requests
- **Request status breakdown** — pill counts by review_status across the agency's requests
- **Recent referrals + Recent activity** — the last 10 events (referrals + requests + deliveries)
- **Team at [Agency]** — a table of every caseworker at this agency with status pills: **Active** (signed up), **Invited · expires DATE** (pending), **Expired**, **Revoked**

All queries are scoped by `req.user.agency_id` — a caseworker literally cannot see another agency's data even by crafting URLs.

### 5. Approved agencies show up publicly at `/referring-agencies`

Any approved agency (`is_approved = true`) is listed on `https://<host>/referring-agencies` with its public description, service area, populations served, and website. Rejected or pending applications are not listed. Referring social workers or families can browse this page to find a partner agency to work through.

---

## Making a Furnish Hope staff member a Program Manager

Only admins can grant this role.

1. Admin → **Database Admin** → open `tbl_user_account`
2. Find the staff user, click their row
3. Check **Program Manager**
4. Save

After the next login (or refresh), they'll see "Applications" appear under **Partner Agencies** in the sidebar and can approve/reject/preview invitations. Admins have PM powers implicitly — no need to grant themselves.

---

## Reissuing an invitation

Invitations expire 14 days after issue. If a caseworker misses the window:

1. PM → **Applications** → open the approved application
2. In the caseworker list, each invitation shows its status
3. Click **Reissue** (regenerates the token + resets `expires_at`)
4. Copy the new link and email it

The new token invalidates the old one — the old URL becomes a 404.

To revoke a still-valid but no-longer-wanted invitation, set `tbl_caseworker_invitation.status = 'revoked'` via the admin form. The link stops working immediately.

---

## Adding a caseworker to an already-approved agency

Once an agency has been approved, a PM can invite additional caseworkers at any time:

1. PM → **Applications** → open the approved application (it stays in the queue with status `approved`)
2. **Add caseworker** — enter their first name, last name, email
3. System creates `tbl_agency_contact` + `tbl_caseworker_invitation`
4. Copy the invitation link, email it to them

The new caseworker's dashboard's "Team at [agency]" section will show all sibling caseworkers plus their own row.

---

## Revoking a caseworker's access

- Admin → **Database Admin** → `tbl_user_account` → find them → set `is_active = false` → save
- Their referral history stays intact (audit trail preserved); they just can't log in
- Re-enable later by flipping the same flag

To also revoke pending invitations they haven't accepted yet: set `tbl_caseworker_invitation.status = 'revoked'`.

---

## What the caseworker can and cannot do

**Can:**
- View the `/agency` dashboard scoped to their own agency
- List and search referrals their agency has made
- Submit new referrals via `/agency/referrals/new` (creates client + referral + optional provisioning request items atomically)
- View read-only detail on any of their agency's referrals + delivery status

**Cannot** (enforced server-side via `requireAgency` + in-query scoping — hand-crafted URLs return 403 or 404):
- See other agencies' referrals
- See donors, donations, pledges, campaigns, events
- See volunteers, staff, vehicles, vendors
- See inventory, pickups, internal deliveries
- See audit log, settings, lookup tables, admin panel
- Send email from Furnish Hope accounts
- Access reports / dashboards / mailbox / calendar
- Edit a client after submission

---

## Multi-caseworker agencies

Multiple caseworkers at the same agency each have their own login. They all see the same agency-wide pool of referrals (shared `agency_id`). Each referral records which specific caseworker submitted it (`tbl_referral.agency_contact_id`), so agency-internal accountability is preserved.

---

## Security model — four layers

1. **Session middleware** (`requireUser`) — every API request requires a valid signed-in user
2. **Role middleware** (`requireStaff` / `requireAgency` / `requireProgramManager` / `requireAdmin`) — gates entire route families to one role
3. **In-query scoping** — every `/api/agency/*` endpoint appends `WHERE ac.agency_id = $userAgencyId`, so a guessed `client_id` from another agency returns 404
4. **`fkOptionsFilter`** on admin dropdowns — unapproved agencies (and their contacts) don't appear as options in the picker even for admins, so no new referral can accidentally reference one

A bug in any single layer doesn't expose data alone. All four would have to fail.

---

## Appendix — Legacy manual flow (still supported)

If you need to backfill an agency (e.g. reconstructing history) or handle an edge case without going through the review queue:

1. **Add the agency** — Admin → `tbl_agency` → **+ New** — set `is_approved = true` if you want it to appear in dropdowns
2. **Add each caseworker as a `tbl_contact`**
3. **Link contact to agency** — `tbl_agency_contact` → **+ New**
4. **Create a login** — Admin → **User accounts** → **+ New**
   - Username: their email
   - Pick the `agency_contact` you just created
   - **Leave `facility_staff` blank** — this is the agency-role discriminator
   - **Leave `is_admin` unchecked**, **leave `is_program_manager` unchecked**
   - Set `is_active = true`
   - Set a one-time temporary password — **copy it now**, you can't see it again
5. **Email them** the URL + username + temporary password; tell them to change it on first login

Prefer the self-serve flow whenever possible — no temporary-password handling, no risk of half-configured accounts, and an audit trail via `tbl_agency_application` + `tbl_caseworker_invitation`.
