import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar.tsx';
import { ScrollToTop } from './components/ScrollToTop.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { RequireAuth, RequireAdmin } from './components/RequireAuth.tsx';
import { AuthProvider, useAuth } from './lib/auth.tsx';
import { Login } from './pages/Login.tsx';
import { Settings } from './pages/Settings.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { Reports } from './pages/Reports.tsx';
import { Clients } from './pages/Clients.tsx';
import { ClientDetail } from './pages/ClientDetail.tsx';
import { ClientForm } from './pages/ClientForm.tsx';
import { Requests } from './pages/Requests.tsx';
import { RequestDetail } from './pages/RequestDetail.tsx';
import { RequestForm } from './pages/RequestForm.tsx';
import { SignWaiver } from './pages/SignWaiver.tsx';
import { Inventory } from './pages/Inventory.tsx';
import { InventoryDetail } from './pages/InventoryDetail.tsx';
import { InventoryForm } from './pages/InventoryForm.tsx';
import { Deliveries } from './pages/Deliveries.tsx';
import { DeliveryDetail } from './pages/DeliveryDetail.tsx';
import { DeliveryForm } from './pages/DeliveryForm.tsx';
import { Visits } from './pages/Visits.tsx';
import { VisitForm } from './pages/VisitForm.tsx';
import { VisitDetail } from './pages/VisitDetail.tsx';
import { Pickups } from './pages/Pickups.tsx';
import { PickupDetail } from './pages/PickupDetail.tsx';
import { PickupForm } from './pages/PickupForm.tsx';
import { Volunteers } from './pages/Volunteers.tsx';
import { VolunteerDetail } from './pages/VolunteerDetail.tsx';
import { VolunteerForm } from './pages/VolunteerForm.tsx';
import { Donations } from './pages/Donations.tsx';
import { DonationDetail } from './pages/DonationDetail.tsx';
import { DonationForm } from './pages/DonationForm.tsx';
import { Pledges } from './pages/Pledges.tsx';
import { PledgeDetail } from './pages/PledgeDetail.tsx';
import { PledgeForm } from './pages/PledgeForm.tsx';
import { Donors } from './pages/Donors.tsx';
import { DonorDetail } from './pages/DonorDetail.tsx';
import { Campaigns } from './pages/Campaigns.tsx';
import { CampaignDetail } from './pages/CampaignDetail.tsx';
import { CampaignForm } from './pages/CampaignForm.tsx';
import { Events } from './pages/Events.tsx';
import { EventDetail } from './pages/EventDetail.tsx';
import { EventForm } from './pages/EventForm.tsx';
import { EventCheckIn } from './pages/EventCheckIn.tsx';
import { Help } from './pages/help/index.tsx';
import { AgencyHelp } from './pages/help/AgencyHelp.tsx';
import { ManualScreenshots } from './pages/admin/ManualScreenshots.tsx';
import { VolunteerSignup } from './pages/VolunteerSignup.tsx';
import { VolunteerAgreement } from './pages/VolunteerAgreement.tsx';
import { VolunteerSignups, VolunteerSignupDetail } from './pages/admin/VolunteerSignups.tsx';
import {
  DoorRoster, RunOfShow, SponsorSheet, Nametags,
  TableCards, PlaceCards, SeatingChart, PledgeCards,
  WalkInForm, StaffBriefing, WillCallLabels, VolunteerRoster,
} from './pages/eventPrints/index.tsx';
import { EmailAccounts } from './pages/EmailAccounts.tsx';
import { EmailCompose } from './pages/EmailCompose.tsx';
import { EmailTemplates } from './pages/EmailTemplates.tsx';
import { Vendors } from './pages/Vendors.tsx';
import { VendorDetail } from './pages/VendorDetail.tsx';
import { VendorForm } from './pages/VendorForm.tsx';
import { Mailbox } from './pages/Mailbox.tsx';
import { PickupManifest } from './pages/PickupManifest.tsx';
import { DeliveryManifest } from './pages/DeliveryManifest.tsx';
import { CalendarView } from './pages/CalendarView.tsx';
import { Shifts } from './pages/Shifts.tsx';
import { ShiftForm } from './pages/ShiftForm.tsx';
import { ShiftDetail } from './pages/ShiftDetail.tsx';
import { Acknowledgements } from './pages/Acknowledgements.tsx';
import { AdminIndex } from './pages/admin/AdminIndex.tsx';
import { AdminList } from './pages/admin/AdminList.tsx';
import { AdminForm } from './pages/admin/AdminForm.tsx';
import { AdminActivity } from './pages/admin/AdminActivity.tsx';
import { AdminSettings } from './pages/admin/AdminSettings.tsx';
import { AdminQuickBooks } from './pages/admin/AdminQuickBooks.tsx';
import { AdminAttachmentStorage } from './pages/admin/AdminAttachmentStorage.tsx';
import { AdminShiftTemplates } from './pages/admin/AdminShiftTemplates.tsx';
import { AdminHolidays } from './pages/admin/AdminHolidays.tsx';
import { AgencyShell } from './pages/agency/AgencyShell.tsx';
import { AgencyDashboard } from './pages/agency/AgencyDashboard.tsx';
import { AgencyReferrals } from './pages/agency/AgencyReferrals.tsx';
import { AgencyReferralForm } from './pages/agency/AgencyReferralForm.tsx';
import { AgencyReferralDetail } from './pages/agency/AgencyReferralDetail.tsx';

