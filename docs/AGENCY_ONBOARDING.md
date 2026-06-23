# Onboarding a partner-agency caseworker

A partner agency wants their caseworker to submit referrals directly. Here's how an admin sets that up — all clicks in the existing admin UI, no SQL needed.

## One-time per agency

1. **Add the agency** (if not already in the system)
   - Admin → search **`tbl_agency`** → **+ New**
   - Fill in agency name, address, etc.
   - Save

## For each caseworker at that agency

2. **Add the person as a contact**
   - Admin → search **`tbl_contact`** → **+ New**
   - First name, last name, email, phone
   - Save

3. **Link the contact to the agency**
   - Admin → search **`tbl_agency_contact`** → **+ New**
   - Pick the agency + pick the contact → Save

4. **Create their login account**
   - Admin → **User accounts** → **+ New**
   - Username: their email address
   - Pick the **agency_contact** you just created
   - **Leave `facility_staff` blank** — this is the role discriminator
   - **Leave `is_admin` unchecked**
   - Set **`is_active = true`**
   - Set a one-time temporary password — **copy it now**, you can't see it again
   - Save

5. **Email them their credentials**
   - URL: `https://hammerhead-app-tk838.ondigitalocean.app/login`
   - Username: their email
   - Password: <the temporary one>
   - Tell them to change it on first login

That's it. When they sign in, the system detects `agency_contact_id is set AND facility_staff_id is null AND is_admin is false` → role becomes `agency` → they land at `/agency` (the partner portal) and never see the staff UI.

## What the caseworker can do

- **Dashboard** at `/agency` — own-agency referral counts + recent activity
- **My referrals** — searchable list of households their agency has referred
- **+ Refer a household** — short form, creates client + referral atomically
- **Referral detail** — read-only household + request/delivery status

## What the caseworker CANNOT do

Enforced server-side via `requireStaff` middleware. Even hand-crafted URLs return 403:

- See other agencies' referrals
- See donors, donations, pledges, campaigns, events
- See volunteers, staff, vehicles, vendors
- See inventory, pickups, internal deliveries
- See audit log, settings, lookup tables, admin panel
- Send email from Furnish Hope accounts
- Access reports / dashboards / mailbox / calendar
- Edit a client after submission

## Multi-caseworker agencies

Multiple caseworkers at the same agency can each have their own login. They all see the same agency-wide pool of referrals (shared `agency_id`). Each referral records the specific caseworker who submitted it (`tbl_referral.agency_contact_id`).

## Revoking access

- Admin → User accounts → find them → set `is_active = false` → save
- Their referral history stays intact (audit trail preserved); they just can't log in
- Re-enable later by flipping the same flag

## Security model — three layers

1. **Session middleware** — every API request requires a valid signed-in user
2. **`requireStaff` / `requireAgency`** — gates entire route families to one role
3. **In-query scoping** — every agency endpoint includes `WHERE ac.agency_id = $userAgencyId`, so a guessed `client_id` from another agency returns 404

A bug in any one layer doesn't expose data alone. All three would have to fail.
