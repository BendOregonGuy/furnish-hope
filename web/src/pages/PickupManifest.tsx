/**
 * Print-optimized one-page manifest for a donation pickup. Donor info,
 * pickup address with QR-to-Google-Maps route, access notes, crew +
 * vehicle, blank lines for the items received on-site, IRS-standard
 * donor acknowledgement + dual signature blocks.
 *
 * Rendered at /pickups/:id/manifest. The page auto-opens the browser's
 * Print dialog after data loads so the user can print or save-as-PDF
 * without an extra click.
 */

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { apiGet } from '../lib/api.ts';
import { Loading, ErrorBox } from '../components/ui.tsx';
import { QrCode } from '../components/manifest/QrCode.tsx';
import {
  ManifestPage, ManifestHeader, Section, Field, Grid2, Grid3,
  SignatureLine, BlankItemLine, buildMapsUrl, formatAddress,
} from '../components/manifest/ManifestShell.tsx';

interface OrgInfo {
  org_name: string;
  org_address_line1: string;
  org_address_line2: string;
  org_city: string;
  org_state: string;
  org_postalcode: string;
  org_phone: string;
  org_email: string;
  org_ein: string;
}

interface PickupDetail {
  pickup: {
    pickup_id: number;
    scheduled_date: string;
    time_window_start: string | null;
    time_window_end: string | null;
    pickup_status: string;
    donor_name: string;
    donor_phone: string | null;
    donor_email: string | null;
    is_anonymous: boolean;
    address: string;
    address2: string | null;
    city: string | null;
    state: string | null;
    postalcode: string;
    access_notes: string | null;
    vehicle_license: string | null;
    team_lead: string | null;
    lead_facility_name: string | null;
    lead_facility_address: string | null;
    lead_facility_city: string | null;
    lead_facility_state: string | null;
    lead_facility_postalcode: string | null;
  };
}

