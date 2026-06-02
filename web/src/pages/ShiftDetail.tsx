/**
 * Volunteer shift detail. Shows the shift basics plus the signup list
 * with inline controls to add signups, mark attendance, and log hours.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { apiGet, apiPost, apiPut, formatLongDate } from '../lib/api.ts';
import { Loading, ErrorBox, StatusPill } from '../components/ui.tsx';
import { DetailNavBar } from '../components/forms/FormNavBar.tsx';
import { FkSelectWithCreate } from '../components/admin/FkSelectWithCreate.tsx';
import { FacilityStaffQuickCreateModal } from '../components/quickCreate/FacilityStaffQuickCreateModal.tsx';

interface Signup {
  signup_id: number;
  facility_staff_id: number;
  signup_status: 'signed_up' | 'cancelled' | 'attended' | 'no_show';
  hours_logged: number | string | null;
  notes: string | null;
  signed_up_at: string;
  volunteer_name: string;
  mobile_phone: string | null;
  email: string | null;
  is_volunteer: boolean;
}

interface ShiftDetail {
  shift: {
    shift_id: number;
    shift_type: string;
    shift_status: string;
    shift_name: string | null;
    shift_date: string;
    start_time: string | null;
    end_time: string | null;
    capacity_needed: number;
    facility_name: string | null;
    notes: string | null;
  };
  signups: Signup[];
  prevId: number | null;
  nextId: number | null;
}

export function ShiftDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [addingId, setAddingId] = useState<number | null>(null);
  const [addingNotes, setAddingNotes] = useState('');

  const { data, isLoading, error } = useQuery<ShiftDetail>({
    queryKey: ['shift', id],
    queryFn: () => apiGet(`/api/shifts/${id}`),
  });

  const addMut = useMutation({
    mutationFn: () => apiPost(`/api/shifts/${id}/signup`, { facility_staff_id: addingId, notes: addingNotes || null }),
    onSuccess: () => {
      setAddingId(null);
      setAddingNotes('');
      qc.invalidateQueries({ queryKey: ['shift', id] });
    },
    onError: (e: any) => window.alert(e.message ?? 'Signup failed'),
  });

  const cancelMut = useMutation({
    mutationFn: (sid: number) => apiPost(`/api/shifts/${id}/signup/${sid}/cancel`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shift', id] }),
    onError: (e: any) => window.alert(e.message ?? 'Cancel failed'),
  });

  const attendMut = useMutation({
    mutationFn: (rows: { signup_id: number; signup_status: string; hours_logged: number | null }[]) =>
      apiPut(`/api/shifts/${id}/attendance`, { rows }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shift', id] }),
    onError: (e: any) => window.alert(e.message ?? 'Attendance update failed'),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;

  const s = data.shift;
  const active = data.signups.filter(u => u.signup_status !== 'cancelled');
  const cancelled = data.signups.filter(u => u.signup_status === 'cancelled');

  return (
    <>
      <DetailNavBar
        listLabel="shifts" singularLabel="shift" basePath="/shifts"
        prevId={data.prevId} nextId={data.nextId}
        actions={
          <>
            <Link to="/shifts/new" className="text-xs text-ink-soft hover:text-terracotta border border-hairline-strong px-3 py-1 rounded-md hover:border-terracotta">+ New shift</Link>
            <Link to={`/shifts/${id}/edit`} className="btn-primary text-xs py-1.5">Edit</Link>
          </>
        }
      />

      <div className="flex gap-5 p-5 bg-cream border border-hairline rounded-[10px] mb-6">
        <div className="flex-1">
          <div className="flex items-baseline gap-3.5 mb-1 flex-wrap">
            <div className="font-display text-2xl font-medium">{s.shift_name ?? s.shift_type}</div>
            <span className="pill pill-terra">{s.shift_type}</span>
            <StatusPill status={s.shift_status} />
          </div>
          <div className="flex gap-4 text-sm text-ink-soft flex-wrap">
            <span>{formatLongDate(s.shift_date)}</span>
            {s.start_time && s.end_time && <><span>·</span><span>{formatTime(s.start_time)} – {formatTime(s.end_time)}</span></>}
            {s.facility_name && <><span>·</span><span>{s.facility_name}</span></>}
          </div>
          {s.notes && <div className="text-sm text-ink-soft mt-2 whitespace-pre-line">{s.notes}</div>}
        </div>
        <div className="text-right">
          <div className="text-[11px] text-ink-faint tracking-widest uppercase font-medium">Filled</div>
          <div className="font-display text-3xl font-medium leading-none">
            {active.length} / {s.capacity_needed}
          </div>
        </div>
      </div>

      <div className="card mb-5">
        <div className="card-head">
          <h3 className="font-display font-medium text-[17px] m-0">Signups</h3>
          <span className="text-xs text-ink-faint">{active.length} active{cancelled.length > 0 ? ` · ${cancelled.length} cancelled` : ''}</span>
        </div>

        {active.length === 0 && (
          <div className="text-sm text-ink-faint italic py-4">No one signed up yet.</div>
        )}
        {active.length > 0 && (
          <table className="w-full text-sm mb-4">
            <thead className="text-[10px] uppercase tracking-widest text-ink-faint">
              <tr className="border-b border-hairline">
                <th className="text-left py-2 pr-3 font-medium">Volunteer</th>
                <th className="text-left py-2 pr-3 font-medium">Contact</th>
                <th className="text-left py-2 pr-3 font-medium">Status</th>
                <th className="text-right py-2 pr-3 font-medium">Hours</th>
                <th className="w-32"></th>
              </tr>
            </thead>
            <tbody>
              {active.map(u => (
                <tr key={u.signup_id} className="border-b border-hairline/60">
                  <td className="py-2.5 pr-3">
                    <div className="font-medium">{u.volunteer_name}</div>
                    {u.is_volunteer && <span className="pill pill-sage text-[9px] py-0">Volunteer</span>}
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-ink-soft">{u.email ?? u.mobile_phone ?? '—'}</td>
                  <td className="py-2.5 pr-3">
                    <select
                      value={u.signup_status}
                      onChange={e => attendMut.mutate([{
                        signup_id: u.signup_id,
                        signup_status: e.target.value,
                        hours_logged: u.hours_logged != null ? Number(u.hours_logged) : null,
                      }])}
                      className="field-input text-xs py-1"
                    >
                      <option value="signed_up">Signed up</option>
                      <option value="attended">Attended</option>
                      <option value="no_show">No-show</option>
                    </select>
                  </td>
                  <td className="py-2.5 pr-3 text-right">
                    <input
                      type="number" step="0.25" min="0"
                      defaultValue={u.hours_logged ?? ''}
                      onBlur={e => attendMut.mutate([{
                        signup_id: u.signup_id,
                        signup_status: u.signup_status,
                        hours_logged: e.target.value ? Number(e.target.value) : null,
                      }])}
                      className="field-input text-xs py-1 w-20 text-right"
                      placeholder="—"
                    />
                  </td>
                  <td className="py-2.5 pr-3 text-right">
                    <button
                      onClick={() => cancelMut.mutate(u.signup_id)}
                      className="text-xs text-terracotta hover:text-terracotta-deep"
                    >
                      Cancel signup
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Add signup */}
        <div className="border-t border-hairline pt-4">
          <div className="text-[10px] tracking-widest uppercase text-ink-faint font-medium mb-2">Add signup</div>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <div>
              <label className="field-label">Volunteer / staff</label>
              <FkSelectWithCreate
                fkTable="tbl_facility_staff"
                value={addingId}
                onChange={setAddingId}
                newButtonLabel="+ New"
                renderModal={ctx => <FacilityStaffQuickCreateModal {...ctx} />}
              />
            </div>
            <div>
              <label className="field-label">Notes (optional)</label>
              <input type="text" className="field-input" value={addingNotes} onChange={e => setAddingNotes(e.target.value)} maxLength={200} />
            </div>
            <button
              onClick={() => addMut.mutate()}
              disabled={!addingId || addMut.isPending}
              className="btn-primary disabled:opacity-50"
            >
              {addMut.isPending ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>
      </div>

      {cancelled.length > 0 && (
        <details className="card mb-5">
          <summary className="cursor-pointer text-xs text-ink-faint">
            {cancelled.length} cancelled signup{cancelled.length === 1 ? '' : 's'} (click to view)
          </summary>
          <table className="w-full text-sm mt-3">
            <tbody>
              {cancelled.map(u => (
                <tr key={u.signup_id} className="border-t border-hairline/60">
                  <td className="py-2 pr-3 line-through text-ink-faint">{u.volunteer_name}</td>
                  <td className="py-2 pr-3 text-xs text-ink-faint">{u.email ?? u.mobile_phone ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </>
  );
}

function formatTime(t: string): string {
  const [hh, mm] = t.split(':');
  let h = Number(hh);
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${mm} ${ampm}`;
}