export function App() {
  return (
    <AuthProvider>
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* Public volunteer signup — no login required. Lives outside
            both shells so it loads instantly for anonymous visitors. */}
        <Route path="/volunteer" element={<VolunteerSignup />} />
        <Route path="/volunteer-agreement" element={<VolunteerAgreement />} />
        {/* Agency-caseworker routes get their own shell (no staff
            sidebar). Wrapped in RequireAuth which redirects to login
            if not signed in. RoleGate inside redirects staff away. */}
        <Route path="/agency/*" element={
          <RequireAuth>
            <RoleGate allow="agency">
              <ErrorBoundary label="agency-shell">
                <AgencyShell />
              </ErrorBoundary>
            </RoleGate>
          </RequireAuth>
        }>
          <Route index element={<AgencyDashboard />} />
          <Route path="referrals" element={<AgencyReferrals />} />
          <Route path="referrals/new" element={<AgencyReferralForm />} />
          <Route path="referrals/:id" element={<AgencyReferralDetail />} />
          <Route path="help" element={<AgencyHelp />} />
        </Route>
        {/* Staff / admin — the rest of the app */}
        <Route path="/*" element={
          <RequireAuth>
            <RoleGate allow="staff">
              <ErrorBoundary label="app-shell">
                <AppShell />
              </ErrorBoundary>
            </RoleGate>
          </RequireAuth>
        } />
      </Routes>
    </AuthProvider>
  );
}

/** Redirect a user away if their role doesn't match the gate. An
 *  agency caseworker landing on /clients gets bounced to /agency;
 *  a staff user landing on /agency gets bounced to /. Prevents the
 *  brief flash of a forbidden shell + the inevitable 403s as the
 *  forbidden page tries to load data it can't access. */
function RoleGate({ allow, children }: { allow: 'staff' | 'agency'; children: React.ReactNode }) {
  const { user } = useAuth();
  if (user && user.role !== allow) {
    const dest = user.role === 'agency' ? '/agency' : '/';
    return <Navigate to={dest} replace />;
  }
  return <>{children}</>;
}

