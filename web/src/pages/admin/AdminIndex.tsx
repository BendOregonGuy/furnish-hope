/**
 * Admin landing page — shows every table grouped by domain. Click a table
 * to drill into its list view.
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchSchema, type AdminSchema } from '../../lib/admin.ts';
import { PageHeader, Loading, ErrorBox } from '../../components/ui.tsx';

export function AdminIndex() {
  const { data, isLoading, error } = useQuery<AdminSchema>({
    queryKey: ['admin', 'schema'],
    queryFn: fetchSchema,
  });

  return (
    <>
      <PageHeader
        helpSection="admin-database"
        title="Database"
        emphasis="admin"
        subtitle="Browse, add, edit, and remove records across every table. Be careful — changes are immediate."
        actions={
          <a
            href="/api/admin/erd"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-ink-soft hover:text-terracotta border border-hairline-strong px-3 py-1.5 rounded-md hover:border-terracotta inline-flex items-center gap-1.5"
            title="Open the entity-relationship PDF — one page per theme, every table with PKs and FKs."
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            View ERD (PDF)
          </a>
        }
      />

      {isLoading && <Loading />}
      {error && <ErrorBox error={error} />}

      {data && (
        <div className="space-y-7">
          {data.groups.map(group => (
            <section key={group.name}>
              <h2 className="font-display text-lg mb-3 text-ink-soft">{group.name}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.tables.map(t => (
                  <Link
                    key={t.table}
                    to={`/admin/${t.table}`}
                    className="card hover:border-terracotta hover:shadow-soft transition group block"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-medium text-ink group-hover:text-terracotta">{t.label}</div>
                      <div className="text-[10px] tracking-widest uppercase text-ink-faint font-mono">{t.table}</div>
                    </div>
                    {t.description && (
                      <div className="text-xs text-ink-soft mt-1.5 leading-snug">{t.description}</div>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
