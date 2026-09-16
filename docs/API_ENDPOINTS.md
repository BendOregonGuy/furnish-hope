# Furnish Hope — API Endpoint Reference (by Actor / Role)

_Base path for every route below is `/api`. Auth is enforced by mount-order
middleware in `api/src/index.ts`: public routers are mounted **before**
`app.use('/api', requireUser)`; everything after requires a valid session, and
most routers add a role gate (`requireStaff`, `requireAdmin`,
`requireProgramManager`, `requireDeveloper`, `requireAgency`) on top._

_Last generated: 2026-07-29._

---

## 1. Public / Anonymous (no login required)

These routers are mounted before `requireUser`, so anyone on the internet can
reach them (rate-limited + honeypot-protected where noted).

### Authentication — `/api/auth`
The router is public-mounted, but the individual handlers enforce a session
where it matters (change-password, profile, `me`).

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Sign in, create session |
| POST | `/api/auth/logout` | Destroy session |
| GET  | `/api/auth/me` | Current user + role (session required) |
| POST | `/api/auth/password` | Change own password (session required) |
| POST | `/api/auth/users/:id/reset-password` | Admin reset of another user's password |
| GET  | `/api/auth/profile` | Read own profile (session required) |
| PUT  | `/api/auth/profile` | Update own profile (session required) |

### Public agency-application / invitation — `/api/public`
The self-service "Apply to Refer" flow and caseworker invitation acceptance.

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/public/agencies` | Registered-agency lookup (powers the Agency-Name dedup dropdown on the apply form) |
| GET  | `/api/public/invitations/:token` | Load a caseworker invitation by token |
| POST | `/api/public/invitations/:token/accept` | Accept invitation, set up caseworker login |
| GET  | `/api/public/lookups/:name` | Whitelisted lookups needed by the public form (client types, etc.) |
| POST | `/api/public/agency-applications` | Submit a new agency application (409 on approved name/EIN duplicate) |

### Public volunteer signup — `/api/volunteer-signup`
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/volunteer-signup` | Submit a public volunteer signup (honeypot + IP capture) |

### Public org identity — `/api/org-info`
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/org-info` | Public org name / branding for login + apply pages |
| GET | `/api/org-info/logo` | Public logo image |

### Twilio inbound webhook — `/api/webhooks/twilio`
Twilio can't authenticate, so this is mounted before `requireUser`
(signature-verified inside the handler).

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/webhooks/twilio/inbound` | Inbound SMS |
| POST | `/api/webhooks/twilio/status` | Delivery-status callbacks |

---

## 2. Caseworker / Referring-Agency Portal — `/api/agency`

Mounted with `agencyRouter.use(requireAgency)`. Every response is **scoped to
the signed-in caseworker's `agency_id`** — a caseworker only ever sees their
own agency's clients and referrals.

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/agency/me` | Caseworker + agency profile |
| GET  | `/api/agency/dashboard` | Agency dashboard (their referrals + statuses) |
| GET  | `/api/agency/lookups/:table` | Whitelisted lookups for the referral form |
| GET  | `/api/agency/clients/search` | Search this agency's clients (dedup on referral) |
| GET  | `/api/agency/referrals` | List this agency's referrals |
| POST | `/api/agency/referrals` | Submit a new client referral |
| GET  | `/api/agency/referrals/:id` | View one referral |

---

## 3. Program Manager — `/api/agencies/applications`

Gated by `requireProgramManager`. The review/approval workflow for incoming
agency applications.

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/agencies/applications` | Review queue (includes `possible_duplicates`) |
| GET  | `/api/agencies/applications/:id` | Application detail + duplicate panel |
| POST | `/api/agencies/applications/:id/approve` | Approve, provision agency + caseworker (409 on duplicate name) |
| POST | `/api/agencies/applications/:id/reject` | Reject application |
| GET  | `/api/agencies/applications/:id/invitation-preview/:cwId` | Preview caseworker invitation email |

---

