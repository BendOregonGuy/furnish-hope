/**
 * Per-entity attachments widget. Drop onto any detail page with the
 * entity_type + entity_id and it owns the rest: list, upload,
 * download, rename, edit description, delete.
 *
 *   <AttachmentsWidget entityType="donor" entityId={42} />
 *
 * Backed by /api/attachments/* — storage is provider-agnostic on
 * the server, so a future migration to DO Spaces / S3 / Drive
 * doesn't change anything in this component.
 */

import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost, apiPut } from '../../lib/api.ts';
import { arrayBufferToBase64 } from '../email/attachments.tsx';

interface AttachmentRow {
  attachment_id: number;
  filename: string;
  mime_type: string;
  size_bytes: number;
  description: string | null;
  storage_provider: string;
  external_url: string | null;
  uploaded_at: string;
  last_modified_at: string | null;
  uploaded_by_username: string | null;
  uploaded_by_name: string | null;
}

export function AttachmentsWidget({
  entityType, entityId, title = 'Documents', collapsedByDefault = false,
}: {
  entityType: string;
  entityId: number;
  title?: string;
  collapsedByDefault?: boolean;
}) {
  const qc = useQueryClient();
  const [collapsed, setCollapsed] = useState(collapsedByDefault);
  const [topError, setTopError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const { data, isLoading, error } = useQuery<AttachmentRow[]>({
    queryKey: ['attachments', entityType, entityId],
    queryFn: () => apiGet(`/api/attachments/${entityType}/${entityId}`),
  });

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const buf = await file.arrayBuffer();
      return apiPost(`/api/attachments/${entityType}/${entityId}`, {
        filename: file.name,
        mime_type: file.type || 'application/octet-stream',
        content_base64: arrayBufferToBase64(buf),
      });
    },
    onSuccess: () => {
      setTopError(null);
      qc.invalidateQueries({ queryKey: ['attachments', entityType, entityId] });
    },
    onError: (err: any) => setTopError(err.message ?? 'Upload failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiDelete(`/api/attachments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attachments', entityType, entityId] }),
    onError: (err: any) => window.alert(err.message ?? 'Delete failed'),
  });

  async function handleFiles(list: FileList | null) {
    if (!list) return;
    setTopError(null);
    for (const f of Array.from(list)) {
      // Cap on the client to avoid pointless base64 + roundtrip.
      if (f.size > 10 * 1024 * 1024) {
        setTopError(`${f.name} is too large (${(f.size / 1024 / 1024).toFixed(1)} MB > 10 MB). Compress or split it.`);
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      await uploadMut.mutateAsync(f);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3 className="font-display font-medium text-[17px] m-0">{title}</h3>
          <div className="text-[11px] text-ink-faint mt-0.5">
            Up to 10 MB per file · {data?.length ?? 0} attached
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setCollapsed(c => !c)} className="btn-ghost text-xs">
            {collapsed ? 'Show' : 'Hide'}
          </button>
        </div>
      </div>

      {topError && (
        <div className="mb-3 p-2.5 bg-terracotta-soft text-terracotta-deep rounded-md text-xs">{topError}</div>
      )}

      {!collapsed && (
        <>
          {/* Drag-drop / click-to-upload */}
          <label
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`block border border-dashed rounded-md p-4 mb-3 text-center cursor-pointer transition ${
              dragging ? 'border-terracotta bg-terracotta/[0.04]' : 'border-hairline-strong hover:border-terracotta'
            }`}
          >
            <input
              type="file"
              multiple
              className="hidden"
              onChange={e => handleFiles(e.target.files)}
            />
            <div className="text-sm text-ink-soft">
              {uploadMut.isPending
                ? <span className="text-ink">Uploading…</span>
                : <>📄 <strong>Drop files here</strong> or <span className="text-terracotta">click to choose</span></>}
            </div>
            <div className="text-[10px] text-ink-faint mt-1">
              PDF, Word, Excel, images, anything up to 10 MB
            </div>
          </label>

          {error && <div className="text-xs text-terracotta-deep">{(error as any).message ?? 'Load failed'}</div>}

          {isLoading && <div className="text-xs text-ink-faint italic">Loading…</div>}
          {data && data.length === 0 && (
            <div className="text-sm text-ink-faint italic text-center py-4">No documents yet.</div>
          )}

          {data && data.length > 0 && (
            <table className="w-full text-sm">
              <tbody>
                {data.map(a => (
                  <AttachmentRow key={a.attachment_id} row={a}
                    onDelete={() => {
                      if (window.confirm(`Delete "${a.filename}"? This cannot be undone.`)) {
                        deleteMut.mutate(a.attachment_id);
                      }
                    }}
                    onRefresh={() => qc.invalidateQueries({ queryKey: ['attachments', entityType, entityId] })}
                  />
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  Per-row                                                           */
/* ----------------------------------------------------------------- */

function AttachmentRow({
  row, onDelete, onRefresh,
}: {
  row: AttachmentRow;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [filename, setFilename] = useState(row.filename);
  const [description, setDescription] = useState(row.description ?? '');

  const saveMut = useMutation({
    mutationFn: () => apiPut(`/api/attachments/${row.attachment_id}`, {
      filename: filename.trim(),
      description: description.trim() || null,
    }),
    onSuccess: () => { setEditing(false); onRefresh(); },
    onError: (err: any) => window.alert(err.message ?? 'Save failed'),
  });

  return (
    <tr className="border-t border-hairline first:border-0">
      <td className="py-2.5 pr-3 text-2xl align-top w-10">
        <FileEmoji mime={row.mime_type} />
      </td>
      <td className="py-2.5 pr-3 align-top">
        {editing ? (
          <div className="space-y-2">
            <input
              type="text"
              className="field-input"
              value={filename}
              onChange={e => setFilename(e.target.value)}
              maxLength={255}
            />
            <input
              type="text"
              className="field-input"
              placeholder="Description (optional)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={500}
            />
            <div className="flex gap-2">
              <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="btn-primary text-xs">
                {saveMut.isPending ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setEditing(false); setFilename(row.filename); setDescription(row.description ?? ''); }} className="btn-ghost text-xs">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <a
              href={`/api/attachments/${row.attachment_id}/download`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-ink hover:text-terracotta"
            >
              {row.filename}
            </a>
            {row.description && <div className="text-xs text-ink-soft mt-0.5">{row.description}</div>}
            <div className="text-[11px] text-ink-faint mt-1">
              {formatBytes(row.size_bytes)} ·
              {' '}{new Date(row.uploaded_at).toLocaleString()}
              {row.uploaded_by_name && <> · by {row.uploaded_by_name}</>}
              {row.storage_provider !== 'pg_blob' && (
                <> · <span className="pill pill-muted text-[9px]">{row.storage_provider}</span></>
              )}
            </div>
          </>
        )}
      </td>
      {!editing && (
        <td className="py-2.5 pr-3 text-right align-top whitespace-nowrap">
          <a
            href={`/api/attachments/${row.attachment_id}/download`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-ink-soft hover:text-terracotta mr-3"
          >
            Open
          </a>
          <button onClick={() => setEditing(true)} className="text-xs text-ink-soft hover:text-terracotta mr-3">
            Edit
          </button>
          <button onClick={onDelete} className="text-xs text-terracotta hover:text-terracotta-deep">
            Delete
          </button>
        </td>
      )}
    </tr>
  );
}

/* ----------------------------------------------------------------- */
/*  Helpers                                                           */
/* ----------------------------------------------------------------- */

function FileEmoji({ mime }: { mime: string }): ReactNode {
  const m = mime.toLowerCase();
  if (m.startsWith('image/')) return <>🖼️</>;
  if (m === 'application/pdf') return <>📕</>;
  if (m.includes('word') || m.includes('msword')) return <>📘</>;
  if (m.includes('excel') || m.includes('sheet')) return <>📗</>;
  if (m.includes('powerpoint') || m.includes('presentation')) return <>📙</>;
  if (m.startsWith('audio/')) return <>🎵</>;
  if (m.startsWith('video/')) return <>🎬</>;
  if (m.includes('zip') || m.includes('compressed')) return <>🗜️</>;
  if (m.startsWith('text/')) return <>📄</>;
  return <>📎</>;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
