/**
 * Donors list — donor-centric view with lifetime + YTD giving totals.
 * "+ New donor" opens the same quick-create modal used from other forms
 * (DonorQuickCreateModal — inlines contact + address, no nested FK
 * dropdowns the user has to chase down). Edits still flow through
 * /admin/tbl_donor for now.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { apiGet, formatMoney, formatShortDate } from '../lib/api.ts';
import { PageHeader, Avatar, Loading, ErrorBox, EmptyState, AnonPill } from '../components/ui.tsx';
import { FkSelect } from '../components/admin/FkSelect.tsx';
import { DonorQuickCreateModal } from '../components/donor/DonorQuickCreateModal.tsx';
import { QuickCreateOverlay } from '../components/admin/FkSelectWithCreate.tsx';

interface DonorRow {
  donor_id: number;
  donor_name: string;
  mobile_phone: string | null;
  email: string | null;
  donor_type: string;
  is_recurring: boolean;
  is_anonymous: boolean;
  do_not_contact: boolean;
  donor_stage_id: number | null;
  donor_stage: string | null;
  lifetime_giving: number | string;
  ytd_giving: number | string;
  last_gift_date: string | null;
  gift_count: number;
}

export function Donors() {
  const [search, setSearch] = useState('');
  const [stageId, setStageId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery<DonorRow[]>({
    queryKey: ['donors', search, stageId],
    queryFn: () => apiGet('/api/donors', {
      search: search || undefined,
      stage_id: stageId ? String(stageId) : undefined,
    }),
  });

  const totalLifetime = data?.reduce((s, d) => s + Number(d.lifetime_giving ?? 0), 0) ?? 0;
  const totalYTD = data?.reduce((s, d) => s + Number(d.ytd_giving ?? 0), 0) ?? 0;

  return (
    <>
      <PageHeader
        helpSection="donors"
        title="Donors"
        emphasis="& funders"
        subtitle="Everyone who has given (or pledged) to Furnish Hope. Sorted by lifetime giving."
        actions={
          <button type="button" onClick={() => setAddOpen(true)} className="btn-primary">
            <span className="text-base leading-none">+</span> New donor
          </button>
        }
      />

      {/* + New donor opens DonorQuickCreateModal — same inline-composition
          modal we use from Pickup/Donation/Pledge forms. After save we
          navigate straight to the new donor's detail page so the user can
          continue adding info (gift history, donor stage, etc.). */}
      {addOpen && (
        <QuickCreateOverlay onClose={() => setAddOpen(false)}>
          <DonorQuickCreateModal
            onCancel={() => setAddOpen(false)}
            onCreated={(id) => {
              setAddOpen(false);
              queryClient.invalidateQueries({ queryKey: ['donors'] });
              navigate(`/donors/${id}`);
            }}
          />
        </QuickCreateOverlay>
      )}

      <div className="card mb-3">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-3">
          <div>
            <label className="field-label">Search</label>
            <input
              type="text"
              className="field-input"
              placeholder="Name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Pipeline stage</label>
            <FkSelect fkTable="lkp_donor_stage" value={stageId} onChange={setStageId} />
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-hairline text-xs text-ink-faint">
          {(data?.length ?? 0).toLocaleString()} donor{(data?.length ?? 0) === 1 ? '' : 's'} ·
          Lifetime <span className="text-ink font-medium">{formatMoney(totalLifetime)}</span> ·
          YTD <span className="text-ink font-medium">{formatMoney(totalYTD)}</span>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading && <Loading />}
        {error && <ErrorBox error={error} />}
        {data && data.length === 0 && (
          <EmptyState
            title={search ? 'No donors match' : 'No donors yet'}
            hint={search ? 'Try a different search.' : 'Click "New donor" to add one.'}
          />
        )}
        {data && data.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-cream">
              <tr>
                <Th>Donor</Th>
                <Th>Type</Th>
                <Th>Stage</Th>
                <Th className="text-right">Lifetime</Th>
                <Th className="text-right">YTD</Th>
                <Th className="text-right">Gifts</Th>
                <Th>Last gift</Th>
              </tr>
            </thead>
            <tbody>
              {data.map(d => (
                <tr key={d.donor_id} className="border-t border-hairline hover:bg-terracotta/[0.025]">
                  <td className="px-5 py-3">
                    <Link to={`/donors/${d.donor_id}`} className="flex items-center gap-2.5">
                      <Avatar name={d.donor_name} />
                      <div>
                        <div className="font-medium flex items-center gap-1.5 flex-wrap">
                          {d.donor_name}
                          {d.is_anonymous && <AnonPill />}
                        </div>
                        <div className="text-[11px] text-ink-faint">
                          {d.email ?? d.mobile_phone ?? '—'}
                          {d.is_recurring && <span className="ml-2 pill pill-sage text-[9px] py-0">Recurring</span>}
                          {d.do_not_contact && <span className="ml-2 pill pill-terra text-[9px] py-0">Do not contact</span>}
                        </div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-xs text-ink-soft">{d.donor_type}</td>
                  <td className="px-5 py-3 text-xs">
                    {d.donor_stage
                      ? <span className="pill pill-muted">{d.donor_stage}</span>
                      : <span className="text-ink-faint">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right font-display font-medium">{formatMoney(d.lifetime_giving)}</td>
                  <td className="px-5 py-3 text-right text-xs">{formatMoney(d.ytd_giving)}</td>
                  <td className="px-5 py-3 text-right text-xs text-ink-soft">{d.gift_count}</td>
                  <td className="px-5 py-3 text-xs text-ink-soft">{d.last_gift_date ? formatShortDate(d.last_gift_date) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium px-5 py-3 ${className}`}>
      {children}
    </th>
  );
}
