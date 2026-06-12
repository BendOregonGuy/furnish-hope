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
