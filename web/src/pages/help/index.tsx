/**
 * Staff user manual at /help. Single page, anchored sections, sticky
 * TOC. Help buttons throughout the app link here via #section.
 */

import { ManualShell, type TocEntry } from './ManualShell.tsx';
import { ScreenshotSlot } from './ScreenshotSlot.tsx';

const TOC: TocEntry[] = [
  { id: 'getting-started', label: 'Getting started', children: [
    { id: 'login', label: 'Logging in' },
    { id: 'profile', label: 'Your profile' },
    { id: 'sidebar', label: 'The sidebar' },
    { id: 'dashboard', label: 'The dashboard' },
  ]},
  { id: 'donors', label: 'Donors' },
  { id: 'donations', label: 'Donations' },
  { id: 'pledges', label: 'Pledges' },
  { id: 'clients', label: 'Clients (households)' },
  { id: 'requests', label: 'Packing lists' },
  { id: 'waivers', label: 'Furniture waivers' },
  { id: 'pickups', label: 'Pickups' },
  { id: 'visits', label: 'Visits' },
  { id: 'deliveries', label: 'Deliveries', children: [
    { id: 'deliveries-home',     label: 'Home delivery' },
    { id: 'deliveries-walkout',  label: 'Walkout' },
    { id: 'deliveries-container', label: 'Container pickup' },
  ]},
  { id: 'inventory', label: 'Inventory' },
  { id: 'volunteers', label: 'Volunteers' },
  { id: 'shifts', label: 'Shifts' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'events', label: 'Events', children: [
    { id: 'events-roles', label: 'Manager, host, capacity' },
    { id: 'events-attendees', label: 'Attendees + seating' },
    { id: 'events-sponsors', label: 'Sponsors' },
    { id: 'events-checkin', label: 'Day-of check-in' },
    { id: 'events-prints', label: 'Print views' },
  ]},
  { id: 'vendors', label: 'Vendors' },
  { id: 'email', label: 'Email & mailbox' },
  { id: 'attachments', label: 'Files & attachments' },
  { id: 'reports', label: 'Reports' },
  { id: 'qbo', label: 'QuickBooks sync' },
  { id: 'patterns', label: 'Common patterns' },
  { id: 'reporting-issues', label: 'Reporting issues', children: [
    { id: 'reporting-issues-modal',    label: 'Using the Report Issue button' },
    { id: 'reporting-issues-settings', label: 'Opening it up to everyone' },
  ]},
  { id: 'troubleshooting', label: 'Troubleshooting' },
  { id: 'admin', label: 'Admin guide' },
  { id: 'developer-tools', label: 'Developer tools', children: [
    { id: 'developer-tools-flag',       label: 'Marking a user as developer' },
    { id: 'developer-tools-console',    label: 'The issue console' },
    { id: 'developer-tools-broadcasts', label: 'Broadcasting to all users' },
  ]},
];

