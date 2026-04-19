import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      nav('/', { replace: true });
    } catch {
      setError('Login failed. Check credentials.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-2xl border border-surface-border bg-surface-raised p-8 shadow-2xl"
      >
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-slate-400">
          Demo: <code className="text-accent">alice@example.com</code> /{' '}
          <code className="text-accent">Password123!</code>
        </p>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="space-y-1">
          <label className="text-sm text-slate-400">Email</label>
          <input
            className="w-full rounded-xl border border-surface-border bg-surface-inset px-3 py-2.5 text-slate-100 outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-400">Password</label>
          <input
            className="w-full rounded-xl border border-surface-border bg-surface-inset px-3 py-2.5 text-slate-100 outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            autoComplete="current-password"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-accent py-2.5 font-semibold text-white shadow-bubble transition hover:bg-accent-dim disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-center text-sm text-slate-400">
          No account?{' '}
          <Link className="text-accent hover:underline" to="/register">
            Register
          </Link>
        </p>
      </form>
    </div>
  );
}
