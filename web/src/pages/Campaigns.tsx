/**
 * Campaigns list — fundraising drives with progress bars against goal.
 * Sorted by status (Active first, then Planning/Paused/Completed/Cancelled).
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { apiGet, formatMoney, formatShortDate } from '../lib/api.ts';
import { PageHeader, Loading, ErrorBox, EmptyState, StatusPill } from '../components/ui.tsx';
import { FkSelect } from '../components/admin/FkSelect.tsx';

interface CampaignRow {
  campaign_id: number;
  campaign_name: string;
  campaign_type: string;
  campaign_status: string;
  fund_name: string | null;
  goal_amount: number | string | null;
  raised: number | string;
  gift_count: number;
  outstanding_pledged: number | string;
  start_date: string | null;
  end_date: string | null;
  public_url: string | null;
}

export function Campaigns() {
  const [statusId, setStatusId] = useState<number | null>(null);
  const [typeId, setTypeId] = useState<number | null>(null);
  const [fundId, setFundId] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery<CampaignRow[]>({
    queryKey: ['campaigns', statusId, typeId, fundId],
    queryFn: () => apiGet('/api/campaigns', {
      status_id: statusId ? String(statusId) : undefined,
      type_id:   typeId   ? String(typeId)   : undefined,
      fund_id:   fundId   ? String(fundId)   : undefined,
    }),
  });

  return (
    <>
      <PageHeader
        helpSection="campaigns"
        title="Fundraising"
        emphasis="campaigns"
        subtitle="Drives that group donations, pledges, and events toward a shared goal."
        actions={
          <Link to="/campaigns/new" className="btn-primary">
            <span className="text-base leading-none">+</span> New campaign
          </Link>
        }
      />

      <div className="card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="field-label">Status</label>
            <FkSelect fkTable="lkp_campaign_status" value={statusId} onChange={setStatusId} />
          </div>
          <div>
            <label className="field-label">Type</label>
            <FkSelect fkTable="lkp_campaign_type" value={typeId} onChange={setTypeId} />
          </div>
          <div>
            <label className="field-label">Fund</label>
            <FkSelect fkTable="lkp_fund" value={fundId} onChange={setFundId} />
          </div>
        </div>
      </div>

      {isLoading && <Loading />}
      {error && <ErrorBox error={error} />}
      {data && data.length === 0 && (
        <EmptyState
          title="No campaigns yet"
          hint='Click "New campaign" to start your first fundraising drive.'
        />
      )}

      {data && data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.map(c => {
            const raised = Number(c.raised ?? 0);
            const goal = Number(c.goal_amount ?? 0);
            const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
            const outstanding = Number(c.outstanding_pledged ?? 0);
            const projectedPct = goal > 0 ? Math.min(100, Math.round(((raised + outstanding) / goal) * 100)) : 0;
            return (
              <Link key={c.campaign_id} to={`/campaigns/${c.campaign_id}`}
                className="card hover:border-terracotta transition block">
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <div className="font-display font-medium text-lg leading-tight truncate">{c.campaign_name}</div>
                  <StatusPill status={c.campaign_status} />
                </div>
                <div className="text-[11px] text-ink-faint mb-3">
                  {c.campaign_type}
                  {c.fund_name && <> · for {c.fund_name}</>}
                  {c.start_date && <> · {formatShortDate(c.start_date)}{c.end_date && ` → ${formatShortDate(c.end_date)}`}</>}
                </div>

                {goal > 0 ? (
                  <>
                    <div className="flex items-baseline justify-between mb-1">
                      <div className="text-xs text-ink-soft">
                        <span className="font-display font-medium text-base text-ink">{formatMoney(raised)}</span>
                        {' '}of {formatMoney(goal)}
                      </div>
                      <div className="text-xs text-ink-faint">{pct}%</div>
                    </div>
                    <div className="w-full h-2 bg-cream-deep rounded-full overflow-hidden relative">
                      {/* Outstanding pledges shown as a lighter overlay */}
                      <div className="absolute inset-y-0 left-0 bg-gold-soft" style={{ width: `${projectedPct}%` }} />
                      <div className="absolute inset-y-0 left-0 bg-sage" style={{ width: `${pct}%` }} />
                    </div>
                    {outstanding > 0 && (
                      <div className="text-[11px] text-ink-faint mt-1">
                        + {formatMoney(outstanding)} outstanding pledged
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-ink-soft">
                    <span className="font-display font-medium text-base text-ink">{formatMoney(raised)}</span>
                    {' '}raised
                    {outstanding > 0 && <> · <span className="text-ink-faint">{formatMoney(outstanding)} outstanding pledged</span></>}
                  </div>
                )}

                <div className="text-[11px] text-ink-faint mt-2">
                  {c.gift_count} gift{c.gift_count === 1 ? '' : 's'}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
