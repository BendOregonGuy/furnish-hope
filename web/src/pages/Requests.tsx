import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiGet, formatShortDate } from '../lib/api.ts';
import { PageHeader, Avatar, Loading, ErrorBox, StatusPill } from '../components/ui.tsx';

type Req = {
  request_id: number;
  request_at: string;
  client_id: number;
  client_name: string;
  client_type: string;
  item_count: number;
  matched_count: number;
};

export function Requests() {
  const { data, isLoading, error } = useQuery<Req[]>({
    queryKey: ['requests'],
    queryFn: () => apiGet('/api/requests'),
  });

  return (
    <>
      <PageHeader
        title="Provisioning"
        emphasis="requests"
        subtitle="Each request represents one household's needs. Match items, schedule delivery, complete the cycle."
        actions={
          <Link to="/requests/new" className="btn-primary">
            <span className="text-base leading-none">+</span> New request
          </Link>
        }
      />

      <div className="card p-0 overflow-hidden">
        {isLoading && <Loading />}
        {error && <ErrorBox error={error} />}
        {data && (
          <table className="w-full text-sm">
            <thead className="bg-cream">
              <tr>
                <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium px-5 py-3">Client</th>
                <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium px-5 py-3">Type</th>
                <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium px-5 py-3">Request date</th>
                <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium px-5 py-3">Items</th>
                <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map(r => {
                const status = r.matched_count === 0 ? 'New'
                  : r.matched_count >= r.item_count * 0.8 ? 'Ready to schedule'
                  : 'Matching';
                return (
                  <tr key={r.request_id} className="border-t border-hairline hover:bg-terracotta/[0.025]">
                    <td className="px-5 py-3">
                      <Link to={`/requests/${r.request_id}`} className="flex items-center gap-2.5">
                        <Avatar name={r.client_name} />
                        <div className="font-medium">{r.client_name}</div>
                      </Link>
                    </td>
                    <td className="px-5 py-3">{r.client_type}</td>
                    <td className="px-5 py-3">{formatShortDate(r.request_at)}</td>
                    <td className="px-5 py-3 text-xs"><span className="text-ink-soft">{r.matched_count}</span><span className="text-ink-faint"> / {r.item_count}</span></td>
                    <td className="px-5 py-3"><StatusPill status={status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
