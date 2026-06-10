/**
 * Top-level chrome shown to agency-caseworker users. NO sidebar with
 * internal pages — just a small header with the org logo, agency name,
 * and a tiny nav (Dashboard / Referrals / + New Referral / Sign out).
 *
 * Routes inside it are agency-only; the staff router never reaches
 * this shell. Conversely, an agency user landing on a staff route
 * gets bounced to /agency by the role-aware top-level App routing.
 */

import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api.ts';
import { useAuth } from '../../lib/auth.tsx';

interface OrgInfo {
  org_name: string;
  has_logo: boolean;
  logo_updated_at: string | null;
}

export function AgencyShell() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const { data: org } = useQuery<OrgInfo>({
    queryKey: ['org-info'],
    queryFn: () => apiGet('/api/org-info'),
  });

  const logoUrl = org?.has_logo && org?.logo_updated_at
    ? `/api/org-info/logo?v=${encodeURIComponent(org.logo_updated_at)}`
    : null;

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-paper border-b border-hairline">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-5 flex-wrap">
          <Link to="/agency" className="flex items-center gap-2 mr-auto">
            {logoUrl && <img src={logoUrl} alt="" className="h-9 w-auto object-contain" />}
            <div>
              <div className="font-display font-medium text-base leading-none">{org?.org_name ?? 'Furnish Hope'}</div>
              <div className="text-[11px] text-ink-faint mt-0.5">Partner agency portal</div>
            </div>
          </Link>

          <nav className="flex items-center gap-1 text-sm">
            <NavTab to="/agency"           current={location.pathname}>Dashboard</NavTab>
            <NavTab to="/agency/referrals" current={location.pathname}>My referrals</NavTab>
            <NavTab to="/agency/referrals/new" current={location.pathname}>+ Refer household</NavTab>
          </nav>

          <div className="flex items-center gap-3 text-sm">
            <div className="text-right">
              <div className="font-medium leading-none">{user?.display_name}</div>
              <div className="text-[11px] text-ink-faint mt-0.5">{user?.agency_name ?? 'Agency caseworker'}</div>
            </div>
            <button type="button" onClick={() => logout()} className="text-xs text-ink-soft hover:text-terracotta border border-hairline-strong px-2 py-1 rounded">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-7">
        <Outlet />
      </main>
    </div>
  );
}

function NavTab({ to, current, children }: { to: string; current: string; children: React.ReactNode }) {
  // Exact match for /agency (dashboard); startsWith for nested routes.
  const active = to === '/agency'
    ? current === '/agency'
    : current.startsWith(to);
  return (
    <NavLink
      to={to}
      className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${
        active
          ? 'bg-terracotta text-paper font-medium'
          : 'text-ink-soft hover:text-terracotta hover:bg-terracotta/[0.06]'
      }`}
    >
      {children}
    </NavLink>
  );
}
