/**
 * Admin → Manual Screenshots: every screenshot slot referenced by
 * the user manuals appears here, grouped by section. Each row shows
 * the slug, description, the URL the screenshot should capture, a
 * thumbnail of the currently-uploaded image (if any), and an Upload
 * / Delete pair.
 *
 * Uploads are base64-encoded and POSTed to
 * PUT /api/manual/screenshots/:slug. Read on render via the cached
 * GET /api/manual/screenshots list.
 */

import { useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPut, formatLongDate } from '../../lib/api.ts';
import { PageHeader, Loading, ErrorBox } from '../../components/ui.tsx';
import { HelpLink } from '../../components/HelpLink.tsx';
import { SCREENSHOT_MANIFEST, type ScreenshotMeta } from '../help/screenshotManifest.ts';

interface UploadedRow {
  slug: string;
  audience: string;
  caption: string | null;
  content_type: string;
  filename: string | null;
  byte_size: number;
  uploaded_at: string;
}

export function ManualScreenshots() {
  const queryClient = useQueryClient();
  const [audience, setAudience] = useState<'all' | 'staff' | 'agency'>('all');

  const { data: uploaded, isLoading, error } = useQuery<UploadedRow[]>({
    queryKey: ['manual', 'screenshots'],
    queryFn: () => apiGet('/api/manual/screenshots'),
  });

  const filtered = useMemo(() => {
    return SCREENSHOT_MANIFEST.filter(m => audience === 'all' || m.audience === audience);
  }, [audience]);

  // Group by section header for the layout.
  const grouped = useMemo(() => {
    const out: Record<string, ScreenshotMeta[]> = {};
    for (const m of filtered) {
      (out[m.group] ??= []).push(m);
    }
    return out;
  }, [filtered]);

  const uploadedBySlug = useMemo(() => {
    const m: Record<string, UploadedRow> = {};
    for (const u of uploaded ?? []) m[u.slug] = u;
    return m;
  }, [uploaded]);

  const totalSlots = filtered.length;
  const filledSlots = filtered.filter(m => uploadedBySlug[m.slug]).length;

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  return (
    <>
      <PageHeader
        title="Manual screenshots"
        subtitle={`Upload an image for each placeholder slot in the User Manual. Filled: ${filledSlots} / ${totalSlots}.`}
        actions={<HelpLink section="admin-manual" />}
      />

      <div className="mb-5 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">Filter</span>
        <div className="flex border border-hairline-strong rounded-md overflow-hidden">
          {(['all', 'staff', 'agency'] as const).map(k => (
            <button
              key={k}
              type="button"
              onClick={() => setAudience(k)}
              className={`px-3 py-1.5 text-xs ${audience === k ? 'bg-terracotta text-paper' : 'bg-paper hover:bg-cream'}`}
            >
              {k === 'all' ? 'All' : k === 'staff' ? 'Staff manual' : 'Caseworker manual'}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-ink-faint">
          Open the URL in a new tab, take the screenshot, anonymize, then upload.
        </span>
      </div>

      <div className="space-y-7">
        {Object.entries(grouped).map(([group, slots]) => (
          <div key={group}>
            <h3 className="font-display font-medium text-base text-ink mb-3 pb-1 border-b border-hairline">
              {group} <span className="text-xs text-ink-faint font-normal font-sans">({slots.length})</span>
            </h3>
            <div className="space-y-2">
              {slots.map(m => (
                <SlotRow
                  key={m.slug}
                  meta={m}
                  uploaded={uploadedBySlug[m.slug] ?? null}
                  onChange={() => queryClient.invalidateQueries({ queryKey: ['manual', 'screenshots'] })}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function SlotRow({
  meta, uploaded, onChange,
}: { meta: ScreenshotMeta; uploaded: UploadedRow | null; onChange: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState(uploaded?.caption ?? '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('Image must be 2MB or smaller.');
      }
      const buf = await file.arrayBuffer();
      const b64 = arrayBufferToBase64(buf);
      return apiPut(`/api/manual/screenshots/${meta.slug}`, {
        content_base64: b64,
        content_type: file.type || 'image/png',
        filename: file.name,
        caption: caption.trim() || null,
        audience: meta.audience,
      });
    },
    onSuccess: () => {
      setError(null);
      onChange();
    },
    onError: (e: any) => setError(e.message ?? 'Upload failed'),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiDelete(`/api/manual/screenshots/${meta.slug}`),
    onSuccess: () => onChange(),
    onError: (e: any) => setError(e.message ?? 'Delete failed'),
  });

  const captionMut = useMutation({
    // Caption-only edit replays an upload with the existing image
    // bytes preserved server-side — that's not how the endpoint
    // works (it's full-replace). For now, caption is editable only
    // at upload time. Future enhancement: PATCH endpoint for
    // metadata-only edits.
    mutationFn: () => Promise.resolve(),
    onSuccess: () => {},
  });
  void captionMut;

  return (
    <div className="card">
      <div className="grid gap-3" style={{ gridTemplateColumns: '180px 1fr 180px' }}>
        {/* Thumbnail */}
        <div className="border border-hairline rounded bg-cream/40 flex items-center justify-center" style={{ minHeight: 120 }}>
          {uploaded ? (
            <img
              src={`/api/manual/screenshots/${meta.slug}/image?v=${uploaded.uploaded_at}`}
              alt={meta.description}
              className="max-w-full max-h-[160px] rounded"
            />
          ) : (
            <span className="text-[11px] text-ink-faint italic">No image yet</span>
          )}
        </div>

        {/* Metadata */}
        <div>
          <div className="flex items-baseline gap-2 mb-1 flex-wrap">
            <code className="text-xs bg-cream px-1.5 py-0.5 rounded">{meta.slug}</code>
            <span className="text-[10px] uppercase tracking-widest text-ink-faint">{meta.audience}</span>
          </div>
          <div className="text-sm text-ink mb-1.5">{meta.description}</div>
          <div className="text-xs text-ink-soft mb-2">
            <span className="text-ink-faint">Capture from:</span>{' '}
            <a href={meta.url} target="_blank" rel="noopener noreferrer" className="text-terracotta hover:text-terracotta-deep">
              {meta.url}
            </a>
          </div>
          <label className="block text-[10px] uppercase tracking-widest text-ink-faint font-medium mb-0.5">Caption (shown beneath the image)</label>
          <input
            type="text"
            className="field-input text-xs"
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder={meta.description}
            maxLength={300}
          />
          {uploaded && (
            <div className="text-[11px] text-ink-faint mt-2">
              Uploaded {formatLongDate(uploaded.uploaded_at)} · {(uploaded.byte_size / 1024).toFixed(0)} KB · {uploaded.content_type}
            </div>
          )}
          {error && <div className="text-[11px] text-terracotta-deep mt-1.5">{error}</div>}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) uploadMut.mutate(f);
              // Reset the input so re-uploading the same filename re-fires.
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMut.isPending}
            className="btn-primary text-xs disabled:opacity-60"
          >
            {uploadMut.isPending ? 'Uploading…' : uploaded ? 'Replace' : 'Upload'}
          </button>
          {uploaded && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Delete the screenshot for "${meta.slug}"?`)) {
                  deleteMut.mutate();
                }
              }}
              disabled={deleteMut.isPending}
              className="btn-ghost text-xs disabled:opacity-50"
            >
              {deleteMut.isPending ? 'Deleting…' : 'Delete'}
            </button>
          )}
          <Link
            to={meta.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-ink-soft hover:text-terracotta text-center"
          >
            Open URL ↗
          </Link>
        </div>
      </div>
    </div>
  );
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  let s = '';
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}
