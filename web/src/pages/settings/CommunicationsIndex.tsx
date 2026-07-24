/**
 * Communications settings landing (COMMUNICATIONS_DESIGN §10). Links to the
 * SMS provider, org email, and fallback inbox pages, with an at-a-glance
 * configured/enabled status for each. Admin-only (routed under RequireAdmin).
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api.ts';
import { PageHeader } from '../../components/ui.tsx';

interface SmsPublic {
  provider: string;
  from_phone: string | null;
  enabled: boolean;
  account_sid_set: boolean;
  auth_token_set: boolean;
  webhook_secret_set: boolean;
}
interface EmailPublic {
  smtp_host: string | null;
  from_address: string | null;
  enabled: boolean;
  smtp_password_set: boolean;
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`pill ${ok ? 'pill-sage' : 'pill-muted'}`}>{label}</span>;
}

export function CommunicationsIndex() {
  const { data: sms } = useQuery<SmsPublic>({
    queryKey: ['comms', 'sms-provider'],
    queryFn: () => apiGet('/api/settings/communications/sms-provider'),
  });
  const { data: email } = useQuery<EmailPublic>({
    queryKey: ['comms', 'org-email'],
    queryFn: () => apiGet('/api/settings/communications/org-email'),
  });
  const { data: fallback } = useQuery<{ email: string | null }>({
    queryKey: ['comms', 'fallback-inbox'],
    queryFn: () => apiGet('/api/settings/communications/fallback-inbox'),
  });

  const smsConfigured = !!(sms?.account_sid_set && sms?.auth_token_set && sms?.from_phone);
  const emailConfigured = !!(email?.smtp_host && email?.from_address && email?.smtp_password_set);

  return (
    <>
      <PageHeader
        title="Communications"
        emphasis="settings"
        subtitle="Configure how Furnish Hope sends text messages and organizational email, and where undeliverable messages go."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl">
        <Link to="/settings/communications/sms-provider" className="card hover:border-terracotta transition block">
          <h3 className="font-display text-lg font-medium m-0">SMS provider</h3>
          <p className="text-sm text-ink-soft mt-1 mb-3">Twilio credentials and the sending phone number.</p>
          <div className="flex gap-2 flex-wrap">
            <StatusPill ok={smsConfigured} label={smsConfigured ? 'Configured' : 'Not configured'} />
            <StatusPill ok={!!sms?.enabled} label={sms?.enabled ? 'Enabled' : 'Disabled'} />
          </div>
        </Link>

        <Link to="/settings/communications/org-email" className="card hover:border-terracotta transition block">
          <h3 className="font-display text-lg font-medium m-0">Organization email</h3>
          <p className="text-sm text-ink-soft mt-1 mb-3">SMTP settings for mail sent as Furnish Hope.</p>
          <div className="flex gap-2 flex-wrap">
            <StatusPill ok={emailConfigured} label={emailConfigured ? 'Configured' : 'Not configured'} />
            <StatusPill ok={!!email?.enabled} label={email?.enabled ? 'Enabled' : 'Disabled'} />
          </div>
        </Link>

        <Link to="/settings/communications/fallback-inbox" className="card hover:border-terracotta transition block">
          <h3 className="font-display text-lg font-medium m-0">Fallback inbox</h3>
          <p className="text-sm text-ink-soft mt-1 mb-3">Where messages go when a contact can't be reached.</p>
          <div className="flex gap-2 flex-wrap">
            <StatusPill ok={!!fallback?.email} label={fallback?.email ? 'Set' : 'Not set'} />
          </div>
        </Link>
      </div>

      <div className="mt-6 max-w-3xl text-sm text-ink-faint italic">
        Templates, triggers, and the undeliverable queue arrive in the next phase. For now, once a provider is
        configured you can send messages via the API and receive replies and delivery status back.
      </div>
    </>
  );
}
