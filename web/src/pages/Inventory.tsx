import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { apiGet, formatMoney, formatShortDate } from '../lib/api.ts';
import { PageHeader, StatusPill, Loading, ErrorBox, EmptyState } from '../components/ui.tsx';

type InvItem = {
  inv_id: number;
  description: string | null;
  item_category: string;
  item_size: string | null;
  item_condition: string | null;
  value: number | null;
  facility_name: string;
  location_code: string | null;
  date_added_to_inventory: string;
  status: string;
};

// Curated filter sets — only the values that matter operationally appear as
// chips. The full lookup table is still available via search.
const STATUS_OPTIONS = ['available', 'reserved', 'out'] as const;
const CATEGORY_OPTIONS = ['Sofa', 'Sectional', 'Bed frame', 'Mattress', 'Dining table', 'Dresser', 'Lamp', 'Kitchen essentials kit'];
const CONDITION_OPTIONS = ['Excellent', 'Good', 'Fair'];
const FACILITY_OPTIONS = ['Bend Warehouse', 'Redmond Storage'];

export function Inventory() {
  const [status, setStatus] = useState<string>('available');
  const [category, setCategory] = useState<string | undefined>();
  const [condition, setCondition] = useState<string | undefined>();
  const [facility, setFacility] = useState<string | undefined>();
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery<InvItem[]>({
    queryKey: ['inventory', status, category, condition, facility, search],
    queryFn: () => apiGet('/api/inventory', { status, category, condition, facility, search }),
  });

  return (
    <>
      <PageHeader
        title="Warehouse"
        emphasis="inventory"
        subtitle="Items on hand across all facilities. Reserve, match to requests, track condition."
        actions={
          <Link to="/inventory/new" className="btn-primary">
            <span className="text-base leading-none">+</span> New item
          </Link>
        }
      />

      <div className="space-y-3 mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <FilterLabel>Status</FilterLabel>
          {STATUS_OPTIONS.map(s => (
            <Chip key={s} active={status === s} onClick={() => setStatus(s)} label={s} />
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <FilterLabel>Category</FilterLabel>
          <Chip active={!category} onClick={() => setCategory(undefined)} label="All" />
          {CATEGORY_OPTIONS.map(c => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)} label={c} />
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <FilterLabel>Condition</FilterLabel>
          <Chip active={!condition} onClick={() => setCondition(undefined)} label="All" />
          {CONDITION_OPTIONS.map(c => (
            <Chip key={c} active={condition === c} onClick={() => setCondition(c)} label={c} />
          ))}
          <span className="mx-2 h-5 w-px bg-hairline" />
          <FilterLabel>Facility</FilterLabel>
          <Chip active={!facility} onClick={() => setFacility(undefined)} label="All" />
          {FACILITY_OPTIONS.map(f => (
            <Chip key={f} active={facility === f} onClick={() => setFacility(f)} label={f} />
          ))}
        </div>
        <div>
          <input
            type="text"
            className="field-input max-w-sm"
            placeholder="Search descriptions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading && <Loading />}
      {error && <ErrorBox error={error} />}
      {data && data.length === 0 && <EmptyState title="No matching items" hint="Try widening the filters." />}

      {data && data.length > 0 && (
        <>
          <div className="text-xs text-ink-faint mb-3">
            Showing <span className="text-ink font-medium">{data.length}</span> item{data.length === 1 ? '' : 's'}
            {' '}· Total value <span className="text-ink font-medium">{formatMoney(data.reduce((sum, i) => sum + Number(i.value ?? 0), 0))}</span>
          </div>

          <div className="grid grid-cols-3 gap-3.5">
            {data.map(it => (
              <Link key={it.inv_id} to={`/inventory/${it.inv_id}`} className="card hover:border-hairline-strong transition cursor-pointer block">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-[11px] text-ink-faint tracking-widest uppercase font-medium">{it.item_category}</div>
                    <div className="font-display font-medium text-base leading-tight mt-0.5">{it.description ?? it.item_category}</div>
                  </div>
                  <StatusPill status={it.status} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-ink-soft mt-3 pt-3 border-t border-hairline">
                  <div>
                    <div className="text-[10px] text-ink-faint uppercase tracking-wider">Condition</div>
                    <div className="text-ink">{it.item_condition ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-ink-faint uppercase tracking-wider">Size</div>
                    <div className="text-ink">{it.item_size ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-ink-faint uppercase tracking-wider">Location</div>
                    <div className="text-ink">{it.location_code ?? it.facility_name}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-ink-faint uppercase tracking-wider">Value</div>
                    <div className="text-ink font-display font-medium">{formatMoney(it.value)}</div>
                  </div>
                </div>

                <div className="text-[10px] text-ink-faint mt-3">Added {formatShortDate(it.date_added_to_inventory)}</div>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] tracking-widest uppercase text-ink-faint font-medium mr-1">{children}</span>;
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'text-xs px-3 py-1 rounded-full border transition capitalize ' +
        (active
          ? 'bg-ink text-paper border-ink'
          : 'bg-paper text-ink-soft border-hairline-strong hover:border-ink')
      }
    >
      {label}
    </button>
  );
}
