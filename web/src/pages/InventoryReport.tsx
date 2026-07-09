/**
 * Inventory Report — warehouse snapshot rendered from the same
 * ExportBundle the PDF/XLSX/DOCX writers consume. Period + status +
 * sort controls at the top; the page re-fetches when any changes.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api.ts';
import { PageHeader, Loading, ErrorBox } from '../components/ui.tsx';
import { ExportMenu } from '../components/ExportMenu.tsx';

type Period = 'daily' | 'monthly' | 'yearly';
type Status = 'all' | 'in_stock' | 'delivered' | 'received' | 'other';
type Sort   = 'category' | 'warehouse' | 'value' | 'date_added' | 'condition' | 'size';
type Dir    = 'asc' | 'desc';

interface Column {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  format?: 'number' | 'money' | 'text' | 'date';
}
interface TableSection {
  kind: 'table';
  title: string;
  subtitle?: string;
  columns: Column[];
  rows: Array<Record<string, string | number | null>>;
  totalRow?: Record<string, string | number | null>;
}
interface KpiSection {
  kind: 'kpi';
  title: string;
  items: Array<{ label: string; value: string | number; hint?: string }>;
}
type Section = TableSection | KpiSection;
interface Bundle {
  title: string;
  subtitle: string;
  headerMeta: Array<{ label: string; value: string }>;
  sections: Section[];
}

const STATUS_OPTIONS: Array<{ id: Status; label: string }> = [
  { id: 'all',       label: 'All' },
  { id: 'in_stock',  label: 'In stock' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'received',  label: 'Received' },
  { id: 'other',     label: 'Other' },
];

const SORT_OPTIONS: Array<{ id: Sort; label: string }> = [
  { id: 'category',   label: 'Category' },
  { id: 'warehouse',  label: 'Warehouse' },
  { id: 'value',      label: 'Value' },
  { id: 'date_added', label: 'Date received' },
  { id: 'condition',  label: 'Condition' },
  { id: 'size',       label: 'Size' },
];

export function InventoryReport() {
  const [period, setPeriod] = useState<Period>('monthly');
  const [status, setStatus] = useState<Status>('all');
  const [sort,   setSort]   = useState<Sort>('category');
  const [dir,    setDir]    = useState<Dir>('desc');

  const params = { period, status, sort, dir };

  const { data, isLoading, error } = useQuery<Bundle>({
    queryKey: ['inventory-report', params],
    queryFn: () => apiGet('/api/reports/inventory', params),
  });

  return (
    <>
      <PageHeader
        title="Inventory Report"
        emphasis="& warehouse snapshot"
        subtitle={data?.subtitle ?? 'Received / in stock / delivered — sortable, filterable, exportable.'}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <PeriodToggle period={period} onChange={setPeriod} />
            <ExportMenu report="inventory" params={params} />
          </div>
        }
      />

      {/* Filters row */}
      <div className="card mb-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <FilterGroup label="Status">
            <SegBar
              options={STATUS_OPTIONS.map(o => ({ id: o.id, label: o.label }))}
              value={status}
              onChange={v => setStatus(v as Status)}
            />
          </FilterGroup>
          <FilterGroup label="Sort by">
            <SegBar
              options={SORT_OPTIONS.map(o => ({ id: o.id, label: o.label }))}
              value={sort}
              onChange={v => setSort(v as Sort)}
            />
          </FilterGroup>
          <FilterGroup label="Direction">
            <SegBar
              options={[{ id: 'desc', label: 'High → Low' }, { id: 'asc', label: 'Low → High' }]}
              value={dir}
              onChange={v => setDir(v as Dir)}
            />
          </FilterGroup>
        </div>
      </div>

      {isLoading && !data && <Loading />}
      {error && <ErrorBox error={error} />}

      {data && data.sections.map((s, i) => (
        s.kind === 'kpi' ? <KpiCard key={i} section={s} /> : <TableCard key={i} section={s} />
      ))}
    </>
  );
}

/* -------------------------- KPI card -------------------------- */

function KpiCard({ section }: { section: KpiSection }) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6`}>
      {section.items.map(it => (
        <div key={it.label} className="card text-center">
          <div className="font-display text-2xl font-medium text-terracotta tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">
            {String(it.value)}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-ink-faint font-medium mt-1 leading-tight">
            {it.label}
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------- Table card -------------------------- */

function TableCard({ section }: { section: TableSection }) {
  return (
    <div className="card p-0 overflow-hidden mb-4">
      <div className="card-head px-4">
        <div>
          <h3 className="font-display font-medium text-[17px] m-0">{section.title}</h3>
          {section.subtitle && <span className="text-[11px] text-ink-faint">{section.subtitle}</span>}
        </div>
        <span className="text-[11px] text-ink-faint">{section.rows.length} rows</span>
      </div>
      {section.rows.length === 0 ? (
        <div className="px-4 py-6 text-sm text-ink-faint italic text-center">No rows for this filter.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-widest text-ink-faint">
                {section.columns.map(c => (
                  <th
                    key={c.key}
                    className={`px-4 py-2 font-medium ${(c.align ?? (c.format === 'money' || c.format === 'number' ? 'right' : 'left')) === 'right' ? 'text-right' : ''}`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.rows.map((r, i) => (
                <tr key={i} className="border-t border-hairline">
                  {section.columns.map(c => (
                    <td
                      key={c.key}
                      className={`px-4 py-1.5 ${(c.align ?? (c.format === 'money' || c.format === 'number' ? 'right' : 'left')) === 'right' ? 'text-right tabular-nums' : ''}`}
                    >
                      {formatCell(r[c.key], c)}
                    </td>
                  ))}
                </tr>
              ))}
              {section.totalRow && (
                <tr className="border-t-2 border-ink font-medium">
                  {section.columns.map(c => (
                    <td
                      key={c.key}
                      className={`px-4 py-2 ${(c.align ?? (c.format === 'money' || c.format === 'number' ? 'right' : 'left')) === 'right' ? 'text-right tabular-nums' : ''}`}
                    >
                      {formatCell(section.totalRow![c.key], c)}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatCell(raw: string | number | null | undefined, c: Column): string {
  if (raw === null || raw === undefined || raw === '') return '';
  if (c.format === 'money') {
    const n = Number(raw);
    if (isNaN(n)) return String(raw);
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (c.format === 'number') {
    const n = Number(raw);
    if (isNaN(n)) return String(raw);
    return n.toLocaleString();
  }
  if (c.format === 'date') {
    const d = new Date(String(raw));
    if (isNaN(d.getTime())) return String(raw);
    return d.toISOString().slice(0, 10);
  }
  return String(raw);
}

/* -------------------------- Filter widgets -------------------------- */

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-widest text-ink-faint font-medium">{label}</span>
      {children}
    </div>
  );
}

function SegBar<T extends string>({ options, value, onChange }: { options: Array<{ id: T; label: string }>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded border border-hairline overflow-hidden bg-paper text-sm">
      {options.map(o => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={
            'px-3 py-1 ' +
            (value === o.id
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

function PeriodToggle({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const options: Array<{ id: Period; label: string }> = [
    { id: 'daily',   label: 'Daily' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'yearly',  label: 'Yearly' },
  ];
  return <SegBar options={options} value={period} onChange={onChange} />;
}
