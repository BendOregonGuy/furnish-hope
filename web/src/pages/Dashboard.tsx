import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiGet, formatMoney, formatShortDate } from '../lib/api.ts';
import { PageHeader, StatusPill, Avatar, Loading, ErrorBox } from '../components/ui.tsx';

type DashboardData = {
  metrics: {
    active_clients: number;
    open_requests: number;
    inventory_value: number;
    inventory_count: number;
    homes_furnished_ytd: number;
  };
  pendingRequests: Array<{
    request_id: number;
    client_id: number;
    client_name: string;
    client_type: string;
    agency_name: string | null;
    request_date: string;
    status: string;
  }>;
  recentDonations: Array<{
    donation_id: number;
    donation_date: string;
    total_value: number | null;
    donation_type: string;
    donor_name: string;
    donor_type: string;
    item_count: number;
  }>;
};

export function Dashboard() {
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => apiGet('/api/dashboard'),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;

  return (
    <>
      <PageHeader
        title="Good morning,"
        emphasis="Jamie"
        subtitle={`${data.metrics.open_requests} provisioning requests await review. Cycle of Hope continues.`}
        actions={
          <>
            <button className="btn-ghost">Export report</button>
            <Link to="/clients" className="btn-primary"><span className="text-base leading-none">+</span> New referral</Link>
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3.5 mb-7">
        <Metric label="Active Clients" value={data.metrics.active_clients} hint="" />
        <Metric label="Open Requests" value={data.metrics.open_requests} hint="" />
        <Metric label="Inventory Value" value={formatMoney(data.metrics.inventory_value)} hint={`${data.metrics.inventory_count} items across facilities`} />
        <Metric label="Homes Furnished YTD" value={data.metrics.homes_furnished_ytd} hint="" />
      </div>

      <div className="grid grid-cols-[1.6fr_1fr] gap-5">
        <div className="card">
          <div className="card-head">
            <h3 className="font-display font-medium text-[17px] m-0">Pending provisioning requests</h3>
            <Link to="/requests" className="text-xs text-terracotta font-medium">View all →</Link>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Client</th>
                <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Agency</th>
                <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Request</th>
                <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.pendingRequests.map(r => (
                <tr key={r.request_id} className="border-t border-hairline hover:bg-terracotta/[0.025]">
                  <td className="py-2.5 pr-2">
                    <Link to={`/requests/${r.request_id}`} className="flex items-center gap-2.5">
                      <Avatar name={r.client_name} />
                      <div>
                        <div className="font-medium">{r.client_name}</div>
                        <div className="text-[11px] text-ink-faint">{r.client_type}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="py-2.5 pr-2">{r.agency_name ?? '—'}</td>
                  <td className="py-2.5 pr-2">{formatShortDate(r.request_date)}</td>
                  <td className="py-2.5"><StatusPill status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-head">
            <h3 className="font-display font-medium text-[17px] m-0">Recent donations</h3>
            <Link to="/inventory" className="text-xs text-terracotta font-medium">Inventory →</Link>
          </div>
          <div>
            {data.recentDonations.map(d => (
              <div key={d.donation_id} className="grid grid-cols-[1.4fr_70px_80px] gap-3 py-2.5 border-b border-hairline last:border-0 items-center text-sm">
                <div>
                  <div className="font-medium">{d.donor_name}</div>
                  <div className="text-[11px] text-ink-faint">{d.donor_type} · {formatShortDate(d.donation_date)}</div>
                </div>
                <div className="text-xs text-ink-soft">{d.item_count > 0 ? `${d.item_count} item${d.item_count > 1 ? 's' : ''}` : '—'}</div>
                <div className="text-right font-display font-medium">{formatMoney(d.total_value)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Metric({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="bg-cream border border-hairline rounded-[10px] px-4 pt-4 pb-4">
      <div className="text-[11px] tracking-widest uppercase text-ink-faint font-medium mb-3">{label}</div>
      <div className="font-display font-medium text-[32px] tracking-tight text-ink leading-none mb-1.5">{value}</div>
      {hint ? <div className="text-xs text-ink-soft">{hint}</div> : <div className="text-xs">&nbsp;</div>}
    </div>
  );
}
