/**
 * "Report issue" button + modal.
 *
 * Admin users see the button in the PageHeader on every page. Clicking it
 * captures a screenshot of the visible app (via html2canvas, excluding the
 * modal itself), records page URL + viewport + user agent, and lets the
 * admin describe what went wrong. POSTs to /api/issues.
 *
 * The button is silently hidden for non-admins.
 */

import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import html2canvas from 'html2canvas';
import { apiPost } from '../lib/api.ts';
import { useAuth } from '../lib/auth.tsx';

type Severity = 'low' | 'medium' | 'high' | 'critical';

export function IssueReporterButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user?.is_admin) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-ink-soft hover:text-terracotta border border-hairline-strong px-3 py-1 rounded-md hover:border-terracotta inline-flex items-center gap-1.5"
        title="Report a problem with this page (admin only)"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        Report issue
      </button>
      {open && <IssueReporterModal onClose={() => setOpen(false)} />}
    </>
  );
}

function IssueReporterModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(true);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Capture the screenshot once the modal mounts. We hide the modal
  // briefly via opacity so it doesn't end up in its own screenshot.
  useEffect(() => {
    const node = modalRef.current;
    if (!node) return;
    const prevVisibility = node.style.visibility;
    node.style.visibility = 'hidden';
    // Wait one paint cycle so the browser actually applies the hidden
    // state before html2canvas snapshots.
    const t = window.setTimeout(async () => {
      try {
        const canvas = await html2canvas(document.body, {
          // Disable taint-related options that block reading from the
          // canvas. Foreign images (e.g. CSS background-image from an
          // external CDN) will be omitted but the app's own DOM is fine.
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#FAF7F1',
          logging: false,
          // Cap resolution so the upload doesn't balloon on a 4K screen.
          scale: Math.min(window.devicePixelRatio || 1, 1.5),
        });
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1] ?? '';
        setScreenshotPreview(dataUrl);
        setScreenshotBase64(base64);
      } catch (err: any) {
        setCaptureError(err?.message ?? 'Could not capture a screenshot. You can still submit without one.');
      } finally {
        node.style.visibility = prevVisibility;
        setCapturing(false);
      }
    }, 80);
    return () => window.clearTimeout(t);
  }, []);

  const submitMut = useMutation({
    mutationFn: () => apiPost<{ issue_id: number }>('/api/issues', {
      title: title.trim(),
      description: description.trim(),
      severity,
      page_url: window.location.href,
      page_title: document.title,
      user_agent: navigator.userAgent,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      steps_to_reproduce: stepsToReproduce.trim() || null,
      expected_behavior: expected.trim() || null,
      actual_behavior: actual.trim() || null,
      screenshot_base64: screenshotBase64,
      screenshot_content_type: 'image/png',
    }),
    onSuccess: () => {
      window.alert('Issue submitted. The developer will see it in the Developer console.');
      onClose();
    },
    onError: (e: any) => window.alert(e?.message ?? 'Submission failed.'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { window.alert('Please add a short title.'); return; }
    if (!description.trim()) { window.alert('Please describe the issue.'); return; }
    submitMut.mutate();
  }

  return (
    <div className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        ref={modalRef}
        className="bg-paper rounded-[10px] max-w-3xl w-full max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-baseline justify-between border-b border-hairline pb-2.5">
            <h2 className="font-display text-xl font-medium m-0">Report an issue</h2>
            <button type="button" onClick={onClose} className="text-ink-faint hover:text-terracotta text-sm">Cancel</button>
          </div>

          <p className="text-xs text-ink-faint">
            We auto-captured the page URL, your browser, and a screenshot of what
            you're seeing. Add a short summary + any details that'll help the
            developer reproduce the problem.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
            <div>
              <label className="field-label">Title <span className="text-terracotta">*</span></label>
              <input type="text" className="field-input" value={title} onChange={e => setTitle(e.target.value)} maxLength={200} placeholder="One-line summary" autoFocus />
            </div>
            <div>
              <label className="field-label">Severity</label>
              <select className="field-input" value={severity} onChange={e => setSeverity(e.target.value as Severity)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="field-label">What happened? <span className="text-terracotta">*</span></label>
            <textarea className="field-input" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the problem in your own words." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="field-label">Expected behavior</label>
              <textarea className="field-input" rows={2} value={expected} onChange={e => setExpected(e.target.value)} placeholder='"I expected to see…"' />
            </div>
            <div>
              <label className="field-label">Actual behavior</label>
              <textarea className="field-input" rows={2} value={actual} onChange={e => setActual(e.target.value)} placeholder='"Instead, I saw…"' />
            </div>
          </div>

          <div>
            <label className="field-label">Steps to reproduce (optional but very helpful)</label>
            <textarea className="field-input font-mono text-xs" rows={3} value={stepsToReproduce} onChange={e => setStepsToReproduce(e.target.value)} placeholder={'1. Open the donor list\n2. Click "+ New donor"\n3. …'} />
          </div>

          <div>
            <label className="field-label">Screenshot</label>
            {capturing && <div className="text-xs text-ink-faint italic">Capturing…</div>}
            {captureError && <div className="text-xs text-terracotta-deep">{captureError}</div>}
            {!capturing && screenshotPreview && (
              <div className="border border-hairline rounded">
                <img src={screenshotPreview} alt="Captured page state" className="max-w-full max-h-[280px] mx-auto" />
              </div>
            )}
            {!capturing && !screenshotPreview && !captureError && (
              <div className="text-xs text-ink-faint italic">No screenshot was captured.</div>
            )}
          </div>

          <div className="bg-cream/40 rounded p-3 text-[11px] text-ink-faint">
            <div><strong>Page:</strong> <code className="text-ink-soft">{window.location.pathname}{window.location.search}</code></div>
            <div><strong>Viewport:</strong> {window.innerWidth} × {window.innerHeight}</div>
            <div className="truncate"><strong>Browser:</strong> {navigator.userAgent}</div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-hairline">
            <button type="button" onClick={onClose} className="btn-ghost text-xs">Cancel</button>
            <button type="submit" disabled={submitMut.isPending || capturing} className="btn-primary text-xs disabled:opacity-60">
              {submitMut.isPending ? 'Submitting…' : 'Submit issue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
