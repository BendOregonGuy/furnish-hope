/**
 * Sign the client furniture waiver against a specific provisioning
 * request. Captures four attestations:
 *   - Typed legal name (the legally-significant act of attestation)
 *   - Drawn signature (visual evidence)
 *   - "I have read and agree" checkbox (explicit assent)
 *   - Auto-captured: server timestamp, IP, user-agent, staff witness
 *
 * On submit, server generates a PDF and attaches it to the request.
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../lib/api.ts';
import { useAuth } from '../lib/auth.tsx';
import { PageHeader, Loading, ErrorBox } from '../components/ui.tsx';
import { SignaturePad, type SignaturePadHandle } from '../components/waivers/SignaturePad.tsx';

interface Template {
  waiver_template_id: number;
  title: string;
  subtitle: string | null;
  body_markdown: string;
  version_label: string | null;
}

interface OrgInfo {
  org_name: string;
  org_address_line1: string;
  org_address_line2: string;
  org_city: string;
  org_state: string;
  org_postalcode: string;
  org_phone: string;
  org_email: string;
  has_logo: boolean;
  logo_updated_at: string | null;
}

interface ExistingWaiver {
  waiver_id: number;
  typed_legal_name: string;
  signed_at: string;
  witness_username: string | null;
  template_version: string | null;
  pdf_attachment_id: number | null;
}

export function SignWaiver() {
  const { id } = useParams<{ id: string }>();
  const requestId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: template, isLoading: loadingTemplate, error: templateError } = useQuery<Template>({
    queryKey: ['waiver', 'template'],
    queryFn: () => apiGet('/api/waivers/template'),
  });
  const { data: org } = useQuery<OrgInfo>({
    queryKey: ['org-info'],
    queryFn: () => apiGet('/api/org-info'),
  });
  const { data: existing } = useQuery<ExistingWaiver | null>({
    queryKey: ['request', requestId, 'waiver'],
    queryFn: () => apiGet(`/api/requests/${requestId}/waiver`),
  });

  const sigRef = useRef<SignaturePadHandle>(null);
  const [typedName, setTypedName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Scroll lock — make sure the waiver text was viewed before
  // allowing the agree checkbox. (Not a hard requirement legally,
  // but a sensible UX nudge.)
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    function onScroll() {
      if (!el) return;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setScrolledToBottom(true);
    }
    el.addEventListener('scroll', onScroll);
    // If the content already fits without scrolling, allow agreement immediately.
    if (el.scrollHeight <= el.clientHeight + 8) setScrolledToBottom(true);
    return () => el.removeEventListener('scroll', onScroll);
  }, [template]);

  const signMut = useMutation({
    mutationFn: () => {
      const png = sigRef.current?.toPng() ?? null;
      return apiPost<{ waiver_id: number }>(`/api/requests/${requestId}/waiver`, {
        typed_legal_name: typedName.trim(),
        signature_image_base64: png,
        agreed,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['request', requestId] });
      qc.invalidateQueries({ queryKey: ['request', requestId, 'waiver'] });
      qc.invalidateQueries({ queryKey: ['requests'] });
      navigate(`/requests/${requestId}`);
    },
    onError: (e: any) => setErr(e.message ?? 'Save failed'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (sigRef.current?.isEmpty()) { setErr('Please sign in the signature box before submitting.'); return; }
    if (typedName.trim().length < 2) { setErr('Please type your full legal name above.'); return; }
    if (!agreed) { setErr('You must check "I have read and agree" to sign.'); return; }
    signMut.mutate();
  }

  if (loadingTemplate) return <Loading />;
  if (templateError) return <ErrorBox error={templateError} />;
  if (!template) return null;

  // If already signed, show a confirmation block + link to download.
  if (existing) {
    return (
      <>
        <PageHeader title="Waiver already signed" emphasis="for this request" helpSection="waivers" />
        <div className="card max-w-2xl">
          <div className="p-3 bg-sage-soft text-[#3F4A33] rounded mb-4 text-sm">
            ✓ This waiver was signed by <strong>{existing.typed_legal_name}</strong> on{' '}
            <strong>{new Date(existing.signed_at).toLocaleString()}</strong>,{' '}
            witnessed by <strong>{existing.witness_username}</strong>
            {existing.template_version && <> · template {existing.template_version}</>}.
          </div>
          <div className="flex gap-3 text-sm">
            {existing.pdf_attachment_id && (
              <a
                href={`/api/waivers/${existing.waiver_id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
              >
                View signed PDF
              </a>
            )}
            <Link to={`/requests/${requestId}`} className="btn-ghost">Back to request</Link>
          </div>
        </div>
      </>
    );
  }

  const logoUrl = org?.has_logo && org?.logo_updated_at
    ? `/api/org-info/logo?v=${encodeURIComponent(org.logo_updated_at)}`
    : null;

  return (
    <>
      <PageHeader title="Sign the furniture waiver" emphasis="recipient consent" helpSection="waivers" />

      <form onSubmit={handleSubmit} className="card max-w-3xl space-y-5">

        {/* Letterhead — visible to the client so they know they're
            signing a Furnish Hope document, not some random form. */}
        <div className="flex items-baseline justify-between gap-4 pb-3 border-b border-hairline">
          <div className="flex items-center gap-3">
            {logoUrl && <img src={logoUrl} alt="" className="h-12 w-auto object-contain" />}
            <div>
              <div className="font-display font-medium text-lg">{org?.org_name || 'Furnish Hope'}</div>
              {org?.org_phone && <div className="text-[11px] text-ink-faint">{org.org_phone} · {org.org_email}</div>}
            </div>
          </div>
          <div className="text-[10px] text-ink-faint text-right">
            Template {template.version_label ?? ''}
          </div>
        </div>

        {/* Title */}
        <div className="text-center">
          <h2 className="font-display text-2xl font-medium m-0">{template.title}</h2>
          {template.subtitle && <div className="text-xs text-ink-soft italic mt-1">{template.subtitle}</div>}
        </div>

        {/* Body — scrollable so a long template doesn't push the
            signature box off-screen on small viewports. */}
        <div
          ref={bodyRef}
          className="max-h-72 overflow-y-auto p-4 bg-cream/30 rounded border border-hairline text-sm leading-relaxed"
        >
          {renderTemplateBody(template.body_markdown)}
        </div>
        {!scrolledToBottom && (
          <div className="text-[11px] text-ink-faint italic">↑ Scroll the waiver to the end before signing.</div>
        )}

        {/* Typed legal name */}
        <div>
          <label className="field-label">
            Recipient — Printed Legal Name <span className="text-terracotta">*</span>
          </label>
          <input
            type="text"
            className="field-input"
            value={typedName}
            onChange={e => setTypedName(e.target.value)}
            placeholder="Type your full legal name exactly as you'd sign"
            autoComplete="off"
            required
          />
        </div>

        {/* Drawn signature */}
        <div>
          <label className="field-label">
            Recipient Signature <span className="text-terracotta">*</span>
          </label>
          <div className="flex items-start gap-3 flex-wrap">
            <SignaturePad ref={sigRef} width={480} height={160} onStrokeEnd={() => setErr(null)} />
            <button
              type="button"
              onClick={() => sigRef.current?.clear()}
              className="btn-ghost text-xs"
            >
              Clear
            </button>
          </div>
          <div className="text-[11px] text-ink-faint mt-1">
            Sign with your finger or stylus on touch screens, mouse on laptops.
          </div>
        </div>

        {/* Agreement checkbox */}
        <label className={`flex items-start gap-2.5 p-3 rounded border ${scrolledToBottom ? 'border-hairline-strong hover:bg-cream/30 cursor-pointer' : 'border-hairline bg-cream/20 opacity-60 cursor-not-allowed'}`}>
          <input
            type="checkbox"
            checked={agreed}
            disabled={!scrolledToBottom}
            onChange={e => setAgreed(e.target.checked)}
            className="w-5 h-5 accent-terracotta mt-0.5"
          />
          <div className="text-sm">
            <strong>I have read this waiver and agree to its terms.</strong> I understand
            that signing this is the legal equivalent of a paper signature.
          </div>
        </label>

        {/* Audit trail preview — visible reassurance that this is a real, witnessed signing */}
        <div className="text-[11px] text-ink-faint bg-cream/30 p-3 rounded">
          <strong className="text-ink-soft">Witness:</strong> {user?.display_name || user?.username} (Furnish Hope staff, currently signed in).{' '}
          <strong className="text-ink-soft">Date/time:</strong> stamped automatically when you submit.
        </div>

        {err && <div className="p-2.5 bg-terracotta-soft text-terracotta-deep rounded text-sm">{err}</div>}

        <div className="flex justify-end gap-2 pt-3 border-t border-hairline">
          <Link to={`/requests/${requestId}`} className="btn-ghost">Cancel</Link>
          <button type="submit" disabled={signMut.isPending} className="btn-primary disabled:opacity-60">
            {signMut.isPending ? 'Signing & generating PDF…' : 'Sign waiver'}
          </button>
        </div>
      </form>
    </>
  );
}

/** Render the markdown-ish body — only supports ## headings and
 *  blank-line paragraph breaks. Matches the PDF generator. */
function renderTemplateBody(body: string): React.ReactNode[] {
  const blocks = body.split(/\n\n+/);
  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('## ')) {
      return <h3 key={i} className="font-display font-medium text-base text-terracotta-deep mt-3 mb-1">{trimmed.slice(3).trim()}</h3>;
    }
    return <p key={i} className="mb-2">{trimmed}</p>;
  });
}
