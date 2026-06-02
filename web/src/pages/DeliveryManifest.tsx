/**
 * Print-optimized one-page manifest for a client delivery. Client info,
 * delivery address with QR-to-Google-Maps route, items being delivered
 * (pre-listed from the provisioning request fulfillment), crew + vehicle,
 * client confirmation of receipt + signature.
 *
 * Rendered at /deliveries/:id/manifest. Auto-opens the browser's Print
 * dialog after data loads.
 */

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { apiGet } from '../lib/api.ts';
import { Loading, ErrorBox } from '../components/ui.tsx';
import { QrCode } from '../components/manifest/QrCode.tsx';
import {
  ManifestPage, ManifestHeader, Section, Field, Grid2, Grid3,
  SignatureLine, buildMapsUrl, formatAddress,
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

interface DeliveryDetail {
  delivery: {
    delivery_id: number;
    delivery_date: string;
    time_arrival_earliest: string | null;
    time_arrival_latest: string | null;
    delivery_status: string;
    client_name: string;
    client_phone: string | null;
    address: string | null;
    address2: string | null;
    city: string | null;
    state: string | null;
    postalcode: string | null;
    gate_code: string | null;
    notes: string | null;
    client_request_note: string | null;
    scheduler_name: string | null;
    vehicle_license: string | null;
    vehicle_type: string | null;
    rental_agency: string | null;
    fulfill_facility_name: string | null;
    fulfill_facility_address: string | null;
    fulfill_facility_city: string | null;
    fulfill_facility_state: string | null;
    fulfill_facility_postalcode: string | null;
  };
  crew: Array<{
    delivery_staff_id: number;
    is_team_lead: boolean;
    name: string;
    mobile_phone: string | null;
    is_volunteer: boolean;
  }>;
  items: Array<{
    delivery_items_id: number;
    description: string;
    item_category: string;
    item_size: string | null;
    item_condition: string | null;
  }>;
}

export function DeliveryManifest() {
  const { id } = useParams();

  const { data: dd, isLoading: l1, error: e1 } = useQuery<DeliveryDetail>({
    queryKey: ['delivery', id],
    queryFn: () => apiGet(`/api/deliveries/${id}`),
  });
  const { data: org, isLoading: l2, error: e2 } = useQuery<OrgInfo>({
    queryKey: ['org-info'],
    queryFn: () => apiGet('/api/org-info'),
  });

  if (l1 || l2) return <Loading />;
  if (e1) return <ErrorBox error={e1} />;
  if (e2) return <ErrorBox error={e2} />;
  if (!dd || !org) return null;

  const d = dd.delivery;
  const lead = dd.crew.find(c => c.is_team_lead) ?? dd.crew[0];
  const assistants = dd.crew.filter(c => c !== lead);

  const destination = formatAddress({
    address: d.address, address2: d.address2, city: d.city, state: d.state, postalcode: d.postalcode,
  });
  const origin = formatAddress({
    address: d.fulfill_facility_address, city: d.fulfill_facility_city,
    state: d.fulfill_facility_state, postalcode: d.fulfill_facility_postalcode,
  });
  const mapsUrl = buildMapsUrl(origin, destination);

  const orgAddress = formatAddress({
    address: org.org_address_line1, address2: org.org_address_line2,
    city: org.org_city, state: org.org_state, postalcode: org.org_postalcode,
  });

  const dateLabel = new Date(d.delivery_date + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const timeLabel = formatTimeWindow(d.time_arrival_earliest, d.time_arrival_latest);

  return (
    <ManifestPage>
      <ManifestHeader
        orgName={org.org_name || 'Furnish Hope'}
        title="Delivery Manifest"
        meta={
          <div>
            <div style={{ fontWeight: 500 }}>Delivery #{d.delivery_id}</div>
            <div>{dateLabel}</div>
            {timeLabel && <div>{timeLabel}</div>}
          </div> as any
        }
      />

      {/* Client + address + QR */}
      <Section>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 130pt', gap: '18pt' }}>
          <Field label="Receiving party">
            <div style={{ fontWeight: 500, fontSize: '12pt' }}>{d.client_name}</div>
            {d.client_phone && <div>{d.client_phone}</div>}
          </Field>

          <Field label="Delivery address">
            <div>{d.address ?? '—'}{d.address2 ? `, ${d.address2}` : ''}</div>
            <div>{[d.city, d.state, d.postalcode].filter(Boolean).join(' ')}</div>
            {d.gate_code && (
              <div style={{ fontSize: '9pt', marginTop: '3pt' }}>
                Gate code: <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{d.gate_code}</span>
              </div>
            )}
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
            Route start: {d.fulfill_facility_name ?? 'Facility'} — {origin}
          </div>
        )}
      </Section>

      {/* Special instructions / notes from the request */}
      {(d.notes || d.client_request_note) && (
        <Section>
          {d.notes && (
            <Field label="Delivery notes">
              <div style={{ whiteSpace: 'pre-line' }}>{d.notes}</div>
            </Field>
          )}
          {d.client_request_note && (
            <div style={{ marginTop: d.notes ? '8pt' : 0 }}>
              <Field label="Original request note">
                <div style={{ whiteSpace: 'pre-line' }}>{d.client_request_note}</div>
              </Field>
            </div>
          )}
        </Section>
      )}

      {/* Crew + vehicle */}
      <Section>
        <Grid3>
          <Field label="Crew lead">
            <div style={{ minHeight: '13pt' }}>{lead?.name ?? <span style={{ color: '#6b6b6b' }}>__________________</span>}</div>
          </Field>
          <Field label="Crew">
            <div style={{ minHeight: '13pt' }}>
              {assistants.length > 0
                ? assistants.map(a => a.name).join(', ')
                : <span style={{ color: '#6b6b6b' }}>__________________</span>}
            </div>
          </Field>
          <Field label="Vehicle">
            <div style={{ minHeight: '13pt' }}>
              {d.vehicle_license || d.vehicle_type || d.rental_agency ? (
                <>
                  {d.vehicle_type && <div>{d.vehicle_type}</div>}
                  {d.vehicle_license && <div style={{ fontFamily: 'monospace', fontSize: '10pt' }}>{d.vehicle_license}</div>}
                  {d.rental_agency && <div style={{ fontSize: '9pt', color: '#6b6b6b' }}>Rental: {d.rental_agency}</div>}
                </>
              ) : <span style={{ color: '#6b6b6b' }}>__________________</span>}
            </div>
          </Field>
        </Grid3>
      </Section>

      {/* Items being delivered — pre-listed from the request */}
      <Section>
        <div className="manifest-label" style={{ marginBottom: '6pt' }}>
          Items being delivered ({dd.items.length})
        </div>
        {dd.items.length === 0 ? (
          <div style={{ fontStyle: 'italic', color: '#6b6b6b', fontSize: '10pt' }}>
            No items on this delivery yet. Add items to the delivery before printing.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #888' }}>
                <th style={{ textAlign: 'left',  padding: '4pt 2pt', width: '14pt' }}></th>
                <th style={{ textAlign: 'left',  padding: '4pt 2pt' }}>Item</th>
                <th style={{ textAlign: 'left',  padding: '4pt 2pt', width: '90pt' }}>Category</th>
                <th style={{ textAlign: 'left',  padding: '4pt 2pt', width: '60pt' }}>Size</th>
                <th style={{ textAlign: 'left',  padding: '4pt 2pt', width: '70pt' }}>Condition</th>
              </tr>
            </thead>
            <tbody>
              {dd.items.map(it => (
                <tr key={it.delivery_items_id} style={{ borderBottom: '1px solid #e0dccf' }}>
                  <td style={{ padding: '4pt 2pt' }}>
                    <div style={{ width: '11pt', height: '11pt', border: '1px solid #888', borderRadius: '2px' }} />
                  </td>
                  <td style={{ padding: '4pt 2pt' }}>{it.description}</td>
                  <td style={{ padding: '4pt 2pt', color: '#444' }}>{it.item_category}</td>
                  <td style={{ padding: '4pt 2pt', color: '#444' }}>{it.item_size ?? '—'}</td>
                  <td style={{ padding: '4pt 2pt', color: '#444' }}>{it.item_condition ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Client confirmation + signatures */}
      <Section>
        <div className="manifest-label" style={{ marginBottom: '4pt' }}>Client confirmation of receipt</div>
        <p style={{ fontSize: '10pt', lineHeight: 1.45, margin: '0 0 10pt 0' }}>
          I confirm I received the items listed above from <strong>{org.org_name || 'Furnish Hope'}</strong> in
          acceptable condition. If any items were declined or damaged on arrival, please note them on
          the back of this form and inform the crew lead before they leave.
        </p>
        <Grid2>
          <SignatureLine label="Client signature · Date" />
          <SignatureLine label="Crew lead signature · Date" />
        </Grid2>
      </Section>

      {/* Footer */}
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
/*  Helpers                                                           */
/* ----------------------------------------------------------------- */

function formatTimeWindow(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  return `${formatTime(start)} – ${formatTime(end)}`;
}

function formatTime(t: string | null): string {
  if (!t) return '?';
  const [hh, mm] = t.split(':');
  let h = Number(hh);
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${mm} ${ampm}`;
}
