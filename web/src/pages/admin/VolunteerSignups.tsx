/**
 * Admin → Volunteer applications: list + per-signup review page.
 *
 * Routes:
 *   /admin/volunteer-signups          — list, filtered by status
 *   /admin/volunteer-signups/:id      — detail with Approve / Reject
 *
 * Approving creates a real tbl_contact + tbl_facility_staff
 * record server-side. The detail page then surfaces a link to
 * the new volunteer's facility-staff page.
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, formatLongDate } from '../../lib/api.ts';
import { PageHeader, Loading, ErrorBox, Avatar } from '../../components/ui.tsx';
import { HelpLink } from '../../components/HelpLink.tsx';

interface ListRow {
  signup_id: number;
  first_name: string;
  last_name: string;
  email: string;
  mobile_phone: string;
  city: string | null;
  frequency: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  any_activity: boolean;
}

/* ----------------------------------------------------------------- */
/*  List                                                              */
/* ----------------------------------------------------------------- */

export function VolunteerSignups() {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const { data, isLoading, error } = useQuery<ListRow[]>({
    queryKey: ['volunteer-signups', status],
    queryFn: () => apiGet('/api/admin/volunteer-signups', { status }),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const rows = data ?? [];

  return (
    <>
      <PageHeader
        title="Volunteer applications"
        subtitle="Submissions from the public volunteer form. Approve to create a real volunteer record."
        actions={<HelpLink section="volunteers" />}
      />

      <div className="mb-5 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">Status</span>
        <div className="flex border border-hairline-strong rounded-md overflow-hidden">
          {(['pending', 'approved', 'rejected', 'all'] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 text-xs ${status === s ? 'bg-terracotta text-paper' : 'bg-paper hover:bg-cream'}`}
            >
              {s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-ink-faint">{rows.length} {rows.length === 1 ? 'application' : 'applications'}</span>
      </div>

      {rows.length === 0 ? (
        <div className="card text-sm text-ink-faint italic text-center py-10">
          {status === 'pending'
            ? 'No applications waiting for review.'
            : `No ${status === 'all' ? '' : status} applications.`}
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr>
              <Th>Applicant</Th>
              <Th>City</Th>
              <Th>How often</Th>
              <Th>Submitted</Th>
              <Th>Status</Th>
              <Th>{' '}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.signup_id} className="border-t border-hairline">
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={`${r.first_name} ${r.last_name}`} />
                    <div>
                      <div className="font-medium">{r.first_name} {r.last_name}</div>
                      <div className="text-[11px] text-ink-faint">{r.email} · {r.mobile_phone}</div>
                    </div>
                  </div>
                </td>
                <td className="py-2.5 pr-3 text-xs">{r.city ?? '—'}</td>
                <td className="py-2.5 pr-3 text-xs">{labelFrequency(r.frequency)}</td>
                <td className="py-2.5 pr-3 text-xs">{formatLongDate(r.submitted_at)}</td>
                <td className="py-2.5 pr-3">
                  <span className={`pill ${pillForStatus(r.status)}`}>{r.status}</span>
                </td>
                <td className="py-2.5 text-right">
                  <Link to={`/admin/volunteer-signups/${r.signup_id}`} className="text-xs text-terracotta hover:text-terracotta-deep">
                    Review →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

/* ----------------------------------------------------------------- */
/*  Detail + actions                                                  */
/* ----------------------------------------------------------------- */

interface DetailRow {
  signup_id: number;
  first_name: string; last_name: string;
  email: string; mobile_phone: string;
  city: string | null; state_id: number | null; state_name: string | null; postalcode: string | null;
  date_of_birth: string | null;
  emergency_contact_name: string | null; emergency_contact_phone: string | null;
  frequency: string;
  start_date: string | null; end_date: string | null;
  avail_mon: boolean; avail_tue: boolean; avail_wed: boolean; avail_thu: boolean;
  avail_fri: boolean; avail_sat: boolean; avail_sun: boolean;
  time_morning: boolean; time_afternoon: boolean; time_evening: boolean;
  act_pickups: boolean; act_deliveries: boolean; act_warehouse: boolean; act_events: boolean;
  act_admin: boolean; act_photography: boolean; act_trades: boolean; act_anywhere: boolean;
  can_lift: string;
  has_drivers_license: boolean; has_vehicle: boolean;
  special_skills: string | null;
  heard_from_id: number | null; heard_from_label: string | null;
  why_interested: string | null;
  needs_verified_hours: boolean;
  agreed_to_waiver: boolean; agreed_to_emails: boolean;
  status: string;
  submitted_at: string; submitted_ip: string | null;
  reviewed_at: string | null; reviewer_name: string | null;
  review_notes: string | null;
  approved_facility_staff_id: number | null;
}

const ACTIVITY_LABELS: Array<[keyof DetailRow & `act_${string}`, string]> = [
  ['act_pickups',     'Donation pickups'],
  ['act_deliveries',  'Furniture delivery'],
  ['act_warehouse',   'Warehouse sorting'],
  ['act_events',      'Event support'],
  ['act_admin',       'Admin / data entry'],
  ['act_photography', 'Photography / social media'],
  ['act_trades',      'Specialized trades'],
  ['act_anywhere',    'Wherever needed'],
];

const DAY_LABELS: Array<[keyof DetailRow & `avail_${string}`, string]> = [
  ['avail_mon', 'Mon'], ['avail_tue', 'Tue'], ['avail_wed', 'Wed'],
  ['avail_thu', 'Thu'], ['avail_fri', 'Fri'], ['avail_sat', 'Sat'],
  ['avail_sun', 'Sun'],
];

export function VolunteerSignupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');

  const { data, isLoading, error } = useQuery<DetailRow>({
    queryKey: ['volunteer-signup', id],
    queryFn: () => apiGet(`/api/admin/volunteer-signups/${id}`),
  });

  const approveMut = useMutation({
    mutationFn: () => apiPost<{ facility_staff_id: number }>(`/api/admin/volunteer-signups/${id}/approve`, { review_notes: notes || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteer-signups'] });
      queryClient.invalidateQueries({ queryKey: ['volunteer-signup', id] });
    },
    onError: (e: any) => window.alert(e.message ?? 'Approval failed'),
  });

  const rejectMut = useMutation({
    mutationFn: () => apiPost(`/api/admin/volunteer-signups/${id}/reject`, { review_notes: notes || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteer-signups'] });
      queryClient.invalidateQueries({ queryKey: ['volunteer-signup', id] });
    },
    onError: (e: any) => window.alert(e.message ?? 'Rejection failed'),
  });

  const days = useMemo(() => {
    if (!data) return '';
    return DAY_LABELS.filter(([k]) => data[k]).map(([, l]) => l).join(' · ') || '—';
  }, [data]);

  const times = useMemo(() => {
    if (!data) return '';
    return [
      data.time_morning && 'Morning',
      data.time_afternoon && 'Afternoon',
      data.time_evening && 'Evening',
    ].filter(Boolean).join(' · ') || '—';
  }, [data]);

  const activities = useMemo(() => {
    if (!data) return [];
    return ACTIVITY_LABELS.filter(([k]) => data[k]).map(([, l]) => l);
  }, [data]);

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;

  const isPending = data.status === 'pending';

  return (
    <>
      <PageHeader
        title={`${data.first_name} ${data.last_name}`}
        emphasis={`application #${data.signup_id}`}
        subtitle={`Submitted ${formatLongDate(data.submitted_at)} · ${labelFrequency(data.frequency)}`}
        actions={
          <>
            <Link to="/admin/volunteer-signups" className="btn-ghost text-xs">← Back</Link>
            <HelpLink section="volunteers" />
          </>
        }
      />

      <div className="mb-4">
        <span className={`pill ${pillForStatus(data.status)}`}>{data.status}</span>
        {data.reviewed_at && data.reviewer_name && (
          <span className="ml-3 text-xs text-ink-faint">
            Reviewed by {data.reviewer_name} on {formatLongDate(data.reviewed_at)}
          </span>
        )}
        {data.approved_facility_staff_id && (
          <Link to={`/volunteers/${data.approved_facility_staff_id}`} className="ml-3 text-xs text-sage hover:text-terracotta-deep">
            → Volunteer record #{data.approved_facility_staff_id}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">

          <Card title="Contact">
            <Row label="Email"   value={data.email} />
            <Row label="Phone"   value={data.mobile_phone} />
            <Row label="Address" value={
              [data.city, data.state_name, data.postalcode].filter(Boolean).join(', ') || '—'
            } />
            {data.date_of_birth && <Row label="Date of birth" value={data.date_of_birth} />}
            {(data.emergency_contact_name || data.emergency_contact_phone) && (
              <Row label="Emergency contact" value={
                `${data.emergency_contact_name ?? ''}${data.emergency_contact_phone ? ' · ' + data.emergency_contact_phone : ''}`
              } />
            )}
          </Card>

          <Card title="What they want to do">
            <Row label="Frequency"  value={labelFrequency(data.frequency)} />
            <Row label="Activities" value={
              activities.length > 0
                ? <ul className="list-disc pl-5 text-sm">{activities.map(a => <li key={a}>{a}</li>)}</ul>
                : <span className="text-ink-faint italic">No activities selected</span>
            } />
            <Row label="Days"  value={days} />
            <Row label="Times" value={times} />
            {data.start_date && <Row label="Earliest start" value={data.start_date} />}
            {data.end_date && <Row label="End date" value={data.end_date} />}
          </Card>

          <Card title="What they bring">
            <Row label="Can lift" value={labelLift(data.can_lift)} />
            <Row label="Driver's license" value={data.has_drivers_license ? 'Yes' : 'No'} />
            <Row label="Has vehicle" value={data.has_vehicle ? 'Yes' : 'No'} />
            {data.special_skills && <Row label="Special skills" value={
              <span className="whitespace-pre-wrap">{data.special_skills}</span>
            } />}
          </Card>

          <Card title="About">
            {data.heard_from_label && <Row label="Heard about us via" value={data.heard_from_label} />}
            {data.why_interested && <Row label="Why interested" value={
              <span className="whitespace-pre-wrap">{data.why_interested}</span>
            } />}
            <Row label="Needs verified hours" value={data.needs_verified_hours ? 'Yes' : 'No'} />
            <Row label="Agreed to emails" value={data.agreed_to_emails ? 'Yes' : 'No'} />
          </Card>

          {data.review_notes && (
            <Card title="Review notes">
              <div className="text-sm whitespace-pre-wrap">{data.review_notes}</div>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          {isPending ? (
            <Card title="Decision">
              <label className="field-label">Review notes (optional)</label>
              <textarea
                rows={4}
                className="field-input font-sans"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Anything to record about this decision?"
              />
              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Approve ${data.first_name} ${data.last_name}? This creates a real volunteer record + contact.`)) {
                      approveMut.mutate();
                    }
                  }}
                  disabled={approveMut.isPending || rejectMut.isPending}
                  className="btn-primary w-full disabled:opacity-60"
                >
                  {approveMut.isPending ? 'Approving…' : '✓ Approve'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Reject this application?`)) {
                      rejectMut.mutate();
                    }
                  }}
                  disabled={approveMut.isPending || rejectMut.isPending}
                  className="w-full text-sm text-terracotta-deep border border-terracotta px-3 py-2 rounded hover:bg-terracotta-soft disabled:opacity-60"
                >
                  {rejectMut.isPending ? 'Rejecting…' : '✗ Reject'}
                </button>
              </div>
              <div className="mt-3 text-[11px] text-ink-faint">
                Approval creates a tbl_contact + tbl_facility_staff record with is_volunteer = true.
              </div>
            </Card>
          ) : (
            <Card title="Audit">
              <Row label="Submitted IP" value={data.submitted_ip ?? '—'} />
              {data.reviewed_at && (
                <>
                  <Row label="Reviewed at" value={formatLongDate(data.reviewed_at)} />
                  <Row label="Reviewed by" value={data.reviewer_name ?? '—'} />
                </>
              )}
            </Card>
          )}
        </div>
      </div>

      {data.status === 'approved' && (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => navigate(`/volunteers/${data.approved_facility_staff_id}`)}
            className="btn-primary"
          >
            Open volunteer record →
          </button>
        </div>
      )}
    </>
  );
}

/* ---------- small helpers ---------- */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3 className="font-display font-medium text-[15px] m-0 mb-2 pb-1 border-b border-hairline">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm py-1.5 border-b border-hairline last:border-b-0">
      <div className="text-[10px] uppercase tracking-widest text-ink-faint font-medium pt-0.5">{label}</div>
      <div className="text-ink">{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">{children}</th>;
}

function labelFrequency(f: string): string {
  if (f === 'one_time')  return 'One-time';
  if (f === 'recurring') return 'Recurring';
  if (f === 'on_call')   return 'On-call';
  return f;
}

function labelLift(v: string): string {
  if (v === 'under_25') return 'Under 25 lbs';
  if (v === '25_50')    return '25–50 lbs';
  if (v === '50_plus')  return '50+ lbs';
  if (v === 'cannot')   return "Can't lift";
  return v;
}

function pillForStatus(s: string): string {
  if (s === 'approved') return 'pill-sage';
  if (s === 'pending')  return 'pill-gold';
  if (s === 'rejected') return 'pill-terra';
  return 'pill-muted';
}