export function Help() {
  return (
    <ManualShell
      title="Furnish Hope — Staff User Manual"
      subtitle="Plain-language walkthrough of every part of the app. Use the table of contents to jump to a section, or use the Help button on any page to land here at the right spot."
      toc={TOC}
    >
      <p>
        Welcome. This manual is meant to be a reference, not a textbook —
        you don't have to read it front to back. The most common workflows
        are covered first under <a href="#donors">Donors</a>,{' '}
        <a href="#donations">Donations</a>, <a href="#clients">Clients</a>,
        and <a href="#pickups">Pickups / Deliveries</a>. Everything else
        is below those for when you need it.
      </p>

      <div className="callout tip">
        <strong>💡 Help buttons</strong> — every page in the app has a small
        <code>Help ↗</code> link in the top-right corner. Clicking it opens
        this manual in a new browser tab, scrolled directly to the relevant
        section. Your form data stays put in the original tab.
      </div>

      {/* ============================================================ */}
      <section id="getting-started">
        <h2>Getting started</h2>

        <section id="login">
          <h3>Logging in</h3>
          <ol>
            <li>Open your web browser and go to the app's URL (e.g., <code>https://hammerhead-app-tk838.ondigitalocean.app</code>).</li>
            <li>Enter the <strong>email address</strong> and <strong>password</strong> your administrator set up.</li>
            <li>Click <strong>Sign in</strong>.</li>
          </ol>
          <p>If you forget your password, ask your administrator to reset it. On a shared workstation, decline browser save-password prompts.</p>
          <ScreenshotSlot slug="login-page" description="The login screen with email + password fields and the Furnish Hope logo." url="/login" />
        </section>

        <section id="profile">
          <h3>Your profile</h3>
          <p>After login, your name appears in the top-right corner. Click it to edit your display name, change your password, or sign out.</p>
          <ScreenshotSlot slug="profile-menu" description="The dropdown that appears when clicking your name in the top-right." url="/" />
        </section>

        <section id="sidebar">
          <h3>The sidebar</h3>
          <p>The vertical menu on the left is how you reach every part of the app. Entries are grouped by purpose:</p>
          <table>
            <thead><tr><th>Group</th><th>What lives here</th></tr></thead>
            <tbody>
              <tr><td>Overview</td><td>Dashboard, Reports</td></tr>
              <tr><td>Email</td><td>Mailbox, Compose, Templates, Accounts</td></tr>
              <tr><td>Clients</td><td>Clients, Packing Lists</td></tr>
              <tr><td>Operations</td><td>Calendar, Deliveries, Pickups, Inventory, Vendors</td></tr>
              <tr><td>Network</td><td>Volunteers, Shifts</td></tr>
              <tr><td>Fundraising</td><td>Campaigns, Events, Donors, Donations, Acknowledgements, Pledges</td></tr>
              <tr><td>System</td><td>Settings, QuickBooks, Shift templates, Holidays, Manual Screenshots, Activity log, Database Admin, User Manual <em>(this page)</em></td></tr>
            </tbody>
          </table>
          <ScreenshotSlot slug="sidebar-full" description="The full sidebar expanded, with all sections labeled." url="/" />
        </section>

        <section id="dashboard">
          <h3>The dashboard</h3>
          <p>The dashboard is your home screen — a snapshot of what's happening right now:</p>
          <ul>
            <li>Year-to-date revenue</li>
            <li>Top donors this fiscal year</li>
            <li>Active campaigns and progress to goal</li>
            <li>Upcoming events</li>
            <li>Unread email count (if connected)</li>
          </ul>
          <p>Click any widget to jump to the relevant section. You don't have to do anything here — it's a read-only summary.</p>
          <ScreenshotSlot slug="dashboard" description="The dashboard with all widgets visible." url="/" />
        </section>
      </section>

      {/* ============================================================ */}
      <section id="donors">
        <h2>Donors</h2>
        <p>The Donors section is the heart of fundraising work. A <strong>donor</strong> is anyone who gives — a person, couple, family, business, foundation, or anonymous source.</p>
        <h3 id="donors-adding">Adding a donor</h3>
        <ol>
          <li>Sidebar → <strong>Donors</strong> → <strong>+ New Donor</strong>.</li>
          <li>Pick the <strong>donor type</strong> (Individual, Couple, Family, Business, Foundation, Anonymous).</li>
          <li>Fill in name, primary contact, address. Address can be picked from existing or created with <strong>+ New</strong>.</li>
          <li>Click <strong>Save</strong>.</li>
        </ol>
        <p>Anywhere else in the app where you pick a donor from a dropdown, you'll see <strong>+ New</strong> beside it — click to create a donor inline without leaving the form.</p>
        <h3 id="donors-detail">The donor detail page</h3>
        <p>Each donor's page collects everything in one place:</p>
        <ul>
          <li><strong>Lifetime giving</strong> — total, count, average, first and last gift.</li>
          <li><strong>All donations</strong> in a timeline.</li>
          <li><strong>All pledges</strong> with fulfillment percentage.</li>
          <li><strong>All emails</strong> to and from them.</li>
          <li><strong>Pipeline stage</strong> — Prospect → Cultivating → Solicited → Stewarded → Lapsed.</li>
          <li><strong>Attached files</strong> — signed pledge cards, MOUs, etc.</li>
        </ul>
        <ScreenshotSlot slug="donor-detail" description="A donor's detail page with sections visible — bio, giving history, pipeline, email widget, attachments." url="/donors" />
        <div className="callout tip">
          <strong>💡 Search before adding</strong> — duplicate donors are the #1 future cleanup headache. Always search by name and email first.
        </div>
      </section>

      {/* ============================================================ */}
      <section id="donations">
        <h2>Donations</h2>
        <p>When someone gives money or items, you record it as a donation. Every donation has a donor.</p>
        <h3 id="donations-recording">Recording a donation</h3>
        <ol>
          <li>Sidebar → <strong>Donations</strong> → <strong>+ New Donation</strong>.</li>
          <li>Pick the <strong>donor</strong> (or click <strong>+ New</strong> to add inline).</li>
          <li>Choose the <strong>donation type</strong> (Monetary, In-kind, Mixed).</li>
          <li>Enter the <strong>amount</strong> (estimated value for in-kind).</li>
          <li>Pick a <strong>fund</strong> (General, Housing, etc.) and a <strong>donation date</strong>.</li>
          <li>If the donor has open pledges, the form offers to link the donation to one — say yes for accurate pledge tracking.</li>
          <li>Click <strong>Save</strong>.</li>
        </ol>
        <ScreenshotSlot slug="donation-form" description="The new donation form with all main fields visible." url="/donations/new" />
        <h3 id="donations-receipt">Sending a receipt</h3>
        <p>On the donation's detail page, click <strong>Send Receipt</strong>. A PDF acknowledgement is generated using your org's name, address, EIN, and the donation details, then attached to an email and sent from your connected account. The email is logged automatically on the donor's record.</p>
        <ScreenshotSlot slug="send-receipt-button" description="The donation detail page with the Send Receipt button visible." url="/donations" />
        <div className="callout tip">
          <strong>💡 Bulk receipts</strong> — use <strong>Donations → Acknowledgements</strong> to send receipts for many donations at once.
        </div>
        <h3 id="donations-sync">Sync to QuickBooks</h3>
        <p>If QuickBooks is connected, each donation creates a Sales Receipt in QBO automatically. See <a href="#qbo">QuickBooks sync</a> for details.</p>
      </section>

      {/* ============================================================ */}
      <section id="pledges">
        <h2>Pledges</h2>
        <p>A <strong>pledge</strong> is a future commitment. When the donor pays toward it, you record a donation and link it to the pledge — the system tracks fulfillment percentage automatically.</p>
        <h3 id="pledges-recording">Recording a pledge</h3>
        <ol>
          <li>Sidebar → <strong>Pledges</strong> → <strong>+ New Pledge</strong>.</li>
          <li>Pick the <strong>donor</strong>, <strong>fund</strong>, <strong>amount</strong>, and target date.</li>
          <li>Save.</li>
        </ol>
        <p>When the donor pays, record a donation as usual and pick the pledge from the dropdown. The pledge's fulfillment percent updates immediately.</p>
      </section>

      {/* ============================================================ */}
      <section id="clients">
        <h2>Clients (households)</h2>
        <p>A <strong>client</strong> is a household receiving furniture. Clients are deliberately kept separate from donors — different table, different list. Client information is <strong>sensitive</strong>: addresses, family composition, agency referrals.</p>
        <h3 id="clients-adding">Adding a client</h3>
        <ol>
          <li>Sidebar → <strong>Clients</strong> → <strong>+ New Client</strong>.</li>
          <li>Fill in head-of-household, address, family size, <strong>referring agency</strong>.</li>
          <li>Add accessibility notes (apartment unit, stairs, pet warnings).</li>
          <li>Save.</li>
        </ol>
        <ScreenshotSlot slug="client-detail" description="A client detail page with the request history visible." url="/clients" />
      </section>

      {/* ============================================================ */}
      <section id="requests">
        <h2>Packing lists</h2>
        <p>A <strong>request</strong> is what a household has asked for — beds, dining table, couch, dressers. Capture as soon as the household is intaked, then track through fulfillment.</p>
        <ol>
          <li>From the client's detail page, click <strong>+ New Request</strong>.</li>
          <li>List the items they need, urgency, special notes.</li>
          <li>Save.</li>
        </ol>
        <p>When the request is filled, create a delivery that links to it — closes the loop and lets you report on time-from-request-to-delivery.</p>
      </section>

      {/* ============================================================ */}
      <section id="waivers">
        <h2>Furniture waivers</h2>
        <p>Before a household receives furniture, they sign a <strong>furniture waiver</strong> — the standard liability release used by the nonprofit.</p>
        <p>From the request detail page, click <strong>Sign waiver</strong>. The client types their legal name, draws their signature with a finger or mouse, checks the agreement box, and signs. A PDF is generated automatically and attached to the request with full audit trail (timestamp, IP, witness staff member).</p>
        <p>Clients don't log in — staff witness the signing in person on the same device.</p>
      </section>

      {/* ============================================================ */}
      <section id="pickups">
        <h2>Pickups</h2>
        <p>When a donor has items for collection, you create a <strong>pickup</strong>.</p>
        <ol>
          <li>Sidebar → <strong>Pickups</strong> → <strong>+ New Pickup</strong>.</li>
          <li>Pick the donor — their address auto-fills.</li>
          <li>Pick a date, time window, vehicle, driver.</li>
          <li>Add notes — gate codes, stair count, fragile items.</li>
          <li>Save.</li>
        </ol>
        <p>After saving, click <strong>Print manifest</strong>. The manifest is a one-page printable sheet with name, address, items expected, signature line, and a <strong>QR code</strong> that opens turn-by-turn directions on the driver's phone.</p>
        <ScreenshotSlot slug="pickup-manifest" description="A printed pickup manifest sample with QR code for directions." url="/pickups" />
      </section>

      {/* ============================================================ */}
      <section id="visits">
        <h2>Visits</h2>
        <p>
          Once a client has been referred (or self-presented) and has a
          packing list open, a <strong>visit</strong> is the
          scheduled moment where they pick out their furniture. Visits are
          a soft requirement — most clients have one, but staff can also
          make choices on the client's behalf if a visit isn't practical.
        </p>
        <p>There are four <strong>modes</strong>:</p>
        <ul>
          <li><strong>In-person</strong> — client comes to the showroom or warehouse and walks the floor with a staff host.</li>
          <li><strong>Phone</strong> — staff calls the client and reads off available options.</li>
          <li><strong>Zoom</strong> — live video call where staff shows the showroom or catalog on screen.</li>
          <li><strong>Email</strong> — asynchronous; staff sends photos/a catalog, the client replies with picks.</li>
        </ul>
        <p>To schedule a visit:</p>
        <ol>
          <li>Open the client's detail page (Sidebar → <strong>Clients → Clients</strong> → click the name).</li>
          <li>In the <strong>Visits</strong> card at the top, click <strong>+ Schedule visit</strong>.</li>
          <li>The form pre-fills the client. Pick a date, time window, mode, status, host (the staff member running the visit), and a location (only required for in-person).</li>
          <li>Optionally link the visit to the packing list it serves.</li>
          <li>Save.</li>
        </ol>
        <p>
          Scheduled and completed visits also appear on the <strong>Calendar</strong>
          (Sidebar → Operations → Calendar) in their own copper color, separate from pickups
          and deliveries.
        </p>
        <p>
          Sidebar → <strong>Clients → Visits</strong> shows every visit across all clients,
          filterable by date range and status. A client's visit history is also visible on
          their detail page (most recent eight, with a link to the full list).
        </p>
        <ScreenshotSlot slug="visits-list" description="The visits list with date and status filters." url="/visits" />
      </section>

      {/* ============================================================ */}
      <section id="deliveries">
        <h2>Deliveries</h2>
        <p>When you've fulfilled a household's request, schedule a <strong>delivery</strong>.</p>
        <ol>
          <li>Sidebar → <strong>Deliveries</strong> → <strong>+ New Delivery</strong>.</li>
          <li>Pick the <strong>client</strong>.</li>
          <li>Pick the <strong>request</strong> this delivery fulfills (recommended — links the loop closed).</li>
          <li>Pick the delivery date, vehicle, driver.</li>
          <li>Pick a <strong>fulfillment method</strong> — see the three options below.</li>
          <li>Add items from inventory, or list them in the description. Use <strong>Copy items from request</strong> to pre-fill.</li>
          <li>Save.</li>
        </ol>
        <p>The manifest is the same shape as the pickup version — printable, signature line, QR code, items listed.</p>

        <h3 id="deliveries-home">Home delivery</h3>
        <p>
          The default. Furnish Hope's crew drives the furniture to the client's
          home address on the scheduled date. Use the <strong>Vehicle</strong>
          and <strong>Crew</strong> sections of the form to assign a truck and the
          people going on the run. Print the manifest before the crew rolls out.
        </p>

        <h3 id="deliveries-walkout">Walkout</h3>
        <p>
          When the client is at the showroom for an in-person visit and decides
          to take their selections home immediately, set the fulfillment method
          to <strong>Walkout</strong>. No crew, no vehicle, no follow-up — staff
          just walks the items out with the client and the delivery is closed.
          Use the receipt sign-off button to capture their acknowledgement that
          the items left in their possession.
        </p>

        <h3 id="deliveries-container">Container pickup</h3>
        <p>
          When items can't go home with the client at visit time and a home
          delivery isn't booked, the items are locked into one of Furnish Hope's
          shipping containers (or smaller lockboxes) at the warehouse, and the
          client picks them up later during yard hours. To use this method:
        </p>
        <ol>
          <li>On the delivery form, set <strong>Fulfillment method</strong> to <strong>Container pickup</strong>. New fields appear below.</li>
          <li>Type the <strong>lock code</strong> from the physical lock you're using. Shared across all containers on this pickup; don't reuse codes between clients.</li>
          <li>Set a <strong>pickup deadline</strong>. The default is 30 days; admins can change the default at <code>/admin/settings</code> (key: <code>container_pickup_default_deadline_days</code>).</li>
          <li>Add at least one <strong>container or lockbox</strong>. The dropdown is filtered to storage locations that have been flagged <code>is_container_or_lockbox</code> in <code>/admin/lkp_storage_location</code>. Add more rows if the items span multiple containers.</li>
          <li>Save.</li>
        </ol>
        <p>
          Once the delivery is saved with a lock code, the detail page shows a
          <strong> Container pickup</strong> panel with the code, the deadline,
          and a <strong>Send code to client</strong> button. Clicking it opens a
          modal where you record that you shared the code with the client by
          email, phone, or SMS — Furnish Hope doesn't send the message itself in
          v1, so share the code yourself first (using your normal email, phone
          call, or text), then click <strong>Record sent</strong> to stamp the
          audit trail.
        </p>
        <div className="callout tip">
          <strong>Admin: adding containers to the picker.</strong> When Furnish
          Hope acquires a new container or lockbox, an admin goes to
          <code> /admin/lkp_storage_location</code>, opens that row, sets
          <code> is_container_or_lockbox</code> to true, fills in
          <code> container_type</code> (e.g. <code>container</code> or
          <code> lockbox</code>), and saves. It immediately appears in the
          pickup dropdown on the delivery form.
        </div>
        <ScreenshotSlot slug="container-pickup-panel" description="The Container pickup panel on a delivery detail page, showing lock code, deadline, and Send code button." url="/deliveries" />
      </section>

      {/* ============================================================ */}
      <section id="inventory">
        <h2>Inventory</h2>
        <p>The Inventory section tracks furniture currently in your warehouse, available to deliver.</p>
        <ul>
          <li><strong>+ New Inventory Item</strong> — record an item that arrived (usually triggered automatically by a pickup, but can be manual).</li>
          <li>Each item has a <strong>category</strong>, <strong>condition</strong>, and <strong>location</strong> (warehouse bay).</li>
          <li>Items get marked <strong>reserved</strong> when promised to a household, <strong>delivered</strong> when handed off.</li>
        </ul>
        <ScreenshotSlot slug="inventory-list" description="The inventory list with status filters at the top." url="/inventory" />
        <div className="callout tip">
          <strong>💡 Optional discipline.</strong> Most teams don't track inventory in this much detail at first — it's optional. You can still record donations and deliveries; you just won't have a real-time "what's on hand" view.
        </div>
      </section>

      {/* ============================================================ */}
      <section id="volunteers">
        <h2>Volunteers</h2>
        <p>Volunteers and staff are stored in the same table — the <code>is_volunteer</code> flag distinguishes them. There are two ways a volunteer can enter the system:</p>

        <h3 id="volunteers-public">Public sign-up portal</h3>
        <p>
          The org's public URL <code>/volunteer</code> (e.g.{' '}
          <code>https://hammerhead-app-tk838.ondigitalocean.app/volunteer</code>) opens a
          self-service application form — no login required. Anyone can fill it out: name,
          contact info, how often they want to help (one-time / recurring / on-call), what
          kind of work, days + times available, lifting capacity, driver's license / vehicle,
          special skills, and a checkbox-signed volunteer agreement.
        </p>
        <p>
          Submissions land in a pending queue at{' '}
          <code>/admin/volunteer-signups</code> (sidebar → <strong>Network → Volunteer applications</strong>, admin only).
          Each row shows the applicant's details and lets an admin <strong>Approve</strong> or <strong>Reject</strong>.
        </p>
        <ul>
          <li><strong>Approve</strong> — atomically creates a <code>tbl_contact</code> + <code>tbl_facility_staff</code> record (with <code>is_volunteer = true</code>), linked back to the original application via <code>approved_facility_staff_id</code>. After approval, an "Open volunteer record →" button appears.</li>
          <li><strong>Reject</strong> — leaves the application in the system with status='rejected' and an optional review-notes field. No staff record is created.</li>
        </ul>
        <p>
          The volunteer agreement / liability release document is at{' '}
          <code>/volunteer-agreement</code> — public, printable, opens in a new tab from
          the signup form. The text is a reasonable nonprofit template, but{' '}
          <strong>your legal counsel should review and adapt it</strong> before relying on it
          in practice. A prominent banner on the document calls this out.
        </p>

        <h3 id="volunteers-manual">Manual entry by an admin</h3>
        <ol>
          <li>Sidebar → <strong>Network → Volunteers & Staff</strong> → <strong>+ New Volunteer</strong>.</li>
          <li>Fill in contact info, role (driver, intake, admin support), preferred days.</li>
          <li>Save.</li>
        </ol>
        <p>Use this for in-person walk-ins or when you want to skip the public form.</p>
      </section>

      {/* ============================================================ */}
      <section id="shifts">
        <h2>Shifts</h2>
        <p>A <strong>shift</strong> is a single block of volunteer time — e.g., "Saturday 9am-noon, driver shift." Volunteers sign up for individual shifts.</p>
        <h3 id="shifts-templates">Shift templates</h3>
        <p>For recurring patterns ("every Mon/Wed/Fri morning"), use shift templates. A template says "every Mon/Wed/Fri 9am–noon we need a driver." Click <strong>Generate</strong> and the system creates real shifts for the next 30 days, skipping holidays automatically.</p>
        <ScreenshotSlot slug="shift-template" description="The shift template form with day-of-week toggle buttons." url="/admin/shift-templates" />
        <h3 id="shifts-hours">Recording volunteer hours</h3>
        <p>Each signup has an "hours logged" field. After the shift, record actual hours. Feeds into lifetime hours + the Reports page.</p>
      </section>

      {/* ============================================================ */}
      <section id="calendar">
        <h2>Calendar</h2>
        <p>The Calendar shows everything on one view — pickups, deliveries, shifts, events. Color-coded by type.</p>
        <ul>
          <li>Click any entry to jump to its detail page.</li>
          <li>Toggle event types at the top to filter.</li>
          <li>Switch month / week / day views.</li>
        </ul>
        <ScreenshotSlot slug="calendar-month" description="The calendar in month view with pickups, deliveries, and events visible." url="/calendar" />
      </section>

      {/* ============================================================ */}
      <section id="campaigns">
        <h2>Campaigns</h2>
        <p>A <strong>campaign</strong> is a fundraising drive with a goal — e.g., "Spring Capital Campaign, goal $50,000."</p>
        <ol>
          <li>Sidebar → <strong>Campaigns</strong> → <strong>+ New</strong>.</li>
          <li>Name, goal amount, start and end dates.</li>
          <li>Save.</li>
        </ol>
        <p>As donations come in tagged to the campaign, the progress bar fills. The Dashboard shows all active campaigns and their progress.</p>
      </section>

      {/* ============================================================ */}
      <section id="events">
        <h2>Events</h2>
        <p>An <strong>event</strong> is anything you're hosting — gala, open house, donor lunch, volunteer day. The events module supports the full lifecycle from planning through day-of execution.</p>

        <section id="events-roles">
          <h3>Manager, host, capacity</h3>
          <ul>
            <li><strong>Event manager</strong> — the staff person running the event. Picks from your staff list.</li>
            <li><strong>Host</strong> — who's hosting? Pick <strong>Person</strong> (any contact) OR <strong>Corporate</strong> (a sponsoring organization). Leaving it blank is fine.</li>
            <li><strong>Max attendees</strong> — capacity. Blank = no limit. Pre-registered attendees are hard-blocked at this number; walk-ins on event day can override with confirmation.</li>
            <li><strong>Run of show</strong> + <strong>Staff briefing</strong> — free-text fields that print to their own cards for the event team.</li>
          </ul>
        </section>

        <section id="events-attendees">
          <h3>Attendees + seating</h3>
          <p>Each attendee row captures:</p>
          <ul>
            <li><strong>Person</strong> — picked from contacts. Click <strong>+ New</strong> to create a contact inline (email required).</li>
            <li><strong>RSVP</strong> — Invited / Accepted / Declined / Maybe / No response. Manage the lookup values at <code>/admin/lkp_rsvp_status</code>.</li>
            <li><strong>Tickets</strong>, <strong>Contributed amount</strong>, <strong>Table</strong>, <strong>Seat</strong>, <strong>Dietary / notes</strong>.</li>
          </ul>
          <p><strong>Email is required</strong> on every attendee's contact record — invites and acknowledgements use it. If you try to save an attendee whose contact lacks an email, the server returns a clear error naming them.</p>
          <ScreenshotSlot slug="event-attendees" description="An event detail page with the attendee table visible." url="/events" />
        </section>

        <section id="events-sponsors">
          <h3>Sponsors</h3>
          <p>The <strong>Corporate sponsors</strong> subform on the event edit page captures sponsorships. Each row is either a Corporate sponsor or an individual Person (use the Kind dropdown to switch).</p>
          <ul>
            <li><strong>Level</strong> — Title / Presenting / Platinum / Gold / Silver / Bronze (configurable at <code>/admin/lkp_sponsor_level</code>).</li>
            <li><strong>Pledged</strong> + <strong>Paid</strong> — commitment vs. actual.</li>
            <li><strong>Acknowledged</strong> — check when the thank-you has gone out.</li>
          </ul>
          <p>On the event detail page, sponsors are grouped by tier (Title first → Bronze last). Each row has a <strong>Convert to donation →</strong> button when there's an amount. Clicking it auto-creates a donor (if missing) and a real <code>tbl_donation</code> record linked back to the sponsor row — so the gift counts toward lifetime giving and can generate a receipt.</p>
        </section>

        <section id="events-checkin">
          <h3>Day-of check-in</h3>
          <p>On the event detail page, click <strong>Day-of check-in →</strong>. This opens a tablet-optimized view designed for the door:</p>
          <ul>
            <li>Big search bar at top — filter by name, email, or phone as the volunteer types.</li>
            <li>Filter chips: All / Not yet / Checked in.</li>
            <li>Each attendee is a big tappable card. One tap checks them in.</li>
            <li>Tapping a checked-in card prompts <strong>"Are you sure you want to un-check {`{name}`}?"</strong> — undo mistakes safely.</li>
            <li><strong>+ Walk-in</strong> button opens a quick form for someone who showed up without RSVP'ing — atomic create of contact + attendee + check-in. Email is optional for walk-ins.</li>
          </ul>
        </section>

        <section id="events-prints">
          <h3>Print views</h3>
          <p>From the event detail page, click <strong>Print ▾</strong>. The menu groups print views by purpose:</p>
          <table>
            <thead><tr><th>Group</th><th>Print views</th></tr></thead>
            <tbody>
              <tr><td><strong>Day-of</strong></td><td>Door check-in roster, Run of show, Volunteer shift roster, Staff briefing card, Walk-in paper form</td></tr>
              <tr><td><strong>Sponsors</strong></td><td>Sponsor recognition sheet</td></tr>
              <tr><td><strong>Seating</strong></td><td>Name badges (Avery 5395), Table cards (numbered tents), Place cards, Seating chart</td></tr>
              <tr><td><strong>Fundraising</strong></td><td>Pledge cards, Will-call labels (Avery 5160)</td></tr>
            </tbody>
          </table>
          <p>Each print view opens in a new tab and auto-launches the browser's print dialog. The "door roster" is your WiFi-down backup — print one in advance and you can check people in on paper, then sync into the system after.</p>
        </section>
      </section>

      {/* ============================================================ */}
      <section id="vendors">
        <h2>Vendors</h2>
        <p>The Vendors section tracks suppliers, trades-people, and service providers (warehouse repair, AV rental, photographer, caterer, etc.). It's deliberately scoped to <strong>operational</strong> tracking — invoices, AR, and AP stay in QuickBooks.</p>
        <ul>
          <li>Sidebar → <strong>Vendors</strong> → <strong>+ New Vendor</strong>.</li>
          <li>Fill in business name, contact, type (Supplier, Trades, Service), specialty.</li>
          <li>Compliance pills track W-9 received + COI expiration dates.</li>
          <li>From the vendor detail page, the <strong>Service Log</strong> records each visit (what was done, when, cost, who).</li>
        </ul>
      </section>

      {/* ============================================================ */}
      <section id="email">
        <h2>Email & mailbox</h2>
        <p>The mailbox lets you read and reply to email from inside the app. Every message you send or receive is automatically logged on the relevant donor / client / volunteer record. <strong>You see only your own email</strong> — never another staff member's.</p>

        <section id="email-accounts">
          <h3>Connecting your account</h3>
          <ol>
            <li>Sidebar → <strong>Email → Accounts</strong>.</li>
            <li><strong>+ Add Account</strong>.</li>
            <li>Pick a provider preset (Gmail, Outlook, Yahoo, Custom IMAP) or sign in with Google / Microsoft OAuth (if your admin has configured those).</li>
            <li>For password auth, paste an <strong>app-specific password</strong> (not your normal login — see Admin guide).</li>
            <li>Click <strong>Test connection</strong>, then <strong>Save</strong>.</li>
          </ol>
        </section>

        <section id="email-compose">
          <h3>Composing email</h3>
          <p>On the Compose form, the To / Cc / Bcc fields support two complementary inputs:</p>
          <ul>
            <li><strong>Ghost-text autocomplete</strong> — start typing and the best-matching contact's email appears in muted text after the cursor. Press <strong>Tab</strong> or <strong>Enter</strong> to accept; arrow keys cycle alternates.</li>
            <li><strong>"+ Contact" picker</strong> — click the button next to each field to open a browse-by-type list (Staff, Volunteer, Donor, Client, Agency, Vendor, Attendee).</li>
          </ul>
          <p>Templates: click <strong>⚡ Apply template ▾</strong> by the Subject to insert pre-canned messages. Manage templates at <strong>Email → Templates</strong>.</p>
        </section>

        <section id="email-templates">
          <h3>Email templates</h3>
          <p>Pre-canned messages you can apply on the Compose / Reply forms. Useful for thank-you notes, pickup confirmations, scheduling reminders, etc.</p>
          <ol>
            <li>Sidebar → <strong>Email → Templates</strong>.</li>
            <li><strong>+ New template</strong>: give it a name + subject + body.</li>
            <li>Templates are scoped to YOUR account — other staff see only their own.</li>
            <li>Body supports placeholder substitution (e.g., <code>{'{{first_name}}'}</code>) — see the templates page for the full list.</li>
          </ol>
        </section>

        <section id="email-mailbox">
          <h3>Reading mail (Mailbox)</h3>
          <ol>
            <li>Sidebar → <strong>Mailbox</strong>.</li>
            <li><strong>Sync now</strong> pulls the latest messages.</li>
            <li>Click any message to expand. Replies are inline at the bottom.</li>
            <li>Unread messages have a colored dot; opening one marks it read automatically.</li>
            <li>Messages are grouped into <strong>threads</strong> — Gmail-style conversation view.</li>
          </ol>
          <ScreenshotSlot slug="mailbox" description="The mailbox with unread messages visible and one expanded." url="/email/mailbox" />
        </section>
      </section>

      {/* ============================================================ */}
      <section id="attachments">
        <h2>Files & attachments</h2>
        <p>Most records — donors, clients, pickups, deliveries, events, vendors, etc. — support file attachments. Photos, signed forms, PDFs, spreadsheets.</p>
        <ol>
          <li>Open the record's detail page.</li>
          <li>Find the <strong>Attachments</strong> section (usually near the bottom).</li>
          <li>Drag a file onto the dotted area, or click to pick.</li>
          <li>The file uploads and lives with that record.</li>
        </ol>
        <p>Click the filename to download. Pencil icon to rename. Trash to delete (confirms first). Max 20MB per file.</p>
        <ScreenshotSlot slug="attachments-widget" description="The attachments widget with one file uploaded and visible." url="/donors" />
      </section>

      {/* ============================================================ */}
      <section id="reports">
        <h2>Reports</h2>
        <p>The Reports page has 16 charts that summarize what's happening across the organization. Read-only — nothing you click can break anything.</p>
        <p>Use the <strong>Period toggle</strong> at the top to switch between Monthly / Quarterly / Yearly buckets — every chart re-buckets when you switch.</p>
        <p>Charts included:</p>
        <ul>
          <li>Revenue trend</li>
          <li>Revenue by fund</li>
          <li>Donor mix (new vs. returning)</li>
          <li>Active campaigns + progress</li>
          <li>Pickup / delivery throughput</li>
          <li>Average cycle time (request → delivery)</li>
          <li>Inventory flow</li>
          <li>Donor pipeline funnel</li>
          <li>Volunteer hours</li>
          <li>Top donors</li>
          <li>Average gift size</li>
          <li>Pledges fulfilled vs. outstanding</li>
          <li>Shift fill rate</li>
          <li>Inventory by category</li>
          <li>Acknowledgement turnaround time</li>
          <li>Donation types</li>
        </ul>
        <ScreenshotSlot slug="reports-overview" description="The Reports page showing several of the top charts." url="/reports" />
        <div className="callout tip">
          <strong>💡 Board-friendly.</strong> Right-click any chart → Save Image. Drop into a board presentation.
        </div>
      </section>

      {/* ============================================================ */}
      <section id="qbo">
        <h2>QuickBooks sync</h2>
        <p>If QuickBooks Online is connected, donations sync automatically.</p>
        <h3 id="qbo-what-syncs">What syncs</h3>
        <ul>
          <li>Every saved donation → corresponding <strong>Sales Receipt</strong> in QuickBooks.</li>
          <li>Each fund maps to a QuickBooks <strong>Income Account</strong> (admin-configured).</li>
          <li>Each donor maps to a QuickBooks <strong>Customer</strong>.</li>
        </ul>
        <h3 id="qbo-sync-status">Sync status indicator</h3>
        <p>On any donation's detail page, a small Sync Status indicator shows:</p>
        <ul>
          <li><strong>✓ Synced</strong> — successfully recorded in QBO.</li>
          <li><strong>⏳ Pending</strong> — queued.</li>
          <li><strong>✗ Error</strong> — something went wrong (hover for details).</li>
        </ul>
        <ScreenshotSlot slug="qbo-sync-status" description="Donation detail page with the sync indicator visible." url="/donations" />
      </section>

      {/* ============================================================ */}
      <section id="patterns">
        <h2>Common patterns</h2>
        <p>A few habits the app uses everywhere — once you know them, everything else feels easier.</p>
        <ul>
          <li><strong>+ New buttons</strong> next to dropdowns let you create a missing record without leaving the form.</li>
          <li><strong>Help ↗</strong> link in every page header opens this manual at the relevant section.</li>
          <li><strong>Required fields</strong> are marked with a red asterisk (*). Saving with a blank required field highlights it.</li>
          <li><strong>Search bars</strong> on every list page filter as you type. No need to click Search.</li>
          <li><strong>← Prev</strong> / <strong>Next →</strong> on detail pages walks through records one at a time.</li>
          <li><strong>Unsaved changes warning</strong> protects in-progress edits if you try to navigate away.</li>
          <li><strong>Audit log</strong> records every change with who + when. Admins can review at <code>/admin/activity</code>.</li>
        </ul>
      </section>

      {/* ============================================================ */}
      <section id="reporting-issues">
        <h2>Reporting issues</h2>
        <p>
          If something in the app doesn't work right — a page won't load, a
          button does nothing, the wrong data shows — you can file a report
          from inside the app and the development team will see it
          immediately, with a screenshot of exactly what you were looking at.
        </p>

        <h3 id="reporting-issues-modal">Using the Report Issue button</h3>
        <p>
          On every page, look in the top-right corner of the page header for a
          button labeled <strong>Report issue</strong> with a small "⓵" icon
          next to it (next to the Help button). If you don't see it, scroll up
          to the top of the page or see "Opening it up to everyone" below.
        </p>
        <ol>
          <li>Click <strong>Report issue</strong>. A dialog opens and the app automatically takes a screenshot of the visible page behind it — you'll briefly see the modal "blink" while the screenshot captures.</li>
          <li>
            Fill in the dialog:
            <ul>
              <li><strong>Title</strong> — a one-line summary, e.g. "Donation receipt PDF is blank."</li>
              <li><strong>Severity</strong> — Low / Medium / High / Critical. Use Critical only when work is fully blocked.</li>
              <li><strong>What happened?</strong> — Describe the problem in your own words.</li>
              <li><strong>Expected / Actual</strong> — Optional but very helpful. "I expected the PDF to show the receipt. Instead it was blank."</li>
              <li><strong>Steps to reproduce</strong> — Optional. Number the clicks if you can: "1. Open donor X. 2. Click Send receipt. 3. PDF downloads but is blank."</li>
            </ul>
          </li>
          <li>Click <strong>Submit issue</strong>. You'll see a confirmation; the report is in the developer's queue.</li>
        </ol>
        <p>
          The form auto-captures the page URL, your viewport size, and your
          browser version — you don't have to type any of that. The screenshot
          is stored privately on the server and only the developer can view it.
        </p>
        <ScreenshotSlot slug="report-issue-modal" description="The Report Issue dialog with all fields filled in and the auto-captured screenshot preview at the bottom." url="/" />

        <h3 id="reporting-issues-settings">Opening it up to everyone</h3>
        <p>
          By default the Report Issue button is visible only to <strong>admins</strong>.
          During the initial rollout, you may want every staff user to be able to
          flag problems. An admin can open it up from the Settings page:
        </p>
        <ol>
          <li>Sidebar → <strong>System → Settings</strong>.</li>
          <li>Find the row <code>issue_reporter_visible_to_all</code>.</li>
          <li>Change the value from <code>false</code> to <code>true</code>. Save.</li>
        </ol>
        <p>
          Within a few minutes (or immediately after their next page refresh)
          every signed-in staff user will see the Report Issue button. Set the
          value back to <code>false</code> to restrict reporting to admins
          again once the app has stabilized.
        </p>
        <div className="callout tip">
          <strong>💡 Privacy.</strong> Don't include passwords, full Social
          Security numbers, or other secrets in the description. Screenshots
          show what's on screen at the time — if a sensitive field is visible,
          close the panel or scroll away before clicking Report Issue.
        </div>
      </section>

      {/* ============================================================ */}
      <section id="troubleshooting">
        <h2>Troubleshooting</h2>
        <h3>"I can't see something I just created"</h3>
        <ul>
          <li>Refresh the page (Ctrl+R / ⌘+R).</li>
          <li>Check list filters — you might be viewing only "Active" while your record is "Pending".</li>
        </ul>
        <h3>"The page won't load / I see an error"</h3>
        <ul>
          <li>Hard refresh: <strong>Ctrl+Shift+R</strong> (Windows) or <strong>⌘+Shift+R</strong> (Mac).</li>
          <li>Log out, log back in.</li>
          <li>If still broken, screenshot the error and email your admin.</li>
        </ul>
        <h3>"I deleted something by accident"</h3>
        <p>Tell your admin — most things are restorable from the audit log. Don't recreate manually; let the admin recover the original.</p>
        <h3>How to report a bug</h3>
        <p>Email your administrator with: (1) what you were trying to do, (2) what actually happened, (3) a screenshot of the error if possible, (4) the rough time so we can find it in logs.</p>
      </section>

      {/* ============================================================ */}
      <section id="admin">
        <h2>Admin guide</h2>
        <p>This section is for users marked <strong>Admin</strong>. The System group in the sidebar holds everything only admins can change.</p>

        <h3 id="admin-users">User accounts</h3>
        <p>Admin → <strong>Database Admin</strong> → <code>tbl_user_account</code>:</p>
        <ul>
          <li><strong>+ New</strong> to create a user. Pick a username (typically their email), set is_active = true. The first save shows a one-time temporary password — copy it and pass it to them.</li>
          <li>To disable someone, set is_active = false. Their history stays intact.</li>
          <li>To reset a password, edit the user and click Reset password.</li>
        </ul>

        <h3 id="admin-activity">Activity log</h3>
        <p>System → <strong>Activity log</strong>. Filter by user, date, table, or action. Click any entry to see before / after values.</p>
        <ScreenshotSlot slug="audit-log" description="The audit log filtered for one user, showing recent changes." url="/admin/activity" />

        <h3 id="admin-lookups">Lookup tables</h3>
        <p>Tables starting with <code>lkp_</code> hold dropdown values throughout the app. Edit them at <code>/admin/&lt;table&gt;</code>. New entries appear in dropdowns immediately. Don't delete a lookup row that's in use — the app blocks it. Mark inactive instead if the table has an is_active flag.</p>

        <h3 id="admin-shifts">Shift templates + holidays</h3>
        <p>System → <strong>Shift templates</strong> for recurring shift patterns. System → <strong>Holidays</strong> seeds federal holidays; add custom ones or remove ones that don't apply.</p>
        <ScreenshotSlot slug="shift-templates-list" description="The shift templates admin list." url="/admin/shift-templates" />

        <h3 id="admin-settings">Settings</h3>
        <p>System → <strong>Settings</strong>: legal name, EIN, address (used on receipts). Receipt numbering: starting number, prefix. Logo upload for PDF receipts.</p>
        <ScreenshotSlot slug="org-settings" description="The Settings page with all fields filled in." url="/admin/settings" />

        <h3 id="admin-qbo">QuickBooks setup</h3>
        <p>System → <strong>QuickBooks</strong> → <strong>Connect</strong>. Sign in with a QBO admin account, authorize. Then map each fund to a QBO income account.</p>
        <ScreenshotSlot slug="qbo-mappings" description="The QuickBooks fund mapping page." url="/admin/quickbooks" />

        <h3 id="admin-storage">Storage settings</h3>
        <p>System → <strong>Attachment storage</strong>. Default is in-database (pg_blob). For high-volume orgs, switch to DigitalOcean Spaces / AWS S3 / Google Drive — then click <strong>Migrate existing files</strong> to move them.</p>

        <h3 id="admin-database">Database admin</h3>
        <p>System → <strong>Database Admin</strong> shows every table in the database. Use sparingly — it's the most direct access surface. Most day-to-day work doesn't need this.</p>
        <p>
          The <strong>View ERD (PDF)</strong> button in the top-right of the
          Database Admin landing page opens a multi-page entity-relationship
          diagram — every table organized by theme (Clients, Donations,
          Inventory, etc.), with primary keys, foreign keys, and the arrows
          between related tables. Useful as a reference when adding fields
          or planning bulk edits.
        </p>
        <p>
          When the schema changes, regenerate the PDF from a fresh schema by
          running <code>python scripts/generate_erd_pdf.py</code> against the
          dev DB, then commit + push the new <code>docs/FurnishHopeERD.pdf</code>.
          Full step-by-step instructions (one-time setup of Graphviz +
          Python packages, regeneration command, and troubleshooting) live
          in <code>docs/REGENERATE_ERD.md</code> in the repo.
        </p>
        <ScreenshotSlot slug="admin-home" description="The admin landing page with the list of tables grouped by purpose." url="/admin" />

        <h3 id="admin-manual">User Manual + screenshots</h3>
        <p>
          You're reading the manual right now. Every page in the app has a small
          <strong> Help ↗</strong> link in the top-right that opens the manual in a new tab,
          scrolled to the right section — see <a href="#patterns">Common patterns</a>.
        </p>
        <p>
          The manual has placeholder boxes (light-green dashed borders) where screenshots
          should go. Admins fill them in at <strong>System → Manual Screenshots</strong>:
        </p>
        <ol>
          <li>Open the URL from the placeholder row in a new tab.</li>
          <li>Take a screenshot (Windows: <strong>Win+Shift+S</strong>; Mac: <strong>⌘+Shift+4</strong>). Crop to just the relevant area.</li>
          <li><strong>Anonymize</strong> — blur or crop any real donor / client names + addresses you don't want in the manual.</li>
          <li>Back on the Manual Screenshots page, click <strong>Upload</strong> on that row, pick the file, optionally add a caption, save.</li>
          <li>Reload the manual page to see your screenshot in place.</li>
        </ol>
        <p>
          Filter the placeholder list by audience: All / Staff manual / Caseworker manual.
          The caseworker manual at <code>/agency/help</code> is a shorter version scoped to the agency portal.
        </p>

        <h3 id="admin-volunteer-signups">Volunteer applications review</h3>
        <p>
          Sidebar → <strong>Network → Volunteer applications</strong> (admin only). See the{' '}
          <a href="#volunteers">Volunteers</a> section above for the full flow — TL;DR is that
          public sign-ups land here for approval, and approval creates a real volunteer record.
        </p>

        <h3>Admin habits — keeping things healthy</h3>
        <ul>
          <li><strong>Weekly:</strong> glance at the activity log, send any unsent acknowledgements older than a week.</li>
          <li><strong>Monthly:</strong> review user list for departures, run reports in Quarterly view, take a DB backup.</li>
          <li><strong>Quarterly:</strong> review lookup tables for stale entries (mark inactive, don't delete).</li>
        </ul>
      </section>

      {/* ============================================================ */}
      <section id="developer-tools">
        <h2>Developer tools</h2>
        <p>
          A small set of admin-only pages exists for the person who maintains
          the app. They live under <code>/dev/*</code> and only appear in the
          sidebar for users flagged as developers. If you're not the
          developer, you can skip this section.
        </p>

        <h3 id="developer-tools-flag">Marking a user as developer</h3>
        <p>
          The developer flag is separate from the admin flag. A user must be
          BOTH an admin AND flagged as a developer to access the dev console
          — the developer flag alone grants no access. To set it:
        </p>
        <ol>
          <li>Sidebar → <strong>System → Database Admin</strong> → <code>tbl_user_account</code>.</li>
          <li>Click the row for the developer user.</li>
          <li>Make sure <strong>is_admin</strong> is checked.</li>
          <li>Check <strong>is_developer</strong>. Save.</li>
        </ol>
        <p>
          After saving, the developer should sign out and back in (or hard
          refresh) so the app picks up the new role. A <strong>Developer</strong>
          section appears in the sidebar with two entries:
          <strong> Reported issues</strong> and <strong>Broadcasts</strong>.
        </p>

        <h3 id="developer-tools-console">The issue console</h3>
        <p>
          Sidebar → <strong>Developer → Reported issues</strong> lists every
          issue staff has filed via the Report Issue button. Issues are sorted
          by status (Open → Investigating → Resolved → Closed) and then by
          severity (Critical first). Filters at the top let you narrow by
          status or severity.
        </p>
        <p>Each issue's detail page shows:</p>
        <ul>
          <li>The full screenshot the reporter captured (click to open at full size in a new tab).</li>
          <li>The narrative — title, description, expected vs actual, steps to reproduce.</li>
          <li>Context — page URL, viewport size, browser version, reporter name, when it was filed.</li>
          <li>Triage controls in the right sidebar — change Status, adjust Severity, write resolution notes.</li>
        </ul>
        <p><strong>Status workflow:</strong></p>
        <ul>
          <li><strong>Open</strong> — not yet looked at.</li>
          <li><strong>Investigating</strong> — actively being worked on. Auto-set when you assign an assignee while the issue is Open.</li>
          <li><strong>Resolved</strong> — fix is in. Auto-stamps a resolved-at timestamp.</li>
          <li><strong>Closed</strong> — issue is verified fixed or otherwise closed out.</li>
        </ul>
        <p>
          Resolution notes auto-save on blur (when you click outside the
          textarea), so don't worry about pressing a Save button.
        </p>

        <h3 id="developer-tools-broadcasts">Broadcasting to all users</h3>
        <p>
          When you deploy a fix or want to warn users about an outage, you can
          push a banner that appears at the top of every page for every
          signed-in user until they dismiss it. There are two ways in:
        </p>
        <ol>
          <li>
            <strong>From an issue:</strong> on any issue detail page, click
            <strong> Notify all users to refresh</strong> in the right sidebar.
            You'll be prompted for a message; the broadcast is created as
            "refresh required" kind and linked back to the issue.
          </li>
          <li>
            <strong>Standalone:</strong> Sidebar → <strong>Developer → Broadcasts</strong>
            → <strong>+ New broadcast</strong>. Pick a kind and type a message.
          </li>
        </ol>
        <p><strong>Three broadcast kinds:</strong></p>
        <ul>
          <li>
            <strong>Info</strong> (green) — "FYI, donor reports were sluggish
            for a few minutes earlier; that's resolved." Just informational.
          </li>
          <li>
            <strong>Warning</strong> (red) — "We're seeing an issue with
            email sync. Working on it now." Attention-grabbing for known
            problems.
          </li>
          <li>
            <strong>Refresh required</strong> (gold) — "We just deployed a
            fix. Please save your work and click Refresh to pick up the new
            version." Includes a <strong>Refresh now</strong> button right on
            the banner so users can reload with one click.
          </li>
        </ul>
        <p>
          The broadcast list page shows every broadcast you've sent with a
          dismissal count (how many users have already clicked the × on it).
          Deactivate a broadcast to stop showing it to anyone who hasn't
          dismissed it yet; delete it to remove it entirely.
        </p>
      </section>

      <hr className="my-8" />
      <p className="text-xs text-ink-faint italic">
        Furnish Hope is built and maintained by Preston Callicott. Questions, bug reports, or ideas?{' '}
        <a href="mailto:preston@getreality.com" className="text-terracotta hover:text-terracotta-deep">preston@getreality.com</a>.
      </p>
    </ManualShell>
  );
}
