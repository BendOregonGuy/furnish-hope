# Furnish Hope — Staff User Manual

**Welcome!** This manual walks you through every part of the Furnish Hope app, in plain language, in the order you're likely to need it. Most of the work you do every day lives in just a handful of pages — this guide gets you comfortable with those first, then covers everything else as reference.

You do **not** need to read it front to back. Use the table of contents to jump to whatever you need. If you've never used an app like this before, start with **Getting Started** (it's short, about 10 minutes) and then **Daily Tasks** — those two sections cover 80% of what you'll do.

> 📸 **About the screenshots.** Throughout this manual you'll see boxes like `[Screenshot: …]`. Those are markers where a picture of the app will help. Anyone with admin access can replace them with real screenshots from our live system; instructions for that are in **Appendix A**.

---

## Table of Contents

- [Getting Started](#getting-started)
  - [Logging in](#logging-in)
  - [Your profile](#your-profile)
  - [The sidebar — a tour](#the-sidebar--a-tour)
  - [The dashboard](#the-dashboard)
- [Daily Tasks](#daily-tasks)
  - [Recording a donation](#recording-a-donation)
  - [Logging a pickup](#logging-a-pickup)
  - [Scheduling a delivery](#scheduling-a-delivery)
  - [Sending a thank-you receipt](#sending-a-thank-you-receipt)
  - [Adding a new donor or contact](#adding-a-new-donor-or-contact)
- [Working with Donors](#working-with-donors)
- [Working with Clients (Households)](#working-with-clients-households)
- [Pickups](#pickups)
- [Deliveries](#deliveries)
- [Inventory](#inventory)
- [Volunteers & Shifts](#volunteers--shifts)
- [Calendar](#calendar)
- [Campaigns & Events](#campaigns--events)
- [Email (Mailbox)](#email-mailbox)
- [Files & Attachments](#files--attachments)
- [Reports](#reports)
- [QuickBooks Sync](#quickbooks-sync)
- [Common Patterns Across the App](#common-patterns-across-the-app)
- [Troubleshooting & Getting Help](#troubleshooting--getting-help)
- **[Appendix A — Administrator Guide](#appendix-a--administrator-guide)**

---

## Getting Started

### Logging in

1. Open your web browser and go to **https://hammerhead-app-tk838.ondigitalocean.app** (or whatever address your administrator gives you).
2. Enter the **email address** and **password** your administrator set up for you.
3. Click **Sign in**.

> `[Screenshot: login-page.png — the login screen with email + password fields and the Furnish Hope logo.]`

If you forget your password, ask your administrator to reset it for you. (Admins: see **Appendix A → Resetting a user's password**.)

**Tip:** Most browsers will offer to remember your password. On a shared workstation, decline — on your own laptop, accept.

### Your profile

After you log in, you'll see your name in the top-right corner. Click it to:

- **Edit your profile** — update your display name, change your password.
- **Sign out** — when you're done for the day or stepping away.

> `[Screenshot: profile-menu.png — the dropdown that appears when clicking your name in the top-right.]`

### The sidebar — a tour

The vertical menu on the left side of the screen is the **sidebar**. It's how you get to every part of the app. Sections are grouped by what they're for:

| Group | What lives here |
|---|---|
| **Operations** | Clients, Requests, Pickups, Deliveries, Inventory |
| **Fundraising** | Donors, Donations, Pledges, Campaigns, Events |
| **People** | Volunteers, Shifts, Calendar |
| **Communication** | Mailbox, Compose |
| **Insights** | Dashboard, Reports |
| **Admin** | (only visible if your role allows it) |

> `[Screenshot: sidebar-full.png — the full sidebar expanded, with all sections labeled.]`

If the sidebar feels too wide, click the small collapse arrow to shrink it to icons-only — hover any icon to see its label.

### The dashboard

Your home screen — the page that loads first after you log in — is the **Dashboard**. It shows a snapshot of what's happening right now:

- Year-to-date revenue
- Top donors this fiscal year
- Active campaigns and how close they are to goal
- Upcoming events in the next two weeks
- Unread email count (if you have email connected)

> `[Screenshot: dashboard.png — the dashboard with all widgets visible.]`

**You don't need to do anything here** — it's just a quick read of how things are going. Click any widget to jump to the relevant section.

---

## Daily Tasks

This section covers the five things you'll do most often. Each one is broken into the smallest possible steps. If you can do these five, you can run the app.

### Recording a donation

When someone gives money or items, you record it as a **donation**. Every donation needs a **donor** — the person or group who gave.

**Step by step:**

1. In the sidebar, click **Donations**.
2. Click the **+ New Donation** button in the top-right.
3. Pick the **donor** from the dropdown. If they're new, click **+ New** beside the dropdown to add them on the spot — you don't have to leave the page.
4. Choose the **donation type** (cash, check, in-kind goods, etc.).
5. Enter the **amount** (or for in-kind donations, the estimated value).
6. Pick a **fund** (where the money is going — e.g., General, Housing, Volunteer Stipends).
7. Pick a **donation date** — usually today, unless you're catching up on paperwork.
8. Click **Save**.

> `[Screenshot: donation-form.png — the new donation form, with all main fields visible.]`

**What happens next:**

- The donation appears on the donor's page in their giving history.
- If you have QuickBooks connected, the donation will sync there automatically (see [QuickBooks Sync](#quickbooks-sync)).
- You can now **Send Receipt** from the donation's detail page — that emails an IRS-compliant acknowledgement PDF to the donor.

> 💡 **Tip:** If the donor already pledged this gift, the form will offer to link it. Always say yes — it keeps your pledge tracking honest.

### Logging a pickup

When a donor has items for us to come collect, you create a **pickup**.

1. In the sidebar, click **Pickups**.
2. Click **+ New Pickup**.
3. Pick the **donor**. Their **address auto-fills** — verify it's correct, or change it for this pickup only.
4. Pick a **pickup date** and **time window** (e.g., "Tuesday afternoon, 2pm–5pm").
5. Pick a **vehicle** and a **driver** (these come from Volunteers / corporate facilities).
6. Add notes — gate codes, stair count, fragile items, anything the driver needs to know.
7. Click **Save**.

After saving, the pickup detail page has a **Print manifest** button. The manifest is a one-page printable sheet with the donor's name, address, a map QR code, items expected, and a signature line.

> `[Screenshot: pickup-manifest.png — a printed pickup manifest sample.]`

> 💡 **Drivers love the QR code.** It opens turn-by-turn directions on their phone with one scan — no typing addresses while driving.

### Scheduling a delivery

When you've fulfilled a household's furniture request, you schedule a **delivery**.

1. Sidebar → **Deliveries** → **+ New Delivery**.
2. Pick the **client** (the household receiving the furniture).
3. Pick the **request** this delivery fulfills (optional but recommended — it links the loop closed).
4. Pick the **delivery date**, **vehicle**, and **driver**.
5. Add items from inventory (or note them in the description).
6. Click **Save**.

Same as pickups, you can **Print manifest** for the driver.

### Sending a thank-you receipt

Every donor expects an acknowledgement — both for the warm fuzzy and for their tax return. The app makes it one click.

1. From the donor's page (or the donation's detail page), click **Send Receipt**.
2. A PDF acknowledgement is generated automatically using your org's name, address, EIN, and the donation details.
3. The PDF is attached to an email and sent from your connected email account.
4. The email is logged automatically — you can see it later in the **Mailbox** and on the donor's record.

> `[Screenshot: send-receipt-button.png — the donation detail page with the Send Receipt button highlighted.]`

> 💡 **Bulk option:** Use **Donations → Acknowledgements batch** to send receipts for many donations at once.

### Adding a new donor or contact

This is the most common "I need to add a new person" task. You'll meet two related terms:

- **Donor** — the entity that gives. Could be a person, a couple, a company, an anonymous gift.
- **Contact** — a specific person to communicate with. A company might have several contacts.

If your donor is a person and they're giving as themselves, **donor and contact are the same person** — you'll create both with one form.

1. Sidebar → **Donors** → **+ New Donor**.
2. Pick the **donor type** (Individual, Couple, Family, Business, Foundation, Anonymous).
3. Fill in name, address, primary contact info.
4. Click **Save**.

Everywhere else in the app, when you need to pick a donor from a dropdown and they don't exist yet, you'll see a **+ New** button right beside the dropdown. Click it, fill in the same form in a small popup, save, and the new donor is now selected for whatever you were doing. **You never have to leave the page you were on.**

> `[Screenshot: quick-create-modal.png — the small popup form for adding a donor without leaving the current page.]`

---

## Working with Donors

The **Donors** section is the heart of your fundraising work. Every page has the same shape:

- **List page** — a searchable table of all donors.
- **Detail page** — everything about one donor: bio, lifetime giving, pledges, communication history, attached documents, donor pipeline stage.
- **Form page** — for creating a new donor or editing an existing one.

> `[Screenshot: donor-detail.png — a donor's detail page with sections visible: bio, giving history, pipeline, email widget, attachments.]`

### Donor types and the "Anonymous" flag

A donor's **type** (Individual, Couple, Business, etc.) tells you what kind of entity they are. The separate **Anonymous** flag is a privacy choice — checking it means "do not publicly attribute their gifts." Anonymous gifts still need a real donor record so you can send a receipt and acknowledge them privately.

### The donor pipeline

Each donor has a **stage** — Prospect, Cultivating, Solicited, Stewarded, Lapsed. Update the stage as your relationship evolves; the **Reports** section will show you the funnel.

### Donor history

The detail page shows:
- **Lifetime giving** — total amount, count, average gift, first gift, last gift
- **All donations** in a timeline
- **All pledges** with fulfillment percentage
- **All emails** to and from them
- **All attached files** (signed pledge cards, MOUs, etc.)

---

## Working with Clients (Households)

A **client** is a household receiving furniture from us. Clients are deliberately kept separate from donors — different tab, different list, different forms. We treat client information as **sensitive**: address details, family composition, agency referrals.

### Adding a client

1. Sidebar → **Clients** → **+ New Client**.
2. Fill in head-of-household, address, family composition.
3. **Household type** is a multi-select checkbox group — a family can be more than one type at the same time (e.g. **Veteran** AND **Natural Disaster**). Check every category that applies; the first checked becomes the "primary" used in some reports.
4. **"Did you mean...?" banner.** As you type a name + DOB, the form may surface existing households that look similar. If one is the same person, click **Use this household** — you'll land on their existing detail page and can file a new referral against them instead of duplicating.
5. Add notes about delivery accessibility (apartment unit, stairs, pet warnings).
6. Save.

### Adding new household types

Sidebar → **Database Admin** → search for `lkp_client_type` → **+ New** → enter a label (e.g. "Recently incarcerated") → save. The new option appears as a checkbox on every client form on the next page load — no developer needed.

### Multi-agency referrals

A household can be referred by **more than one agency** (~5% of clients). The system keeps **one client record** but stacks multiple referrals against them. On the client detail page, scroll to **Referral history** to see every agency, caseworker, date, and the requests each referral spawned.

If two agencies refer the same family in the same week for the same furniture, each agency's request goes into the **review queue** for staff to triage. Each request stays tied to its originating referral (and agency); you can approve one and reject the other, or approve both if they're for different things.

### Requests

A **request** is what a household has asked for — beds, dining table, couch, dressers, etc.

Requests reach Furnish Hope two ways:

1. **Staff-created** — you open the client detail page, click **+ New Request**, list items, save. These land approved and join the matching pipeline immediately.
2. **Agency-submitted** — a caseworker fills in items on their referral form, which atomically creates the client + referral + request + items. These land with **review status = "Awaiting review"** so you can confirm them before matching starts.

### Resolving duplicate clients

The system runs a **nightly dedup scan** at 2:00 AM server time that compares every pair of clients on name, date of birth, phone, email, and address. Pairs scoring at or above the **threshold** (default 70%, admin-tunable in **Database Admin → App Settings → `dedupe_match_threshold`**) land in the review queue.

Sidebar (admin-only) → **System → Duplicate clients** (red badge shows the pending count). The dashboard also shows a banner at the top when there are any.

For each pair you'll see two options:

- **Review →** opens a side-by-side compare. Each column has a **Keep** radio button at the top — the system defaults to whichever side has more referrals + requests + visits (more history = stronger anchor). Toggle if you'd rather keep the other. Fields that differ are shown in dark ink; identical ones are dimmed. Click **Merge X → Y** to move every referral, request, visit, and delivery to the kept client and delete the other. The operation cannot be undone; an audit-log row is written.
- **Not a duplicate** if you've decided the two are actually different people. The pair is marked resolved and the nightly scan won't re-flag it.

Two manual triggers exist for impatient cases:

- **Run scan now** button on the queue page (top of the Duplicate Clients view). Runs the same scan immediately and shows the result counter.
- **Check for duplicates** button on each client's detail page (admin-only, top-right of the header). Searches the rest of the database against THIS client and shows top matches inline so you can decide whether to merge.

### The review queue (agency-submitted requests)

Sidebar → **Clients → Review queue** (red badge shows pending count). The queue lists every awaiting-review request oldest first.

For each:

- **Edit** — open the full RequestDetail to adjust items, assign the correct facility, pick the right origin/creator, then save and approve.
- **Approve** — accept the request as-is. Status flips to **Approved** and the request joins the matching pipeline.
- **Reject** — opens a modal for a brief note. The agency caseworker sees that note in their portal so they know what to fix or contact Furnish Hope about. Be brief and constructive.

The badge clears when the queue is empty.

> `[Screenshot: client-detail.png — a client detail page with their request history.]`

---

## Pickups

Covered in **Daily Tasks** above. A few extras:

- **Multiple pickups, one day** — schedule them all, then use the **Calendar** view to see them laid out by time.
- **Cancellations** — change the pickup status to "Cancelled" and add a note. We keep cancelled pickups for reporting (no-show rates).
- **Attached photos** — drag-and-drop photos onto the pickup detail page. Useful for documenting damaged items or pickup conditions.

---

## Deliveries

Covered in **Daily Tasks** above. A few extras:

- **Copy items from the linked request** — when a delivery is linked to a request, the items list pre-fills.
- **Sign-off** — the manifest includes a signature line for the client to sign on delivery.

---

## Inventory

The **Inventory** section tracks furniture that's currently in our warehouse, available to deliver.

- **+ New Inventory Item** — record an item that arrived (usually triggered automatically by a pickup, but you can add manually).
- Each item has a **category** (sofa, table, bed, etc.), **condition**, and **location** (which warehouse bay it's in).
- Items get marked **reserved** when promised to a household, and **delivered** when handed off.

> `[Screenshot: inventory-list.png — the inventory list with status filters at the top.]`

> 💡 **Reality check:** Most teams don't track inventory in this much detail at first — it's optional. If you skip it, you can still record donations and deliveries; you just won't have a real-time "what's on hand" answer.

---

## Volunteers & Shifts

### Adding a volunteer

1. Sidebar → **Volunteers** → **+ New Volunteer**.
2. Fill in contact info, role (driver, intake, admin support), preferred days.
3. Save.

### Scheduling shifts

A **shift** is a single block of volunteer time — e.g., "Saturday 9am-noon, driver shift."

You can add shifts one at a time, or use **shift templates** (Appendix A → Shift templates).

A template says "every Mon/Wed/Fri from 9am to noon we need a driver." Then click **Generate** and the app creates real shifts for the next 30 days from that pattern — skipping holidays automatically.

> `[Screenshot: shift-template.png — the shift template form with day-of-week toggle buttons.]`

### Recording volunteer hours

Each shift has a **signup** (who's working it). After the shift, record actual hours. That feeds into:
- Volunteer's lifetime hours
- IRS-required volunteer hour reports
- The "Volunteer Hours" chart on the Reports page

---

## Calendar

The **Calendar** page shows everything happening on one view — pickups, deliveries, shifts, events. Color-coded by type.

- Click any event to jump to its detail page.
- Use the toggles at the top to hide event types you don't care about.
- Switch between month, week, and day views.

> `[Screenshot: calendar-month.png — the calendar in month view with pickups, deliveries, and events visible.]`

---

## Campaigns & Events

### Campaigns

A **campaign** is a fundraising drive with a goal — e.g., "Spring Capital Campaign, goal $50,000."

- Create the campaign with a name, goal amount, and start/end dates.
- As donations come in tagged to that campaign, the progress bar fills.
- You can see all campaigns and their progress on the Dashboard.

### Events

An **event** is anything you're hosting — gala, open house, donor lunch.

- Create the event with a date, venue, capacity.
- Attendees get added from the event's detail page.
- Each attendee can be tagged "Confirmed," "Maybe," "Declined," or "No-show."

> `[Screenshot: event-attendees.png — an event detail page with the attendee table visible.]`

---

## Email (Mailbox)

The Mailbox lets you read and reply to email from inside the app — and every message you send or receive is automatically logged on the relevant donor/client/volunteer record. **You see only your own email** — never another staff member's.

### Connecting your email account (one-time setup)

You'll do this once, per yourself.

1. Sidebar → **Email** → **Email Accounts**.
2. Click **+ Add Account**.
3. Pick a provider preset (Gmail, Outlook, Yahoo, or Custom IMAP).
4. Enter your email address and an **app-specific password** (NOT your regular password — see below).
5. Click **Test connection**.
6. If green ✓, click **Save**.

> ⚠️ **About app-specific passwords.** Most email providers (Gmail, Microsoft, Yahoo) require you to generate an "app password" for third-party apps. Your normal login password won't work. Your administrator can help — instructions are in Appendix A → Email account setup.

### Reading mail

1. Sidebar → **Mailbox**.
2. Click **Sync now** to pull the latest messages from your inbox.
3. Click any message to expand it. Inline reply opens at the bottom.
4. Unread messages have a colored dot and bold subject; once you open them, they go to "read" automatically.
5. The number badge on the sidebar **Mailbox** entry shows your unread count.

> `[Screenshot: mailbox.png — the mailbox with unread messages visible and one expanded.]`

### Composing a new message

1. **Email → Compose** in the sidebar.
2. Fill in To, Cc (optional), Subject, body.
3. Drag-and-drop files onto the **Attachments** area to attach them.
4. Click **Send**.

### Email from a record

On any donor, client, volunteer, or contact's detail page, you'll see an **Email** widget. It shows all the email history between you and that person. You can reply from the widget or compose a new message that's automatically addressed to them.

> 💡 **Why bother?** Because two months from now you'll forget what you promised Margaret Lin. Having every exchange logged on her record means you can scroll back and see exactly what was said.

---

## Files & Attachments

You can attach files (photos, signed documents, PDFs, etc.) to most records — donors, clients, pickups, deliveries, contacts, volunteers, vehicles, agencies, corporate facilities.

### Attaching a file

1. Open the record (e.g., a donor's detail page).
2. Find the **Attachments** section (usually at the bottom).
3. **Drag a file from your computer** onto the dotted area, or click to pick a file.
4. The file uploads, and now lives with that record.

> `[Screenshot: attachments-widget.png — the attachments widget with one file uploaded and visible in the list.]`

### Editing, downloading, deleting

- **Click the file name** to download it.
- **Pencil icon** to rename or change the description.
- **Trash icon** to delete (you'll be asked to confirm).

### What can I attach?

Anything reasonable — PDFs, images, Word docs, spreadsheets, signed forms. The limit is **20MB per file**. For very large files (e.g., long video recordings), don't attach them — store them in cloud storage and put the link in a note.

---

## Reports

The **Reports** page has 16 charts that summarize what's happening across the org. It's read-only — you can't break anything by clicking around.

At the top there's a **Period toggle**: Monthly / Quarterly / Yearly. Every chart re-buckets when you switch.

What's there:

- Revenue trend over time
- Revenue by fund
- Donor mix (new vs. returning)
- Active campaigns and progress
- Pickup/delivery throughput
- Average cycle time (request to delivery)
- Inventory flow (in vs. out)
- Donor pipeline funnel
- Volunteer hours
- Top donors
- Average gift size
- Pledges fulfilled vs. outstanding
- Shift fill rate
- Inventory by category
- Acknowledgement turnaround time
- Donation types (cash, check, in-kind, recurring)

> `[Screenshot: reports-overview.png — the Reports page showing a few of the top charts.]`

> 💡 **Boardroom-friendly.** Take a screenshot of any chart by right-clicking → Save Image. Drop into a board presentation.

---

## QuickBooks Sync

If your organization uses QuickBooks Online, donations sync automatically.

### What syncs

- Every saved donation creates a corresponding **Sales Receipt** in QuickBooks.
- Each fund maps to a QuickBooks **Income Account** (set up by your admin).
- Each donor maps to a QuickBooks **Customer**.

### Where to see sync status

On any donation's detail page, you'll see a small **Sync Status** indicator:

- **✓ Synced** — successfully recorded in QBO.
- **⏳ Pending** — queued but not yet sent.
- **✗ Error** — something went wrong (hover for details).

If sync fails, your admin can investigate. Most common cause: a new fund or donor hasn't been mapped yet in QuickBooks settings.

> `[Screenshot: qbo-sync-status.png — donation detail page with sync indicator visible.]`

---

## Common Patterns Across the App

A few habits the app uses everywhere — once you know them, the whole app feels easier.

### The "+ New" button

Whenever you need to pick something from a dropdown that doesn't exist yet, look for a small **+ New** button beside the dropdown. Click it, fill in the popup, save, and you're back where you started with the new item selected. This works for donors, contacts, addresses, vehicles, agencies, corporate facilities — anywhere a record might not exist yet.

### Required fields

A red asterisk (`*`) next to a field label means it's required. If you try to save without filling it in, the field will turn red and the form will tell you what's missing.

### Search bars

Every list page has a search bar at the top. It searches across all visible columns — name, email, date, status, whatever. There's no need to click "Search" — results filter as you type.

### Prev / Next navigation

On any detail page, you'll see **← Prev** and **Next →** buttons at the top. They walk you through records one at a time in the order they appear in the list — useful for batch tasks like reviewing all unacknowledged donations.

### Unsaved-changes warning

If you start editing a form and try to navigate away, the app warns you that you'd lose unsaved changes. Click **Stay** to keep editing, or **Discard** to leave.

### Audit log

Everything that changes data — every donation, every pickup, every account edit — is recorded in the **audit log** with who did it and when. Admins can review the log; staff just need to know it exists and that nothing is ever silently lost.

---

## Troubleshooting & Getting Help

### "I can't see something I just created"

- **Refresh the page** (Ctrl+R on Windows, ⌘+R on Mac). Most "missing" data is just a stale view.
- **Check filters** — many list pages have status filters at the top. You might be viewing only "Active" while your record is "Pending."

### "Sync now did nothing"

- That just means there's no new mail since the last sync. It's normal.

### "The page won't load / I'm seeing an error"

- Press **Ctrl+Shift+R** (hard refresh) to force the browser to reload everything.
- If that doesn't fix it, log out and log back in.
- If still broken, take a screenshot of the error and send it to your admin.

### "I deleted something by accident"

- Tell your admin — most things can be restored from the audit log. Don't try to recreate it yet; let admin recover the original.

### How to report a bug

Email your administrator (or [preston@getreality.com](mailto:preston@getreality.com)) with:

1. **What you were trying to do** ("I was sending a receipt to Margaret Lin").
2. **What actually happened** ("The Send Receipt button spun and then showed an error").
3. **A screenshot** of the error message if possible.
4. **The time** so we can find it in the logs.

---

# Appendix A — Administrator Guide

This appendix is for the user(s) marked as **Admin** in the system. It covers everything in the **Admin** section of the sidebar plus the org-wide settings only admins can change.

## What's in the Admin section

The Admin section gives you access to **every table** in the database — 111 of them — through a uniform interface. Most of the time you won't need most of them; the most important ones are listed below.

> `[Screenshot: admin-home.png — the admin landing page with the list of tables grouped by purpose.]`

## Common admin tasks

### Adding a new user account

1. Admin → **User Accounts** → **+ New**.
2. Enter their email, choose a **role** (Admin, Staff, Volunteer Coordinator, etc.).
3. Click **Save**.
4. The system shows you a one-time temporary password. **Copy it now** — you can't see it again.
5. Tell the new user their email + temporary password. They'll be forced to change it on first login.

### Resetting a user's password

1. Admin → **User Accounts** → find the user → **Edit**.
2. Click **Reset password**.
3. Copy the new temporary password and pass it to the user.

### Disabling a user account

When someone leaves the organization, **disable** their account rather than delete it — that keeps their historical actions in the audit log intact.

1. Admin → **User Accounts** → find the user → **Edit**.
2. Set **Active** to "No."
3. Save.

### Viewing the audit log

1. Admin → **Audit Log**.
2. Use the filters at the top: by user, by date range, by table, by action (create/update/delete).
3. Click any entry to see the **before** and **after** values for that change.

> `[Screenshot: audit-log.png — the audit log filtered for one user, showing a recent set of changes.]`

> 💡 **Best practice:** Glance at the audit log once a week. It's how you'll catch accidental deletions, unauthorized changes, or staff confusion.

### Editing lookup tables

Lookup tables (their names start with `lkp_`) are the dropdown choices throughout the app — fund names, request statuses, vehicle types, etc.

1. Admin → search for the table (e.g., `lkp_fund`).
2. Edit existing entries or add new ones.
3. New entries immediately appear in dropdowns across the app.

> ⚠️ **Don't delete lookup entries that are in use.** If any record references that entry, deleting will fail (the app protects you). Instead, mark it inactive if the table has an active flag.

### Shift templates

A **shift template** says "every Monday, Wednesday, Friday from 9am to noon, generate a driver shift."

1. Admin → **Shift Templates** → **+ New**.
2. Pick the days of the week with the M/T/W/T/F/S/S toggle buttons (or use **Mon-Fri** / **Sat+Sun** / **Every day** shortcuts).
3. Set the start time, end time, and shift type.
4. Check **Skip holidays** if you want federal holidays excluded.
5. Save.

Then go to **Shifts → Generate** and pick a date range. The app creates real shifts from the template, skipping holidays as configured. Re-running Generate later is safe — duplicates are prevented automatically.

> `[Screenshot: shift-templates-list.png — the shift templates admin list.]`

### Holidays

The system seeds US federal holidays for the next several years. You can:

- **Add custom holidays** — your nonprofit's anniversary day off, all-staff retreats, etc.
- **Remove holidays** that don't apply to your operation.

Admin → **Holidays** → **+ New**.

### Org settings

Admin → **Org Settings** holds your organization's identity:

- Legal name (shown on receipts)
- EIN (federal tax ID — required for IRS-compliant receipts)
- Mailing address
- Phone, email
- Receipt numbering (starting number, prefix)

These values appear on every PDF receipt. Set them up before you send any acknowledgements.

> `[Screenshot: org-settings.png — the Org Settings page with all fields filled in.]`

### Email account setup (per user)

Each staff member connects their **own** email — admins don't centralize email. Why: privacy, and so each person can use their existing professional inbox without sharing credentials.

**The app-specific password requirement.** Modern email providers (Gmail, Microsoft, Yahoo) require an "app password" — a one-off password they generate specifically for third-party apps like ours. Your normal email password won't work.

- **Gmail:** Account → Security → 2-Step Verification (must be on) → App passwords → generate one for "Mail."
- **Outlook/Microsoft 365:** Microsoft Account → Security → Advanced security options → App passwords.
- **Yahoo:** Account Info → Account security → Generate app password.

Paste that into the Email Account form in the app, test, save. The app-specific password is **encrypted at rest** in our database (AES-256).

### QuickBooks setup

One-time, by an admin:

1. Admin → **QuickBooks** → **Connect**.
2. Sign in to QuickBooks Online with an admin account.
3. Authorize Furnish Hope to access your books.
4. Back in our app, **map each fund** to a QuickBooks income account, and choose an **undesignated default** for donations that don't have a fund tag.
5. Click **Save mappings**.

After this, every new donation syncs automatically. You can see sync status on each donation's detail page and on the QBO settings page.

> `[Screenshot: qbo-mappings.png — the QuickBooks fund mapping page.]`

### Storage settings (attachments)

By default, attached files are stored inside our database. As your file volume grows, you'll want to move them to cheaper **object storage** (DigitalOcean Spaces, AWS S3, or Google Drive).

1. Admin → **Storage Settings**.
2. Configure the new storage provider with credentials.
3. Click **Migrate existing files** to move them in the background.

This is rare — most orgs run for years on the default storage without issue.

---

## Suggestions for admins — how to keep this app healthy

A few habits that prevent future headaches:

### Once a week

- **Glance at the audit log** — anything surprising?
- **Check unacknowledged donations** (Dashboard or Donations list with a status filter) — send receipts for any older than 7 days.
- **Sync now in Mailbox** — make sure your IMAP connection is still healthy.

### Once a month

- **Review the user list** — anyone who's left and still has access?
- **Look at the Reports page in Quarterly view** — anything looking off (a fund with zero gifts? a campaign behind schedule?).
- **Run the schema dump for backup** — `pg_dump` from the Postgres docs we've documented.

### Once a quarter

- **Review lookup tables** for entries no longer in use. Mark inactive rather than delete.
- **Clean up draft / abandoned records** — donations with status "Pending" that have been pending for months are usually mistakes.
- **Walk through the manual** — anything outdated? Have we added features that aren't documented?

### Before any board meeting

- **Reports → Quarterly view** has all the slides you need. Right-click any chart → Save Image.
- **Top donors** + **Active campaigns** + **Revenue trend** is usually all a board wants.

### Data hygiene tips

- **Duplicate donors are the #1 future headache.** When adding a new donor, search first by name and email. If unsure, ask the team.
- **Never delete a record that has history.** Mark it inactive instead. Deletion makes audit logs harder to read.
- **Keep the donor pipeline current.** Stages stop being useful if nobody updates them. Aim for 5 minutes a week.

### When something feels broken

The platform itself is monitored by our deployment provider (DigitalOcean). If you're seeing strange behavior:

1. Try a **hard refresh** (Ctrl+Shift+R on Windows).
2. Try in a **private/incognito window** (rules out browser cache).
3. **Email Preston** with a screenshot, the time it happened, and what you were doing.

---

## Appendix B — Adding screenshots to this manual

If you're the admin filling in screenshots, here's the workflow:

1. Open the app in your browser, navigate to whatever screen the placeholder describes.
2. Take a screenshot (Windows: **Win+Shift+S**, Mac: **⌘+Shift+4**).
3. Save the image into `docs/manual-screenshots/` with the filename mentioned in the placeholder (e.g., `dashboard.png`).
4. In `docs/USER_MANUAL.md`, replace the placeholder line:
   ```
   > `[Screenshot: dashboard.png — …]`
   ```
   with:
   ```
   ![Dashboard](manual-screenshots/dashboard.png)
   ```
5. Save the file. If you have git set up, commit and push.

**Anonymize first.** Before saving any screenshot, blur or crop out:
- Real donor names and addresses
- Real client names and addresses
- Email addresses of staff (other than your own)

A free tool like **Greenshot** (Windows) or the macOS Markup tool lets you blur regions quickly. Or capture against the demo/test database if you have one.

---

*Furnish Hope is built and maintained by Preston Callicott. Questions, bug reports, or ideas? **preston@getreality.com**.*
