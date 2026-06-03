import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { apiDelete, apiGet, apiPost, formatShortDate, formatLongDate } from '../lib/api.ts';
import { Avatar, Loading, ErrorBox } from '../components/ui.tsx';
import { EmailWidget } from '../components/email/EmailWidget.tsx';
import { AttachmentsWidget } from '../components/attachments/AttachmentsWidget.tsx';
import { DetailNavBar } from '../components/forms/FormNavBar.tsx';

type Detail = {
  volunteer: any;
  skills: Array<{ skill_id: number; skill: string }>;
  hours: Array<any>;
  totals: { hours_ytd: number | string; hours_lifetime: number | string; deliveries: number };
  prevId: number | null;
  nextId: number | null;
};

type Lookup = Array<{ id: number; label: string }>;

export function VolunteerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery<Detail>({
    queryKey: ['volunteer', id],
    queryFn: () => apiGet(`/api/volunteers/${id}`),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiDelete(`/api/volunteers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['volunteers'] });
      navigate('/volunteers');
    },
    onError: (err: any) => window.alert(err.message ?? 'Delete failed'),
  });

  function handleDelete() {
    if (window.confirm('Permanently delete this volunteer? This cannot be undone.')) deleteMut.mutate();
  }

  const { data: activityTypes } = useQuery<Lookup>({
    queryKey: ['lookup', 'volunteer_activity_type'],
    queryFn: () => apiGet('/api/lookups/volunteer_activity_type'),
  });

  const [showForm, setShowForm] = useState(false);
  const [activityType, setActivityType] = useState<string>('');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().slice(0, 10));
  const [hoursLogged, setHoursLogged] = useState('');
  const [notes, setNotes] = useState('');

  const logHours = useMutation({
    mutationFn: () => apiPost(`/api/volunteers/${id}/hours`, {
      volunteer_activity_type_id: Number(activityType),
      activity_date: activityDate,
      hours_logged: Number(hoursLogged),
      notes: notes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['volunteer', id] });
      qc.invalidateQueries({ queryKey: ['volunteers'] });
      setShowForm(false);
      setActivityType('');
      setHoursLogged('');
      setNotes('');
    },
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;

  const v = data.volunteer;
  const fullName = `${v.first_name} ${v.last_name}`;

  return (
    <>
      <DetailNavBar
        listLabel="volunteers" singularLabel="volunteer" basePath="/volunteers"
        prevId={data.prevId} nextId={data.nextId}
        actions={
          <>
            <Link to="/volunteers/new" className="text-xs text-ink-soft hover:text-terracotta border border-hairline-strong px-3 py-1 rounded-md hover:border-terracotta">+ New volunteer</Link>
            <Link to={`/volunteers/${id}/edit`} className="btn-primary text-xs py-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </Link>
          </>
        }
      />

      <div className="flex gap-5 p-5 bg-cream border border-hairline rounded-[10px] mb-6">
        <Avatar name={fullName} size="lg" />
        <div className="flex-1">
          <div className="flex items-baseline gap-3.5 mb-1">
            <div className="font-display text-2xl font-medium">{fullName}</div>
            <span className="pill pill-terra">Volunteer</span>
          </div>
          <div className="flex gap-4 text-sm text-ink-soft flex-wrap">
            {v.mobile_phone && <span>{v.mobile_phone}</span>}
            {v.email && <><span>·</span><span>{v.email}</span></>}
            <span>·</span>
            <span>Since {formatLongDate(v.hire_date)}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-5 text-right">
          <Stat label="YTD" value={Number(data.totals.hours_ytd ?? 0).toFixed(1)} suffix="hrs" />
          <Stat label="Lifetime" value={Number(data.totals.hours_lifetime ?? 0).toFixed(1)} suffix="hrs" />
          <Stat label="Deliveries" value={String(data.totals.deliveries)} />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-5">
        <div className="space-y-4">
          {/* Email widget — your messages with this staff/volunteer */}
          <EmailWidget email={v.email ?? null} displayName={fullName} />

          <div className="card">
          <div className="card-head">
            <h3 className="font-display font-medium text-[17px] m-0">Hours log</h3>
            <button className="btn-primary text-xs py-1.5 px-3" onClick={() => setShowForm(s => !s)}>
              {showForm ? 'Cancel' : '+ Log hours'}
            </button>
          </div>

          {showForm && (
            <div className="bg-cream border border-hairline rounded-md p-4 mb-4">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="field-label">Activity</label>
                  <select
                    className="field-input"
                    value={activityType}
                    onChange={(e) => setActivityType(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {(activityTypes ?? []).map(a => (
                      <option key={a.id} value={a.id}>{a.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">Date</label>
                  <input type="date" className="field-input" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-3 mb-3">
                <div>
                  <label className="field-label">Hours</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    className="field-input"
                    value={hoursLogged}
                    onChange={(e) => setHoursLogged(e.target.value)}
                    placeholder="3.5"
                  />
                </div>
                <div>
                  <label className="field-label">Notes (optional)</label>
                  <input
                    type="text"
                    className="field-input"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="What did you do?"
                  />
                </div>
              </div>
              {logHours.error && (
                <div className="text-sm text-terracotta-deep mb-2">{(logHours.error as Error).message}</div>
              )}
              <div className="flex justify-end">
                <button
                  className="btn-primary text-xs"
                  onClick={() => logHours.mutate()}
                  disabled={!activityType || !hoursLogged || logHours.isPending}
                >
                  {logHours.isPending ? 'Saving…' : 'Save entry'}
                </button>
              </div>
            </div>
          )}

          {data.hours.length === 0 ? (
            <div className="text-center text-ink-faint py-6 text-sm">No hours logged yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Date</th>
                  <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Activity</th>
                  <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Notes</th>
                  <th className="text-right text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Hours</th>
                </tr>
              </thead>
              <tbody>
                {data.hours.map((h: any) => (
                  <tr key={h.volunteer_hours_id} className="border-t border-hairline">
                    <td className="py-2.5 pr-3">{formatShortDate(h.activity_date)}</td>
                    <td className="py-2.5 pr-3">{h.volunteer_activity_type}</td>
                    <td className="py-2.5 pr-3 text-ink-soft text-xs">{h.notes ?? '—'}</td>
                    <td className="py-2.5 text-right font-display font-medium">{Number(h.hours_logged).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="card-head" style={{marginBottom:'10px', paddingBottom:'8px'}}>
              <h3 className="font-display font-medium text-sm m-0">Onboarding</h3>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-ink-faint uppercase tracking-wider text-[10px] font-medium">Waiver</span>
                <span className={`pill ${v.waiver_signed ? 'pill-sage' : 'pill-terra'}`}>
                  {v.waiver_signed ? `Signed ${formatShortDate(v.waiver_signed_date)} · ${v.waiver_version ?? ''}` : 'Not signed'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-faint uppercase tracking-wider text-[10px] font-medium">Background</span>
                <span className={`pill ${pillForBgCheck(v.background_check_status)}`}>
                  {v.background_check_status ?? 'Missing'}
                </span>
              </div>
              {v.background_check_expiration && (
                <div className="text-[11px] text-ink-faint text-right">Expires {formatShortDate(v.background_check_expiration)}</div>
              )}
              <Detail label="Emergency" value={v.emergency_contact_name ?? '—'} />
              <Detail label="Phone" value={v.emergency_contact_phone ?? '—'} />
              <Detail label="T-shirt" value={v.t_shirt_size ?? '—'} />
            </div>
          </div>

          <div className="card">
            <div className="card-head" style={{marginBottom:'10px', paddingBottom:'8px'}}>
              <h3 className="font-display font-medium text-sm m-0">Skills</h3>
            </div>
            {data.skills.length === 0 ? (
              <div className="text-xs text-ink-faint">No skills recorded.</div>
            ) : (
              <div className="flex gap-1.5 flex-wrap">
                {data.skills.map(s => (
                  <span key={s.skill_id} className="pill pill-muted">{s.skill}</span>
                ))}
              </div>
            )}
          </div>

          <button onClick={handleDelete} disabled={deleteMut.isPending}
            className="text-xs text-terracotta hover:text-terracotta-deep disabled:opacity-50 self-start">
            {deleteMut.isPending ? 'Deleting…' : 'Delete this volunteer'}
          </button>
        </div>
      </div>

      <div className="mt-5">
        <AttachmentsWidget entityType="volunteer" entityId={Number(id)} title="Documents (waivers, background check, training)" />
      </div>
    </>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div>
      <div className="text-[10px] tracking-widest uppercase text-ink-faint font-medium">{label}</div>
      <div className="font-display text-2xl font-medium leading-none mt-1">
        {value}{suffix ? <span className="text-sm text-ink-soft ml-1">{suffix}</span> : null}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[11px] mt-1.5">
      <span className="text-ink-faint uppercase tracking-wider text-[10px] font-medium">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

function pillForBgCheck(status: string | null): string {
  const s = (status ?? '').toLowerCase();
  if (s === 'cleared') return 'pill-sage';
  if (s === 'pending') return 'pill-gold';
  if (s === 'expired' || s === 'denied') return 'pill-terra';
  return 'pill-muted';
}
