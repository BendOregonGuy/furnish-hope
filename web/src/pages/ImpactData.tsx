/**
 * Impact Data — recipient-facing community-impact snapshot. Mirrors the
 * "Monthly Impact Data" spreadsheet the ED sends out. Everything on the
 * page is scoped by the same time-window toggle (Daily / Monthly /
 * Yearly), so all sections cross-tie to the same period.
 *
 * Backed by /api/reports/impact — one round-trip, all sections.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api.ts';
import { PageHeader, Loading, ErrorBox } from '../components/ui.tsx';
import { ExportMenu } from '../components/ExportMenu.tsx';

type Period = 'daily' | 'monthly' | 'yearly';

interface ImpactResponse {
  period: Period;
  kpis: {
    households: number;
    deliveries: number;
    warehouse_pickups: number;
    guest_selection_appointments: number;
    partnering_agency_requests: number;
    children: number | null;
    female_adults: number | null;
    male_adults: number | null;
    total_individuals: number | null;
  };
  byCity:         Array<{ city: string | null;         households: number }>;
  situations:     Array<{ situation: string;           households: number }>;
  byAgency:       Array<{ agency_name: string;         households: number }>;
  itemCategories: Array<{ category: string;            count: number }>;
  bedding: {
    bedding:   number;
    frame:     number;
    mattress:  number;
    boxspring: number;
  };
}

export function ImpactData() {
  const [period, setPeriod] = useState<Period>('monthly');

  const { data, isLoading, error } = useQuery<ImpactResponse>({
    queryKey: ['impact', period],
    queryFn: () => apiGet('/api/reports/impact', { period }),
  });

  const rangeLabel = period === 'daily'
    ? 'today'
    : period === 'yearly'
      ? new Date().getFullYear().toString()
      : new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <>
      <PageHeader
        title="Impact Data"
        emphasis="& recipient reach"
        subtitle={`How many households, from which places, of which situations, and what we delivered — ${rangeLabel}.`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <PeriodToggle period={period} onChange={setPeriod} />
            <ExportMenu report="impact" params={{ period }} />
          </div>
        }
      />

      {isLoading && !data && <Loading />}
      {error && <ErrorBox error={error} />}

      {data && (
        <>
          {/* ---- Admin summary KPIs ---- */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            <Kpi label="Households"                    value={data.kpis.households} />
            <Kpi label="Deliveries"                    value={data.kpis.deliveries} />
            <Kpi label="Warehouse pickups"             value={data.kpis.warehouse_pickups} />
            <Kpi label="Guest selection appointments"  value={data.kpis.guest_selection_appointments} />
            <Kpi label="Agency requests"               value={data.kpis.partnering_agency_requests} />
          </div>

          {/* ---- Demographics gap notice ---- */}
          <div className="card mb-6 bg-cream-soft/50">
            <div className="flex items-start gap-3">
              <div className="text-lg">ⓘ</div>
              <div>
                <div className="font-medium text-sm">Individuals served — not yet tracked</div>
                <div className="text-xs text-ink-soft mt-1">
                  The spreadsheet template also counts children, female adults, male adults, and total individuals. The database doesn't collect head-of-household demographics today. To surface these, add <code>child_count</code> / <code>adult_female_count</code> / <code>adult_male_count</code> columns to <code>tbl_client_visit</code> or <code>tbl_client</code> and record them at intake — happy to wire it up if you want.
                </div>
              </div>
            </div>
          </div>

          {/* ---- Two-column: cities + situations ---- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <BreakdownCard
              title="Households by city"
              subtitle="Where the households live"
              rows={data.byCity.map(r => ({ label: r.city || '(no city recorded)', value: r.households }))}
              emptyText="No deliveries in this period."
            />
            <BreakdownCard
              title="Situation"
              subtitle="A household can appear in multiple rows if it's multi-typed"
              rows={data.situations.map(r => ({ label: r.situation, value: r.households }))}
              emptyText="No deliveries in this period."
            />
          </div>

          {/* ---- Two-column: agencies + bedding roll-up ---- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <BreakdownCard
              title="Households by referring agency"
              subtitle="Direct / walk-in = no referral on file"
              rows={data.byAgency.map(r => ({ label: r.agency_name, value: r.households }))}
              emptyText="No deliveries in this period."
            />
            <BeddingCard bedding={data.bedding} />
          </div>

          {/* ---- Items delivered ---- */}
          <div className="card p-0 overflow-hidden">
            <div className="card-head px-4">
              <div>
                <h3 className="font-display font-medium text-[17px] m-0">Items delivered</h3>
                <span className="text-[11px] text-ink-faint">Total quantity per item category</span>
              </div>
              <span className="text-[11px] text-ink-faint">{data.itemCategories.length} categories</span>
            </div>
            {data.itemCategories.length === 0 ? (
              <div className="px-4 py-6 text-sm text-ink-faint italic text-center">Nothing delivered in this period.</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-1 p-4">
                {data.itemCategories.map(r => (
                  <div key={r.category} className="flex items-baseline justify-between border-b border-hairline/50 py-1">
                    <span className="text-sm">{r.category}</span>
                    <span className="text-sm font-medium tabular-nums text-terracotta">{r.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

/* -------------------------- KPI card -------------------------- */

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="card text-center">
      <div className="font-display text-3xl font-medium text-terracotta tabular-nums">{value.toLocaleString()}</div>
      <div className="text-[10px] uppercase tracking-widest text-ink-faint font-medium mt-1 leading-tight">{label}</div>
    </div>
  );
}

/* -------------------------- Breakdown card -------------------------- */

interface Row { label: string; value: number }

function BreakdownCard({ title, subtitle, rows, emptyText }: { title: string; subtitle: string; rows: Row[]; emptyText: string }) {
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0);
  return (
    <div className="card p-0 overflow-hidden">
      <div className="card-head px-4">
        <div>
          <h3 className="font-display font-medium text-[17px] m-0">{title}</h3>
          <span className="text-[11px] text-ink-faint">{subtitle}</span>
        </div>
        {total > 0 && (
          <span className="text-[11px] text-ink-faint whitespace-nowrap">Total: <strong className="text-ink">{total.toLocaleString()}</strong></span>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-sm text-ink-faint italic text-center">{emptyText}</div>
      ) : (
        <div className="px-4 py-3 space-y-1.5">
          {rows.map((r, i) => {
            const pct = total > 0 ? Math.round((r.value / total) * 100) : 0;
            const barPct = max > 0 ? Math.round((r.value / max) * 100) : 0;
            return (
              <div key={i}>
                <div className="flex items-baseline justify-between text-sm">
                  <span>{r.label}</span>
                  <span className="tabular-nums text-ink-soft"><span className="font-medium text-ink">{r.value.toLocaleString()}</span> <span className="text-[11px]">· {pct}%</span></span>
                </div>
                <div className="h-1.5 bg-cream-soft rounded overflow-hidden">
                  <div className="h-full bg-terracotta/70" style={{ width: `${barPct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* -------------------------- Bedding roll-up -------------------------- */

function BeddingCard({ bedding }: { bedding: ImpactResponse['bedding'] }) {
  const items: Array<[string, number]> = [
    ['Bedding sets', bedding.bedding],
    ['Frames',      bedding.frame],
    ['Mattresses',  bedding.mattress],
    ['Boxsprings',  bedding.boxspring],
  ];
  const total = items.reduce((s, [, v]) => s + v, 0);
  return (
    <div className="card p-0 overflow-hidden">
      <div className="card-head px-4">
        <div>
          <h3 className="font-display font-medium text-[17px] m-0">Bedding roll-up</h3>
          <span className="text-[11px] text-ink-faint">Twin / Full / Queen / King subtotals combined</span>
        </div>
        {total > 0 && (
          <span className="text-[11px] text-ink-faint whitespace-nowrap">Total: <strong className="text-ink">{total.toLocaleString()}</strong></span>
        )}
      </div>
      {total === 0 ? (
        <div className="px-4 py-6 text-sm text-ink-faint italic text-center">No bedding items delivered this period.</div>
      ) : (
        <div className="px-4 py-3 grid grid-cols-2 gap-3">
          {items.map(([label, count]) => (
            <div key={label} className="flex items-baseline justify-between border-b border-hairline/50 py-1">
              <span className="text-sm text-ink-soft">{label}</span>
              <span className="text-lg font-display font-medium text-sage tabular-nums">{count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------- Period toggle -------------------------- */

function PeriodToggle({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const options: Array<{ id: Period; label: string }> = [
    { id: 'daily',   label: 'Daily' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'yearly',  label: 'Yearly' },
  ];
  return (
    <div className="inline-flex rounded border border-hairline overflow-hidden bg-paper">
      {options.map(o => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={
            'px-3 py-1 text-sm ' +
            (period === o.id
              ? 'bg-terracotta text-paper font-medium'
              : 'text-ink-soft hover:bg-cream-soft')
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
