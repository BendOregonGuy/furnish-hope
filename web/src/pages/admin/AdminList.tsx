/**
 * Generic list view for any admin table. Search, sort by clicking a column
 * header, paginate via prev/next. Click a row to edit it.
 */

import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import { apiGet } from '../../lib/api.ts';
import {
  fetchSchema, formatValue,
  type AdminSchema, type ListResponse, type ColumnMeta,
} from '../../lib/admin.ts';
import { PageHeader, Loading, ErrorBox, EmptyState } from '../../components/ui.tsx';

const PAGE_SIZE = 50;

export function AdminList() {
  const { table } = useParams<{ table: string }>();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ col: string; dir: 'asc' | 'desc' } | null>(null);

  const { data: schema } = useQuery<AdminSchema>({
    queryKey: ['admin', 'schema'],
    queryFn: fetchSchema,
  });
  const meta = schema?.tables.find(t => t.table === table);

  const sortCol = sort?.col ?? meta?.defaultSort.column;
  const sortDir = sort?.dir ?? meta?.defaultSort.direction;

  const { data, isLoading, error } = useQuery<ListResponse>({
    queryKey: ['admin', 'list', table, search, sortCol, sortDir, page],
    queryFn: () => apiGet(`/api/admin/${table}`, {
      search,
      sort: sortCol,
      dir: sortDir,
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    }),
    enabled: !!meta,
  });

  if (!schema || !meta) {
    return <Loading />;
  }

  const listCols = meta.listColumns
    .map(name => meta.columns.find(c => c.name === name))
    .filter((c): c is ColumnMeta => !!c);

  function handleSort(col: ColumnMeta) {
    if (col.isPk || col.type === 'unknown') return;
    setSort(prev => {
      if (prev?.col === col.name) {
        return prev.dir === 'asc'
          ? { col: col.name, dir: 'desc' }
          : null; // unset back to default on third click
      }
      return { col: col.name, dir: 'asc' };
    });
    setPage(0);
  }

  const total = data?.total ?? 0;
  const showingFrom = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const showingTo = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <>
      <PageHeader
        helpSection="admin-database"
        title={meta.label}
        subtitle={meta.description}
        actions={
          <Link to={`/admin/${table}/new`} className="btn-primary">
            <span className="text-base leading-none">+</span> New {meta.singular}
          </Link>
        }
      />

      <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
        <input
          type="text"
          className="field-input max-w-sm"
          placeholder={meta.searchColumns.length ? `Search ${meta.label.toLowerCase()}…` : 'Search not available for this table'}
          disabled={meta.searchColumns.length === 0}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
        />
        <div className="flex items-center gap-2 text-xs text-ink-faint">
          <Link to="/admin" className="hover:text-terracotta">← All tables</Link>
          <span className="text-hairline-strong">•</span>
          <span>{total.toLocaleString()} {total === 1 ? meta.singular.toLowerCase() : meta.label.toLowerCase()}</span>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading && <Loading />}
        {error && <ErrorBox error={error} />}
        {data && data.rows.length === 0 && (
          <EmptyState
            title={`No ${meta.label.toLowerCase()} yet`}
            hint={`Click "New ${meta.singular}" to add the first one.`}
          />
        )}
        {data && data.rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream">
                <tr>
                  {listCols.map(c => (
                    <th
                      key={c.name}
                      onClick={() => handleSort(c)}
                      className={`text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium px-5 py-3 select-none ${c.isPk || c.type === 'unknown' ? '' : 'cursor-pointer hover:text-ink'}`}
                    >
                      {c.label}
                      {sort?.col === c.name && (
                        <span className="ml-1 text-terracotta">{sort.dir === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </th>
                  ))}
                  <th className="px-5 py-3 w-0"></th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map(row => (
                  <tr key={row[meta.pk]} className="border-t border-hairline hover:bg-terracotta/[0.025]">
                    {listCols.map(c => (
                      <td key={c.name} className="px-5 py-3">
                        {c.isPk ? (
                          <Link
                            to={`/admin/${table}/${row[meta.pk]}`}
                            className="font-mono text-xs text-terracotta hover:underline"
                          >
                            #{row[c.name]}
                          </Link>
                        ) : (
                          formatValue(c, row[c.name], data.fkLabels[c.name]?.[String(row[c.name])])
                        )}
                      </td>
                    ))}
                    <td className="px-5 py-3 text-right">
                      <Link
                        to={`/admin/${table}/${row[meta.pk]}`}
                        className="text-xs text-ink-faint hover:text-terracotta"
                      >
                        Edit →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-between text-xs text-ink-faint">
          <span>Showing {showingFrom.toLocaleString()}–{showingTo.toLocaleString()} of {total.toLocaleString()}</span>
          <div className="flex gap-2">
            <button
              className="btn-ghost text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={page === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
            >
              ← Previous
            </button>
            <button
              className="btn-ghost text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={(page + 1) * PAGE_SIZE >= total}
              onClick={() => setPage(p => p + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
