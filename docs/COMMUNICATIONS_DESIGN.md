# Communications System — Revised Design (Phase 1)

**Project:** Furnish Hope Internal Ops Platform (v0.8 → v0.9)
**Author:** Design collaboration between Preston and Claude
**Status:** Draft v2.1 — ready for Session 1 implementation
**Date:** 2026-07-23

### Revision history

- **v2.1** (2026-07-23) — Marked Q1/Q2 resolved with Preston's answers. Added IMAP/SMTP reuse note in §7.2 pointing to existing `email/transports.ts` infrastructure.
- **v2** (2026-07-23) — Complete rewrite after codebase audit. Rescoped from "build everything" to "build the org messaging layer that doesn't exist, integrate with what does." ~⅓ the length of v1.
- **v1** (2026-07-23) — Initial draft. Superseded — proposed rebuilding several subsystems that already exist.

---

## What changed from v1

The first design doc was written before I understood what was already built. After a codebase audit, most of what I proposed as new infrastructure turned out to overlap with existing systems — or to solve problems the app doesn't yet have.

This revision is **~⅓ the length** of the original and aimed at what's actually needed:

- The app has **no organizational messaging layer**. Every send today is per-user, via a staff member's own connected email account. There is no `noreply@furnishhope.org` path. There is no message log — once nodemailer accepts a send, no record persists.
- The existing `tbl_email_template` is per-user (Gmail-style canned responses), not org-wide. The existing `tbl_communication_log` is a manual call-notes table, not a message audit.
- The agency-application → approval → caseworker-invite flow is **built**. Same for the volunteer signup and approval flow. Client status transitions are built. What's missing is a **trigger mechanism** — right now the caseworker invite email is hardcoded, sent inline in the approval route.
- `tbl_app_setting` (key-value store) is the natural home for SMS provider credentials — no new tables needed for config.

So what we're really building is: **an organizational messaging layer, with SMS as the first channel and org email as the second, plus a trigger system so admins can wire it into existing events.**

---

## 1. Scope

### 1.1 What we're building

1. **Twilio SMS integration** — provider abstraction, send path, inbound webhook, delivery status webhook
2. **Organizational email path** — a new `sendOrgEmail()` distinct from the per-user email in the Mailbox
3. **Consent tracking** — TCPA-compliant for SMS, CAN-SPAM-compliant for email, on `tbl_contact`
4. **Message log** — every SMS and org email tracked in a new `tbl_message` table
5. **Organizational templates** — a new `tbl_message_template` with channel/form/recipient/role tags
6. **Trigger system** — `tbl_message_trigger` firing on domain events, admin-configurable
7. **Send Message modal** — button on forms with phone/email fields
8. **Communications panel** — on contact profiles and business records
9. **Reply threading** — reference-code approach, inbound linked to source
10. **In-app notifications** — sender sees replies to their outbound; badges on records with unread inbound
11. **Fallback inbox** — undeliverable messages go to a configured shared email

### 1.2 What we're NOT building in Phase 1