function AppShell() {
  return (
    <div className="grid min-h-screen" style={{ gridTemplateColumns: '232px 1fr' }}>
      <Sidebar />
      <main className="bg-paper px-9 py-7 overflow-x-hidden">
        <Breadcrumbs />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/calendar" element={<CalendarView />} />

          <Route path="/shifts" element={<Shifts />} />
          <Route path="/shifts/new" element={<ShiftForm />} />
          <Route path="/shifts/:id/edit" element={<ShiftForm />} />
          <Route path="/shifts/:id" element={<ShiftDetail />} />

          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/new" element={<ClientForm />} />
          <Route path="/clients/:id/edit" element={<ClientForm />} />
          <Route path="/clients/:id" element={<ClientDetail />} />

          <Route path="/requests" element={<Requests />} />
          <Route path="/requests/new" element={<RequestForm />} />
          <Route path="/requests/:id/edit" element={<RequestForm />} />
          <Route path="/requests/:id" element={<RequestDetail />} />
          <Route path="/requests/:id/sign-waiver" element={<SignWaiver />} />

          <Route path="/inventory" element={<Inventory />} />
          <Route path="/inventory/new" element={<InventoryForm />} />
          <Route path="/inventory/:id/edit" element={<InventoryForm />} />
          <Route path="/inventory/:id" element={<InventoryDetail />} />

          <Route path="/deliveries" element={<Deliveries />} />
          <Route path="/deliveries/new" element={<DeliveryForm />} />
          <Route path="/deliveries/:id/edit" element={<DeliveryForm />} />
          <Route path="/deliveries/:id/manifest" element={<DeliveryManifest />} />
          <Route path="/deliveries/:id" element={<DeliveryDetail />} />

          <Route path="/visits" element={<Visits />} />
          <Route path="/visits/new" element={<VisitForm />} />
          <Route path="/visits/:id/edit" element={<VisitForm />} />
          <Route path="/visits/:id" element={<VisitDetail />} />

          <Route path="/pickups" element={<Pickups />} />
          <Route path="/pickups/new" element={<PickupForm />} />
          <Route path="/pickups/:id/edit" element={<PickupForm />} />
          <Route path="/pickups/:id/manifest" element={<PickupManifest />} />
          <Route path="/pickups/:id" element={<PickupDetail />} />

          <Route path="/volunteers" element={<Volunteers />} />
          <Route path="/volunteers/new" element={<VolunteerForm />} />
          <Route path="/volunteers/:id/edit" element={<VolunteerForm />} />
          <Route path="/volunteers/:id" element={<VolunteerDetail />} />

          <Route path="/donations" element={<Donations />} />
          <Route path="/donations/new" element={<DonationForm />} />
          <Route path="/donations/acknowledgements" element={<Acknowledgements />} />
          <Route path="/donations/:id/edit" element={<DonationForm />} />
          <Route path="/donations/:id" element={<DonationDetail />} />

          <Route path="/pledges" element={<Pledges />} />
          <Route path="/pledges/new" element={<PledgeForm />} />
          <Route path="/pledges/:id/edit" element={<PledgeForm />} />
          <Route path="/pledges/:id" element={<PledgeDetail />} />

          <Route path="/donors" element={<Donors />} />
          <Route path="/donors/:id" element={<DonorDetail />} />

          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/campaigns/new" element={<CampaignForm />} />
          <Route path="/campaigns/:id/edit" element={<CampaignForm />} />
          <Route path="/campaigns/:id" element={<CampaignDetail />} />

          <Route path="/events" element={<Events />} />
          <Route path="/events/new" element={<EventForm />} />
          <Route path="/events/:id/edit" element={<EventForm />} />
          <Route path="/events/:id/check-in" element={<EventCheckIn />} />
          <Route path="/events/:id/print/door-roster"     element={<DoorRoster />} />
          <Route path="/events/:id/print/run-of-show"     element={<RunOfShow />} />
          <Route path="/events/:id/print/sponsors"        element={<SponsorSheet />} />
          <Route path="/events/:id/print/nametags"        element={<Nametags />} />
          <Route path="/events/:id/print/table-cards"     element={<TableCards />} />
          <Route path="/events/:id/print/place-cards"     element={<PlaceCards />} />
          <Route path="/events/:id/print/seating-chart"   element={<SeatingChart />} />
          <Route path="/events/:id/print/pledge-cards"    element={<PledgeCards />} />
          <Route path="/events/:id/print/walk-in-form"    element={<WalkInForm />} />
          <Route path="/events/:id/print/staff-briefing"  element={<StaffBriefing />} />
          <Route path="/events/:id/print/will-call-labels" element={<WillCallLabels />} />
          <Route path="/events/:id/print/volunteer-roster" element={<VolunteerRoster />} />
          <Route path="/events/:id" element={<EventDetail />} />

          <Route path="/help" element={<Help />} />
          <Route path="/admin/manual-screenshots" element={<ManualScreenshots />} />
          <Route path="/admin/volunteer-signups" element={<VolunteerSignups />} />
          <Route path="/admin/volunteer-signups/:id" element={<VolunteerSignupDetail />} />

          <Route path="/email/accounts" element={<EmailAccounts />} />
          <Route path="/email/compose" element={<EmailCompose />} />
          <Route path="/email/templates" element={<EmailTemplates />} />
          <Route path="/vendors" element={<Vendors />} />
          <Route path="/vendors/new" element={<VendorForm />} />
          <Route path="/vendors/:id" element={<VendorDetail />} />
          <Route path="/vendors/:id/edit" element={<VendorForm />} />
          <Route path="/email/mailbox" element={<Mailbox />} />

          {/* Admin section is admin-only. The RequireAdmin wrapper renders
              a friendly "admins only" screen for non-admin users. */}
          <Route path="/admin" element={<RequireAdmin><AdminIndex /></RequireAdmin>} />
          <Route path="/admin/activity" element={<RequireAdmin><AdminActivity /></RequireAdmin>} />
          <Route path="/admin/settings" element={<RequireAdmin><AdminSettings /></RequireAdmin>} />
          <Route path="/admin/quickbooks" element={<RequireAdmin><AdminQuickBooks /></RequireAdmin>} />
          <Route path="/admin/attachment-storage" element={<RequireAdmin><AdminAttachmentStorage /></RequireAdmin>} />
          <Route path="/admin/shift-templates" element={<RequireAdmin><AdminShiftTemplates /></RequireAdmin>} />
          <Route path="/admin/holidays" element={<RequireAdmin><AdminHolidays /></RequireAdmin>} />
          <Route path="/admin/settings/quickbooks" element={<RequireAdmin><AdminQuickBooks /></RequireAdmin>} />
          <Route path="/admin/:table" element={<RequireAdmin><AdminList /></RequireAdmin>} />
          <Route path="/admin/:table/new" element={<RequireAdmin><AdminForm /></RequireAdmin>} />
          <Route path="/admin/:table/:id" element={<RequireAdmin><AdminForm /></RequireAdmin>} />
          {/* Alias with /edit suffix — every operational form uses
              /:id/edit (clients, pickups, etc.), so a Link to
              /admin/tbl_X/:id/edit is a natural mistake. Accept both. */}
          <Route path="/admin/:table/:id/edit" element={<RequireAdmin><AdminForm /></RequireAdmin>} />
        </Routes>
      </main>
    </div>
  );
}

function Breadcrumbs() {
  const { pathname } = useLocation();
  if (pathname === '/') return null;

  const parts = pathname.split('/').filter(Boolean);
  return (
    <div className="text-xs text-ink-faint mb-5">
      <Link to="/" className="hover:text-terracotta">Dashboard</Link>
      {parts.map((p, i) => {
        const path = '/' + parts.slice(0, i + 1).join('/');
        const isLast = i === parts.length - 1;
        return (
          <span key={path}>
            <span className="text-hairline-strong">  /  </span>
            {isLast ? (
              <span className="text-ink-soft capitalize">{decodeURIComponent(p)}</span>
            ) : (
              <Link to={path} className="hover:text-terracotta capitalize">{p}</Link>
            )}
          </span>
        );
      })}
    </div>
  );
}
