/**
 * Send an email through a connected account. Lightweight compose form
 * with to/cc/bcc, subject, plaintext body, and attachments encoded as
 * base64 then assembled server-side.
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { apiGet, apiPost } from '../lib/api.ts';
import { PageHeader, Loading, ErrorBox } from '../components/ui.tsx';
import { TemplatePicker } from '../components/email/TemplatePicker.tsx';

interface Account {
  email_account_id: number;
  email_address: string;
  is_default_send: boolean;
  last_test_status: string | null;
}

interface FileEntry {
  filename: string;
  content_base64: string;
  content_type: string;
  size: number;
}

export function EmailCompose() {
  const { data: accounts, isLoading, error } = useQuery<Account[]>({
    queryKey: ['email', 'accounts'],
    queryFn: () => apiGet('/api/email/accounts'),
  });

  const defaultId = accounts?.find(a => a.is_default_send)?.email_account_id
                 ?? accounts?.[0]?.email_account_id ?? null;

  const [accountId, setAccountId] = useState<number | null>(null);
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<FileEntry[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [topError, setTopError] = useState<string | null>(null);

  // Default to the default-send account once loaded.
  const effectiveId = accountId ?? defaultId;

  const sendMut = useMutation({
    mutationFn: () => apiPost<{ messageId: string; accepted: string[]; rejected: string[] }>('/api/email/send', {
      email_account_id: effectiveId,
      to, cc: cc || undefined, bcc: bcc || undefined,
      subject,
      body_text: body,
      attachments,
    }),
    onSuccess: (data) => {
      setSuccess(`Sent. Accepted by ${data.accepted.length} recipient${data.accepted.length === 1 ? '' : 's'}.`);
      setTopError(null);
      setTo(''); setCc(''); setBcc(''); setSubject(''); setBody(''); setAttachments([]);
    },
    onError: (err: any) => {
      setSuccess(null);
      setTopError(err.message ?? 'Send failed');
    },
  });

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const list: FileEntry[] = [];
    for (const f of Array.from(files)) {
      const buf = await f.arrayBuffer();
      const b64 = arrayBufferToBase64(buf);
      list.push({ filename: f.name, content_base64: b64, content_type: f.type || 'application/octet-stream', size: f.size });
    }
    setAttachments(prev => [...prev, ...list]);
  }

  function removeAttachment(i: number) {
    setAttachments(prev => prev.filter((_, idx) => idx !== i));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(null);
    setTopError(null);
    if (!effectiveId) { setTopError('Connect an email account first.'); return; }
    if (!to.trim()) { setTopError('To address is required.'); return; }
    if (!subject.trim()) { setTopError('Subject is required.'); return; }
    if (!body.trim()) { setTopError('Message body is required.'); return; }
    sendMut.mutate();
  }

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  // No accounts yet — direct the user to connect first.
  if (!accounts || accounts.length === 0) {
    return (
      <>
        <PageHeader title="Compose" emphasis="email" />
        <div className="card max-w-md text-center">
          <div className="font-display text-xl mb-2">No email accounts connected</div>
          <div className="text-sm text-ink-soft mb-5">
            You need to connect an email account before you can send. Pick a provider on the next page.
          </div>
          <Link to="/email/accounts" className="btn-primary inline-flex">+ Connect an account</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Compose"
        emphasis="email"
        subtitle="Send through one of your connected accounts."
        actions={<Link to="/email/accounts" className="btn-ghost">Manage accounts</Link>}
      />

      <form onSubmit={handleSubmit} className="card max-w-3xl space-y-4">
        {/* From */}
        <div>
          <label className="field-label">From</label>
          <select
            className="field-input"
            value={effectiveId ?? ''}
            onChange={e => setAccountId(Number(e.target.value))}
          >
            {accounts.map(a => (
              <option key={a.email_account_id} value={a.email_account_id}>
                {a.email_address}
                {a.is_default_send ? ' (default)' : ''}
                {a.last_test_status === 'failure' ? ' — test failed' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* To */}
        <div>
          <label className="field-label">
            To
            {!showCc && (
              <button type="button" onClick={() => setShowCc(true)} className="ml-2 text-[10px] normal-case tracking-normal text-terracotta hover:text-terracotta-deep">
                + Cc / Bcc
              </button>
            )}
          </label>
          <input
            type="text"
            className="field-input"
            value={to}
            onChange={e => setTo(e.target.value)}
            placeholder="recipient@example.com (comma-separated for multiple)"
            required
          />
        </div>

        {showCc && (
          <>
            <div>
              <label className="field-label">Cc</label>
              <input type="text" className="field-input" value={cc} onChange={e => setCc(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Bcc</label>
              <input type="text" className="field-input" value={bcc} onChange={e => setBcc(e.target.value)} />
            </div>
          </>
        )}

        <div>
          <label className="field-label flex items-center justify-between">
            <span>Subject</span>
            <TemplatePicker
              onApply={t => {
                if (t.subject) setSubject(t.subject);
                // Append the body rather than replacing — if the user has
                // already typed something, we don't want to wipe it. The
                // "subject" usually wants replacing though since it's one
                // line.
                setBody(prev => prev ? `${prev}\n\n${t.body}` : t.body);
              }}
            />
          </label>
          <input
            type="text"
            className="field-input"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="field-label">Message</label>
          <textarea
            rows={12}
            className="field-input font-sans"
            value={body}
            onChange={e => setBody(e.target.value)}
            required
          />
          <p className="text-[11px] text-ink-faint mt-1">
            Your signature (set on Email Accounts) is appended automatically when you send.
          </p>
        </div>

        {/* Attachments */}
        <div>
          <label className="field-label">Attachments</label>
          {attachments.length > 0 && (
            <div className="mb-2 space-y-1">
              {attachments.map((a, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-cream px-2.5 py-1.5 rounded">
                  <span>📎 {a.filename} <span className="text-ink-faint">({Math.round(a.size / 1024)} KB)</span></span>
                  <button type="button" onClick={() => removeAttachment(i)} className="text-ink-faint hover:text-terracotta">×</button>
                </div>
              ))}
            </div>
          )}
          <label className="inline-flex items-center gap-2 text-xs text-terracotta hover:text-terracotta-deep cursor-pointer">
            <input type="file" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
            + Attach files
          </label>
        </div>

        {topError && <div className="p-2.5 bg-terracotta-soft text-terracotta-deep rounded-md text-xs">{topError}</div>}
        {success && <div className="p-2.5 bg-sage-soft text-[#3F4A33] rounded-md text-xs">{success}</div>}

        <div className="flex justify-end gap-2 pt-3 border-t border-hairline">
          <button type="submit" disabled={sendMut.isPending} className="btn-primary disabled:opacity-60">
            {sendMut.isPending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </>
  );
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  let s = '';
  const bytes = new Uint8Array(buf);
  // Chunk to avoid call stack issues with large attachments.
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}