## 4. Staff (all FH staff) — `requireStaff`

The core operational surface. Every router below is mounted with
`requireStaff`.

### Dashboard & clients
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/dashboard` | Staff home metrics |
| GET | `/api/clients` | List/search clients |
| GET | `/api/clients/search` | Typeahead search |
| GET | `/api/clients/:id` | Client detail |
| GET | `/api/clients/:id/check-duplicates` | Duplicate check |
| GET | `/api/clients/:id/referrals` | Client's referral history |
| POST | `/api/clients` | Create client |
| PUT | `/api/clients/:id` | Update client |
| DELETE | `/api/clients/:id` | Delete client |

### Packing Lists (formerly "Provisioning Requests") — `/api/requests`
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/requests` | List packing lists |
| GET | `/api/requests/review-queue` | Pending-approval queue |
| GET | `/api/requests/template` | Default rooms/items template for a new list |
| GET | `/api/requests/:id` | Packing-list detail (items, children, reference code) |
| POST | `/api/requests` | Create packing list |
| PUT | `/api/requests/:id` | Update packing list |
| DELETE | `/api/requests/:id` | Delete packing list |
| POST | `/api/requests/:id/approve` | Approve |
| POST | `/api/requests/:id/reject` | Reject |
| GET | `/api/requests/:id/waiver` | Waiver status for this list _(mounted via `mountWaiverOnRequests`)_ |
| POST | `/api/requests/:id/waiver` | Generate / sign waiver |
| DELETE | `/api/requests/:id/waiver` | Remove waiver _(admin only)_ |

### Waivers — `/api/waivers`
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/waivers/template` | Current waiver template |
| GET | `/api/waivers/template/:id` | Specific template version |
| GET | `/api/waivers/:id/pdf` | Signed waiver PDF |

### Inventory — `/api/inventory`
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/inventory` | List inventory |
| GET | `/api/inventory/suggestions` | Item suggestions |
| GET | `/api/inventory/:id` | Item detail |
| POST | `/api/inventory` | Create item |
| PUT | `/api/inventory/:id` | Update item |
| DELETE | `/api/inventory/:id` | Delete item |

### Deliveries — `/api/deliveries`
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/deliveries` | List |
| GET | `/api/deliveries/container-options` | Container/vehicle options |
| GET | `/api/deliveries/:id` | Detail |
| POST | `/api/deliveries` | Create |
| PUT | `/api/deliveries/:id` | Update |
| DELETE | `/api/deliveries/:id` | Delete |
| POST | `/api/deliveries/:id/send-pickup-code` | Text pickup code |
| POST | `/api/deliveries/:id/receipt` | Generate receipt |

### Visits — `/api/visits`
Now carries `visit_type` (Delivery / Donation Center Pick Up / Selection of
Items) and conditional `selection_type`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/visits` | List (filters: visit_type, selection_type, location) |
| GET | `/api/visits/:id` | Detail |
| POST | `/api/visits` | Create |
| PUT | `/api/visits/:id` | Update |
| DELETE | `/api/visits/:id` | Delete |

### Pickups — `/api/pickups`
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/pickups` | List |
| GET | `/api/pickups/:id` | Detail |
| POST | `/api/pickups` | Create |
| PUT | `/api/pickups/:id` | Update |
| DELETE | `/api/pickups/:id` | Delete |

### Volunteers — `/api/volunteers`
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/volunteers` | List |
| GET | `/api/volunteers/:id` | Detail |
| POST | `/api/volunteers` | Create |
| PUT | `/api/volunteers/:id` | Update |
| DELETE | `/api/volunteers/:id` | Delete |
| POST | `/api/volunteers/:id/hours` | Log hours |

