/**
 * Catalogue of every screenshot slot referenced in the manuals.
 * Drives the admin uploader page (Admin → Manual Screenshots) so it
 * can list every slot whether or not an image has been uploaded yet.
 *
 * Keep this list in sync with the actual <ScreenshotSlot slug="..." />
 * calls in pages/help/index.tsx and pages/help/AgencyHelp.tsx. If a
 * slug appears here but not in the manual, the upload is wasted; if a
 * slug is in the manual but missing here, admins can still upload via
 * the API but the slot won't show on the admin page.
 */

export interface ScreenshotMeta {
  slug: string;
  audience: 'staff' | 'agency';
  description: string;
  url: string;
  /** Section label for grouping in the admin UI. */
  group: string;
}

export const SCREENSHOT_MANIFEST: ScreenshotMeta[] = [
  // ---------- Staff manual ----------
  { slug: 'login-page',        audience: 'staff',  group: 'Getting started', url: '/login',
    description: 'The login screen with email + password fields and the Furnish Hope logo.' },
  { slug: 'profile-menu',      audience: 'staff',  group: 'Getting started', url: '/',
    description: 'The dropdown that appears when clicking your name in the top-right.' },
  { slug: 'sidebar-full',      audience: 'staff',  group: 'Getting started', url: '/',
    description: 'The full sidebar expanded, with all sections labeled.' },
  { slug: 'dashboard',         audience: 'staff',  group: 'Getting started', url: '/',
    description: 'The dashboard with all widgets visible.' },

  { slug: 'donor-detail',      audience: 'staff',  group: 'Donors',          url: '/donors',
    description: "A donor's detail page with sections visible — bio, giving history, pipeline, email widget, attachments." },

  { slug: 'donation-form',     audience: 'staff',  group: 'Donations',       url: '/donations/new',
    description: 'The new-donation form with all main fields visible.' },
  { slug: 'send-receipt-button', audience: 'staff', group: 'Donations',      url: '/donations',
    description: 'The donation detail page with the Send Receipt button visible.' },

  { slug: 'client-detail',     audience: 'staff',  group: 'Clients',         url: '/clients',
    description: 'A client detail page with the request history visible.' },

  { slug: 'pickup-manifest',   audience: 'staff',  group: 'Operations',      url: '/pickups',
    description: 'A printed pickup manifest sample with QR code for directions.' },
  { slug: 'visits-list',       audience: 'staff',  group: 'Operations',      url: '/visits',
    description: 'The Visits list page with date and status filters.' },
  { slug: 'container-pickup-panel', audience: 'staff', group: 'Operations',  url: '/deliveries',
    description: 'A delivery detail page in container-pickup mode, with the lock code, deadline, container list, and Send code button visible.' },
  { slug: 'inventory-list',    audience: 'staff',  group: 'Operations',      url: '/inventory',
    description: 'The inventory list with status filters at the top.' },

  { slug: 'shift-template',    audience: 'staff',  group: 'Shifts',          url: '/admin/shift-templates',
    description: 'The shift template form with day-of-week toggle buttons.' },
  { slug: 'shift-templates-list', audience: 'staff', group: 'Shifts',        url: '/admin/shift-templates',
    description: 'The shift templates admin list.' },

  { slug: 'calendar-month',    audience: 'staff',  group: 'Calendar',        url: '/calendar',
    description: 'The calendar in month view with pickups, deliveries, and events visible.' },

  { slug: 'event-attendees',   audience: 'staff',  group: 'Events',          url: '/events',
    description: 'An event detail page with the attendee table visible.' },

  { slug: 'mailbox',           audience: 'staff',  group: 'Email',           url: '/email/mailbox',
    description: 'The mailbox with unread messages visible and one expanded.' },

  { slug: 'attachments-widget', audience: 'staff', group: 'Attachments',     url: '/donors',
    description: 'The attachments widget with one file uploaded and visible in the list.' },

  { slug: 'reports-overview',  audience: 'staff',  group: 'Reports',         url: '/reports',
    description: 'The Reports page showing several of the top charts.' },

  { slug: 'qbo-sync-status',   audience: 'staff',  group: 'QuickBooks',      url: '/donations',
    description: 'Donation detail page with the sync indicator visible.' },
  { slug: 'qbo-mappings',      audience: 'staff',  group: 'QuickBooks',      url: '/admin/quickbooks',
    description: 'The QuickBooks fund mapping page.' },

  { slug: 'org-settings',      audience: 'staff',  group: 'Admin',           url: '/admin/settings',
    description: 'The Settings page with all fields filled in.' },
  { slug: 'audit-log',         audience: 'staff',  group: 'Admin',           url: '/admin/activity',
    description: 'The audit / activity log filtered for one user.' },
  { slug: 'admin-home',        audience: 'staff',  group: 'Admin',           url: '/admin',
    description: 'The admin landing page with the list of tables grouped by purpose.' },

  // ---------- Agency caseworker manual ----------
  { slug: 'agency-login',          audience: 'agency', group: 'Agency portal', url: '/login',
    description: 'The portal sign-in page.' },
  { slug: 'agency-dashboard',      audience: 'agency', group: 'Agency portal', url: '/agency',
    description: 'The caseworker portal dashboard.' },
  { slug: 'agency-referrals',      audience: 'agency', group: 'Agency portal', url: '/agency/referrals',
    description: 'The list of caseworker referrals.' },
  { slug: 'agency-referral-form',  audience: 'agency', group: 'Agency portal', url: '/agency/referrals/new',
    description: 'The Refer-a-household form.' },
  { slug: 'agency-referral-detail', audience: 'agency', group: 'Agency portal', url: '/agency/referrals',
    description: 'A referral status page showing furniture request status and household info.' },
];
