/**
 * Landfill Diversion (Overview) — the environmental-impact report. Weight and
 * volume of furniture kept out of the landfill by placing it with families,
 * computed from delivered items × per-category average weight/volume
 * (editable in the item-category admin table). Backed by /api/reports/landfill.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api.ts';
import { PageHeader, Loading, ErrorBox } from '../components/ui.tsx';
import { ExportMenu } from '../components/ExportMenu.tsx';
import { PeriodToggle, StatTile, TrendTable, BreakdownList, type ReportPeriod } from '../components/reportUi.tsx';

interface LandfillSingle {
  mode: 'single';
  period: string;
  totals: { items: number; lbs: number; cuft: number };
  byCategory: Array<{ category: string; items: number; lbs: number; cuft: number }>;
}
interface LandfillTrend {
  mode: 'monthly_trend' | 'annual_trend';
  buckets: Array<{ label: string; items: number; lbs: number; cuft: number }>;
}
type LandfillResp = LandfillSingle | LandfillTrend;

const lbs = (n: number) => Math.round(n).toLocaleString() + ' lbs';
const cuft = (n: number) => Math.round(n).toLocaleString() + ' cu ft';

export function LandfillDiversion() {
  const [period, setPeriod] = useState<ReportPeriod>('yearly');
  const { data, isLoading, error } = useQuery<LandfillResp>({
    queryKey: ['landfill', period],
    queryFn: () => apiGet('/api/reports/landfill', { period }),
  });

  return (
    <>
      <PageHeader
        title="Landfill"
        emphasis="diversion"
        subtitle="Furniture kept out of the landfill by placing it with families — measured by weight and volume."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <PeriodToggle period={period} onChange={setPeriod} />
            <ExportMenu report="landfill" params={{ period }} />
          </div>
        }
      />

      {isLoading && !data && <Loading />}
      {error && <ErrorBox error={error} />}

      {data && data.mode === 'single' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <StatTile label="Items diverted" value={data.totals.items} />
            <StatTile label="Kept from landfill" value={lbs(data.totals.lbs)} />
            <StatTile label="Volume diverted" value={cuft(data.totals.cuft)} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BreakdownList
              title="Weight by category"
              subtitle="Pounds diverted"
              rows={data.byCategory.map(c => ({ label: c.category, value: Math.round(c.lbs) }))}
              valueFmt={n => n.toLocaleString() + ' lbs'}
              emptyText="Nothing delivered in this period."
            />
            <BreakdownList
              title="Volume by category"
              subtitle="Cubic feet diverted"
              rows={data.byCategory.map(c => ({ label: c.category, value: Math.round(c.cuft) }))}
              valueFmt={n => n.toLocaleString() + ' cu ft'}
              emptyText="Nothing delivered in this period."
            />
          </div>
          <div className="text-[11px] text-ink-faint italic mt-4 max-w-3xl">
            Per-item weight and volume estimates live on each item category and can be adjusted under Database Admin → Item categories.
          </div>
        </>
      )}

      {data && data.mode !== 'single' && (
        <TrendTable
          buckets={data.buckets}
          caption="Landfill diverted per period"
          metrics={[
            { key: 'items', label: 'Items diverted' },
            { key: 'lbs', label: 'Pounds (lbs)', fmt: n => Math.round(n).toLocaleString() },
            { key: 'cuft', label: 'Volume (cu ft)', fmt: n => Math.round(n).toLocaleString() },
          ]}
        />
      )}
    </>
  );
}
