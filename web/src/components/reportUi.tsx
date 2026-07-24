/**
 * Shared building blocks for the Overview reports (Impact Data, Landfill
 * Diversion, Value of Goods). Keeps the five-way period toggle, the trend
 * table, stat tiles, and labelled breakdown bars consistent across all three.
 */

export type ReportPeriod = 'daily' | 'monthly' | 'yearly' | 'monthly_trend' | 'annual_trend';

export function isTrendPeriod(p: ReportPeriod): boolean {
  return p === 'monthly_trend' || p === 'annual_trend';
}

export function PeriodToggle({ period, onChange }: { period: ReportPeriod; onChange: (p: ReportPeriod) => void }) {
  const options: Array<{ id: ReportPeriod; label: string }> = [
    { id: 'daily', label: 'Daily' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'yearly', label: 'Yearly' },
    { id: 'monthly_trend', label: 'Monthly trend' },
    { id: 'annual_trend', label: 'Annual trend' },
  ];
  return (
    <div className="inline-flex rounded border border-hairline overflow-hidden bg-paper flex-wrap">
      {options.map(o => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={
            'px-3 py-1 text-sm ' +
            (period === o.id ? 'bg-terracotta text-paper font-medium' : 'text-ink-soft hover:bg-cream-soft')
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card text-center">
      <div className="font-display text-3xl font-medium text-terracotta tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-ink-faint font-medium mt-1 leading-tight">{label}</div>
      {sub && <div className="text-[11px] text-ink-faint mt-1">{sub}</div>}
    </div>
  );
}

export interface TrendMetric {
  key: string;
  label: string;
  fmt?: (n: number) => string;
}

/** Metrics-as-rows × buckets-as-columns table with a Total column. Used for
 *  both monthly (12 columns) and annual (6 columns) trend modes. */
export function TrendTable({
  buckets,
  metrics,
  caption,
}: {
  buckets: Array<Record<string, number | string> & { label: string }>;
  metrics: TrendMetric[];
  caption?: string;
}) {
  return (
    <div className="card p-0 overflow-x-auto">
      {caption && <div className="px-4 pt-3 text-[11px] text-ink-faint">{caption}</div>}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-hairline">
            <th className="text-left font-medium text-ink-faint px-4 py-2 text-[11px] uppercase tracking-wider">Metric</th>
            {buckets.map(b => (
              <th key={b.label} className="text-right font-medium text-ink-faint px-3 py-2 text-[11px]">{b.label}</th>
            ))}
            <th className="text-right font-medium text-ink px-4 py-2 text-[11px] uppercase tracking-wider">Total</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map(m => {
            const vals = buckets.map(b => Number(b[m.key]) || 0);
            const total = vals.reduce((s, v) => s + v, 0);
            const fmt = m.fmt ?? ((n: number) => n.toLocaleString());
            return (
              <tr key={m.key} className="border-b border-hairline/50">
                <td className="px-4 py-1.5 text-ink-soft whitespace-nowrap">{m.label}</td>
                {vals.map((v, i) => (
                  <td key={i} className="px-3 py-1.5 text-right tabular-nums">{v ? fmt(v) : '·'}</td>
                ))}
                <td className="px-4 py-1.5 text-right tabular-nums font-medium text-terracotta">{fmt(total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Labelled rows with a proportional bar. `valueFmt` lets callers append units
 *  ("lbs", "cu ft") or money formatting. */
export function BreakdownList({
  title,
  subtitle,
  rows,
  valueFmt,
  emptyText,
}: {
  title: string;
  subtitle?: string;
  rows: Array<{ label: string; value: number }>;
  valueFmt?: (n: number) => string;
  emptyText?: string;
}) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0);
  const fmt = valueFmt ?? ((n: number) => n.toLocaleString());
  return (
    <div className="card p-0 overflow-hidden">
      <div className="card-head px-4">
        <div>
          <h3 className="font-display font-medium text-[17px] m-0">{title}</h3>
          {subtitle && <span className="text-[11px] text-ink-faint">{subtitle}</span>}
        </div>
        {total > 0 && (
          <span className="text-[11px] text-ink-faint whitespace-nowrap">Total: <strong className="text-ink">{fmt(total)}</strong></span>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-sm text-ink-faint italic text-center">{emptyText ?? 'No data in this period.'}</div>
      ) : (
        <div className="px-4 py-3 space-y-1.5">
          {rows.map((r, i) => {
            const barPct = max > 0 ? Math.round((r.value / max) * 100) : 0;
            return (
              <div key={i}>
                <div className="flex items-baseline justify-between text-sm">
                  <span>{r.label}</span>
                  <span className="tabular-nums font-medium text-ink">{fmt(r.value)}</span>
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
