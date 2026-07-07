/**
 * Public /referring-agencies page. Anonymous marketing-style listing of
 * every agency Furnish Hope has approved as a referring partner. Anyone
 * with the URL can view it; no login required.
 *
 * Powered by GET /api/public/agencies which filters is_approved=true and
 * only exposes public-safe fields (name, description, service area,
 * website, populations). Sensitive applicant-only data (EIN, main_email,
 * ED name, address detail, monthly volume) is never included in the
 * response.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api.ts';
import { Loading, ErrorBox } from '../components/ui.tsx';

interface OrgInfo { org_name: string }
interface AgencyRow {
  agency_id: number;
  agency_name: string;
  public_description: string | null;
  service_area: string | null;
  website: string | null;
  client_types: string[];
}

export function ReferringAgencies() {
  const { data: org } = useQuery<OrgInfo>({
    queryKey: ['org-info-public'],
    queryFn: () => fetch('/api/org-info').then(r => r.ok ? r.json() : { org_name: 'Furnish Hope' }),
    retry: false,
  });
  const { data: agencies, isLoading, error } = useQuery<AgencyRow[]>({
    queryKey: ['public-agencies'],
    queryFn: () => apiGet('/api/public/agencies'),
  });

  const [filter, setFilter] = useState<string>('');

  // All population labels across every approved agency, deduped.
  const allPopulations = useMemo(() => {
    const s = new Set<string>();
    for (const a of agencies ?? []) for (const t of a.client_types) s.add(t);
    return Array.from(s).sort();
  }, [agencies]);

  const visible = useMemo(() => {
    if (!agencies) return [];
    if (!filter) return agencies;
    return agencies.filter(a => a.client_types.includes(filter));
  }, [agencies, filter]);

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <header className="mb-8">
          <h1 className="font-display text-3xl font-medium m-0">Our referring partners</h1>
          <p className="text-ink-soft mt-2 max-w-2xl">
            The partner agencies below refer households to {org?.org_name ?? 'Furnish Hope'} for
            furniture support. If your family is working with a caseworker at one
            of these agencies, ask them about a Furnish Hope referral.
          </p>
          <p className="text-ink-soft mt-1 text-sm">
            Are you a nonprofit that isn't listed here? <Link to="/apply-to-refer" className="text-terracotta hover:underline">Apply to refer households →</Link>
          </p>
        </header>

        {allPopulations.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-ink-faint font-medium">Filter by population:</span>
            <button
              onClick={() => setFilter('')}
              className={
                'px-3 py-1 text-xs rounded-full ' +
                (filter === '' ? 'bg-terracotta text-paper' : 'bg-cream text-ink-soft hover:bg-cream-deep')
              }
            >
              All ({agencies?.length ?? 0})
            </button>
            {allPopulations.map(p => (
              <button
                key={p}
                onClick={() => setFilter(f => f === p ? '' : p)}
                className={
                  'px-3 py-1 text-xs rounded-full ' +
                  (filter === p ? 'bg-terracotta text-paper' : 'bg-cream text-ink-soft hover:bg-cream-deep')
                }
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {visible.length === 0 ? (
          <div className="card text-center py-12 text-ink-faint">
            <div className="text-sm">
              {filter ? `No approved agencies serving ${filter}.` : 'No approved agencies yet.'}
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {visible.map(a => (
              <li key={a.agency_id} className="card flex flex-col">
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <div className="font-display font-medium text-lg leading-tight">{a.agency_name}</div>
                </div>
                {a.public_description && (
                  <p className="text-sm text-ink-soft mb-3">{a.public_description}</p>
                )}
                {a.service_area && (
                  <div className="text-xs text-ink-soft mb-3">
                    <span className="text-ink-faint">Service area:</span> {a.service_area}
                  </div>
                )}
                {a.client_types.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {a.client_types.map(t => (
                      <span key={t} className="pill pill-terra text-[10px]">{t}</span>
                    ))}
                  </div>
                )}
                {a.website && (
                  <a
                    href={normalizeUrl(a.website)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-auto text-sm text-terracotta hover:underline break-all"
                  >
                    Visit website →
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** The `website` column stores free-text — normalize to a valid href so
 *  raw hostnames ("agency.org") open correctly instead of resolving
 *  relative to the current page. */
function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
