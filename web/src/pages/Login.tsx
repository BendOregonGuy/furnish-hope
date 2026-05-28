/**
 * Login page. Shown when there's no signed-in user. After a successful
 * login, redirects to the dashboard (or wherever the user was trying to
 * go before being bounced here, if we ever wire `from`).
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.tsx';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Brand mark */}
        <div className="flex items-center gap-3 mb-7 justify-center">
          <div className="w-10 h-10 rounded-full border-[2px] border-terracotta flex items-center justify-center text-terracotta font-display italic text-lg font-semibold">F</div>
          <div>
            <div className="font-display font-medium text-ink text-xl leading-none">Furnish Hope</div>
            <div className="text-[10px] tracking-widest uppercase text-terracotta/80 mt-1">Internal Ops</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <h1 className="font-display text-xl font-medium mb-1">Sign in</h1>
            <p className="text-xs text-ink-faint">Enter your username and password.</p>
          </div>

          <div>
            <label htmlFor="login-username" className="field-label">Username</label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              autoFocus
              className="field-input"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="login-password" className="field-label">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              className="field-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="p-2.5 bg-terracotta-soft text-terracotta-deep rounded-md text-xs">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="text-[11px] text-ink-faint pt-1 border-t border-hairline">
            First-time setup: a temporary password was printed to the API
            server console when it started. Use it once, then change your
            password from <span className="font-medium text-ink-soft">Settings</span>.
          </div>
        </form>
      </div>
    </div>
  );
}
