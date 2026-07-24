/**
 * Reports — KPI tiles + 16 charts across Fundraising, Operations,
 * Community, and (Tier 2) Polish sections. A single period toggle
 * at the top re-buckets every chart to monthly / quarterly / yearly.
 *
 * Backed by /api/reports?period=…, which returns every dataset in one
 * batch so the page renders coherently with one loading state.
 *
 * Recharts handles the rendering. The project palette is wired through
 * via the CHART_COLORS constant so the visuals match the rest of the
 * app (terracotta primary, sage / gold / slate accents).
 */

import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { apiGet, formatMoney } from '../lib/api.ts';
import { PageHeader, Loading, ErrorBox, AnonPill } from '../components/ui.tsx';
import { ExportMenu } from '../components/ExportMenu.tsx';

type Period = 'monthly' | 'quarterly' | 'yearly';

const CHART_COLORS = {
  terracotta: '#C7704A',
  sage:       '#7C8B5E',
  gold:       '#C9A24E',
  slate:      '#5B6478',
  ink:        '#1a1611',
  ink_soft:   '#6b6b6b',
  hairline:   '#d8d4cc',
};

const PALETTE = [
  CHART_COLORS.terracotta,
  CHART_COLORS.sage,
  CHART_COLORS.gold,
  CHART_COLORS.slate,
  '#8E6C95',  // soft purple (shifts)
  '#4A7A8C',  // muted blue
];

/* ----------------------------------------------------------------- */
/*  Page                                                              */
/* ----------------------------------------------------------------- */

interface ReportsResponse {
  period: Period;
  kpis: {
    revenue: number | string; active_donors: number; new_donors: number;
    households_served: number; pickups_completed: number; deliveries_completed: number;
    volunteer_hours: number | string; items_in: number; items_out: number;
  };
  revenueTrend: Array<{ bucket: string; revenue: number | string }>;
  revenueByFund: Array<{ bucket: string; fund_name: string; revenue: number | string }>;
  donorMix: Array<{ bucket: string; new_donors: number; returning_donors: number }>;
  campaigns: Array<{ campaign_id: number; campaign_name: string; goal_amount: number | string | null; raised: number | string }>;
  pickupsDeliveries: Array<{ bucket: string; pickups: number; deliveries: number }>;
  cycleTime: Array<{ bucket: string; avg_days: number | string | null }>;
  inventoryFlow: Array<{ bucket: string; received: number; distributed: number }>;
  donorPipeline: Array<{ stage: string; count: number }>;
  volunteerHours: Array<{ bucket: string; hours: number | string }>;
  topDonors: Array<{ donor_id: number; donor_name: string; is_anonymous: boolean; total: number | string; gift_count: number; last_gift_date: string }>;
  avgGift: Array<{ bucket: string; avg_gift: number | string; gift_count: number }>;
  pledges: Array<{ bucket: string; pledged: number | string; fulfilled: number | string; outstanding: number | string }>;
  shiftFillRate: Array<{ bucket: string; capacity_needed: number; filled: number; fill_rate_pct: number | string }>;
  inventoryByCategory: Array<{ category: string; count: number }>;
  ackTurnaround: Array<{ bucket: string; avg_days: number | string | null }>;
  donationTypes: Array<{ type: string; count: number; total: number | string }>;
}

