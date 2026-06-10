# Onboarding a partner-agency caseworker

A partner agency wants their caseworker to submit referrals directly. Here's how an admin sets that up.

## One-time per agency

1. Admin -> search tbl_agency -> + New -> fill in agency name + address -> Save

## For each caseworker

2. Admin -> tbl_contact -> + New -> first/last/email -> Save
3. Admin -> tbl_agency_contact -> + New -> pick the agency + contact -> Save
4. Admin -> User accounts -> + New
   - Username: their email
   - Pick the agency_contact you just created
   - **Leave facility_staff blank** (this is the role discriminator)
   - Leave is_admin unchecked
   - is_active = true
   - Temporary password (copy it now!)
   - Save
5. Email them their credentials + the login URL.

When they sign in, the system detects they're an agency user (agency_contact_id set, no facility_staff_id, not admin) and lands them at /agency.

## What the caseworker CAN do

- Dashboard at /agency: own-agency referral counts + recent activity
- My referrals: searchable list
- + Refer a household: short form, creates client + referral atomically
- Read-only referral detail with request/delivery status

## What the caseworker CANNOT do

Server-enforced via requireStaff middleware. Even hand-crafted URLs return 403:
- Other agencies' referrals
- Donors, donations, pledges, campaigns, events
- Volunteers, staff, vendors
- Inventory, pickups, internal deliveries
- Audit log, settings, admin panel
- Email, reports, dashboards, mailbox, calendar

## Multi-caseworker agencies

Multiple caseworkers per agency each get their own login. They share the same agency_id so they see the same pool of referrals. Each referral records WHO submitted it via tbl_referral.agency_contact_id.

## Revoking access

Admin -> User accounts -> find them -> is_active = false -> save. History intact, can't log in. Re-enable by flipping the flag.

## Security model

1. Session middleware - every request requires signed-in user
2. requireStaff / requireAgency - gate route families to one role
3. In-query scoping - WHERE ac.agency_id = userAgencyId on every agency SQL

A bug in one layer alone doesn't leak data. All three would have to fail.
