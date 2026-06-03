/**
 * Shared attachment-picker primitives for every place we compose or
 * reply to email from inside the app:
 *   - EmailCompose page (full compose)
 *   - EmailWidget inline compose
 *   - MessageList inline reply
 *
 * Files are read into ArrayBuffers, base64-encoded client-side, and
 * shipped to /api/email/send (or /api/mailbox/messages/:id/reply) as
 * FileEntry[]. The server reconstructs the Buffer and hands it to
 * nodemailer.
 */

import { useState } from 'react';

export interface FileEntry {
  filename: string;
  content_base64: string;
  content_type: string;
  size: number;
}

/** State + handlers for an attachment list. Use in any compose surface
 *  that wants to support file uploads. */
export function useAttachments() {
  const [files, setFiles] = useState<FileEntry[]>([]);

  async function add(list: FileList | null): Promise<void> {
    if (!list) return;
    const next: FileEntry[] = [];
    for (const f of Array.from(list)) {
      const buf = await f.arrayBuffer();
      next.push({
        filename: f.name,
        content_base64: arrayBufferToBase64(buf),
        content_type: f.type || 'application/octet-stream',
        size: f.size,
      });
    }
    setFiles(prev => [...prev, ...next]);
  }

  function remove(index: number): void {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }

  function clear(): void {
    setFiles([]);
  }

  return { files, add, remove, clear };
}

/**
 * Render the picker + removable file chips. Designed to slot into any
 * compose form right above the Send button.
 */
export function AttachmentPicker({
  files, onAdd, onRemove, label = '+ Attach files',
}: {
  files: FileEntry[];
  onAdd: (list: FileList | null) => void;
  onRemove: (i: number) => void;
  label?: string;
}) {
  return (
    <div>
      {files.length > 0 && (
        <div className="mb-1.5 space-y-1">
          {files.map((a, i) => (
            <div key={i} className="flex items-center justify-between text-xs bg-cream px-2.5 py-1.5 rounded">
              <span className="truncate flex-1 mr-2">
                📎 {a.filename}{' '}
                <span className="text-ink-faint">({Math.round(a.size / 1024)} KB)</span>
              </span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="text-ink-faint hover:text-terracotta flex-shrink-0"
                aria-label={`Remove ${a.filename}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="inline-flex items-center gap-2 text-xs text-terracotta hover:text-terracotta-deep cursor-pointer">
        <input type="file" multiple className="hidden" onChange={e => onAdd(e.target.files)} />
        {label}
      </label>
    </div>
  );
}

/**
 * Chunk-safe binary-to-base64. Big attachments can blow the JS call
 * stack with the naïve `String.fromCharCode(...bytes)` pattern; we
 * chunk in 32KB blocks to stay well under the limit.
 */
export function arrayBufferToBase64(buf: ArrayBuffer): string {
  let s = '';
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}
