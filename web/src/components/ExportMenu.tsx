/**
 * ExportMenu — dropdown that lets a report page export its current
 * view as PDF / XLSX / DOCX. Hits /api/reports/export/:report.:format,
 * blobs the response, and triggers a download.
 *
 * The parent tells us which report to export (impact | inventory) and
 * which query params to include so the export mirrors what's on screen.
 */

import { useEffect, useRef, useState } from 'react';

interface Props {
  report: 'impact' | 'inventory' | 'reports' | 'landfill' | 'valuation';
  /** Query params to pass through to the export endpoint (period, status, etc.). */
  params: Record<string, string>;
}

const FORMATS: Array<{ ext: 'pdf' | 'xlsx' | 'docx'; label: string; hint: string }> = [
  { ext: 'pdf',  label: 'PDF',           hint: 'Print / share' },
  { ext: 'xlsx', label: 'Excel (.xlsx)', hint: 'Sortable spreadsheet' },
  { ext: 'docx', label: 'Word (.docx)',  hint: 'Editable document' },
];

export function ExportMenu({ report, params }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click / escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function download(ext: 'pdf' | 'xlsx' | 'docx') {
    if (busy) return;
    setBusy(ext);
    try {
      const qs = new URLSearchParams(params).toString();
      const url = `/api/reports/export/${report}.${ext}${qs ? '?' + qs : ''}`;
      const r = await fetch(url, { credentials: 'include' });
      if (!r.ok) {
        const msg = await r.text().catch(() => `HTTP ${r.status}`);
        throw new Error(msg);
      }
      const blob = await r.blob();
      // Grab the server-suggested filename from Content-Disposition; fall
      // back to a reasonable default if the header isn't present.
      const cd = r.headers.get('content-disposition') || '';
      const match = /filename="([^"]+)"/.exec(cd);
      const filename = match?.[1] ?? `${report}.${ext}`;

      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 100);
      setOpen(false);
    } catch (e: any) {
      alert(`Export failed: ${e.message ?? e}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1 px-3 py-1 border border-hairline rounded text-sm bg-paper hover:bg-cream-soft"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Export
        <span className="text-[10px] opacity-70">▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 min-w-[220px] rounded border border-hairline bg-paper shadow-lg z-30 overflow-hidden"
        >
          {FORMATS.map(f => (
            <button
              key={f.ext}
              type="button"
              role="menuitem"
              disabled={busy === f.ext}
              onClick={() => download(f.ext)}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-cream-soft disabled:opacity-60 disabled:cursor-wait"
            >
              <div className="font-medium">{busy === f.ext ? 'Generating…' : f.label}</div>
              <div className="text-[11px] text-ink-faint">{f.hint}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
