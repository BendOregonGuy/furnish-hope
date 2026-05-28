import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar.tsx';
import { RequireAuth, RequireAdmin } from './components/RequireAuth.tsx';
import { AuthProvider } from './lib/auth.tsx';
import { Login } from './pages/Login.tsx';
import { Settings } from './pages/Settings.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { Clients } from './pages/Clients.tsx';
import { ClientDetail } from './pages/ClientDetail.tsx';
import { ClientForm } from './pages/ClientForm.tsx';
import { Requests } from './pages/Requests.tsx';
import { RequestDetail } from './pages/RequestDetail.tsx';
import { RequestForm } from './pages/RequestForm.tsx';
import { Inventory } from './pages/Inventory.tsx';
import { InventoryDetail } from './pages/InventoryDetail.tsx';
import { InventoryForm } from './pages/InventoryForm.tsx';
import { Deliveries } from './pages/Deliveries.tsx';
import { DeliveryDetail } from './pages/DeliveryDetail.tsx';
import { DeliveryForm } from './pages/DeliveryForm.tsx';
import { Pickups } from './pages/Pickups.tsx';
import { PickupDetail } from './pages/PickupDetail.tsx';
import { PickupForm } from './pages/PickupForm.tsx';
import { Volunteers } from './pages/Volunteers.tsx';
import { VolunteerDetail } from './pages/VolunteerDetail.tsx';
import { VolunteerForm } from './pages/VolunteerForm.tsx';
import { AdminIndex } from './pages/admin/AdminIndex.tsx';
import { AdminList } from './pages/admin/AdminList.tsx';
import { AdminForm } from './pages/admin/AdminForm.tsx';
import { AdminActivity } from './pages/admin/AdminActivity.tsx';

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        } />
      </Routes>
    </AuthProvider>
  );
}

function AppShell() {
  return (
    <div className="grid min-h-screen" style={{ gridTemplateColumns: '232px 1fr' }}>
      <Sidebar />
      <main className="bg-paper px-9 py-7 overflow-x-hidden">
        <Breadcrumbs />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />

          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/new" element={<ClientForm />} />
          <Route path="/clients/:id/edit" element={<ClientForm />} />
          <Route path="/clients/:id" element={<ClientDetail />} />

          <Route path="/requests" element={<Requests />} />
          <Route path="/requests/new" element={<RequestForm />} />
          <Route path="/requests/:id/edit" element={<RequestForm />} />
          <Route path="/requests/:id" element={<RequestDetail />} />

          <Route path="/inventory" element={<Inventory />} />
          <Route path="/inventory/new" element={<InventoryForm />} />
          <Route path="/inventory/:id/edit" element={<InventoryForm />} />
          <Route path="/inventory/:id" element={<InventoryDetail />} />

          <Route path="/deliveries" element={<Deliveries />} />
          <Route path="/deliveries/new" element={<DeliveryForm />} />
          <Route path="/deliveries/:id/edit" element={<DeliveryForm />} />
          <Route path="/deliveries/:id" element={<DeliveryDetail />} />

          <Route path="/pickups" element={<Pickups />} />
          <Route path="/pickups/new" element={<PickupForm />} />
          <Route path="/pickups/:id/edit" element={<PickupForm />} />
          <Route path="/pickups/:id" element={<PickupDetail />} />

          <Route path="/volunteers" element={<Volunteers />} />
          <Route path="/volunteers/new" element={<VolunteerForm />} />
          <Route path="/volunteers/:id/edit" element={<VolunteerForm />} />
          <Route path="/volunteers/:id" element={<VolunteerDetail />} />

          {/* Admin section is admin-only. The RequireAdmin wrapper renders
              a friendly "admins only" screen for non-admin users. */}
          <Route path="/admin" element={<RequireAdmin><AdminIndex /></RequireAdmin>} />
          <Route path="/admin/activity" element={<RequireAdmin><AdminActivity /></RequireAdmin>} />
          <Route path="/admin/:table" element={<RequireAdmin><AdminList /></RequireAdmin>} />
          <Route path="/admin/:table/new" element={<RequireAdmin><AdminForm /></RequireAdmin>} />
          <Route path="/admin/:table/:id" element={<RequireAdmin><AdminForm /></RequireAdmin>} />
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
