/**
 * In-app document viewer modal.
 *
 * One-click "open" for any attachment, in a popup overlay, with
 * prev/next navigation across the record's file list. Rendering by
 * type:
 *   - PDF                    -> <iframe> (browser's built-in PDF
 *                               viewer supplies page navigation + zoom)
 *   - images                 -> <img>
 *   - text / .md / .csv / etc-> fetched and shown as monospaced text
 *   - Word .docx             -> mammoth (docx -> HTML), lazy-loaded
 *   - Excel .xlsx            -> SheetJS (xlsx -> HTML table), lazy-loaded,
 *                               with a tab per worksheet
 *   - anything else          -> "preview not available" + Download
 *
 * mammoth + xlsx are pulled in with dynamic import() so they land in
 * their own bundle chunks and only download when a user actually opens
 * a Word/Excel file. HTML produced by either library is sanitized with
 * DOMPurify before it touches the DOM.
 *
 * The file bytes come from /api/attachments/:id/download, which is
 * same-origin and session-authenticated, so fetch/iframe/img all carry
 * the cookie automatically — files stay behind the access wall.
 */

import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';

export interface ViewerFile {
  attachment_id: number;
  filename: string;
  mime_type: string;
}

type Kind = 'pdf' | 'image' | 'text' | 'docx' | 'xlsx' | 'unsupported';

function classify(file: ViewerFile): Kind {
  const mime = (file.mime_type || '').toLowerCase();
  const ext = file.filename.toLowerCase().split('.').pop() ?? '';

  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (
    ext === 'docx' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) return 'docx';
  if (
    ext === 'xlsx' ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) return 'xlsx';
  if (
    mime.startsWith('text/') ||
    ['txt', 'md', 'markdown', 'csv', 'tsv', 'log', 'json', 'xml', 'yaml', 'yml'].includes(ext)
  ) return 'text';

  return 'unsupported';
}

function downloadUrl(id: number): string {
  return `/api/attachments/${id}/download`;
}

export function DocViewerModal({
  files, startIndex, onClose,
}: {
  files: ViewerFile[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const file = files[index];

  // Esc to close, arrow keys to page between files.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') setIndex(i => Math.min(files.length - 1, i + 1));
      else if (e.key === 'ArrowLeft') setIndex(i => Math.max(0, i - 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [files.length, onClose]);

  if (!file) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Viewing ${file.filename}`}
    >
      <div
        className="m-auto flex flex-col bg-paper rounded-lg shadow-xl overflow-hidden"
        style={{ width: 'min(1100px, 94vw)', height: 'min(88vh, 900px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-hairline bg-cream">
          <button
            onClick={() => setIndex(i => Math.max(0, i - 1))}
            disabled={index === 0}
            className="btn-ghost text-sm disabled:opacity-30"
            aria-label="Previous file"
          >
            ‹
          </button>
          <button
            onClick={() => setIndex(i => Math.min(files.length - 1, i + 1))}
            disabled={index === files.length - 1}
            className="btn-ghost text-sm disabled:opacity-30"
            aria-label="Next file"
          >
            ›
          </button>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-ink truncate">{file.filename}</div>
            <div className="text-[11px] text-ink-faint">
              {index + 1} of {files.length}
            </div>
          </div>
          <a
            href={downloadUrl(file.attachment_id)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-xs"
          >
            Download
          </a>
          <button onClick={onClose} className="btn-ghost text-lg leading-none" aria-label="Close">
            ×
          </button>
        </div>

        {/* Body — keyed on id so switching files remounts the renderer */}
        <div className="flex-1 min-h-0 overflow-auto bg-white">
          <FileBody key={file.attachment_id} file={file} />
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  Per-file renderer                                                 */
/* ----------------------------------------------------------------- */

function FileBody({ file }: { file: ViewerFile }) {
  const kind = classify(file);
  const url = downloadUrl(file.attachment_id);

  if (kind === 'pdf') {
    return <iframe src={url} title={file.filename} className="w-full h-full border-0" />;
  }

  if (kind === 'image') {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <img src={url} alt={file.filename} className="max-w-full max-h-full object-contain" />
      </div>
    );
  }

  if (kind === 'text') return <TextBody url={url} />;
  if (kind === 'docx') return <DocxBody url={url} />;
  if (kind === 'xlsx') return <XlsxBody url={url} />;

  // Unsupported (.doc, .ppt, .pptx, archives, unknown)
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-6">
      <div className="text-4xl">📎</div>
      <div className="text-ink-soft text-sm max-w-sm">
        This file type can't be previewed in the browser. Download it to open in the
        matching app.
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm">
        Download {file.filename}
      </a>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center h-full text-sm text-ink-faint italic">{children}</div>;
}

function TextBody({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(url, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error(`Load failed (${r.status})`); return r.text(); })
      .then(t => { if (alive) setText(t); })
      .catch(e => { if (alive) setErr(e.message); });
    return () => { alive = false; };
  }, [url]);

  if (err) return <Centered>{err}</Centered>;
  if (text === null) return <Centered>Loading…</Centered>;
  return <pre className="p-4 text-xs whitespace-pre-wrap break-words font-mono text-ink">{text}</pre>;
}

function DocxBody({ url }: { url: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) throw new Error(`Load failed (${res.status})`);
        const buf = await res.arrayBuffer();
        const mammoth = await import('mammoth');
        const out = await mammoth.convertToHtml({ arrayBuffer: buf });
        if (alive) setHtml(DOMPurify.sanitize(out.value));
      } catch (e: any) {
        if (alive) setErr(e?.message ?? 'Could not render this Word document.');
      }
    })();
    return () => { alive = false; };
  }, [url]);

  if (err) return <Centered>{err}</Centered>;
  if (html === null) return <Centered>Rendering document…</Centered>;
  return (
    <div
      className="doc-prose p-6 max-w-3xl mx-auto text-sm text-ink leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function XlsxBody({ url }: { url: string }) {
  const [sheets, setSheets] = useState<{ name: string; html: string }[] | null>(null);
  const [active, setActive] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) throw new Error(`Load failed (${res.status})`);
        const buf = await res.arrayBuffer();
        const XLSX = await import('xlsx');
        const wb = XLSX.read(buf, { type: 'array' });
        const out = wb.SheetNames.map(name => ({
          name,
          html: DOMPurify.sanitize(XLSX.utils.sheet_to_html(wb.Sheets[name])),
        }));
        if (alive) setSheets(out);
      } catch (e: any) {
        if (alive) setErr(e?.message ?? 'Could not render this spreadsheet.');
      }
    })();
    return () => { alive = false; };
  }, [url]);

  if (err) return <Centered>{err}</Centered>;
  if (sheets === null) return <Centered>Rendering spreadsheet…</Centered>;
  if (sheets.length === 0) return <Centered>No sheets found.</Centered>;

  return (
    <div className="flex flex-col h-full">
      {sheets.length > 1 && (
        <div className="flex gap-1 flex-wrap px-3 py-2 border-b border-hairline bg-cream sticky top-0">
          {sheets.map((s, i) => (
            <button
              key={s.name}
              onClick={() => setActive(i)}
              className={`text-xs px-2.5 py-1 rounded ${i === active ? 'bg-terracotta text-white' : 'text-ink-soft hover:bg-black/5'}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div
        className="xlsx-sheet flex-1 overflow-auto p-3 text-xs"
        dangerouslySetInnerHTML={{ __html: sheets[active].html }}
      />
    </div>
  );
}