export function PickupManifest() {
  const { id } = useParams();

  const { data: pd, isLoading: l1, error: e1 } = useQuery<PickupDetail>({
    queryKey: ['pickup', id],
    queryFn: () => apiGet(`/api/pickups/${id}`),
  });
  const { data: org, isLoading: l2, error: e2 } = useQuery<OrgInfo>({
    queryKey: ['org-info'],
    queryFn: () => apiGet('/api/org-info'),
  });

  if (l1 || l2) return <Loading />;
  if (e1) return <ErrorBox error={e1} />;
  if (e2) return <ErrorBox error={e2} />;
  if (!pd || !org) return null;

  const p = pd.pickup;
  const destination = formatAddress({
    address: p.address, address2: p.address2, city: p.city, state: p.state, postalcode: p.postalcode,
  });
  const origin = formatAddress({
    address: p.lead_facility_address, city: p.lead_facility_city,
    state: p.lead_facility_state, postalcode: p.lead_facility_postalcode,
  });
  const mapsUrl = buildMapsUrl(origin, destination);

  const orgAddress = formatAddress({
    address: org.org_address_line1, address2: org.org_address_line2,
    city: org.org_city, state: org.org_state, postalcode: org.org_postalcode,
  });

  const dateLabel = new Date(p.scheduled_date + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const timeLabel = formatTimeWindow(p.time_window_start, p.time_window_end);

  return (
    <ManifestPage>
      <ManifestHeader
        orgName={org.org_name || 'Furnish Hope'}
        title="Donation Pickup Manifest"
        meta={
          <div>
            <div style={{ fontWeight: 500 }}>Pickup #{p.pickup_id}</div>
            <div>{dateLabel}</div>
            {timeLabel && <div>{timeLabel}</div>}
          </div> as any
        }
      />

      {/* Donor + address + QR */}
      <Section>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 130pt', gap: '18pt' }}>
          <Field label="Donor">
            <div style={{ fontWeight: 500, fontSize: '12pt' }}>{p.donor_name}</div>
            {p.is_anonymous && (
              <div style={{ fontSize: '9pt', color: '#6b6b6b', marginTop: '2pt' }}>
                🔒 Anonymous — do not list publicly
              </div>
            )}
            {p.donor_phone && <div>{p.donor_phone}</div>}
            {p.donor_email && <div style={{ color: '#444', fontSize: '10pt' }}>{p.donor_email}</div>}
          </Field>

          <Field label="Pickup address">
            <div>{p.address}{p.address2 ? `, ${p.address2}` : ''}</div>
            <div>{[p.city, p.state, p.postalcode].filter(Boolean).join(' ')}</div>
          </Field>

          <div style={{ textAlign: 'center' }}>
            <div className="manifest-label" style={{ marginBottom: '4pt' }}>Scan for route</div>
            <QrCode value={mapsUrl} size={110} />
            <div style={{ fontSize: '8pt', color: '#6b6b6b', marginTop: '3pt' }}>
              Opens in Google Maps
            </div>
          </div>
        </div>

        {origin && (
          <div style={{ marginTop: '8pt', fontSize: '9pt', color: '#6b6b6b' }}>
            Route start: {p.lead_facility_name ?? 'Facility'} — {origin}
          </div>
        )}
      </Section>

      {/* Access notes */}
      {p.access_notes && (
        <Section>
          <Field label="Access notes">
            <div style={{ whiteSpace: 'pre-line' }}>{p.access_notes}</div>
          </Field>
        </Section>
      )}

      {/* Crew + vehicle */}
      <Section>
        <Grid3>
          <Field label="Crew lead">
            <div style={{ minHeight: '13pt' }}>{p.team_lead ?? <span style={{ color: '#6b6b6b' }}>__________________</span>}</div>
          </Field>
          <Field label="Assistant">
            <div style={{ borderBottom: '1px solid #888', minHeight: '13pt' }} />
          </Field>
          <Field label="Vehicle">
            <div style={{ minHeight: '13pt' }}>
              {p.vehicle_license
                ? <span>License: <span style={{ fontFamily: 'monospace' }}>{p.vehicle_license}</span></span>
                : <span style={{ color: '#6b6b6b' }}>__________________</span>}
            </div>
          </Field>
        </Grid3>
        <Grid2>
          <Field label="Mileage out">
            <div style={{ borderBottom: '1px solid #888', minHeight: '13pt', marginTop: '4pt' }} />
          </Field>
          <Field label="Mileage back">
            <div style={{ borderBottom: '1px solid #888', minHeight: '13pt', marginTop: '4pt' }} />
          </Field>
        </Grid2>
      </Section>

      {/* Items received — blank lines for the crew to fill in */}
      <Section>
        <div className="manifest-label" style={{ marginBottom: '6pt' }}>
          Items received (fill in on site)
        </div>
        {Array.from({ length: 8 }).map((_, i) => <BlankItemLine key={i} />)}
      </Section>

      {/* Donor acknowledgement + signatures */}
      <Section>
        <div className="manifest-label" style={{ marginBottom: '4pt' }}>Donor acknowledgement</div>
        <p style={{ fontSize: '10pt', lineHeight: 1.45, margin: '0 0 10pt 0' }}>
          I confirm I donated the items listed above to <strong>{org.org_name || 'Furnish Hope'}</strong>
          {org.org_ein && <>, a 501(c)(3) nonprofit (EIN <span style={{ fontFamily: 'monospace' }}>{org.org_ein}</span>)</>}.
          No goods or services were provided in exchange for this contribution. Please retain this
          form for your tax records — Furnish Hope does not assign a fair market value to donated
          items; that determination is the donor's responsibility.
        </p>
        <Grid2>
          <SignatureLine label="Donor signature · Date" />
          <SignatureLine label="Crew lead signature · Date" />
        </Grid2>
      </Section>

      {/* Footer — org contact line */}
      <div style={{ marginTop: '14pt', paddingTop: '6pt', borderTop: '1px solid #d8d4cc', fontSize: '8pt', color: '#6b6b6b', textAlign: 'center' }}>
        {orgAddress && <div>{orgAddress}</div>}
        <div>
          {[org.org_phone, org.org_email].filter(Boolean).join(' · ')}
        </div>
      </div>
    </ManifestPage>
  );
}

/* ----------------------------------------------------------------- */
/*  Small helpers                                                     */
/* ----------------------------------------------------------------- */

function formatTimeWindow(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  return `${formatTime(start)} – ${formatTime(end)}`;
}

function formatTime(t: string | null): string {
  if (!t) return '?';
  // PG returns "HH:MM:SS" — convert to 12-hour for printable form.
  const [hh, mm] = t.split(':');
  let h = Number(hh);
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${mm} ${ampm}`;
}