export function Reports() {
  const [period, setPeriod] = useState<Period>('monthly');

  const { data, isLoading, error } = useQuery<ReportsResponse>({
    queryKey: ['reports', period],
    queryFn: () => apiGet('/api/reports', { period }),
  });

  return (
    <>
      <PageHeader
        helpSection="reports"
        title="Reports"
        emphasis="& insights"
        subtitle="The numbers behind the work — fundraising, operations, community engagement."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <PeriodToggle period={period} onChange={setPeriod} />
            <ExportMenu report="reports" params={{ period }} />
          </div>
        }
      />

      {isLoading && !data && <Loading />}
      {error && <ErrorBox error={error} />}

      {data && (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Kpi label={`Revenue (${period === 'monthly' ? 'this month' : period === 'quarterly' ? 'this quarter' : 'this year'})`} value={formatMoney(data.kpis.revenue)} />
            <Kpi label="Active donors"     value={data.kpis.active_donors.toLocaleString()} />
            <Kpi label="New donors"        value={data.kpis.new_donors.toLocaleString()} />
            <Kpi label="Households served" value={data.kpis.households_served.toLocaleString()} />
            <Kpi label="Pickups done"      value={data.kpis.pickups_completed.toLocaleString()} />
            <Kpi label="Deliveries done"   value={data.kpis.deliveries_completed.toLocaleString()} />
            <Kpi label="Volunteer hours"   value={Number(data.kpis.volunteer_hours).toFixed(1)} />
            <Kpi label="Items in / out"    value={`${data.kpis.items_in} / ${data.kpis.items_out}`} />
          </div>

          {/* ============== FUNDRAISING ============== */}
          <SectionHeader>Fundraising</SectionHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
            <ChartCard title="Revenue trend" subtitle="Total contributions per period">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.revenueTrend.map(r => ({ ...r, revenue: Number(r.revenue), label: formatBucket(r.bucket, period) }))}>
                  <CartesianGrid stroke={CHART_COLORS.hairline} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="label" stroke={CHART_COLORS.ink_soft} fontSize={11} />
                  <YAxis stroke={CHART_COLORS.ink_soft} fontSize={11} tickFormatter={moneyTick} />
                  <Tooltip formatter={(v: any) => formatMoney(v)} labelFormatter={l => l} />
                  <Line type="monotone" dataKey="revenue" stroke={CHART_COLORS.terracotta} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Revenue by fund" subtitle="Where the money is restricted to">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={pivotByFund(data.revenueByFund, period)}>
                  <CartesianGrid stroke={CHART_COLORS.hairline} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="label" stroke={CHART_COLORS.ink_soft} fontSize={11} />
                  <YAxis stroke={CHART_COLORS.ink_soft} fontSize={11} tickFormatter={moneyTick} />
                  <Tooltip formatter={(v: any) => formatMoney(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {fundsFromData(data.revenueByFund).map((fund, i) => (
                    <Bar key={fund} dataKey={fund} stackId="a" fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Donor mix" subtitle="New vs returning donors per period">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.donorMix.map(r => ({ ...r, label: formatBucket(r.bucket, period) }))}>
                  <CartesianGrid stroke={CHART_COLORS.hairline} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="label" stroke={CHART_COLORS.ink_soft} fontSize={11} />
                  <YAxis stroke={CHART_COLORS.ink_soft} fontSize={11} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="new_donors" name="New" fill={CHART_COLORS.terracotta} />
                  <Bar dataKey="returning_donors" name="Returning" fill={CHART_COLORS.sage} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Active campaigns" subtitle="Raised vs goal">
              <div className="space-y-3 py-2">
                {data.campaigns.length === 0 && <div className="text-sm text-ink-faint italic">No active campaigns.</div>}
                {data.campaigns.map(c => {
                  const raised = Number(c.raised ?? 0);
                  const goal   = Number(c.goal_amount ?? 0);
                  const pct = goal > 0 ? Math.min(100, (raised / goal) * 100) : 0;
                  return (
                    <Link key={c.campaign_id} to={`/campaigns/${c.campaign_id}`} className="block hover:bg-terracotta/[0.025] -mx-2 px-2 py-1.5 rounded">
                      <div className="flex items-baseline justify-between text-xs mb-1">
                        <span className="font-medium truncate mr-2">{c.campaign_name}</span>
                        <span className="text-ink-faint whitespace-nowrap">{formatMoney(raised)} / {goal > 0 ? formatMoney(goal) : '—'}</span>
                      </div>
                      <div className="h-2 bg-cream rounded-full overflow-hidden">
                        <div className="h-full bg-terracotta" style={{ width: `${pct}%` }} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </ChartCard>
          </div>

          {/* ============== OPERATIONS ============== */}
          <SectionHeader>Operations</SectionHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
            <ChartCard title="Pickups + Deliveries" subtitle="Operational tempo">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.pickupsDeliveries.map(r => ({ ...r, label: formatBucket(r.bucket, period) }))}>
                  <CartesianGrid stroke={CHART_COLORS.hairline} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="label" stroke={CHART_COLORS.ink_soft} fontSize={11} />
                  <YAxis stroke={CHART_COLORS.ink_soft} fontSize={11} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="pickups"    stroke={CHART_COLORS.terracotta} strokeWidth={2} dot={{ r: 3 }} name="Pickups" />
                  <Line type="monotone" dataKey="deliveries" stroke={CHART_COLORS.sage} strokeWidth={2} dot={{ r: 3 }} name="Deliveries" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Cycle time" subtitle="Average days from request to delivery — lower is better">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.cycleTime.map(r => ({ ...r, avg_days: Number(r.avg_days ?? 0), label: formatBucket(r.bucket, period) }))}>
                  <CartesianGrid stroke={CHART_COLORS.hairline} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="label" stroke={CHART_COLORS.ink_soft} fontSize={11} />
                  <YAxis stroke={CHART_COLORS.ink_soft} fontSize={11} unit=" d" />
                  <Tooltip formatter={(v: any) => `${v} days`} />
                  <Line type="monotone" dataKey="avg_days" stroke={CHART_COLORS.gold} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Inventory flow" subtitle="Items received vs distributed — a sustained gap means the warehouse is filling up or draining">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.inventoryFlow.map(r => ({ ...r, label: formatBucket(r.bucket, period) }))}>
                  <CartesianGrid stroke={CHART_COLORS.hairline} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="label" stroke={CHART_COLORS.ink_soft} fontSize={11} />
                  <YAxis stroke={CHART_COLORS.ink_soft} fontSize={11} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="received"    stroke={CHART_COLORS.terracotta} strokeWidth={2} dot={{ r: 3 }} name="Received" />
                  <Line type="monotone" dataKey="distributed" stroke={CHART_COLORS.sage} strokeWidth={2} dot={{ r: 3 }} name="Distributed" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Donor pipeline" subtitle="Major-gifts moves management — where prospects live">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.donorPipeline} layout="vertical">
                  <CartesianGrid stroke={CHART_COLORS.hairline} strokeDasharray="2 4" horizontal={false} />
                  <XAxis type="number" stroke={CHART_COLORS.ink_soft} fontSize={11} />
                  <YAxis type="category" dataKey="stage" stroke={CHART_COLORS.ink_soft} fontSize={11} width={100} />
                  <Tooltip />
                  <Bar dataKey="count" fill={CHART_COLORS.slate} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* ============== COMMUNITY ============== */}
          <SectionHeader>Community & engagement</SectionHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
            <ChartCard title="Volunteer hours" subtitle="Total hours logged per period">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.volunteerHours.map(r => ({ ...r, hours: Number(r.hours), label: formatBucket(r.bucket, period) }))}>
                  <CartesianGrid stroke={CHART_COLORS.hairline} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="label" stroke={CHART_COLORS.ink_soft} fontSize={11} />
                  <YAxis stroke={CHART_COLORS.ink_soft} fontSize={11} unit=" h" />
                  <Tooltip formatter={(v: any) => `${Number(v).toFixed(1)} hours`} />
                  <Line type="monotone" dataKey="hours" stroke={CHART_COLORS.sage} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Top 10 donors" subtitle="Largest contributions in the selected period">
              {data.topDonors.length === 0 ? (
                <div className="text-sm text-ink-faint italic py-4">No gifts in this period.</div>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {data.topDonors.map((d, i) => (
                      <tr key={d.donor_id} className="border-b border-hairline/60 last:border-0">
                        <td className="py-2 pr-2 text-[11px] text-ink-faint font-medium w-6">#{i + 1}</td>
                        <td className="py-2 pr-2">
                          <Link to={`/donors/${d.donor_id}`} className="font-medium hover:text-terracotta">
                            {d.donor_name}
                          </Link>
                          {d.is_anonymous && <span className="ml-1.5"><AnonPill /></span>}
                          <div className="text-[10px] text-ink-faint">{d.gift_count} gift{d.gift_count === 1 ? '' : 's'}</div>
                        </td>
                        <td className="py-2 text-right font-display font-medium">{formatMoney(d.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ChartCard>
          </div>

          {/* ============== TIER 2 ============== */}
          <SectionHeader>Polish</SectionHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
            <ChartCard title="Average gift size" subtitle="Trend of the typical donation amount">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.avgGift.map(r => ({ ...r, avg_gift: Number(r.avg_gift), label: formatBucket(r.bucket, period) }))}>
                  <CartesianGrid stroke={CHART_COLORS.hairline} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="label" stroke={CHART_COLORS.ink_soft} fontSize={11} />
                  <YAxis stroke={CHART_COLORS.ink_soft} fontSize={11} tickFormatter={moneyTick} />
                  <Tooltip formatter={(v: any) => formatMoney(v)} />
                  <Line type="monotone" dataKey="avg_gift" stroke={CHART_COLORS.terracotta} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Pledges" subtitle="Committed, fulfilled, and outstanding">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.pledges.map(r => ({ ...r, pledged: Number(r.pledged), fulfilled: Number(r.fulfilled), outstanding: Number(r.outstanding), label: formatBucket(r.bucket, period) }))}>
                  <CartesianGrid stroke={CHART_COLORS.hairline} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="label" stroke={CHART_COLORS.ink_soft} fontSize={11} />
                  <YAxis stroke={CHART_COLORS.ink_soft} fontSize={11} tickFormatter={moneyTick} />
                  <Tooltip formatter={(v: any) => formatMoney(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="fulfilled"   stackId="p" fill={CHART_COLORS.sage} name="Fulfilled" />
                  <Bar dataKey="outstanding" stackId="p" fill={CHART_COLORS.gold} name="Outstanding" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Shift fill rate" subtitle="% of needed volunteer slots that were signed up for">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.shiftFillRate.map(r => ({ ...r, fill_rate_pct: Number(r.fill_rate_pct), label: formatBucket(r.bucket, period) }))}>
                  <CartesianGrid stroke={CHART_COLORS.hairline} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="label" stroke={CHART_COLORS.ink_soft} fontSize={11} />
                  <YAxis stroke={CHART_COLORS.ink_soft} fontSize={11} unit="%" domain={[0, 100]} />
                  <Tooltip formatter={(v: any) => `${v}%`} />
                  <Line type="monotone" dataKey="fill_rate_pct" stroke={CHART_COLORS.sage} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Acknowledgement turnaround" subtitle="Average days from donation to receipt sent — IRS guidance is &lt;30 days">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.ackTurnaround.map(r => ({ ...r, avg_days: Number(r.avg_days ?? 0), label: formatBucket(r.bucket, period) }))}>
                  <CartesianGrid stroke={CHART_COLORS.hairline} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="label" stroke={CHART_COLORS.ink_soft} fontSize={11} />
                  <YAxis stroke={CHART_COLORS.ink_soft} fontSize={11} unit=" d" />
                  <Tooltip formatter={(v: any) => `${v} days`} />
                  <Line type="monotone" dataKey="avg_days" stroke={CHART_COLORS.gold} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Inventory by category" subtitle="Current stock in the warehouse (point-in-time)">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.inventoryByCategory} layout="vertical">
                  <CartesianGrid stroke={CHART_COLORS.hairline} strokeDasharray="2 4" horizontal={false} />
                  <XAxis type="number" stroke={CHART_COLORS.ink_soft} fontSize={11} />
                  <YAxis type="category" dataKey="category" stroke={CHART_COLORS.ink_soft} fontSize={11} width={110} />
                  <Tooltip />
                  <Bar dataKey="count" fill={CHART_COLORS.slate} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Donation types" subtitle="Distribution by donation type — cash, in-kind, securities, etc.">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={data.donationTypes.map(t => ({ ...t, total: Number(t.total) }))}
                    dataKey="total"
                    nameKey="type"
                    cx="50%" cy="50%"
                    outerRadius={90}
                    label={(entry: any) => entry.type}
                  >
                    {data.donationTypes.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => formatMoney(v)} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
    </>
  );
}

/* ----------------------------------------------------------------- */
/*  Bits                                                              */
/* ----------------------------------------------------------------- */

function PeriodToggle({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  return (
    <div className="inline-flex items-center gap-1 border border-hairline-strong rounded-md p-0.5 bg-paper">
      {(['monthly', 'quarterly', 'yearly'] as const).map(p => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`text-xs px-3 py-1 rounded transition ${
            period === p
              ? 'bg-terracotta text-paper font-medium'
              : 'text-ink-soft hover:text-terracotta'
          }`}
        >
          {p === 'monthly' ? 'Monthly' : p === 'quarterly' ? 'Quarterly' : 'Yearly'}
        </button>
      ))}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card">
      <div className="text-[10px] tracking-widest uppercase text-ink-faint font-medium">{label}</div>
      <div className="font-display text-2xl font-medium mt-1">{value}</div>
    </div>
  );
}

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-lg font-medium text-ink mt-7 mb-3 pb-2 border-b border-hairline">
      {children}
    </h2>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="card">
      <div className="mb-3">
        <h3 className="font-display font-medium text-[15px] m-0">{title}</h3>
        {subtitle && <p className="text-[11px] text-ink-faint mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  Helpers                                                           */
/* ----------------------------------------------------------------- */

function moneyTick(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

function formatBucket(raw: string, period: Period): string {
  const d = new Date(raw);
  if (period === 'monthly')   return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  if (period === 'quarterly') return `Q${Math.floor(d.getMonth() / 3) + 1} '${String(d.getFullYear()).slice(2)}`;
  return String(d.getFullYear());
}

/** Pivot long-form revenueByFund rows into rows keyed by bucket with
 *  one column per fund — Recharts BarChart with stackId="a" wants this shape. */
function pivotByFund(rows: Array<{ bucket: string; fund_name: string; revenue: number | string }>, period: Period) {
  const buckets = new Map<string, Record<string, any>>();
  for (const r of rows) {
    const key = r.bucket;
    if (!buckets.has(key)) buckets.set(key, { bucket: key, label: formatBucket(key, period) });
    buckets.get(key)![r.fund_name] = Number(r.revenue);
  }
  return Array.from(buckets.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));
}

/** Unique fund names from the long-form rows, preserving first-seen order. */
function fundsFromData(rows: Array<{ fund_name: string }>): string[] {
  const seen = new Set<string>();
  for (const r of rows) seen.add(r.fund_name);
  return Array.from(seen);
}
