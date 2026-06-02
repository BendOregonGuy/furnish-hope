/**
 * Shell + print CSS for pickup/delivery manifests. The page is sized for
 * US Letter (8.5×11") with sensible margins. Background chrome (sidebar,
 * page header) is hidden on print via the `print:` Tailwind variants.
 *
 * Auto-opens the browser Print dialog on mount so the user can confirm
 * the layout, hit Print or "Save as PDF", and walk away.
 *
 * Each block component below is exported so the per-entity manifest pages
 * (PickupManifest, DeliveryManifest) compose them into the final layout.
 */

import { useEffect, type ReactNode } from 'react';

/** Maps Google Maps origin/destination strings into a directions URL.
 *  Omitting origin (empty string) makes Google Maps use the driver's
 *  current location at the time they scan the QR — which is what we want
 *  when no facility/warehouse is configured. */
export function buildMapsUrl(origin: string, destination: string): string {
  const params = new URLSearchParams();
  if (origin.trim()) params.set('origin', origin);
  params.set('destination', destination);
  params.set('travelmode', 'driving');
  return `https://www.google.com/maps/dir/?api=1&${params.toString()}`;
}

/** Stitch an address into a single "123 Main St, Bend, OR 97701" string,
 *  skipping any missing parts cleanly. */
export function formatAddress(parts: {
  address?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  postalcode?: string | null;
}): string {
  const street = [parts.address, parts.address2].filter(Boolean).join(', ');
  const cityState = [parts.city, parts.state].filter(Boolean).join(', ');
  return [street, cityState, parts.postalcode].filter(Boolean).join(' · ');
}

/* ----------------------------------------------------------------- */
/*  ManifestPage — outer wrapper that sets up print sizing            */
/* ----------------------------------------------------------------- */

export function ManifestPage({ children }: { children: ReactNode }) {
  // Auto-open the print dialog once the page has rendered. setTimeout so
  // images (logo, QR codes) have a tick to paint first.
  useEffect(() => {
    const t = setTimeout(() => { try { window.print(); } catch { /* ignore */ } }, 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {/* Page-level styles. Scoped via @page so they only apply when printing. */}
      <style>{`
        @page { size: Letter; margin: 0.5in; }
        @media print {
          body { background: white !important; }
          /* Classic CSS-print trick: visibility:hidden on everything,
             then make just the manifest sheet visible. This hides the
             app sidebar / breadcrumbs / page chrome without us needing
             to know their classnames. */
          body * { visibility: hidden !important; }
          .manifest-sheet, .manifest-sheet * { visibility: visible !important; }
          .manifest-sheet {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          .manifest-screen-only { display: none !important; }
        }
        .manifest-sheet {
          width: 7.5in;          /* 8.5 - 2*0.5 margins */
          min-height: 10in;
          margin: 0 auto;
          padding: 0;
          font-family: 'Inter', system-ui, sans-serif;
          color: #1a1a1a;
          background: white;
          font-size: 11pt;
          line-height: 1.35;
        }
        .manifest-sheet h2 {
          font-family: 'Spectral', Georgia, serif;
          font-weight: 500;
          margin: 0;
        }
        .manifest-section {
          border-top: 1px solid #d8d4cc;
          padding-top: 10pt;
          padding-bottom: 10pt;
        }
        .manifest-section:first-of-type { border-top: none; padding-top: 0; }
        .manifest-label {
          font-size: 8pt;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #6b6b6b;
          font-weight: 500;
          margin-bottom: 3pt;
        }
        .manifest-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18pt; }
        .manifest-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18pt; }
        .signature-line {
          border-bottom: 1px solid #888;
          min-height: 22pt;
          margin-top: 14pt;
        }
        .blank-item-line {
          display: grid;
          grid-template-columns: 14pt 1fr 80pt;
          gap: 8pt;
          align-items: end;
          padding: 4pt 0;
          border-bottom: 1px solid #ccc;
          font-size: 10pt;
        }
        .blank-item-line .checkbox {
          width: 11pt; height: 11pt; border: 1px solid #888; border-radius: 2px;
        }
        .blank-item-line .condition-label {
          color: #6b6b6b; font-size: 8pt; text-align: right;
          border-bottom: 1px solid #ccc; padding-bottom: 1pt;
        }
      `}</style>

      {/* Screen-only header: lets the user reprint or close. Hidden on paper. */}
      <div className="manifest-screen-only px-6 py-3 bg-cream border-b border-hairline flex items-center justify-between sticky top-0 z-10">
        <div className="text-xs text-ink-soft">
          Manifest preview · use your browser's Print dialog or save as PDF
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="btn-primary text-xs"
          >
            Print
          </button>
          <button
            onClick={() => window.close()}
            className="btn-ghost text-xs"
          >
            Close
          </button>
        </div>
      </div>

      <div className="manifest-sheet">
        {children}
      </div>
    </>
  );
}

/* ----------------------------------------------------------------- */
/*  ManifestHeader — top of the page: logo + title + meta             */
/* ----------------------------------------------------------------- */

export function ManifestHeader({
  title,
  meta,
  orgName,
}: {
  title: string;
  meta: string;
  orgName?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: '10pt', borderBottom: '2px solid #1a1a1a', marginBottom: '12pt' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12pt' }}>
        {/* Logo. The file lives at /logo.png in public/ — falls back to text if missing. */}
        <img
          src="/logo.png"
          alt={orgName ?? 'Furnish Hope'}
          style={{ height: '54pt', width: 'auto' }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
        <div>
          <h2 style={{ fontSize: '16pt' }}>{orgName ?? 'Furnish Hope'}</h2>
          <div style={{ fontSize: '11pt', color: '#444' }}>{title}</div>
        </div>
      </div>
      <div style={{ textAlign: 'right', fontSize: '10pt', color: '#444' }}>
        {meta}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  Layout primitives                                                 */
/* ----------------------------------------------------------------- */

export function Section({ children }: { children: ReactNode }) {
  return <div className="manifest-section">{children}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="manifest-label">{label}</div>
      <div style={{ fontSize: '11pt' }}>{children}</div>
    </div>
  );
}

export function Grid2({ children }: { children: ReactNode }) {
  return <div className="manifest-grid-2">{children}</div>;
}

export function Grid3({ children }: { children: ReactNode }) {
  return <div className="manifest-grid-3">{children}</div>;
}

/* ----------------------------------------------------------------- */
/*  Signature line — plain bottom-border with optional label          */
/* ----------------------------------------------------------------- */

export function SignatureLine({ label }: { label: string }) {
  return (
    <div>
      <div className="signature-line" />
      <div className="manifest-label" style={{ marginTop: '3pt' }}>{label}</div>
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  Blank item line — checkbox + write-in space + condition           */
/* ----------------------------------------------------------------- */

export function BlankItemLine() {
  return (
    <div className="blank-item-line">
      <div className="checkbox" />
      <div style={{ borderBottom: '1px solid #ccc', minHeight: '14pt' }} />
      <div className="condition-label">Condition: ______</div>
    </div>
  );
}
