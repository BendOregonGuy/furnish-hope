import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiGet, formatShortDate } from '../lib/api.ts';
import { PageHeader, Avatar, Loading, ErrorBox, EmptyState } from '../components/ui.tsx';

type Volunteer = {
  facility_staff_id: number;
  name: string;
  mobile_phone: string | null;
  email: string | null;
  hire_date: string | null;
  waiver_signed: boolean | null;
  background_check_status: string | null;
  background_check_expiration: string | null;
  staff_type: string | null;
  status: string | null;
  hours_ytd: number | string;
  skills: string[] | null;
};

export function Volunteers() {
  const { data, isLoading, error } = useQuery<Volunteer[]>({
    queryKey: ['volunteers'],
    queryFn: () => apiGet('/api/volunteers'),
  });

  return (
    <>
      <PageHeader
        helpSection="volunteers-manual"
        title="Volunteers"
        emphasis="& staff"
        subtitle="Onboarding status, hours, and skills. Volunteers are the heart of the Cycle of Hope."
        actions={
          <Link to="/volunteers/new" className="btn-primary">
            <span className="text-base leading-none">+</span> Add volunteer
          </Link>
        }
      />

      {isLoading && <Loading />}
      {error && <ErrorBox error={error} />}
      {data && data.length === 0 && <EmptyState title="No volunteers yet" />}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map(v => (
            <Link
              key={v.facility_staff_id}
              to={`/volunteers/${v.facility_staff_id}`}
              className="card grid grid-cols-[1fr_180px_220px_120px] gap-5 items-center hover:border-hairline-strong transition"
            >
              <div className="flex items-center gap-3">
                <Avatar name={v.name} size="md" />
                <div>
                  <div className="font-medium">{v.name}</div>
                  <div className="text-[11px] text-ink-faint">
                    {v.staff_type ?? 'Volunteer'} · since {formatShortDate(v.hire_date)}
                  </div>
                  {v.mobile_phone && <div className="text-[11px] text-ink-faint mt-0.5">{v.mobile_phone}</div>}
                </div>
              </div>

              <div>
                <div className="text-[10px] tracking-widest uppercase text-ink-faint font-medium mb-1">Onboarding</div>
                <div className="flex gap-1.5 flex-wrap">
                  <span className={`pill ${v.waiver_signed ? 'pill-sage' : 'pill-terra'}`}>
                    {v.waiver_signed ? 'Waiver signed' : 'No waiver'}
                  </span>
                  <span className={`pill ${pillForBgCheck(v.background_check_status)}`}>
                    BG {v.background_check_status ?? 'missing'}
                  </span>
                </div>
              </div>

              <div>
                <div className="text-[10px] tracking-widest uppercase text-ink-faint font-medium mb-1">Skills</div>
                <div className="flex gap-1 flex-wrap">
                  {(v.skills ?? []).slice(0, 3).map(s => (
                    <span key={s} className="pill pill-muted">{s}</span>
                  ))}
                  {v.skills && v.skills.length > 3 && (
                    <span className="text-[11px] text-ink-faint self-center">+{v.skills.length - 3}</span>
                  )}
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] tracking-widest uppercase text-ink-faint font-medium mb-1">Hours YTD</div>
                <div className="font-display text-2xl font-medium leading-none">{Number(v.hours_ytd ?? 0).toFixed(1)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function pillForBgCheck(status: string | null): string {
  const s = (status ?? '').toLowerCase();
  if (s === 'cleared') return 'pill-sage';
  if (s === 'pending') return 'pill-gold';
  if (s === 'expired' || s === 'denied') return 'pill-terra';
  return 'pill-muted';
}
