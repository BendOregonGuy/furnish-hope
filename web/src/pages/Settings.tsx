/**
 * Per-user settings: change password + edit own contact info. Each user
 * reaches this from the sidebar avatar.
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '../lib/api.ts';
import { useAuth } from '../lib/auth.tsx';
import { PageHeader, Loading } from '../components/ui.tsx';

interface ProfileResponse {
  linked: boolean;
  contact: {
    contact_id: number;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    mobile_phone: string | null;
    home_phone: string | null;
    other_phone: string | null;
    email: string | null;
  } | null;
}

export function Settings() {
  const { user, refresh } = useAuth();
  const queryClient = useQueryClient();

  /* ---------- Password change ---------- */
  const [current, setCurrent] = useState('');
  const [nextPw, setNextPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null); setPwSuccess(false);
    if (nextPw !== confirm) { setPwError("New passwords don't match."); return; }
    if (nextPw.length < 8) { setPwError('New password must be at least 8 characters.'); return; }
    setPwLoading(true);
    try {
      await apiPost('/api/auth/password', { current, new: nextPw });
      setCurrent(''); setNextPw(''); setConfirm('');
      setPwSuccess(true);
    } catch (err: any) {
      setPwError(err.message ?? 'Password change failed.');
    } finally {
      setPwLoading(false);
    }
  }

  /* ---------- Profile (contact info) ---------- */
  const { data: profile, isLoading: loadingProfile } = useQuery<ProfileResponse>({
    queryKey: ['profile'],
    queryFn: () => apiGet('/api/auth/profile'),
  });

  const [pf, setPf] = useState({
    first_name: '', middle_name: '', last_name: '',
    mobile_phone: '', home_phone: '', other_phone: '', email: '',
  });
  const [pfDirty, setPfDirty] = useState(false);
  const [pfError, setPfError] = useState<string | null>(null);
  const [pfSuccess, setPfSuccess] = useState(false);

  useEffect(() => {
    if (profile?.contact) {
      const c = profile.contact;
      setPf({
        first_name:   c.first_name ?? '',
        middle_name:  c.middle_name ?? '',
        last_name:    c.last_name ?? '',
        mobile_phone: c.mobile_phone ?? '',
        home_phone:   c.home_phone ?? '',
        other_phone:  c.other_phone ?? '',
        email:        c.email ?? '',
      });
      setPfDirty(false);
    }
  }, [profile]);

  function setPfField(name: keyof typeof pf, v: string) {
    setPf(prev => ({ ...prev, [name]: v }));
    setPfDirty(true);
    setPfSuccess(false);
  }

  const profileMut = useMutation({
    mutationFn: (body: any) => apiPut<{ user: any }>('/api/auth/profile', body),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      await refresh(); // pull the new display_name into the sidebar avatar
      setPfDirty(false);
      setPfSuccess(true);
      setPfError(null);
    },
    onError: (err: any) => setPfError(err.message ?? 'Profile update failed.'),
  });

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pf.first_name.trim() || !pf.last_name.trim()) {
      setPfError('First and last name are required.');
      return;
    }
    profileMut.mutate({
      first_name:   pf.first_name.trim(),
      middle_name:  pf.middle_name.trim() || null,
      last_name:    pf.last_name.trim(),
      mobile_phone: pf.mobile_phone.trim() || null,
      home_phone:   pf.home_phone.trim() || null,
      other_phone:  pf.other_phone.trim() || null,
      email:        pf.email.trim() || null,
    });
  }

  return (
    <>
      <PageHeader
        helpSection="profile"
        title="Account"
        emphasis="settings"
        subtitle={`Signed in as ${user?.display_name ?? user?.username}.`}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-5xl">
        {/* --- Profile card --- */}
        <form onSubmit={handleProfileSubmit} className="card space-y-4">
          <div>
            <h3 className="font-display text-lg font-medium m-0">Profile</h3>
            <div className="text-xs text-ink-faint mt-0.5">How you appear in the app and audit log.</div>
          </div>

          {loadingProfile ? <Loading /> : (
            profile?.linked === false ? (
              <div className="text-sm text-ink-faint italic">
                Your account isn't linked to a staff record yet. Ask an admin to link it via Database Admin → User accounts.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">First name *</label>
                    <input className="field-input" value={pf.first_name}
                      onChange={e => setPfField('first_name', e.target.value)} required />
                  </div>
                  <div>
                    <label className="field-label">Last name *</label>
                    <input className="field-input" value={pf.last_name}
                      onChange={e => setPfField('last_name', e.target.value)} required />
                  </div>
                </div>
                <div>
                  <label className="field-label">Middle name</label>
                  <input className="field-input" value={pf.middle_name}
                    onChange={e => setPfField('middle_name', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Mobile phone</label>
                    <input className="field-input" value={pf.mobile_phone}
                      onChange={e => setPfField('mobile_phone', e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">Home phone</label>
                    <input className="field-input" value={pf.home_phone}
                      onChange={e => setPfField('home_phone', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Other phone</label>
                    <input className="field-input" value={pf.other_phone}
                      onChange={e => setPfField('other_phone', e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">Email</label>
                    <input type="email" className="field-input" value={pf.email}
                      onChange={e => setPfField('email', e.target.value)} />
                  </div>
                </div>

                {pfError && <div className="p-2.5 bg-terracotta-soft text-terracotta-deep rounded-md text-xs">{pfError}</div>}
                {pfSuccess && <div className="p-2.5 bg-sage-soft text-[#3F4A33] rounded-md text-xs">Profile updated.</div>}

                <div className="flex justify-end gap-2 pt-1">
                  <button type="submit"
                    disabled={!pfDirty || profileMut.isPending}
                    className="btn-primary disabled:opacity-60">
                    {profileMut.isPending ? 'Saving…' : 'Save profile'}
                  </button>
                </div>
              </>
            )
          )}
        </form>

        {/* --- Password card --- */}
        <form onSubmit={handlePasswordSubmit} className="card space-y-4">
          <div>
            <h3 className="font-display text-lg font-medium m-0">Change password</h3>
            <div className="text-xs text-ink-faint mt-0.5">Use a strong password you'll remember.</div>
          </div>

          <div>
            <label className="field-label">Current password</label>
            <input type="password" autoComplete="current-password" className="field-input"
              value={current} onChange={e => setCurrent(e.target.value)} required />
          </div>

          <div>
            <label className="field-label">New password</label>
            <input type="password" autoComplete="new-password" className="field-input"
              value={nextPw} onChange={e => setNextPw(e.target.value)} required minLength={8} />
            <div className="text-[11px] text-ink-faint mt-1">At least 8 characters.</div>
          </div>

          <div>
            <label className="field-label">Confirm new password</label>
            <input type="password" autoComplete="new-password" className="field-input"
              value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} />
          </div>

          {pwError && <div className="p-2.5 bg-terracotta-soft text-terracotta-deep rounded-md text-xs">{pwError}</div>}
          {pwSuccess && <div className="p-2.5 bg-sage-soft text-[#3F4A33] rounded-md text-xs">Password updated.</div>}

          <div className="flex justify-end">
            <button type="submit" disabled={pwLoading} className="btn-primary disabled:opacity-60">
              {pwLoading ? 'Saving…' : 'Update password'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
