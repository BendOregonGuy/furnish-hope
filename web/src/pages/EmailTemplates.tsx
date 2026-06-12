/**
 * Manage email templates — pre-canned messages staff can apply to a
 * Compose form to skip retyping the same thank-you for the 50th time.
 *
 * Per-user (each staff member curates their own set). The Compose
 * page has an "Apply template" dropdown that uses /api/email-templates.
 *
 * Placeholders the editor advertises (substituted client-side at
 * apply-time):
 *   {{my_name}}        — your display name on the user account
 *   {{org_name}}       — your nonprofit's legal name from org settings
 *   {{today}}          — today's date (Friday, June 7 2026)
 *
 * (Future: donor / donation context when applied from a donor record.)
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost, apiPut } from '../lib/api.ts';
import { PageHeader, Loading, ErrorBox, EmptyState } from '../components/ui.tsx';

export interface EmailTemplate {
  email_template_id: number;
  user_account_id: number;
  name: string;
  description: string | null;
  subject: string | null;
  body: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function EmailTemplates() {
  const qc = useQueryClient();
  const { data: items, isLoading, error } = useQuery<EmailTemplate[]>({
    queryKey: ['email', 'templates'],
    queryFn: () => apiGet('/api/email-templates'),
  });
  const [editing, setEditing] = useState<EmailTemplate | 'new' | null>(null);

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiDelete(`/api/email-templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email', 'templates'] }),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  return (
    <>
      <PageHeader
        helpSection="email"
        title="Email templates"
        emphasis="email"
        subtitle="Save canned messages for thank-yous, pickup confirmations, volunteer welcomes, anything you find yourself retyping."
        actions={
          <button onClick={() => setEditing('new')} className="btn-primary">+ New template</button>
        }
      />

      {editing && (
        <TemplateEditor
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['email', 'templates'] });
            setEditing(null);
          }}
        />
      )}

      {(!items || items.length === 0) && !editing && (
        <EmptyState
          title="No templates yet"
          hint='Click "+ New template" to save your first one. Tip: paste a thank-you note you already use.'
        />
      )}

      {items && items.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-hairline bg-cream/50">
              <tr className="text-xs text-ink-faint uppercase tracking-widest">
                <th className="text-left px-4 py-2.5 font-medium">Name</th>
                <th className="text-left px-4 py-2.5 font-medium">Subject</th>
                <th className="text-left px-4 py-2.5 font-medium">Notes</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {items.map(t => (
                <tr key={t.email_template_id} className="hover:bg-terracotta/[0.04]">
                  <td className="px-4 py-2.5 font-medium">{t.name}</td>
                  <td className="px-4 py-2.5 text-sm text-ink-soft">{t.subject || '—'}</td>
                  <td className="px-4 py-2.5 text-sm text-ink-faint truncate max-w-md">{t.description || '—'}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setEditing(t)}
                      className="text-xs text-terracotta hover:text-terracotta-deep mr-3"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete template "${t.name}"?`)) deleteMut.mutate(t.email_template_id);
                      }}
                      className="text-xs text-ink-faint hover:text-terracotta"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ----------------------------------------------------------------- */
/*  Editor                                                            */
/* ----------------------------------------------------------------- */

function TemplateEditor({
  initial, onClose, onSaved,
}: {
  initial: EmailTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !initial;
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [err, setErr] = useState<string | null>(null);

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = { name: name.trim(), description: description.trim() || null, subject: subject.trim() || null, body };
      return isNew
        ? apiPost('/api/email-templates', payload)
        : apiPut(`/api/email-templates/${initial!.email_template_id}`, payload);
    },
    onSuccess: () => onSaved(),
    onError: (e: any) => setErr(e.message ?? 'Save failed'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) { setErr('Name is required.'); return; }
    if (!body.trim()) { setErr('Body is required.'); return; }
    saveMut.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="card mb-5 space-y-3 max-w-3xl">
      <div className="flex items-baseline justify-between border-b border-hairline pb-2.5 mb-1">
        <h2 className="font-display text-lg">{isNew ? 'New template' : `Edit "${initial!.name}"`}</h2>
        <button type="button" onClick={onClose} className="text-ink-faint hover:text-terracotta text-xs">Cancel</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="field-label">Name <span className="text-terracotta">*</span></label>
          <input type="text" className="field-input" value={name} onChange={e => setName(e.target.value)} maxLength={120} placeholder="e.g. Thank you — cash donation" />
        </div>
        <div>
          <label className="field-label">Subject</label>
          <input type="text" className="field-input" value={subject} onChange={e => setSubject(e.target.value)} maxLength={500} placeholder="Pre-fills the Subject field when applied" />
        </div>
      </div>

      <div>
        <label className="field-label">Notes</label>
        <input type="text" className="field-input" value={description} onChange={e => setDescription(e.target.value)} maxLength={300} placeholder="When to use this template (only you see this)" />
      </div>

      <div>
        <label className="field-label">Body <span className="text-terracotta">*</span></label>
        <textarea rows={12} className="field-input font-sans" value={body} onChange={e => setBody(e.target.value)} placeholder="Dear {{donor_first_name}},&#10;&#10;Thank you for your generous gift…" />
        <p className="text-[11px] text-ink-faint mt-1">
          Placeholders: <code>{'{{my_name}}'}</code>, <code>{'{{org_name}}'}</code>, <code>{'{{today}}'}</code> — auto-fill at apply-time.
          Other <code>{'{{names}}'}</code> stay as-is so you can hand-fill before sending.
        </p>
      </div>

      {err && <div className="p-2.5 bg-terracotta-soft text-terracotta-deep rounded-md text-xs">{err}</div>}

      <div className="flex justify-end gap-2 pt-2 border-t border-hairline">
        <button type="button" onClick={onClose} className="btn-ghost text-xs">Cancel</button>
        <button type="submit" disabled={saveMut.isPending} className="btn-primary text-xs disabled:opacity-60">
          {saveMut.isPending ? 'Saving…' : (isNew ? 'Create template' : 'Save changes')}
        </button>
      </div>
    </form>
  );
}
