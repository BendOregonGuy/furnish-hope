/**
 * Renders a screenshot slot in the manual.
 *
 * If an admin has uploaded an image for this `slug`, the image is
 * shown with the admin-supplied caption underneath. Otherwise the
 * slot renders as a light-green placeholder card with the slug,
 * description, the URL the screenshot should capture, and a hint
 * about where admins go to upload.
 *
 * The image is served from /api/manual/screenshots/:slug/image,
 * which returns 404 when no image has been uploaded. We use an
 * onError handler on the <img> tag to detect 404 and fall back to
 * the placeholder — simpler than a preflight HEAD request, and the
 * browser caches the failure across reloads in the same session.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  /** Stable identifier matching the database slug. Kebab-case. */
  slug: string;
  /** What the screenshot should show. Used as the alt text + the
   *  fallback caption when no image is uploaded yet. */
  description: string;
  /** Optional URL inside the app where the admin should navigate to
   *  capture this screenshot. Shown only in the placeholder state. */
  url?: string;
  /** 'staff' or 'agency' — determines which upload page admins land
   *  on. Defaults to 'staff'. */
  audience?: 'staff' | 'agency';
}

export function ScreenshotSlot({ slug, description, url, audience = 'staff' }: Props) {
  const [missing, setMissing] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const [captionFetched, setCaptionFetched] = useState(false);
  const src = `/api/manual/screenshots/${slug}/image`;

  if (missing) {
    return (
      <div className="my-6 border-2 border-dashed border-sage rounded-lg p-5 bg-sage-soft/30">
        <div className="text-[10px] uppercase tracking-widest text-sage font-medium mb-1.5">
          📸 Screenshot placeholder · slug: <code className="bg-paper px-1.5 py-0.5 rounded">{slug}</code>
        </div>
        <div className="text-sm text-ink mb-2">{description}</div>
        {url && (
          <div className="text-xs text-ink-soft mb-2">
            <span className="text-ink-faint">Capture from:</span>{' '}
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-terracotta hover:text-terracotta-deep">
              {url}
            </a>
          </div>
        )}
        <div className="text-[11px] text-ink-faint italic">
          Admins can upload a screenshot at{' '}
          <Link to="/admin/manual-screenshots" className="text-terracotta hover:text-terracotta-deep">
            Admin → Manual Screenshots
          </Link>
          .
        </div>
      </div>
    );
  }

  return (
    <figure className="my-6">
      <img
        src={src}
        alt={description}
        onError={() => setMissing(true)}
        onLoad={async () => {
          // Pull the caption from the list endpoint exactly once per
          // mounted slot, ever. Without the captionFetched guard
          // every <img> onLoad — including re-fires after image
          // cache restoration on re-render — would re-fetch the
          // ENTIRE list endpoint. With many slots on the page that
          // becomes N x list-fetches per render.
          if (captionFetched) return;
          setCaptionFetched(true);
          try {
            const r = await fetch('/api/manual/screenshots', { credentials: 'include' });
            if (!r.ok) return;
            const rows = await r.json();
            const row = rows.find((x: any) => x.slug === slug);
            if (row?.caption) setCaption(row.caption);
          } catch { /* leave caption blank */ }
        }}
        className="border border-hairline-strong rounded-lg max-w-full block"
      />
      <figcaption className="text-xs text-ink-soft mt-2 italic">
        {caption ?? description}
      </figcaption>
      <span className="sr-only" aria-hidden>{audience}</span>
    </figure>
  );
}
