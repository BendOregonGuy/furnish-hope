/**
 * "Apply template" dropdown — used in Compose and inline-reply forms.
 *
 * Lists the user's saved templates from /api/email-templates. When the
 * user picks one, we substitute the universal placeholders ({{my_name}},
 * {{org_name}}, {{today}}) and hand back the (subject, body) so the
 * caller can fill the form fields. The caller decides whether to replace
 * or append the existing content.
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiGet } from '../../lib/api.ts';
import { useAuth } from '../../lib/auth.tsx';
import type { EmailTemplate } from '../../pages/EmailTemplates.tsx';

interface OrgInfo {
  org_name: string | null;
}

export function TemplatePicker({
  onApply,
}: {
  /** Called with the resolved subject + body when a template is picked. */
  onApply: (resolved: { subject: string | null; body: string }) => void;
}) {
  const { user } = useAuth();
  const { data: templates } = useQuery<EmailTemplate[]>({
    queryKey: ['email', 'templates'],
    queryFn: () => apiGet('/api/email-templates'),
  });
  const { data: orgInfo } = useQuery<OrgInfo>({
    queryKey: ['org-info'],
    queryFn: () => apiGet('/api/org-info'),
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!templates || templates.length === 0) return null;

  function apply(t: EmailTemplate) {
    const subject = t.subject ? substitute(t.subject, user?.display_name, orgInfo?.org_name) : null;
    const body = substitute(t.body, user?.display_name, orgInfo?.org_name);
    onApply({ subject, body });
    setPickerOpen(false);
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setPickerOpen(v => !v)}
        className="text-[11px] normal-case tracking-normal text-terracotta hover:text-terracotta-deep border border-hairline-strong px-2 py-1 rounded hover:border-terracotta"
      >
        ⚡ Apply template ▾
      </button>
      {pickerOpen && (
        <>
          {/* Click-outside backdrop. */}
          <button
            type="button"
            onClick={() => setPickerOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
            aria-hidden="true"
          />
          <div className="absolute z-40 mt-1 min-w-[260px] max-h-80 overflow-y-auto bg-paper border border-hairline-strong rounded-md shadow-lg">
            {templates.map(t => (
              <button
                key={t.email_template_id}
                type="button"
                onClick={() => apply(t)}
                className="w-full text-left px-3 py-2 hover:bg-terracotta/[0.06] block border-b border-hairline last:border-b-0"
                title={t.description || t.body.slice(0, 200)}
              >
                <div className="text-sm font-medium">{t.name}</div>
                {t.description && <div className="text-[11px] text-ink-faint truncate">{t.description}</div>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Universal placeholder substitution. Unknown {{name}} tokens stay
 *  intact so the user can hand-fill them before sending. */
function substitute(s: string, myName: string | null | undefined, orgName: string | null | undefined): string {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  return s
    .replace(/\{\{\s*my_name\s*\}\}/gi, myName || '')
    .replace(/\{\{\s*org_name\s*\}\}/gi, orgName || '')
    .replace(/\{\{\s*today\s*\}\}/gi, today);
}