- Scheduled/delayed sends (immediate only)
- A global inbox UI (replies surface on records and via in-app notifications)
- MMS / attachments in SMS
- A second SMS provider (interface exists so one can be added later)
- Retrofit of the caseworker invitation email into the template system — Phase 2, after we have the template system working end-to-end
- New approval workflows (client, agency, referral, volunteer approvals all exist in some form; we hook their events, we don't rebuild them)
- Bulk sends
- Analytics / reply-rate dashboards

### 1.3 What we're touching but NOT rebuilding

- The existing per-user email (Mailbox, EmailAccounts, EmailTemplates, EmailCompose) — untouched
- The existing `tbl_communication_log` (call notes) — untouched
- The existing agency application → approval → caseworker invite flow — untouched except to emit events after approvals
- The existing `tbl_audit_log` — untouched

---

## 2. How new pieces fit with what exists

| Layer | Existing | New | Interaction |
|---|---|---|---|
| Config | `tbl_app_setting` | SMS provider settings as rows | New keys: `sms.provider`, `sms.twilio.*`, `email.org.*`, `messaging.fallback_inbox` |
| SMTP send | `email/transports.ts` → `buildSmtpTransporter(acct)` (per-user) | `messaging/email-provider.ts` → `sendOrgEmail(to, subject, body)` (org) | Distinct code path, uses `nodemailer` the same way |
| Templates | `tbl_email_template` (per-user, Mailbox compose) | `tbl_message_template` (org-wide, triggers + Send Message) | Separate tables, separate UIs. Personal templates untouched. |
| Message record | `tbl_communication_log` (manual call notes) | `tbl_message` (automated + staff-initiated org sends) | Separate tables, separate purposes. Both surface on contact profile in different sections. |
| Events | Nothing today | Lightweight event bus in `messaging/events.ts` | Existing routes emit events after successful transactions. No refactoring of existing code. |
| Approvals | Client/agency/volunteer approvals exist as status transitions | Same code emits an event after transition | One-line additions to existing routes. |
| Consent | Nothing today | Columns on `tbl_contact` | New migration. Frontend forms add consent checkboxes. |

---

## 3. Data model changes

### 3.1 New tables

#### `tbl_message`

Every SMS and org email — outbound and inbound — is logged here.

```
message_id                       SERIAL PK
direction                        VARCHAR(8) NOT NULL   -- 'outbound' | 'inbound'
channel                          VARCHAR(16) NOT NULL  -- 'sms' | 'email' | 'fallback_email'
contact_id                       INTEGER NULL FK tbl_contact  -- null for unknown senders
to_address                       VARCHAR(255) NOT NULL  -- phone or email as sent
from_address                     VARCHAR(255) NOT NULL
subject                          TEXT NULL              -- email only
body_rendered                    TEXT NOT NULL
sent_at                          TIMESTAMPTZ NOT NULL
sent_by_facility_staff_id        INTEGER NULL FK tbl_facility_staff  -- for staff-initiated
sent_by_trigger_id               INTEGER NULL FK tbl_message_trigger  -- for automated
message_template_id              INTEGER NULL FK tbl_message_template
provider_message_id              VARCHAR(255) NULL      -- Twilio SID or email Message-ID
delivery_status                  VARCHAR(32) NOT NULL DEFAULT 'queued'
  -- queued | sent | delivered | failed | undelivered
delivery_status_updated_at       TIMESTAMPTZ NULL
delivery_error_code              VARCHAR(32) NULL
delivery_error_message           TEXT NULL
context_type                     VARCHAR(32) NULL
  -- delivery | donation | pickup | referral | request |
  -- client_status | agency_status | volunteer_status | agency_application
context_id                       INTEGER NULL
context_confidence               VARCHAR(16) NOT NULL DEFAULT 'unlinked'
  -- confirmed | inferred | unlinked
context_reference_code           VARCHAR(16) NULL       -- e.g. 'D47-a8b2'
thread_id                        INTEGER NULL FK tbl_message  -- self-ref, first message in thread
reply_to_message_id              INTEGER NULL FK tbl_message
reviewed_at                      TIMESTAMPTZ NULL
reviewed_by_facility_staff_id    INTEGER NULL FK tbl_facility_staff
created_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

Indexes:
- `(contact_id, sent_at DESC)` — contact profile listing
- `(context_type, context_id, sent_at DESC)` — record panel
- `context_reference_code` UNIQUE PARTIAL WHERE NOT NULL — reply lookup
- `provider_message_id` — webhook correlation
- `(thread_id, sent_at)` — thread reconstruction
- `(reviewed_at, sent_by_facility_staff_id)` — sender's unread queue

#### `tbl_message_template`

Organizational templates. Shared across the org; used by triggers and by staff via the Send Message modal.

```
message_template_id             SERIAL PK
channel                          VARCHAR(8) NOT NULL   -- 'sms' | 'email'
name                             VARCHAR(120) NOT NULL
description                      VARCHAR(300) NULL
subject                          TEXT NULL             -- email only
body                             TEXT NOT NULL         -- with {{placeholder}} syntax
body_html                        TEXT NULL             -- email only; plain text always required
append_reference_code            BOOLEAN NOT NULL DEFAULT true  -- SMS: append `Ref: X47a8b2`
is_active                        BOOLEAN NOT NULL DEFAULT true
created_by_facility_staff_id     INTEGER NOT NULL FK tbl_facility_staff
created_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### `tbl_message_template_form`

Which forms can use this template.

```
message_template_form_id         SERIAL PK
message_template_id              INTEGER NOT NULL FK tbl_message_template
form_key                         VARCHAR(64) NOT NULL
  -- 'client_detail' | 'delivery_detail' | 'donation_detail' | 'pickup_detail' |
  -- 'volunteer_detail' | 'agency_detail' | 'donor_detail' | 'referral_detail'
UNIQUE (message_template_id, form_key)
```

#### `tbl_message_template_recipient_type`

Which recipient categories a template targets.

```
message_template_recipient_type_id  SERIAL PK
message_template_id                 INTEGER NOT NULL FK tbl_message_template
recipient_type                      VARCHAR(32) NOT NULL
  -- 'client' | 'donor' | 'volunteer' | 'agency_contact' | 'staff' | 'custom'
UNIQUE (message_template_id, recipient_type)
```

#### `tbl_message_template_sender_role`

Which staff roles can pick this template from the Send Message modal.

```
message_template_sender_role_id     SERIAL PK
message_template_id                 INTEGER NOT NULL FK tbl_message_template
staff_role_id                       INTEGER NOT NULL FK lkp_staff_role
UNIQUE (message_template_id, staff_role_id)
```

#### `tbl_message_trigger`

Automation rules that fire on domain events.

```
message_trigger_id                  SERIAL PK
name                                VARCHAR(120) NOT NULL
description                         VARCHAR(300) NULL
event_key                           VARCHAR(64) NOT NULL   -- see §4
sms_template_id                     INTEGER NULL FK tbl_message_template
email_template_id                   INTEGER NULL FK tbl_message_template
on_reply_notify_source              VARCHAR(32) NULL
  -- 'sender_of_record' | 'assigned_caseworker' | 'role' | 'staff' | 'none'
on_reply_notify_role_id             INTEGER NULL FK lkp_staff_role
on_reply_notify_staff_id            INTEGER NULL FK tbl_facility_staff
is_active                           BOOLEAN NOT NULL DEFAULT true
created_by_facility_staff_id        INTEGER NOT NULL FK tbl_facility_staff
created_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW()

CHECK (sms_template_id IS NOT NULL OR email_template_id IS NOT NULL)
```

#### `tbl_message_trigger_recipient`

Who the trigger targets when it fires. Multiple rows = fan-out.

```
message_trigger_recipient_id        SERIAL PK
message_trigger_id                  INTEGER NOT NULL FK tbl_message_trigger
recipient_source                    VARCHAR(64) NOT NULL   -- see §4.3
custom_phone                        VARCHAR(20) NULL
custom_email                        VARCHAR(255) NULL
staff_role_id                       INTEGER NULL FK lkp_staff_role  -- if source = 'staff_role'
specific_staff_id                   INTEGER NULL FK tbl_facility_staff  -- if source = 'specific_staff'
```

#### `tbl_message_notification`

In-app "you got a reply" notifications for staff.

```
message_notification_id             SERIAL PK
facility_staff_id                   INTEGER NOT NULL FK tbl_facility_staff
message_id                          INTEGER NOT NULL FK tbl_message
notified_at                         TIMESTAMPTZ NOT NULL DEFAULT NOW()
dismissed_at                        TIMESTAMPTZ NULL
```

Index: `(facility_staff_id, dismissed_at, notified_at DESC)` — badge count.

#### `tbl_message_undeliverable`

When a triggered message can't reach the contact by any channel, an admin-visible record is created here in addition to sending the fallback email.

```
message_undeliverable_id            SERIAL PK
contact_id                          INTEGER NOT NULL FK tbl_contact
attempted_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW()
trigger_id                          INTEGER NULL FK tbl_message_trigger
sent_by_facility_staff_id           INTEGER NULL FK tbl_facility_staff
intended_body                       TEXT NOT NULL
intended_subject                    TEXT NULL
reason                              VARCHAR(64) NOT NULL
  -- 'no_channels' | 'sms_failed_no_email' | 'sms_failed_email_failed' |
  -- 'no_sms_consent_no_email' | ...
context_type                        VARCHAR(32) NULL
context_id                          INTEGER NULL
resolved_at                         TIMESTAMPTZ NULL
resolved_by_facility_staff_id       INTEGER NULL FK tbl_facility_staff
resolution_note                     TEXT NULL
```

### 3.2 Changes to existing tables

#### `tbl_contact` — consent columns

```
sms_consent_at                      TIMESTAMPTZ NULL
sms_consent_source                  VARCHAR(64) NULL
  -- 'client_intake_form' | 'agency_referral_form' | 'donor_form' |
  -- 'volunteer_application' | 'verbal_staff_recorded' | 'imported'
sms_consent_facility_staff_id       INTEGER NULL FK tbl_facility_staff
sms_opted_out_at                    TIMESTAMPTZ NULL

email_consent_at                    TIMESTAMPTZ NULL
email_consent_source                VARCHAR(64) NULL
email_consent_facility_staff_id     INTEGER NULL FK tbl_facility_staff
email_opted_out_at                  TIMESTAMPTZ NULL
```

No changes to `tbl_agency`, `tbl_referral`, `tbl_client`, or `tbl_volunteer_profile` — approval flows already exist in some form, and we hook their events without touching the schema.

### 3.3 New `tbl_app_setting` keys

Not schema changes — just settings rows the SMS/email admin page manages:

```
messaging.sms.provider                    'twilio'
messaging.sms.twilio.account_sid          (encrypted)
messaging.sms.twilio.auth_token           (encrypted)
messaging.sms.twilio.from_phone           '+15415551234'
messaging.sms.twilio.webhook_secret       (encrypted)
messaging.sms.enabled                     'true'|'false'

messaging.email.org.smtp_host             'smtp.gmail.com'
messaging.email.org.smtp_port             '587'
messaging.email.org.smtp_username         'ops@furnishhope.org'
messaging.email.org.smtp_password         (encrypted)
messaging.email.org.smtp_use_tls          'true'
messaging.email.org.from_address          'ops@furnishhope.org'
messaging.email.org.from_display_name     'Furnish Hope'
messaging.email.org.reply_domain          'replies.furnishhope.org'
messaging.email.enabled                   'true'|'false'

messaging.fallback_inbox                  'ops@furnishhope.org'
```

Encryption uses the existing `EMAIL_ENCRYPTION_KEY` (or derived from `SESSION_SECRET`, per the current v0.8 code). No new key management.

---

## 4. Event catalog

Events the app emits. Each has a stable `event_key` and a well-defined payload.

### 4.1 Delivery
- `delivery.scheduled` — new `tbl_client_deliveries` row
- `delivery.rescheduled` — date or arrival window changed
- `delivery.completed` — receipt signed off
- `delivery.cancelled` — status → Cancelled

### 4.2 Pickup
- `pickup.scheduled`, `pickup.confirmed`, `pickup.completed`, `pickup.cancelled`

### 4.3 Donation
- `donation.received` — new `tbl_donation` row
- `donation.receipt_sent` — `receipt_sent_date` set

### 4.4 Client / referral / agency / volunteer
- `referral.submitted`, `referral.approved`, `referral.rejected`
- `client.status_changed` (with `from`, `to`) — one event covers all transitions
- `agency_application.submitted`, `agency_application.approved`, `agency_application.rejected`
- `caseworker.invited`, `caseworker.registered`
- `volunteer.signup_submitted`, `volunteer.approved`

### 4.5 Provisioning
- `request.submitted`, `request.matched`, `request.scheduled`

### 4.6 Recipient sources

When a trigger fires, its `tbl_message_trigger_recipient` rows resolve to actual contacts:

| Recipient source | Resolves to |
|---|---|
| `contact_of_record` | Main contact tied to the record (client for delivery, donor for donation, etc.) |
| `referring_caseworker` | The agency_contact who referred the client |
| `assigned_lead` | `facility_staff_id` on delivery/pickup |
| `crew_members` | All `tbl_delivery_staff` for the delivery |
| `agency_primary_contact` | First `tbl_agency_contact` for the agency |
| `emergency_contact` | On `tbl_volunteer_profile` (custom_phone/email fallback if only name is stored) |
| `staff_role` | All active staff with the role (uses `staff_role_id` from trigger row) |
| `specific_staff` | Named staff (uses `specific_staff_id`) |
| `custom_phone` | Typed into trigger config |
| `custom_email` | Typed into trigger config |

Each event type has a subset of these that make semantic sense. The trigger editor UI only offers valid combinations.

---

## 5. Delivery cascade

For every send attempt, whether staff-initiated or triggered:

```
1. Contact has mobile phone + sms_consent_at + NOT sms_opted_out_at?
   YES → attempt SMS via Twilio
     ✓  → log to tbl_message, done
     ✗  → step 2 (hard failure only, e.g. invalid number)

2. Contact has email + email_consent_at + NOT email_opted_out_at?
   YES → attempt org email via sendOrgEmail()
     ✓  → log to tbl_message, done
     ✗  → step 3

3. Send fallback email to messaging.fallback_inbox:
   Subject: "[Furnish Hope] Couldn't reach {contact_name}"
   Body: rendered message + reason + link back to contact profile
   → log to tbl_message with channel='fallback_email'
   → insert tbl_message_undeliverable row for admin queue
```

**Consent is strict.** If a contact has SMS + email available but only SMS consent, and SMS fails, we skip email and go straight to fallback. We don't cascade to a channel without consent.

**Staff-to-staff messages** are treated as implicitly consented (employment relationship). Configurable per-staff if this ever becomes an issue.

---

## 6. Templates & merge fields

### 6.1 Filter logic

When a staff member clicks Send Message on a form, the template dropdown shows templates where ALL of:
- Template's `tbl_message_template_form` includes the current form_key
- Template's `tbl_message_template_recipient_type` includes the recipient's type
- Template's `tbl_message_template_sender_role` includes at least one of the sender's active roles
- Template's `channel` is compatible with recipient consent (SMS if they have SMS consent, email if email; both if both)

SMS and email templates appear together, distinguished by icon.

### 6.2 Merge fields

Hardcoded per form context in `messaging/merge_fields.ts`. When editing a template tagged for a form, the editor shows available fields as clickable chips.

Example — Delivery Detail context:
- `{{client_first_name}}` `{{client_full_name}}`
- `{{delivery_date}}` `{{arrival_window}}` `{{delivery_address}}`
- `{{crew_lead_name}}` `{{item_count}}`
- `{{fh_phone}}` `{{fh_email}}` — from settings

Example — Client Detail context:
- `{{client_first_name}}` `{{client_full_name}}`
- `{{caseworker_name}}` `{{agency_name}}`
- `{{next_delivery_date}}` (nullable — template validation warns)

### 6.3 Rendering

`render(template, payload)` is a pure function. Missing merge field → error surfaced at template save (as lint warning) and at send time. SMS templates with `append_reference_code = true` get `\n\nRef: {code}` appended where `{code}` is a 7-char alphanumeric like `D47a8b2` — deterministic per outbound, stored on `tbl_message.context_reference_code`.

---

## 7. Reply capture and threading

### 7.1 SMS reply flow

1. Contact texts our Twilio number
2. Twilio POSTs to `/api/webhooks/twilio/inbound`
3. Signature verified via `messaging.sms.twilio.webhook_secret`
4. Body parsed for reference code (`Ref: D47a8b2`)
5. Lookup:
   - Code found → link to source `tbl_message`, copy its `context_type`, `context_id`, `thread_id`. Confidence: `confirmed`.
   - No code → find most recent outbound to this phone within 72 hours. Use its context. Confidence: `inferred`.
   - No matches → log as unlinked. Confidence: `unlinked`.
6. Insert into `tbl_message` as inbound
7. Fire in-app notifications (§7.3)

Special:
- Body matches `STOP|UNSUBSCRIBE|CANCEL|QUIT|END` → set `sms_opted_out_at`, log, do NOT notify (Twilio auto-replies with compliance text)
- Body matches `HELP|INFO` → log, notify, Twilio auto-replies

### 7.2 Email reply flow

Uses plus-addressing. Outbound org email has `Reply-To: replies+D47a8b2@replies.furnishhope.org`.

For Phase 1, inbound email capture uses **IMAP poll** on the reply inbox — a small cron every 60 seconds. Simpler than setting up MX + webhook services. Can upgrade to a webhook-based service (Postmark Inbound, SendGrid Parse) in Phase 2 if reply volume warrants.

**Reuse note:** the app's existing per-user email infrastructure (`api/src/email/transports.ts` → `buildImapClient(acct)`) already handles IMAP connection setup, TLS, provider quirks (Gmail App Passwords, Yahoo, iCloud, etc.). The org email reply-inbox poller should reuse `buildImapClient` rather than re-implementing IMAP. Same for `buildSmtpTransporter` on the send side — `sendOrgEmail` will invoke the same nodemailer helper, just against org-level settings from `tbl_app_setting` rather than a per-user `tbl_email_account` row.

Same lookup logic as SMS. Parse the `To:` header for `+CODE@`.

Unsubscribe: outbound emails include a `List-Unsubscribe` header + link. Click → set `email_opted_out_at`.

### 7.3 In-app notification routing

When an inbound arrives:

1. Find the outbound it's replying to (via reference code, thread, or most-recent).
2. If outbound was **staff-initiated**: notify the sender.
3. If outbound was **trigger-initiated**: use the trigger's `on_reply_notify_source`:
   - `sender_of_record` — staff who created the underlying record (e.g., who scheduled the delivery)
   - `assigned_caseworker` — client's referring caseworker (if any)
   - `role` — everyone with `staff_role_id`
   - `staff` — named staff member
   - `none` — no in-app; still logs
4. Insert `tbl_message_notification` rows for each notified staff
5. Frontend badge count on sidebar; click opens notifications dropdown

Also drives **record-level badges**: `tbl_client_deliveries` #47's row in the deliveries list shows "1 new reply" when it has unread inbound.

---

## 8. UI surfacing

### 8.1 Contact profile (Client, Donor, Volunteer, Agency Contact detail pages)

New **Communications** section at bottom. Reverse-chronological list of `tbl_message` rows where `contact_id = this contact`. Each row:
- Timestamp + channel icon + direction arrow
- Subject (email) or first line of body
- Linked record chip ("Re: Delivery #47" — clickable)
- Sender/receiver
- Delivery status pill

Expandable rows show full body. **Send Message** button at top opens compose modal.

This is separate from the existing "call notes" section that lists `tbl_communication_log` entries. Both appear on the profile with clear headings.

### 8.2 Business record detail (Delivery, Donation, Pickup, Referral, Agency detail)

New **Related Communications** panel showing messages where `context_type = 'delivery' AND context_id = 47` (or the equivalent). Includes messages to any contact tied to the record.

Header shows unread badge if any inbound is unreviewed.

### 8.3 Sidebar notification bell

Icon next to user avatar shows count of `tbl_message_notification` where `dismissed_at IS NULL`. Click → dropdown of recent unread. Each row: "Marisol Navarro replied to your message about Delivery #47 · 12m ago." Click navigates + dismisses.

### 8.4 List page badges

Deliveries list, Pickups list, Clients list, Donors list, Referrals list — add small badge column for unread inbound count per row. Empty when zero.

### 8.5 Undeliverable queue

Admin page at `/admin/undeliverable` listing `tbl_message_undeliverable` where `resolved_at IS NULL`. Each row: contact, reason, intended body, "Mark resolved" with note.

---

## 9. Send Message modal

Trigger: "Send Message" button on contact profiles, on records with associated contacts, or inline next to phone/email fields.

Modal shows:
- **Recipient:** name + phone + email
- **Channel checkboxes** — enabled per consent. Grayed with tooltip when unavailable: "No SMS consent — [Manage consent]"
- **Template dropdown** — filtered per §6.1. Includes "— Free-form message —" at bottom
- **Preview area** — pre-filled with rendered template, editable. Tabs if both channels selected: SMS body / email subject+body
- **Send button** — sends via cascade (§5), logs, closes on success

Neither channel available → single "Log to fallback inbox" button + explanation.

---

## 10. Settings — Communications section

New section under Application Settings.

### 10.1 SMS Provider
- Provider dropdown (Twilio only for now)
- Account SID / Auth Token (encrypted) / From Phone / Webhook secret
- "Test connection" button
- Save

### 10.2 Org Email
- SMTP host/port/user/password/TLS
- From address, display name
- Reply domain (for plus-addressing)
- "Send test" button
- Save

### 10.3 Fallback Inbox
- Single email address field
- Note about what messages get sent there

### 10.4 Templates
Two tabs: SMS | Email

Each: table with Name, Tags, Active toggle, Edit / Duplicate / Delete.

Editor: Name, Description, Body with merge-field chip picker, Tags (form/recipient/role), Preview (renders against sample payload), Active toggle. Email version adds Subject + optional HTML body.

### 10.5 Triggers
Table: Name, Event, Templates (SMS/email), Recipients, Active, Edit / Delete / Send Test / View Log.

Editor: Name, Description, Event dropdown (from catalog §4), SMS template + Email template (either required, both allowed), Recipients (multi-select from valid sources for this event), On-reply-notify config, Active toggle.

"Send Test" prompts for a phone/email, renders against sample payload, sends.

### 10.6 Undeliverable Queue
See §8.5.

---

## 11. Approval trigger hooks

Rather than build new approval flows, we emit events from the existing ones. One-line additions to existing routes:

**In `agencyApplication.ts`** (existing approval route):
```typescript
// after successful approval transaction commit:
await emit('agency_application.approved', { application_id, approved_by });
// ...caseworker invitation emails still send inline as they do today.
// Phase 2: retrofit these to route through the trigger system.
```

**Similar one-liners** in the client status transition endpoints, referral approval endpoints, volunteer approval endpoint. Locations to be identified during implementation.

**Backfill events at deploy?** No. Events fire from now forward. The existing state of approved agencies/clients/volunteers doesn't generate historical events — nothing to do.

---

## 12. Consent capture

Two checkboxes added to these forms:
- Client intake form (staff-facing)
- Client waiver / agreement (client-facing, if applicable)
- Referral form (agency-facing at `/apply-to-refer` and internal)
- Donor form
- Volunteer signup (public) and volunteer form (internal)
- Agency contact form

The checkboxes:
- ☐ I consent to receive text messages from Furnish Hope about my [delivery/donation/volunteering]. Message and data rates may apply. Reply STOP to opt out.
- ☐ I consent to receive email messages from Furnish Hope.

Setting either updates the corresponding fields on `tbl_contact`.

On the contact profile, staff can also record consent manually with source = `verbal_staff_recorded`. This is common for phone-intake scenarios.

---

## 13. API surface

### 13.1 New endpoints

**Settings**
```
GET/PUT   /api/settings/communications/sms-provider
POST      /api/settings/communications/sms-provider/test
GET/PUT   /api/settings/communications/org-email
POST      /api/settings/communications/org-email/test
GET/PUT   /api/settings/communications/fallback-inbox
```

**Templates**
```
GET       /api/message-templates
POST      /api/message-templates
GET/PUT/DELETE  /api/message-templates/:id
GET       /api/message-templates/available
  ?form_key=X&recipient_type=Y&sender_role_id=Z
GET       /api/merge-fields?form_key=X
```

**Triggers**
```
GET       /api/message-triggers
POST      /api/message-triggers
GET/PUT/DELETE  /api/message-triggers/:id
POST      /api/message-triggers/:id/test
GET       /api/message-triggers/events
```

**Sending & viewing**
```
POST      /api/messages/send
  { to_contact_id, channels: ['sms','email'], template_id?, body, subject? }
GET       /api/messages?contact_id=X
GET       /api/messages?context_type=X&context_id=Y
POST      /api/messages/:id/mark-reviewed
```

**Webhooks**
```
POST      /api/webhooks/twilio/inbound
POST      /api/webhooks/twilio/status
```

**Notifications**
```
GET       /api/notifications
POST      /api/notifications/:id/dismiss
```

**Consent**
```
POST      /api/contacts/:id/consent
  { sms_consent?, email_consent?, source }
```

**Undeliverable queue**
```
GET       /api/undeliverable
POST      /api/undeliverable/:id/resolve
```

### 13.2 Modified endpoints

Add event emission after successful transactions in:
- `POST /api/deliveries`, `PUT /api/deliveries/:id`, `POST /api/deliveries/:id/receipt`
- `POST /api/pickups`, `PUT /api/pickups/:id`
- `POST /api/donations`, other donation endpoints
- Client status transition endpoints (find during implementation)
- `agencyApplication.ts` approval endpoints
- Volunteer approval endpoint
- Referral approval endpoint

These are one-line additions inside existing transactions, or one line after commit — depending on whether we want events to fire on rollback (they shouldn't).

---

## 14. Frontend surface

### 14.1 New routes
```
/settings/communications
/settings/communications/sms-provider
/settings/communications/org-email
/settings/communications/fallback-inbox
/settings/communications/templates
/settings/communications/templates/:id/edit
/settings/communications/triggers
/settings/communications/triggers/:id/edit
/admin/undeliverable
```

### 14.2 New components
- `<SendMessageModal>` — the compose UI
- `<SendMessageButton>` — inline button next to phone/email fields
- `<CommunicationsPanel>` — used on contact profiles and business records
- `<MessageRow>` — single row in a panel
- `<NotificationBell>` — sidebar dropdown
- `<TemplateEditor>` — SMS + email variants (one component, channel prop)
- `<TriggerEditor>`
- `<MergeFieldPicker>` — chip selector
- `<ConsentCheckboxes>` — reusable form snippet

### 14.3 Modified components
- `<Sidebar>` — add notification bell
- `<Dashboard>` — no changes required
- Contact detail pages (`ClientDetail`, `DonorDetail`, `VolunteerDetail`, agency contact detail) — add `<CommunicationsPanel>` and Send Message button
- Business record detail pages (`DeliveryDetail`, `DonationDetail`, `PickupDetail`, referral pages, agency pages) — add `<CommunicationsPanel>`
- List pages (`Clients`, `Donors`, `Deliveries`, `Pickups`, referral list, etc.) — add unread badge column
- Intake forms (client, referral, donor, volunteer, agency contact) — add `<ConsentCheckboxes>`

### 14.4 Existing pages left alone

`Mailbox.tsx`, `EmailCompose.tsx`, `EmailAccounts.tsx`, `EmailTemplates.tsx` — untouched. Those are per-user email, a separate concern.

---

## 15. Provider abstraction

```typescript
// api/src/messaging/sms/provider.ts
export interface SmsProvider {
  send(to: string, body: string): Promise<SendResult>;
  parseInboundWebhook(req: Request): Promise<InboundMessage>;
  parseStatusWebhook(req: Request): Promise<StatusUpdate>;
  validateSignature(req: Request): boolean;
}

// api/src/messaging/sms/twilio.ts
export class TwilioProvider implements SmsProvider { ... }
```

Provider is loaded at startup based on `messaging.sms.provider` setting. Adding a second provider = new class + settings dropdown entry.

Email uses similar shape:
```typescript
// api/src/messaging/email/org-email.ts
export async function sendOrgEmail({
  to, subject, bodyText, bodyHtml, replyToCode
}): Promise<SendResult>;
```

Configuration lives in `tbl_app_setting`.

---

## 16. Migration & rollout

### 16.1 Migration

Runs as part of the existing `runAuthMigrations()` sequence. Idempotent, like all v0.8 migrations. Order:

1. Add consent columns to `tbl_contact`
2. Create `tbl_message`, `tbl_message_template` and 3 join tables, `tbl_message_trigger` and recipient join, `tbl_message_notification`, `tbl_message_undeliverable`
3. Seed a starter template library (a few examples — delivery confirmation, agency approval, volunteer welcome, donation thank-you) marked `is_active = false` so they show as inactive drafts admins can edit and activate

### 16.2 First-run behavior

If no SMS provider settings exist → Communications sections show a "Configure SMS provider in Settings" banner. Send Message modal still works for email-only recipients. No SMS attempts.

If no org email settings exist → similar banner. SMS still works if configured.

Triggers are inert until their event fires AND at least one configured channel exists.

Undeliverable queue starts empty. Nothing to backfill.

### 16.3 Deprecating anything?

No. All new; existing code paths (caseworker invitation inline send, Mailbox, `tbl_communication_log`, `tbl_email_template`) untouched.

---

## 17. Size estimate

Substantially smaller than v1 of the design because we're not rebuilding what exists.

| Layer | New files | Modified files | LOC est |
|---|---|---|---|
| DB migrations | 1 | 0 | ~500 |
| API — messaging core (provider abstraction, event bus, renderer) | ~6 | 0 | ~900 |
| API — routes (settings, templates, triggers, messages, webhooks, consent, undeliverable) | ~9 | ~10 (event emit) | ~1700 |
| API — Twilio + org email providers | ~3 | 0 | ~400 |
| Frontend — Settings pages | ~6 | 0 | ~900 |
| Frontend — Compose modal + Communications panel + notification bell | ~6 | 0 | ~1100 |
| Frontend — page modifications (badges, panels, consent checkboxes) | 0 | ~15 | ~600 |
| **Total** | **~31** | **~25** | **~6,100** |

About half the size of v1 of the design. Still a real project.

### 17.1 Session plan

**Session 1: Foundation** (goal: SMS + org email works end-to-end via curl)
- Migration (all new tables + consent columns)
- Provider abstraction + Twilio client + `sendOrgEmail`
- Event bus
- Settings pages (SMS provider, org email, fallback inbox)
- Basic `POST /api/messages/send` endpoint
- Twilio webhook receivers (inbound + status)
- Consent columns on `tbl_contact` (no UI yet)

Demo at end: I can hit the API with curl to send a test SMS and email, receive replies, see delivery status update.

**Session 2: Templates & triggers**
- Template CRUD API + UI (both channels)
- Merge field renderer + editor picker
- Trigger CRUD API + UI
- Event emissions added to existing routes (deliveries, pickups, donations, approvals)
- Send Test button on triggers

Demo at end: Admin creates a template + trigger, an event fires, message goes out and gets logged.

**Session 3: UI surfacing**
- `<CommunicationsPanel>` on contact profiles and record detail pages
- `<SendMessageModal>` fully wired
- Notification bell + dropdown
- List page unread badges
- Undeliverable queue admin page
- Consent checkboxes on intake forms

Demo at end: full end-to-end workflow, using the actual UI.

Three sessions instead of four. Better-scoped, smaller session boundaries.

---

## 18. Resolved decisions

Both remaining open questions have been answered by Preston (2026-07-23):

### Q1: Send Message button placement — **Option B**

Contact profiles (Client, Donor, Volunteer, Agency Contact detail) AND business record detail pages (Delivery, Donation, Pickup, Referral). Targets the primary contact of each record. No inline buttons in tables/forms.

### Q2: Twilio account — **Confirmed**

Preston has a Twilio account for local dev testing. Production will use a separate Twilio account (set up during v0.9 deployment). Credentials will be entered via the new Settings UI when Session 1 completes.

---

## 19. Session 1 kickoff plan

This doc is the handoff artifact. Session 1 will be started in a fresh conversation inside the Furnish Hope project. Claude's first action in that conversation: read this design doc.

Session 1 scope, ordered by dependency:

1. **Migration** (`api/src/auth/migrations.ts` addition) — consent columns on `tbl_contact`, 7 new tables (`tbl_message`, `tbl_message_template`, 3 template joins, `tbl_message_trigger`, `tbl_message_trigger_recipient`, `tbl_message_notification`, `tbl_message_undeliverable`). Idempotent per existing v0.8 convention.

2. **Provider layer** —
   - `api/src/messaging/sms/provider.ts` — `SmsProvider` interface
   - `api/src/messaging/sms/twilio.ts` — Twilio implementation
   - `api/src/messaging/sms/index.ts` — resolver that loads active provider from `tbl_app_setting`
   - `api/src/messaging/email/org-email.ts` — `sendOrgEmail()`, reusing `email/transports.ts` `buildSmtpTransporter` pattern against org settings
   - `api/src/messaging/settings.ts` — helpers to read/write `messaging.*` keys in `tbl_app_setting` with encryption for secrets

3. **Event bus** — `api/src/messaging/events.ts`. Simple in-process dispatcher. No trigger execution yet — Session 2 wires triggers to events.

4. **Send + webhook endpoints** —
   - `api/src/routes/messages.ts` — `POST /api/messages/send` (staff-initiated cascade), `GET /api/messages` (by contact_id / context)
   - `api/src/routes/webhooks.ts` — Twilio inbound + status; signature verified against `messaging.sms.twilio.webhook_secret`

5. **Settings UI** —
   - `web/src/pages/settings/CommunicationsSmsProvider.tsx`
   - `web/src/pages/settings/CommunicationsOrgEmail.tsx`
   - `web/src/pages/settings/CommunicationsFallbackInbox.tsx`
   - `web/src/pages/settings/CommunicationsIndex.tsx` (nav landing)
   - Sidebar link additions

**Session 1 exit criteria:**

- `npm run tsc --noEmit` passes for both api and web
- Migrations run cleanly on Preston's local DB
- Preston can enter Twilio credentials via new Settings UI
- Preston can hit `POST /api/messages/send` (with an existing consented contact) and receive a real SMS on his phone
- Preston can reply to that SMS; webhook logs the inbound to `tbl_message` with correct `context_reference_code` linkage
- Twilio status webhook updates `delivery_status` on the outbound record

No template UI, no trigger UI, no Communications panel on records — those are Sessions 2 and 3.

Once Session 1 ships and Preston has confirmed end-to-end works, Session 2 begins.
