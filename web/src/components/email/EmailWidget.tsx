/**
 * Reusable email widget — drops onto entity detail pages (Donor, Client,
 * Volunteer, Contact). Shows your sent/received messages with the given
 * email address, with click-to-expand bodies and inline reply. A
 * "Compose" button opens a compose form pre-filled with the recipient.
 *
 * Strictly per-user on the backend — staff don't see each other's mail.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../../lib/api.ts';
import { MessageList, type MessageListItem } from './MessageList.tsx';

export function EmailWidget({
  email,
  displayName,
  collapsedByDefault = false,
}: {
  email: string | null;
  displayName: string;
  collapsedByDefault?: boolean;
}) {
  const [showCompose, setShowCompose] = useState(false);
  const [collapsed, setCollapsed] = useState(collapsedByDefault);

  // No email on file → nothing useful to show.
  if (!email) {
    return (
      <div className="card">
        <div className="card-head" style={{ marginBottom: '6px', paddingBottom: '6px' }}>
          <h3 className="font-display font-medium text-[17px] m-0">Email</h3>
        </div>
        <div className="text-sm text-ink-faint italic">
          No email address on file. Add one to the contact record to see correspondence here.
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3 className="font-display font-medium text-[17px] m-0">Email</h3>
          <div className="text-[11px] text-ink-faint mt-0.5">
            Your messages with <code className="font-mono">{email}</code>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCompose(true)} className="btn-primary text-xs">
            + Compose
          </button>
          <button onClick={() => setCollapsed(c => !c)} className="btn-ghost text-xs">
            {collapsed ? 'Show' : 'Hide'}
          </button>
        </div>
      </div>

      {showCompose && (
        <InlineCompose
          to={email}
          displayName={displayName}
          onClose={() => setShowCompose(false)}
        />
      )}

      {!collapsed && <ParticipantMessages email={email} />}
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  Filtered message list                                             */
/* ----------------------------------------------------------------- */

function ParticipantMessages({ email }: { email: string }) {
  const { data, isLoading, error } = useQuery<MessageListItem[]>({
    queryKey: ['mailbox', 'participant', email],
    queryFn: () => apiGet('/api/mailbox/messages', { participant: email, limit: '30' }),
  });

  if (error) return <div className="text-xs text-terracotta-deep">{(error as any).message ?? 'Load failed'}</div>;
  return (
    <div className="border-t border-hairline -mx-5 mt-2">
      <MessageList
        messages={data ?? []}
        loading={isLoading}
        emptyHint="No messages with this person yet. Sync your inbox from Email → Mailbox, or compose a new one above."
      />
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  Inline compose                                                    */
/* ----------------------------------------------------------------- */

interface Account {
  email_account_id: number;
  email_address: string;
  is_default_send: boolean;
}

function InlineCompose({
  to, displayName, onClose,
}: {
  to: string;
  displayName: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: accounts } = useQuery<Account[]>({
    queryKey: ['email', 'accounts'],
    queryFn: () => apiGet('/api/email/accounts'),
  });

  const defaultId = accounts?.find(a => a.is_default_send)?.email_account_id
                 ?? accounts?.[0]?.email_account_id ?? null;
  const [accountId, setAccountId] = useState<number | null>(null);
  const effectiveId = accountId ?? defaultId;

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [topError, setTopError] = useState<string | null>(null);

  const sendMut = useMutation({
    mutationFn: () => apiPost('/api/email/send', {
      email_account_id: effectiveId,
      to,
      subject,
      body_text: body,
    }),
    onSuccess: () => {
      setSubject(''); setBody(''); setTopError(null);
      qc.invalidateQueries({ queryKey: ['mailbox'] });
      onClose();
    },
    onError: (e: any) => setTopError(e.message ?? 'Send failed'),
  });

  if (accounts && accounts.length === 0) {
    return (
      <div className="bg-cream/40 border border-hairline rounded p-3 mb-3 text-sm">
        Connect an email account first at <strong>Email → Accounts</strong>.
        <button onClick={onClose} className="text-xs text-ink-faint hover:text-terracotta ml-3">Cancel</button>
      </div>
    );
  }

  return (
    <div className="bg-cream/40 border border-hairline rounded p-3 mb-3">
      <div className="text-[11px] text-ink-faint mb-2">
        To: <strong>{displayName}</strong> <code className="font-mono">&lt;{to}&gt;</code>
      </div>
      {accounts && accounts.length > 1 && (
        <div className="mb-2">
          <label className="field-label text-[10px]">From</label>
          <select
            className="field-input text-xs"
            value={effectiveId ?? ''}
            onChange={e => setAccountId(Number(e.target.value))}
          >
            {accounts.map(a => (
              <option key={a.email_account_id} value={a.email_account_id}>
                {a.email_address}{a.is_default_send ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      <input
        type="text"
        className="field-input mb-2"
        value={subject}
        onChange={e => setSubject(e.target.value)}
        placeholder="Subject"
      />
      <textarea
        rows={4}
        className="field-input font-sans"
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Message…"
      />
      {topError && <div className="text-xs text-terracotta-deep mt-2">{topError}</div>}
      <div className="flex justify-end gap-2 mt-2">
        <button onClick={onClose} className="btn-ghost text-xs">Cancel</button>
        <button
          onClick={() => {
            if (!subject.trim()) { setTopError('Subject is required.'); return; }
            if (!body.trim()) { setTopError('Message body is required.'); return; }
            sendMut.mutate();
          }}
          disabled={sendMut.isPending || !effectiveId}
          className="btn-primary text-xs disabled:opacity-60"
        >
          {sendMut.isPending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
