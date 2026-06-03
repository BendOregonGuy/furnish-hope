/**
 * Admin storage dashboard. Shows where attachments currently live,
 * how much space they're using, and provides the scaffolding for
 * future migration to object storage (DO Spaces, S3, Drive).
 *
 * The actual migration code is intentionally not yet wired — that's
 * Phase 2 work after a remote provider is configured. This page
 * exists today so admins can:
 *   - See current storage usage at a glance
 *   - Browse known provider options
 *   - Get clear instructions on what migration will involve
 */

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api.ts';
import { PageHeader, Loading, ErrorBox } from '../../components/ui.tsx';

interface StatsResponse {
  totals: { count: number; total_bytes: number };
  byProvider: Array<{ storage_provider: string; count: number; total_bytes: number }>;
  byEntity:   Array<{ entity_type: string; count: number; total_bytes: number }>;
}

interface ProvidersResponse {
  providers: Array<{ name: string; configured: boolean; description: string }>;
}

export function AdminAttachmentStorage() {
  const { data: stats, isLoading: l1, error: e1 } = useQuery<StatsResponse>({
    queryKey: ['attachments', 'stats'],
    queryFn: () => apiGet('/api/attachments/stats'),
  });
  const { data: providers, isLoading: l2, error: e2 } = useQuery<ProvidersResponse>({
    queryKey: ['attachments', 'providers'],
    queryFn: () => apiGet('/api/attachments/providers'),
  });

  if (l1 || l2) return <Loading />;
  if (e1) return <ErrorBox error={e1} />;
  if (e2) return <ErrorBox error={e2} />;
  if (!stats || !providers) return null;

  return (
    <>
      <PageHeader
        title="Attachment"
        emphasis="storage"
        subtitle="Where document attachments live, how much they're using, and what's available for future migration to hosted storage."
      />

      {/* Totals */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Stat label="Total files"     value={stats.totals.count.toLocaleString()} />
        <Stat label="Total size"      value={formatBytes(stats.totals.total_bytes)} />
        <Stat label="Active provider" value={stats.byProvider[0]?.storage_provider ?? '—'} />
      </div>

      {/* By provider */}
      <div className="card mb-5">
        <div className="card-head">
          <h3 className="font-display font-medium text-[17px] m-0">Storage providers</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-widest text-ink-faint">
            <tr className="border-b border-hairline">
              <th className="text-left py-2 pr-3 font-medium">Provider</th>
              <th className="text-left py-2 pr-3 font-medium">Status</th>
              <th className="text-right py-2 pr-3 font-medium">Files</th>
              <th className="text-right py-2 pr-3 font-medium">Size</th>
              <th className="w-32"></th>
            </tr>
          </thead>
          <tbody>
            {providers.providers.map(p => {
              const usage = stats.byProvider.find(s => s.storage_provider === p.name);
              return (
                <tr key={p.name} className="border-b border-hairline/60">
                  <td className="py-2.5 pr-3">
                    <div className="font-medium font-mono">{p.name}</div>
                    <div className="text-[11px] text-ink-faint">{p.description}</div>
                  </td>
                  <td className="py-2.5 pr-3">
                    {p.configured
                      ? <span className="pill pill-sage">Configured</span>
                      : <span className="pill pill-muted">Not set up</span>}
                  </td>
                  <td className="py-2.5 pr-3 text-right">{usage?.count.toLocaleString() ?? '—'}</td>
                  <td className="py-2.5 pr-3 text-right">{usage ? formatBytes(usage.total_bytes) : '—'}</td>
                  <td className="py-2.5 pr-3 text-right">
                    <button
                      disabled
                      className="text-xs text-ink-faint border border-hairline px-2 py-1 rounded opacity-50 cursor-not-allowed"
                      title="Migration tooling lands in Phase 2 once a remote provider is configured"
                    >
                      Migrate →
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* By entity */}
      <div className="card mb-5">
        <div className="card-head">
          <h3 className="font-display font-medium text-[17px] m-0">Usage by entity</h3>
        </div>
        {stats.byEntity.length === 0 ? (
          <div className="text-sm text-ink-faint italic py-3">No attachments yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-ink-faint">
              <tr className="border-b border-hairline">
                <th className="text-left py-2 pr-3 font-medium">Entity type</th>
                <th className="text-right py-2 pr-3 font-medium">Files</th>
                <th className="text-right py-2 pr-3 font-medium">Size</th>
              </tr>
            </thead>
            <tbody>
              {stats.byEntity.map(e => (
                <tr key={e.entity_type} className="border-b border-hairline/60">
                  <td className="py-2 pr-3 font-mono text-[12px]">{e.entity_type}</td>
                  <td className="py-2 pr-3 text-right">{e.count.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-right">{formatBytes(e.total_bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Migration guide */}
      <div className="card">
        <div className="card-head">
          <h3 className="font-display font-medium text-[17px] m-0">Future migration</h3>
        </div>
        <div className="text-sm text-ink-soft space-y-2.5 leading-relaxed">
          <p>
            Phase 1 stores files in <code className="font-mono bg-cream px-1.5 py-0.5 rounded text-xs">pg_blob</code> —
            BYTEA columns in the same Postgres database as everything else. This works
            indefinitely for a small org but gets expensive as files accumulate
            (every <code className="font-mono">pg_dump</code> includes them).
          </p>
          <p>
            When you're ready to move to object storage, the migration involves:
          </p>
          <ol className="list-decimal ml-6 space-y-1 text-[13px]">
            <li>Pick a provider (DO Spaces is cheapest at ~$5/mo for 250 GB; S3 also supported)</li>
            <li>Set up a bucket + access keys, add them as env vars on DigitalOcean</li>
            <li>Implement the provider in <code className="font-mono">api/src/storage/</code> — the abstraction layer is already there, so it's ~100 lines per provider</li>
            <li>The "Migrate →" buttons above wake up — clicking one streams each blob from pg_blob to the new provider, updates the metadata row, then deletes the blob from Postgres</li>
            <li>Set <code className="font-mono">attachment_storage_provider</code> in Settings so new uploads land in the new place</li>
          </ol>
          <p className="text-[12px] text-ink-faint">
            The schema is already provider-agnostic — each attachment row stores
            <code className="font-mono"> storage_provider</code> and <code className="font-mono">storage_ref</code>.
            Files can live in two providers at once during a migration; rollback is just flipping the default back.
          </p>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="text-[10px] tracking-widest uppercase text-ink-faint font-medium">{label}</div>
      <div className="font-display text-2xl font-medium mt-1">{value}</div>
    </div>
  );
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
