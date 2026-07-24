/**
 * Export bundles for the Overview reports (Landfill Diversion, Value of Goods,
 * and the Impact trend views). These reuse the verified data builders in
 * communityImpact.ts and map them into the format-agnostic ExportBundle shape
 * that the PDF / XLSX / DOCX writers consume — no duplicated SQL.
 */

import { periodLabel, type ExportBundle, type TableSection, type Column } from './bundle.js';
import {
  getLandfill, getValuation, getImpactTrend,
  type ReportPeriod, type TrendMode, type SinglePeriod,
} from './communityImpact.js';

const today = () => new Date().toISOString().slice(0, 10);

const fmtNum = (n: number) => Math.round(n).toLocaleString('en-US');
const fmtMoney = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
const fmtHours = (n: number) => (Math.round(n * 10) / 10).toLocaleString('en-US');

function periodMeta(period: ReportPeriod): { label: string; windowLabel: string } {
  if (period === 'monthly_trend') return { label: 'Monthly trend', windowLabel: 'By month, current year' };
  if (period === 'annual_trend') return { label: 'Annual trend', windowLabel: 'By year, last six years' };
  return { label: period[0].toUpperCase() + period.slice(1), windowLabel: periodLabel(period as SinglePeriod) };
}

interface TrendMetricDef { label: string; values: number[]; fmt: (n: number) => string }

/** Build a metric-rows × period-columns table (matches the on-screen trend
 *  view). Cells are pre-formatted strings so each metric can carry its own
 *  units even though a column's format is shared. */
function trendTable(title: string, subtitle: string | undefined, labels: string[], metrics: TrendMetricDef[]): TableSection {
  const columns: Column[] = [
    { key: 'metric', label: 'Metric' },
    ...labels.map((l, i) => ({ key: `b${i}`, label: l, align: 'right' as const })),
    { key: 'total', label: 'Total', align: 'right' as const },
  ];
  const rows = metrics.map(m => {
    const row: Record<string, string | number | null> = { metric: m.label };
    let total = 0;
    m.values.forEach((v, i) => { row[`b${i}`] = m.fmt(v); total += v; });
    row['total'] = m.fmt(total);
    return row;
  });
  return { kind: 'table', title, subtitle, columns, rows };
}

function baseBundle(title: string, reportKey: string, period: ReportPeriod, sections: ExportBundle['sections']): ExportBundle {
  const { label, windowLabel } = periodMeta(period);
  return {
    title,
    subtitle: `${title} — ${windowLabel}`,
    filenameBase: `${reportKey}-${period}-${today()}`,
    headerMeta: [
      { label: 'Period', value: label },
      { label: 'Window', value: windowLabel },
    ],
    sections,
  };
}

/* ------------------------- Landfill ------------------------- */

export async function buildLandfillBundle(period: ReportPeriod): Promise<ExportBundle> {
  const data = await getLandfill(period);
  if (data.mode !== 'single') {
    const labels = data.buckets.map(b => b.label);
    return baseBundle('Landfill Diversion', 'landfill', period, [
      trendTable('Landfill diverted per period', 'Items, weight, and volume kept out of the landfill', labels, [
        { label: 'Items diverted', values: data.buckets.map(b => b.items), fmt: fmtNum },
        { label: 'Pounds (lbs)', values: data.buckets.map(b => b.lbs), fmt: fmtNum },
        { label: 'Volume (cu ft)', values: data.buckets.map(b => b.cuft), fmt: fmtNum },
      ]),
    ]);
  }
  return baseBundle('Landfill Diversion', 'landfill', period, [
    {
      kind: 'kpi',
      title: 'Diverted from landfill',
      items: [
        { label: 'Items diverted', value: data.totals.items },
        { label: 'Pounds (lbs)', value: fmtNum(data.totals.lbs) },
        { label: 'Volume (cu ft)', value: fmtNum(data.totals.cuft) },
      ],
    },
    {
      kind: 'table',
      title: 'Weight & volume by category',
      columns: [
        { key: 'category', label: 'Category' },
        { key: 'items', label: 'Items', align: 'right', format: 'number' },
        { key: 'lbs', label: 'Pounds (lbs)', align: 'right', format: 'number' },
        { key: 'cuft', label: 'Volume (cu ft)', align: 'right', format: 'number' },
      ],
      rows: data.byCategory.map(c => ({ category: c.category, items: c.items, lbs: Math.round(c.lbs), cuft: Math.round(c.cuft) })),
      totalRow: {
        category: 'Total',
        items: data.totals.items,
        lbs: Math.round(data.totals.lbs),
        cuft: Math.round(data.totals.cuft),
      },
    },
  ]);
}

/* ------------------------- Valuation ------------------------- */

export async function buildValuationBundle(period: ReportPeriod): Promise<ExportBundle> {
  const data = await getValuation(period);
  if (data.mode !== 'single') {
    const labels = data.buckets.map(b => b.label);
    return baseBundle('Value of Goods Provided', 'valuation', period, [
      trendTable('Value of goods delivered per period', 'Standardized rate-card value', labels, [
        { label: 'Items delivered', values: data.buckets.map(b => b.items), fmt: fmtNum },
        { label: 'Value ($)', values: data.buckets.map(b => b.value), fmt: fmtMoney },
      ]),
    ]);
  }
  return baseBundle('Value of Goods Provided', 'valuation', period, [
    {
      kind: 'kpi',
      title: 'Value delivered',
      items: [
        { label: 'Value delivered', value: fmtMoney(data.total_value) },
        { label: 'Items delivered', value: data.items },
        { label: 'Rate-card year', value: String(data.year) },
      ],
    },
    {
      kind: 'table',
      title: 'Value by category',
      subtitle: 'Standardized value of goods delivered',
      columns: [
        { key: 'category', label: 'Category' },
        { key: 'items', label: 'Items', align: 'right', format: 'number' },
        { key: 'value', label: 'Value', align: 'right', format: 'money' },
      ],
      rows: data.byCategory.map(c => ({ category: c.category, items: c.items, value: Math.round(c.value) })),
      totalRow: { category: 'Total', items: data.items, value: Math.round(data.total_value) },
    },
  ]);
}

/* ------------------------- Impact trend ------------------------- */

export async function buildImpactTrendBundle(mode: TrendMode): Promise<ExportBundle> {
  const data = await getImpactTrend(mode);
  const labels = data.buckets.map(b => b.label);
  const col = (key: keyof (typeof data.buckets)[number]) => data.buckets.map(b => Number(b[key]) || 0);
  return baseBundle('Impact Data', 'impact', mode, [
    trendTable('Recipient reach per period', undefined, labels, [
      { label: 'Households', values: col('households'), fmt: fmtNum },
      { label: 'Deliveries', values: col('deliveries'), fmt: fmtNum },
      { label: 'Warehouse pickups', values: col('warehouse_pickups'), fmt: fmtNum },
      { label: 'Guest selection appts', values: col('guest_selection_appointments'), fmt: fmtNum },
      { label: 'Agency requests', values: col('partnering_agency_requests'), fmt: fmtNum },
      { label: 'Children', values: col('children'), fmt: fmtNum },
      { label: 'Female adults', values: col('female_adults'), fmt: fmtNum },
      { label: 'Male adults', values: col('male_adults'), fmt: fmtNum },
      { label: 'Total individuals', values: col('total_individuals'), fmt: fmtNum },
      { label: 'Volunteer hours', values: col('volunteer_hours'), fmt: fmtHours },
    ]),
  ]);
}
