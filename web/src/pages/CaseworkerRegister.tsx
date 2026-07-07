/**
 * Public caseworker registration page. Reached via a one-time invitation
 * link the Program Manager emailed after approving an agency application.
 *
 * Flow: fetch invitation preview → show pre-filled first/last/email +
 * agency name → caseworker picks username + password → POST accept →
 * server creates tbl_user_account, flips invitation to 'accepted', and
 * regenerates the session. On success we refresh the auth context and
 * navigate straight into /agency.
 *
 * All errors from the backend are surfaced verbatim — the "invalid or
 * expired" and "already used" messages carry the copy the caseworker
 * needs to know what to do next.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiGet, apiPost } from '../lib/api.ts';
import { Loading } from '../components/ui.tsx';
import { useAuth } from '../lib/auth.tsx';

interface InvitationPreview {
  agency_name: string;
  first_name: string;
  last_name: string;
  email: string;
  expires_at: string;
  status: 'pending' | 'sent';
}

interface AuthResponse {
  user: { user_account_id: number; username: string; role: string };
}

export function CaseworkerRegister() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const { data: preview, isLoading, error } = useQuery<InvitationPreview>({
    queryKey: ['invitation-preview', token],
    queryFn: () => apiGet(`/api/public/invitations/${token}`),
    retry: false,
    enabled: !!token && token.length === 64,
  });

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [err, setErr] = useState<string | null>(null);

  // Suggest a sensible default username (first initial + last name lowercased)
  // once we know who the caseworker is. Only fires when the field is still
  // empty so we don't stomp on their choice mid-typing.
  useEffect(() => {
    if (preview && !username) {
      const suggested = `${preview.first_name.charAt(0)}${preview.last_name}`
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, '');
      if (suggested.length >= 3) setUsername(suggested);
    }
  }, [preview]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitMut = useMutation({
    mutationFn: () => apiPost<AuthResponse>(`/api/public/invitations/${token}/accept`, {
      username: username.trim(),
      password,
    }),
    onSuccess: async () => {
      // Session cookie is set server-side. Refresh the auth context so
      // the SPA picks up the new user, then navigate into the portal.
      await refresh();
      navigate('/agency', { replace: true });
    },
    onError: (e: any) => setErr(e.message ?? 'Signup failed'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!username.trim())      { setErr('Please choose a username.'); return; }
    if (password.length < 8)   { setErr('Password must be at least 8 characters.'); return; }
    if (password !== confirm)  { setErr('Passwords don\'t match. Retype and try again.'); return; }
    submitMut.mutate();
  }

  // ------------------------------------------------------------------ //
  // Render                                                              //
  // ------------------------------------------------------------------ //

  if (!token || token.length !== 64) {
    return <ErrorScreen title="Invalid link" body="This invitation link is invalid or has expired. Ask your agency admin or Furnish Hope to send you a new one." />;
  }
  if (isLoading) return <Loading />;
  if (error) {
    const msg = (error as any)?.message ?? 'This invitation link is invalid or has expired.';
    // The already-used case ends with an inline "Sign in" prompt.
    const alreadyUsed = /already used/i.test(msg);
    return (
      <ErrorScreen
        title={alreadyUsed ? 'Already registered' : 'Invalid link'}
        body={msg}
        cta={alreadyUsed ? { label: 'Sign in →', to: '/login' } : undefined}
      />
    );
  }
  if (!preview) return null;

  const expires = new Date(preview.expires_at);
  const expiresLabel = expires.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="min-h-screen bg-paper py-10 px-4">
      <div className="max-w-lg mx-auto">
        <header className="mb-6 text-center">
          <h1 className="font-display text-2xl font-medium m-0">Set up your caseworker login</h1>
          <p className="text-sm text-ink-soft mt-2">
            Furnish Hope has approved <strong>{preview.agency_name}</strong> as a referring partner. Create a username and password to start submitting referrals.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div className="p-3 bg-cream-soft rounded text-sm">
            <div className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-1">
              <div className="text-ink-faint uppercase text-[10px] tracking-widest pt-0.5">Name</div>
              <div>{preview.first_name} {preview.last_name}</div>
              <div className="text-ink-faint uppercase text-[10px] tracking-widest pt-0.5">Email</div>
              <div className="break-all">{preview.email}</div>
              <div className="text-ink-faint uppercase text-[10px] tracking-widest pt-0.5">Agency</div>
              <div>{preview.agency_name}</div>
              <div className="text-ink-faint uppercase text-[10px] tracking-widest pt-0.5">Expires</div>
              <div>{expiresLabel}</div>
            </div>
          </div>

          <div>
            <label className="field-label">Username <span className="text-terracotta">*</span></label>
            <input
              type="text"
              className="field-input"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="e.g. csmith"
            />
            <div className="text-[11px] text-ink-faint mt-0.5">3–50 characters. Letters, numbers, dot, dash, underscore.</div>
          </div>

          <div>
            <label className="field-label">Password <span className="text-terracotta">*</span></label>
            <input
              type="password"
              className="field-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <div className="text-[11px] text-ink-faint mt-0.5">At least 8 characters. Use something you'll remember.</div>
          </div>

          <div>
            <label className="field-label">Confirm password <span className="text-terracotta">*</span></label>
            <input
              type="password"
              className="field-input"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          {err && (
            <div className="p-3 bg-terracotta-soft text-terracotta-deep rounded text-sm">{err}</div>
          )}

          <div className="flex justify-end pt-3 border-t border-hairline">
            <button
              type="submit"
              disabled={submitMut.isPending}
              className="btn-primary disabled:opacity-60"
            >
              {submitMut.isPending ? 'Creating account…' : 'Create account + sign in'}
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-ink-faint mt-4">
          Already registered? <Link to="/login" className="text-terracotta hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

/* ------------------------------ helpers ------------------------------ */

function ErrorScreen({ title, body, cta }: { title: string; body: string; cta?: { label: string; to: string } }) {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="card max-w-md w-full text-center">
        <h1 className="font-display text-xl font-medium m-0 mb-2">{title}</h1>
        <p className="text-sm text-ink-soft">{body}</p>
        {cta && (
          <div className="mt-4">
            <Link to={cta.to} className="btn-primary inline-flex">{cta.label}</Link>
          </div>
        )}
      </div>
    </div>
  );
}
