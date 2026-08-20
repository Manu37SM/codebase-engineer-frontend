import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, getAuthProviders, getGitHubSignInUrl, getGoogleSignInUrl, registerAccount } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Turnstile from "../components/Turnstile";

/**
 * Task #91. Registering the FIRST account on a fresh, open-mode install
 * is what turns auth on for the whole instance (see docs/AUTH.md §1) — so
 * this page is reachable even when `authRequired` is currently false, not
 * just as a "create an additional account" flow.
 */
export default function RegisterPage() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [providers, setProviders] = useState({ google: false, github: false, turnstile: false });
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  useEffect(() => {
    getAuthProviders()
      .then(setProviders)
      .catch(() => setProviders({ google: false, github: false, turnstile: false }));
  }, []);

  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const turnstileRequired = providers.turnstile && Boolean(turnstileSiteKey);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (turnstileRequired && !turnstileToken) {
      setError("Please complete the verification challenge.");
      return;
    }
    setSubmitting(true);
    try {
      await registerAccount({
        email: email.trim(),
        password,
        displayName: displayName.trim() || undefined,
        turnstileToken: turnstileToken ?? undefined,
      });
      await refresh();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Create an account</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Codebase Engineer</p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor="register-name">
              Name (optional)
            </label>
            <input
              id="register-name"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor="register-email">
              Email
            </label>
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor="register-password">
              Password
            </label>
            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-400">At least 8 characters.</p>
          </div>
          {turnstileRequired && (
            <Turnstile
              siteKey={turnstileSiteKey as string}
              onVerify={setTurnstileToken}
              onExpire={() => setTurnstileToken(null)}
            />
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting || (turnstileRequired && !turnstileToken)}
            className="w-full rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        {(providers.google || providers.github) && (
          <>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              or
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            </div>

            <div className="mt-4 space-y-2">
              {providers.google && (
                <a
                  href={getGoogleSignInUrl()}
                  className="block w-full rounded border border-slate-300 px-3 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Continue with Google
                </a>
              )}
              {providers.github && (
                <a
                  href={getGitHubSignInUrl()}
                  className="block w-full rounded border border-slate-300 px-3 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Continue with GitHub
                </a>
              )}
            </div>
          </>
        )}

        <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
          Already have an account?{" "}
          <Link to="/login" className="underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
