/**
 * Vendor detail — contact info, compliance, notes, plus the universal
 * Email + Attachments widgets so all the correspondence and W-9/COI
 * docs sit on the vendor record.
 */

import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet } from '../lib/api.ts';
import { PageHeader, Loading, ErrorBox } from '../components/ui.tsx';
import { FormNavBar } from '../components/forms/FormNavBar.tsx';
import { EmailWidget } from '../components/email/EmailWidget.tsx';
import { AttachmentsWidget } from '../components/attachments/AttachmentsWidget.tsx';
import { ServiceLogWidget } from '../components/vendors/ServiceLogWidget.tsx';

interface VendorDetailResponse {
  vendor: {
    vendor_id: number;
    business_name: string | null;
    vendor_type_id: number;
    vendor_type: string;
    vendor_specialty_id: number | null;
    vendor_specialty: string | null;
    w9_received: boolean;
    w9_received_date: string | null;
    coi_received: boolean;
    coi_expires_at: string | null;
    default_hourly_rate: string | null;
    payment_terms: string | null;
    tax_id: string | null;
    notes: string | null;
    is_active: boolean;
    contact_id: number;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    email: string | null;
    mobile_phone: string | null;
    home_phone: string | null;
    other_phone: string | null;
    created_at: string;
    updated_at: string;
  };
  prevId: number | null;
  nextId: number | null;
}

export function VendorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<VendorDetailResponse>({
    queryKey: ['vendor', id],
    queryFn: () => apiGet(`/api/vendors/${id}`),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiDelete(`/api/vendors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      navigate('/vendors');
    },
    onError: (e: any) => window.alert(e.message ?? 'Delete failed'),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;

  const v = data.vendor;
  const displayName = v.business_name || `${v.first_name} ${v.last_name}`;

  return (
    <>
      <PageHeader title={displayName} emphasis="vendor" subtitle={v.vendor_type + (v.vendor_specialty ? ` · ${v.vendor_specialty}` : '')} />

      <FormNavBar
        listLabel="vendors" singularLabel="vendor" basePath="/vendors"
        isNew={false} prevId={data.prevId} nextId={data.nextId}
        isDirty={false} savedFlash={false} onNav={navigate}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-3">
        <div className="lg:col-span-2 space-y-5">
          {/* Identity card */}
          <div className="card">
            <div className="card-head">
              <h3 className="font-display font-medium text-[17px] m-0">Identity</h3>
              <div className="flex gap-3 text-xs">
                <Link to={`/vendors/${v.vendor_id}/edit`} className="text-terracotta hover:text-terracotta-deep">Edit</Link>
                <button type="button"
                  onClick={() => { if (window.confirm(`Delete vendor "${displayName}"?`)) deleteMut.mutate(); }}
                  className="text-terracotta hover:text-terracotta-deep">
                  Delete
                </button>
              </div>
            </div>

            <Row label="Business name" value={v.business_name || '—'} />
            <Row label="Person" value={`${v.first_name} ${v.middle_name ? v.middle_name + ' ' : ''}${v.last_name}`} />
            <Row label="Type" value={v.vendor_type} />
            {v.vendor_specialty && <Row label="Specialty" value={v.vendor_specialty} />}
            <Row label="Email" value={v.email ? <a href={`mailto:${v.email}`} className="text-terracotta hover:text-terracotta-deep">{v.email}</a> : '—'} />
            <Row label="Mobile" value={v.mobile_phone || '—'} />
            <Row label="Other phone" value={v.home_phone || v.other_phone || '—'} />
            {!v.is_active && (
              <div className="mt-3 p-2.5 bg-terracotta-soft text-terracotta-deep rounded text-xs">
                This vendor is marked inactive — they won't appear in recipient pickers or active-only lists.
              </div>
            )}
          </div>

          {/* Compliance */}
          <div className="card">
            <h3 className="font-display font-medium text-[17px] m-0 mb-3">Compliance</h3>
            <Row
              label="W-9 received"
              value={v.w9_received
                ? <span className="text-sage">✓ {v.w9_received_date ? `on ${formatDate(v.w9_received_date)}` : 'Yes'}</span>
                : <span className="text-terracotta-deep">Missing</span>}
            />
            <Row
              label="COI on file"
              value={v.coi_received
                ? <span className={coiClass(v.coi_expires_at)}>✓ {v.coi_expires_at ? `expires ${formatDate(v.coi_expires_at)}` : 'Yes'}</span>
                : <span className="text-ink-faint">Not on file</span>}
            />
            <Row label="Tax ID (EIN/SSN)" value={v.tax_id ? `••• ${v.tax_id.slice(-4)}` : '—'} />
            <Row label="Payment terms" value={v.payment_terms || '—'} />
            <Row label="Default hourly rate" value={v.default_hourly_rate ? `$${v.default_hourly_rate}` : '—'} />
            <p className="mt-3 text-[11px] text-ink-faint italic">
              Bills, invoices, and payments live in QuickBooks. This card tracks the paperwork (W-9, COI) we keep on file for compliance.
            </p>
          </div>

          {/* Notes */}
          {v.notes && (
            <div className="card">
              <h3 className="font-display font-medium text-[17px] m-0 mb-2">Notes</h3>
              <p className="text-sm whitespace-pre-wrap text-ink-soft">{v.notes}</p>
            </div>
          )}

          {/* Service log — operational history of what this vendor did. */}
          <ServiceLogWidget vendorId={v.vendor_id} />
        </div>

        <div className="space-y-5">
          {/* Email correspondence */}
          {v.email && (
            <EmailWidget email={v.email} displayName={displayName} />
          )}

          {/* Documents — W-9, COI, contracts, scanned invoices */}
          <AttachmentsWidget entityType="vendor" entityId={v.vendor_id} title="Documents" />
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 text-sm py-1.5 border-b border-hairline last:border-b-0">
      <div className="text-[11px] uppercase tracking-widest text-ink-faint font-medium pt-0.5">{label}</div>
      <div className="text-ink">{value}</div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso); if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function coiClass(iso: string | null): string {
  if (!iso) return 'text-sage';
  const d = new Date(iso); if (isNaN(d.getTime())) return 'text-sage';
  const days = (d.getTime() - Date.now()) / 86400000;
  if (days < 0) return 'text-terracotta-deep';
  if (days < 60) return 'text-[#6B4D1E]'; // gold-deep = expiring-soon warning
  return 'text-sage';
}