### Shifts — `/api/shifts`
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/shifts` | List |
| GET | `/api/shifts/:id` | Detail |
| GET | `/api/shifts/:id/eligible-volunteers` | Eligible volunteers |
| POST | `/api/shifts` | Create |
| PUT | `/api/shifts/:id` | Update |
| DELETE | `/api/shifts/:id` | Delete |
| POST | `/api/shifts/:id/signup` | Sign a volunteer up |
| POST | `/api/shifts/:id/signup/:sid/cancel` | Cancel a signup |
| PUT | `/api/shifts/:id/attendance` | Record attendance |

### Donations / Donors / Pledges
| Method | Path | Purpose |
|---|---|---|
| GET / POST | `/api/donations` | List / create donations |
| GET / PUT / DELETE | `/api/donations/:id` | Donation detail / update / delete |
| POST | `/api/donations/:id/receipt` | Generate receipt |
| GET / POST | `/api/donors` | List / create donors |
| GET | `/api/donors/:id` | Donor detail |
| GET / POST | `/api/pledges` | List / create pledges |
| GET / PUT / DELETE | `/api/pledges/:id` | Pledge detail / update / delete |

### Vendors & vendor services
| Method | Path | Purpose |
|---|---|---|
| GET / POST | `/api/vendors` | List / create |
| GET / PUT / DELETE | `/api/vendors/:id` | Detail / update / delete |
| GET / POST | `/api/vendor-services` | List / create |
| PUT / DELETE | `/api/vendor-services/:id` | Update / delete |

### Campaigns & events
| Method | Path | Purpose |
|---|---|---|
| GET / POST | `/api/campaigns` | List / create |
| GET / PUT / DELETE | `/api/campaigns/:id` | Detail / update / delete |
| GET / POST | `/api/events` | List / create |
| GET / PUT / DELETE | `/api/events/:id` | Detail / update / delete |
| POST / DELETE | `/api/events/:id/check-in/:attendeeId` | Check in / undo |
| POST | `/api/events/:id/walk-in` | Add walk-in attendee |
| POST | `/api/events/:id/attendees/:attendeeId/promote-to-donation` | Convert attendee to donation |
| POST | `/api/events/:id/sponsors/:sponsorId/promote-to-donation` | Convert sponsor to donation |
| GET | `/api/events/:id/volunteer-roster` | Volunteer roster |

### Receipts — `/api/receipts`
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/receipts/donation/:id/pdf` | Receipt PDF |
| POST | `/api/receipts/donation/:id/send` | Send one receipt |
| GET | `/api/receipts/unsent` | Unsent receipts |
| POST | `/api/receipts/send-batch` | Batch-send |

### Email (staff outbound + account config) — `/api/email`
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/email/providers` | Available providers |
| GET / POST | `/api/email/accounts` | List / add accounts |
| GET / PUT / DELETE | `/api/email/accounts/:id` | Detail / update / delete |
| POST | `/api/email/accounts/:id/test` | Test connection |
| POST | `/api/email/accounts/:id/default` | Set default |
| GET | `/api/email/oauth/:provider/start` | Begin OAuth |
| GET | `/api/email/oauth/callback` | OAuth callback |
| GET | `/api/email/contact-picker` | Contact picker |
| POST | `/api/email/send` | Send email |

### Email templates — `/api/email-templates`
| Method | Path | Purpose |
|---|---|---|
| GET / POST | `/api/email-templates` | List / create |
| GET / PUT / DELETE | `/api/email-templates/:id` | Detail / update / delete |

### Mailbox (shared inbox) — `/api/mailbox`
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/mailbox/sync` | Sync from provider |
| GET | `/api/mailbox/sync-state` | Sync status |
| GET | `/api/mailbox/messages` | List messages |
| GET | `/api/mailbox/unread-count` | Unread badge count |
| GET | `/api/mailbox/threads/:thread_id` | Thread view |
| GET | `/api/mailbox/messages/:id` | Message detail |
| GET | `/api/mailbox/messages/:id/attachments/:aid` | Attachment |
| POST | `/api/mailbox/messages/:id/mark-unread` | Mark unread |
| POST | `/api/mailbox/mark-all-read` | Mark all read |
| POST | `/api/mailbox/messages/:id/reply` | Reply |

