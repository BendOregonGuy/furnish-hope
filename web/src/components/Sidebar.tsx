import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth.tsx';
import { initials } from '../lib/api.ts';

interface NavItem { to: string; name: string; icon: string; adminOnly?: boolean; }
interface NavSection { label: string; items: NavItem[]; }

const sections: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { to: '/',          name: 'Dashboard',           icon: 'home' },
    ],
  },
  {
    label: 'Clients',
    items: [
      { to: '/clients',   name: 'Clients',             icon: 'users' },
      { to: '/requests',  name: 'Provisioning Requests', icon: 'list-check' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/deliveries',name: 'Deliveries',          icon: 'truck' },
      { to: '/pickups',   name: 'Donation Pickups',    icon: 'package' },
      { to: '/inventory', name: 'Inventory',           icon: 'box' },
    ],
  },
  {
    label: 'Network',
    items: [
      { to: '/volunteers',name: 'Volunteers & Staff',  icon: 'heart' },
    ],
  },
  {
    label: 'Fundraising',
    items: [
      { to: '/campaigns', name: 'Campaigns',           icon: 'flag' },
      { to: '/events',    name: 'Events',              icon: 'calendar' },
      { to: '/donors',    name: 'Donors',              icon: 'sparkle' },
      { to: '/donations', name: 'Donations',           icon: 'gift' },
      { to: '/pledges',   name: 'Pledges',             icon: 'handshake' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/admin/settings', name: 'Settings',       icon: 'gear',     adminOnly: true },
      { to: '/admin/activity', name: 'Activity log',   icon: 'activity', adminOnly: true },
      { to: '/admin',          name: 'Database Admin', icon: 'database', adminOnly: true },
    ],
  },
];

function Icon({ name }: { name: string }) {
  const stroke = 'currentColor';
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'home':       return <svg {...common}><path d="M3 12 12 4l9 8M5 10v10h14V10"/></svg>;
    case 'users':      return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>;
    case 'list-check': return <svg {...common}><path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
    case 'truck':      return <svg {...common}><path d="M1 3h15v13H1zM16 8h4l3 3v5h-7zM5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/></svg>;
    case 'package':    return <svg {...common}><path d="M16.5 9.4 7.55 4.24M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96 12 12.01l8.73-5.05M12 22.08V12"/></svg>;
    case 'box':        return <svg {...common}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>;
    case 'heart':      return <svg {...common}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;
    case 'database':   return <svg {...common}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6"/></svg>;
    case 'logout':     return <svg {...common}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>;
    case 'activity':   return <svg {...common}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>;
    case 'gear':       return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
    case 'gift':       return <svg {...common}><path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>;
    case 'handshake':  return <svg {...common}><path d="M11 17l2 2a1 1 0 0 0 3-3l-1-1M14 14l3 3a1 1 0 0 0 3-3l-3-3M8 14l-3-3a1 1 0 0 0-3 3l3 3M11 11l-3-3a1 1 0 0 0-3 3l3 3M14 11l3-3a1 1 0 1 1 3 3l-3 3M11 14l-3 3a1 1 0 0 0 3 3l3-3"/></svg>;
    case 'sparkle':    return <svg {...common}><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M19 14l.8 2.3L22 17l-2.2.7L19 20l-.8-2.3L16 17l2.2-.7L19 14z"/></svg>;
    case 'flag':       return <svg {...common}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/></svg>;
    case 'calendar':   return <svg {...common}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>;
    default: return null;
  }
}

export function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="w-[232px] bg-gradient-to-b from-[#1F1B16] to-[#2A241D] text-[#E8DFCD] py-5 flex flex-col">
      <div className="flex items-center gap-2.5 px-5 pb-5 border-b border-white/10">
        <div className="w-7 h-7 rounded-full border-[1.5px] border-terracotta-soft flex items-center justify-center text-terracotta-soft font-display italic font-semibold">F</div>
        <div>
          <div className="font-display font-medium text-paper text-base leading-none">Furnish Hope</div>
          <div className="text-[9px] tracking-widest uppercase text-terracotta-soft/70 mt-1">Internal Ops</div>
        </div>
      </div>

      {sections.map(section => {
        // Filter out admin-only items for non-admins. Whole sections that
        // end up empty are skipped entirely.
        const items = section.items.filter(i => !i.adminOnly || user?.is_admin);
        if (items.length === 0) return null;
        return (
          <div key={section.label} className="pt-4 pb-1">
            <div className="text-[10px] tracking-widest uppercase text-[#E8DFCD]/40 px-5 pb-2 font-medium">{section.label}</div>
            {items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-5 py-2 text-[13px] cursor-pointer border-l-2 transition ` +
                  (isActive
                    ? 'text-paper bg-terracotta/10 border-terracotta'
                    : 'text-[#E8DFCD]/75 border-transparent hover:text-paper hover:bg-white/[0.03]')
                }
              >
                <span className="w-4 h-4 inline-flex items-center justify-center opacity-85">
                  <Icon name={item.icon} />
                </span>
                {item.name}
              </NavLink>
            ))}
          </div>
        );
      })}

      <div className="mt-auto pt-4 px-5 border-t border-white/10">
        <Link to="/settings" className="block pt-3 hover:opacity-90">
          <div className="flex items-center gap-2.5">
            <div className="w-[30px] h-[30px] rounded-full bg-terracotta text-paper flex items-center justify-center text-[11px] font-medium">
              {initials(user?.display_name ?? user?.username ?? '?')}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-paper truncate">{user?.display_name ?? user?.username ?? '—'}</div>
              <div className="text-[10px] text-[#E8DFCD]/50 truncate">
                {user?.is_admin ? 'Administrator' : 'Staff'}
              </div>
            </div>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => { void logout(); }}
          className="flex items-center gap-2 mt-3 text-[11px] text-[#E8DFCD]/60 hover:text-paper transition"
        >
          <span className="w-3.5 h-3.5 inline-flex items-center justify-center"><Icon name="logout" /></span>
          Sign out
        </button>
      </div>
    </aside>
  );
}
