/**
 * Impact Data — recipient/community-impact snapshot, mirroring the ED's
 * "2026 Summary" workbook tab. Single-window modes (Daily/Monthly/Yearly)
 * show KPIs + breakdowns; the two trend modes (Monthly trend = this year's
 * months, Annual trend = last six years) show a metrics × periods table.
 *
 * Backed by /api/reports/impact.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api.ts';
import { PageHeader, Loading, ErrorBox } from '../components/ui.tsx';
import { ExportMenu } from '../components/ExportMenu.tsx';
import {
  PeriodToggle, StatTile, TrendTable, BreakdownList, type ReportPeriod,
} from '../components/reportUi.tsx';

interface ImpactSingle {
  mode: 'single';
  period: string;
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
  demographicsEntered: number;
  volunteerHours: { total: number; byTeam: Array<{ team: string; hours: number }> };
  byCity: Array<{ city: string | null; households: number }>;
  situations: Array<{ situation: string; households: number }>;
  byAgency: Array<{ agency_name: string; households: number }>;
  itemCategories: Array<{ category: string; count: number }>;
  bedding: { bedding: number; frame: number; mattress: number; boxspring: number };
}
interface ImpactTrend {
  mode: 'monthly_trend' | 'annual_trend';
  buckets: Array<{
    label: string;
    households: number;
    deliveries: number;
    warehouse_pickups: number;
    guest_selection_appointments: number;
    partnering_agency_requests: number;
    children: number;
    female_adults: number;
    male_adults: number;
    total_individuals: number;
    volunteer_hours: number;
  }>;
}
type ImpactResp = ImpactSingle | ImpactTrend;

const hrs = (n: number) => (Math.round(n * 10) / 10).toLocaleString();

export function ImpactData() {
  const [period, setPeriod] = useState<ReportPeriod>('monthly');

  const { data, isLoading, error } = useQuery<ImpactResp>({
    queryKey: ['impact', period],
    queryFn: () => apiGet('/api/reports/impact', { period }),
  });

  return (
    <>
      <PageHeader
        title="Impact Data"
        emphasis="& recipient reach"
        subtitle="How many households, from which places, of which situations, and what we delivered."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <PeriodToggle period={period} onChange={setPeriod} />
            <ExportMenu report="impact" params={{ period }} />
          </div>
        }
      />

      {isLoading && !data && <Loading />}
      {error && <ErrorBox error={error} />}

      {/* ---- Trend view ---- */}
      {data && data.mode !== 'single' && (
        <TrendTable
          buckets={data.buckets}
          caption={data.mode === 'monthly_trend' ? 'Each column is a month of the current year.' : 'Each column is a calendar year.'}
          metrics={[
            { key: 'households', label: 'Households' },
            { key: 'deliveries', label: 'Deliveries' },
            { key: 'warehouse_pickups', label: 'Warehouse pickups' },
            { key: 'guest_selection_appointments', label: 'Guest selection appts' },
            { key: 'partnering_agency_requests', label: 'Agency requests' },
            { key: 'children', label: 'Children' },
            { key: 'female_adults', label: 'Female adults' },
            { key: 'male_adults', label: 'Male adults' },
            { key: 'total_individuals', label: 'Total individuals' },
            { key: 'volunteer_hours', label: 'Volunteer hours', fmt: hrs },
          ]}
        />
      )}

      {/* ---- Single-window view ---- */}
      {data && data.mode === 'single' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            <StatTile label="Households" value={data.kpis.households} />
            <StatTile label="Deliveries" value={data.kpis.deliveries} />
            <StatTile label="Warehouse pickups" value={data.kpis.warehouse_pickups} />
            <StatTile label="Guest selection appointments" value={data.kpis.guest_selection_appointments} />
            <StatTile label="Agency requests" value={data.kpis.partnering_agency_requests} />
          </div>

          {/* Demographics — real values once entered, else an inline hint. */}
          {data.demographicsEntered > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatTile label="Children" value={data.kpis.children ?? 0} />
              <StatTile label="Female adults" value={data.kpis.female_adults ?? 0} />
              <StatTile label="Male adults" value={data.kpis.male_adults ?? 0} />
              <StatTile label="Total individuals" value={data.kpis.total_individuals ?? 0} />
            </div>
          ) : (
            <div className="card mb-6">
              <div className="flex items-start gap-3">
                <div className="text-lg">ⓘ</div>
                <div>
                  <div className="font-medium text-sm">Individuals served — enter to populate</div>
                  <div className="text-xs text-ink-soft mt-1">
                    Children, female adults, and male adults are now tracked per provisioning request. Enter the
                    counts on a request under Database Admin → Provisioning requests and this section fills in
                    automatically for the selected period.
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <BreakdownList
              title="Volunteer hours by team"
              subtitle="Logged volunteer/staff hours by activity team"
              rows={data.volunteerHours.byTeam.map(t => ({ label: t.team, value: t.hours }))}
              valueFmt={n => hrs(n) + ' hrs'}
              emptyText="No volunteer hours logged in this period."
            />
            <BreakdownList
              title="Households by city"
              subtitle="Where the households live"
              rows={data.byCity.map(r => ({ label: r.city || '(no city recorded)', value: r.households }))}
              emptyText="No deliveries in this period."
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <BreakdownList
              title="Situation"
              subtitle="A household can appear in multiple rows if it's multi-typed"
              rows={data.situations.map(r => ({ label: r.situation, value: r.households }))}
              emptyText="No deliveries in this period."
            />
            <BreakdownList
              title="Households by referring agency"
              subtitle="Direct / walk-in = no referral on file"
              rows={data.byAgency.map(r => ({ label: r.agency_name, value: r.households }))}
              emptyText="No deliveries in this period."
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BreakdownList
              title="Bedding roll-up"
              subtitle="Twin / Full / Queen / King subtotals combined"
              rows={[
                { label: 'Bedding sets', value: data.bedding.bedding },
                { label: 'Frames', value: data.bedding.frame },
                { label: 'Mattresses', value: data.bedding.mattress },
                { label: 'Boxsprings', value: data.bedding.boxspring },
              ]}
              emptyText="No bedding items delivered this period."
            />
            <BreakdownList
              title="Items delivered"
              subtitle="Total quantity per item category"
              rows={data.itemCategories.map(r => ({ label: r.category, value: r.count }))}
              emptyText="Nothing delivered in this period."
            />
          </div>
        </>
      )}
    </>
  );
}