### Messages (SMS/broadcast log) — `/api/messages`
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/messages/send` | Send a message |
| GET | `/api/messages` | List messages |
| POST | `/api/messages/:id/mark-reviewed` | Mark reviewed |

### Attachments — `/api/attachments`
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/attachments/:entity_type/:entity_id` | Upload |
| GET | `/api/attachments/:entity_type/:entity_id` | List for an entity |
| GET | `/api/attachments/:id/download` | Download |
| PUT | `/api/attachments/:id` | Update metadata |
| DELETE | `/api/attachments/:id` | Delete |
| GET | `/api/attachments/stats` | Storage stats |
| GET | `/api/attachments/providers` | Storage providers |

### Calendar, lookups, quick-create, reports
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/calendar` | Operations calendar events (Visits filter + visit_type/selection_type meta) |
| GET | `/api/lookups/:name` | Whitelisted lookup values |
| POST | `/api/quick-create/address` | Inline-create address |
| POST | `/api/quick-create/vehicle` | Inline-create vehicle |
| POST | `/api/quick-create/contact` | Inline-create contact |
| POST | `/api/quick-create/corp-facility` | Inline-create facility |
| POST | `/api/quick-create/facility-staff` | Inline-create facility staff |
| POST | `/api/quick-create/pledge` | Inline-create pledge |
| POST | `/api/quick-create/campaign` | Inline-create campaign |
| GET | `/api/reports` | Report index |
| GET | `/api/reports/impact` | Impact report |
| GET | `/api/reports/landfill` | Landfill-diversion report |
| GET | `/api/reports/valuation` | Valuation report |
| GET | `/api/reports/inventory` | Inventory report |
| GET | `/api/reports/export/:report.:format` | Export a report (csv/xlsx/pdf) |

---

## 5. Admin — `requireAdmin`

### Generic table admin — `/api/admin`
Introspection-driven CRUD over **every** table (uses `information_schema` +
`TABLE_OVERRIDES`/`LOOKUP_OVERRIDES` for friendly labels).

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/schema` | Full introspected schema |
| POST | `/api/admin/_refresh` | Refresh schema cache |
| GET | `/api/admin/erd` | ERD data |
| GET | `/api/admin/_counts` | Row counts |
| GET | `/api/admin/address-usage/:id` | Where an address is referenced |
| GET | `/api/admin/fk-options/:table` | FK dropdown options |
| GET | `/api/admin/:table` | List rows |
| GET | `/api/admin/:table/:id` | Row detail |
| POST | `/api/admin/:table` | Insert row |
| PUT | `/api/admin/:table/:id` | Update row |
| DELETE | `/api/admin/:table/:id` | Delete row |

