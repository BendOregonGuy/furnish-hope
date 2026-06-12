/**
 * React error boundary. Without this, an exception thrown during
 * render (e.g., reading a property off a null shape from the API)
 * gray-screens the entire app — the user sees a blank page with
 * no way back.
 *
 * With it, the user sees a friendly card explaining what happened,
 * with a Reload button. The error is still logged to the browser
 * console so we can investigate.
 *
 * Wraps the AppShell and AgencyShell in App.tsx. Most fault-prone
 * surface — query errors are handled by react-query/ErrorBox, but
 * render-time throws still need a net.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional human-friendly label for which surface this boundary
   *  wraps. Shown in the fallback so we can tell from a screenshot
   *  whether the staff shell or the agency shell crashed. */
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Browsers also surface this in the console with the full stack,
    // but logging here gives us the React component stack as well.
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-cream p-6">
          <div className="bg-paper border border-hairline-strong rounded-lg shadow-sm p-8 max-w-lg w-full">
            <div className="text-2xl font-display text-terracotta-deep mb-2">
              Something went wrong on this page
            </div>
            <p className="text-sm text-ink-soft mb-3">
              We've logged the error. You can usually recover by reloading. If
              this keeps happening, copy the message below and email it to
              your administrator.
            </p>
            {this.state.error && (
              <div className="text-[11px] font-mono bg-cream-deep/30 p-3 rounded text-ink-soft mb-4 break-all">
                {this.state.error.message}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="btn-primary"
              >
                Reload page
              </button>
              <button
                onClick={() => { window.location.href = '/'; }}
                className="btn-ghost"
              >
                Back to dashboard
              </button>
            </div>
            {this.props.label && (
              <div className="text-[10px] text-ink-faint mt-4">surface: {this.props.label}</div>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
