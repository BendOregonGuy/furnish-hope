/**
 * Value of Goods (Overview) — the economic-impact report. Fair-market value of
 * furniture and household goods delivered to families, using the standardized
 * per-category value rate card (by year). Backed by /api/reports/valuation.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet, formatMoney } from '../lib/api.ts';
import { PageHeader, Loading, ErrorBox } from '../components/ui.tsx';
import { ExportMenu } from '../components/ExportMenu.tsx';
import { PeriodToggle, StatTile, TrendTable, BreakdownList, type ReportPeriod } from '../components/reportUi.tsx';

interface ValuationSingle {
  mode: 'single';
  period: string;
  year: number;
  total_value: number;
  items: number;
  byCategory: Array<{ category: string; items: number; value: number }>;
}
interface ValuationTrend {
  mode: 'monthly_trend' | 'annual_trend';
  buckets: Array<{ label: string; items: number; value: number }>;
}
type ValuationResp = ValuationSingle | ValuationTrend;

export function ValueOfGoods() {
  const [period, setPeriod] = useState<ReportPeriod>('yearly');
  const { data, isLoading, error } = useQuery<ValuationResp>({
    queryKey: ['valuation', period],
    queryFn: () => apiGet('/api/reports/valuation', { period }),
  });

  return (
    <>
      <PageHeader
        title="Value of"
        emphasis="goods provided"
        subtitle="Fair-market value of furniture and household goods delivered to families, from the standardized rate card."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <PeriodToggle period={period} onChange={setPeriod} />
            <ExportMenu report="valuation" params={{ period }} />
          </div>
        }
      />

      {isLoading && !data && <Loading />}
      {error && <ErrorBox error={error} />}

      {data && data.mode === 'single' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <StatTile label="Value delivered" value={formatMoney(data.total_value)} />
            <StatTile label="Items delivered" value={data.items} />
            <StatTile label="Rate-card year" value={String(data.year)} />
          </div>
          <BreakdownList
            title="Value by category"
            subtitle="Standardized value of goods delivered"
            rows={data.byCategory.map(c => ({ label: c.category, value: Math.round(c.value) }))}
            valueFmt={n => formatMoney(n)}
            emptyText="Nothing delivered in this period."
          />
          <div className="text-[11px] text-ink-faint italic mt-4 max-w-3xl">
            Standardized per-item values by year are stored in the Item category value rate card and can be adjusted under Database Admin.
          </div>
        </>
      )}

      {data && data.mode !== 'single' && (
        <TrendTable
          buckets={data.buckets}
          caption="Value of goods delivered per period"
          metrics={[
            { key: 'items', label: 'Items delivered' },
            { key: 'value', label: 'Value ($)', fmt: n => formatMoney(n) },
          ]}
        />
      )}
    </>
  );
}