### Admin sub-areas
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/activity` | Audit / activity log |
| GET | `/api/admin/activity/_facets` | Activity filter facets |
| GET / PUT | `/api/admin/settings` | Org settings |
| POST / DELETE | `/api/admin/settings/logo` | Upload / remove logo |
| GET | `/api/admin/volunteer-signups` | Review public volunteer signups |
| GET | `/api/admin/volunteer-signups/:id` | Signup detail |
| POST | `/api/admin/volunteer-signups/:id/approve` | Approve |
| POST | `/api/admin/volunteer-signups/:id/reject` | Reject |
| GET | `/api/admin/duplicates` | Duplicate-record dashboard |
| POST | `/api/admin/duplicates/scan` | Run dedup scan |
| GET | `/api/admin/duplicates/:id` | Duplicate group detail |
| POST | `/api/admin/duplicates/:id/merge` | Merge records |
| POST | `/api/admin/duplicates/:id/not-duplicate` | Dismiss as not-a-duplicate |

### Communications settings — `/api/settings/communications`
| Method | Path | Purpose |
|---|---|---|
| GET / PUT | `/api/settings/communications/sms-provider` | Read / set SMS provider |
| POST | `/api/settings/communications/sms-provider/test` | Test SMS |
| GET / PUT | `/api/settings/communications/org-email` | Read / set org email |
| POST | `/api/settings/communications/org-email/test` | Test email |
| GET / PUT | `/api/settings/communications/fallback-inbox` | Read / set fallback inbox |

### Scheduling config — `/api/shift-templates`, `/api/holidays`
| Method | Path | Purpose |
|---|---|---|
| GET / POST | `/api/shift-templates` | List / create shift templates |
| GET | `/api/shift-templates/:id` | Detail |
| PUT / DELETE | `/api/shift-templates/:id` | Update / delete |
| POST | `/api/shift-templates/generate` | Generate shifts from templates |
| GET / POST | `/api/holidays` | List / create holidays |
| PUT / DELETE | `/api/holidays/:id` | Update / delete |

### QuickBooks integration — `/api/quickbooks`
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/quickbooks/status` | Connection status |
| GET | `/api/quickbooks/connect-url` | OAuth connect URL |
| GET | `/api/quickbooks/callback` | OAuth callback |
| POST | `/api/quickbooks/disconnect` | Disconnect |
| GET | `/api/quickbooks/accounts` | Chart of accounts |
| GET | `/api/quickbooks/deposit-accounts` | Deposit accounts |
| GET / PUT / DELETE | `/api/quickbooks/mappings[/:fund_id]` | Fund → account mappings |
| POST | `/api/quickbooks/sync/:donation_id` | Sync a donation |
| GET | `/api/quickbooks/sync-log` | Sync log |
| GET | `/api/quickbooks/donations/:id/sync-history` | Per-donation sync history |

---

## 6. Developer — `requireDeveloper`

### Issue tracker — `/api/issues`
Custom gate: `POST /` (report an issue) and `GET /visibility` are open to
**staff**; everything else requires **developer**.

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/api/issues/visibility` | staff | Whether the issue reporter shows |
| POST | `/api/issues` | staff | Report an issue |
| GET | `/api/issues` | developer | Triage list |
| GET | `/api/issues/:id` | developer | Issue detail |
| GET | `/api/issues/:id/notes` | developer | Notes thread (newest-first, author + date) |
| POST | `/api/issues/:id/notes` | developer | Add a triage note |
| GET | `/api/issues/:id/screenshot` | developer | Attached screenshot |
| PUT | `/api/issues/:id` | developer | Update status/fields |
| DELETE | `/api/issues/:id` | developer | Delete issue |

### Broadcasts — `/api/broadcasts`
`/active` and `/:id/dismiss` are open to any signed-in user; the management
routes require **developer**.

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/api/broadcasts/active` | any user | Active banner(s) for me |
| POST | `/api/broadcasts/:id/dismiss` | any user | Dismiss a banner |
| GET | `/api/broadcasts` | developer | List all |
| POST | `/api/broadcasts` | developer | Create |
| PUT | `/api/broadcasts/:id` | developer | Update |
| DELETE | `/api/broadcasts/:id` | developer | Delete |

---

## 7. Any signed-in user

### In-app manual — `/api/manual`
Read routes are open to every signed-in user; write routes (`PUT`/`DELETE`)
enforce `requireAdmin` inside the handler.

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/api/manual/screenshots` | any user | List manual screenshots |
| GET | `/api/manual/screenshots/:slug/image` | any user | Screenshot image |
| PUT | `/api/manual/screenshots/:slug` | admin | Upload/replace |
| DELETE | `/api/manual/screenshots/:slug` | admin | Remove |

---

## Role hierarchy (summary)

```
requireUser         any authenticated session
  └─ requireStaff   FH staff  (operational routers §4)
       ├─ requireProgramManager   agency application review (§3)
       ├─ requireAdmin            config / generic table admin / integrations (§5)
       └─ requireDeveloper        issue tracker + broadcasts (§6)
  └─ requireAgency   caseworker portal, scoped to agency_id (§2)
```

_Public routers (§1) sit outside `requireUser` entirely._
