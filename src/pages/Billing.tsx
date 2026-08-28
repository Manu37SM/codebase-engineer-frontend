import { useEffect, useState } from "react";
import {
  ApiError,
  createBillingCheckout,
  getAuthProviders,
  getBillingStatus,
  getGitHubSignInUrl,
  getGoogleSignInUrl,
} from "../lib/api";
import type { BillingStatus } from "../lib/types";
import { getAutoScanOnRegister, setAutoScanOnRegister } from "../lib/settings";
import { useAuth } from "../context/AuthContext";

export default function BillingPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user, refresh: refreshAuth } = useAuth();
  const [oauthProviders, setOauthProviders] = useState({ google: false, github: false });

  useEffect(() => {
    getAuthProviders()
      .then(setOauthProviders)
      .catch(() => setOauthProviders({ google: false, github: false }));
  }, []);

  useEffect(() => {
    refreshAuth();

  }, []);

  const [autoScan, setAutoScan] = useState(() => getAutoScanOnRegister());

  function handleAutoScanChange(value: boolean) {
    setAutoScan(value);
    setAutoScanOnRegister(value);
  }

  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    function handlePageShow() {
      setCheckoutBusy(false);
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  function load() {
    setLoading(true);
    setError(null);
    getBillingStatus()
      .then(setStatus)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load billing status"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleUpgrade() {
    setCheckoutError(null);
    setCheckoutBusy(true);
    try {

      const session = await createBillingCheckout();
      window.location.href = session.checkoutUrl;
    } catch (err) {
      setCheckoutError(err instanceof ApiError ? err.message : "Failed to start checkout.");
      setCheckoutBusy(false);
    }
  }

  const nearLimit =
    status?.configured && status.limit !== null && status.used >= status.limit;
  const closeToLimit =
    status?.configured &&
    status.limit !== null &&
    !nearLimit &&
    status.used >= status.limit * 0.8;

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900">Settings</h1>

      <section>
        <h2 className="text-sm font-semibold text-slate-900">Repositories</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Controls what happens right after registering a repository (Git URL, GitHub, or Google
          Drive, from the Dashboard or the Repositories page).
        </p>
        <label className="mt-3 flex items-start gap-2 rounded border border-slate-200 bg-white p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={autoScan}
            onChange={(e) => handleAutoScanChange(e.target.checked)}
          />
          <span>
            <span className="font-medium text-slate-900">Automatically scan after registering</span>
            <span className="block text-xs text-slate-500">
              When on (the default), a newly registered repository is discovered and indexed right
              away, so findings, dependencies, and Git activity are ready immediately instead of
              requiring a separate manual "Scan" click. Turn this off to register without scanning
              and trigger it yourself later.
            </span>
          </span>
        </label>
      </section>

      {(oauthProviders.google || oauthProviders.github) && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-slate-900">Connected accounts</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Your account is the one you registered with (email + password) — GitHub and Google are
            optional add-ons for it, not separate logins. Connecting one here links it onto this
            same account instead of switching you to a different one.
          </p>
          <div className="mt-3 space-y-2">
            {oauthProviders.github && (
              <div className="flex items-center justify-between rounded border border-slate-200 bg-white p-3 text-sm">
                <div>
                  <span className="font-medium text-slate-900">GitHub</span>
                  <span className="ml-2 text-xs text-slate-500">
                    Used for signing in and browsing your repos to register them.
                  </span>
                </div>
                {user?.githubConnected ? (
                  <span className="flex items-center gap-2">
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      Connected
                    </span>
                    {}
                    <a
                      href={getGitHubSignInUrl()}
                      title="Re-authorize if repo browsing is failing (e.g. a 401 error) — this refreshes the stored token without switching accounts."
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Reconnect
                    </a>
                  </span>
                ) : (
                  <a
                    href={getGitHubSignInUrl()}
                    className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Connect GitHub
                  </a>
                )}
              </div>
            )}
            {oauthProviders.google && (
              <div className="flex items-center justify-between rounded border border-slate-200 bg-white p-3 text-sm">
                <div>
                  <span className="font-medium text-slate-900">Google</span>
                  <span className="ml-2 text-xs text-slate-500">
                    Used for signing in and browsing Google Drive to import a zip.
                  </span>
                </div>
                {user?.driveConnected ? (
                  <span className="flex items-center gap-2">
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      Connected
                    </span>
                    {}
                    <a
                      href={getGoogleSignInUrl()}
                      title="Re-authorize if Drive browsing is failing (e.g. a 403 error) — this refreshes the stored token without switching accounts."
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Reconnect
                    </a>
                  </span>
                ) : (
                  <a
                    href={getGoogleSignInUrl()}
                    className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Connect Google
                  </a>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <h2 className="mt-6 text-sm font-semibold text-slate-900">Billing</h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">
        Billing is entirely optional. Free Mode and AI Mode using your own provider keys keep
        working exactly the same whether billing is configured or not.
        A monthly AI-operation cap only applies when the server operator has configured Dodo
        Payments.
      </p>

      <div className="mt-4 rounded border border-slate-200 bg-white p-4">
        {loading && <p className="text-sm text-slate-500">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && !error && status && !status.configured && (
          <div className="text-sm text-slate-500">
            <p>
              Billing is not configured on this server — AI-Mode usage stays unlimited, and
              nothing else about the app changes. This is expected until Dodo Payments
              credentials are set; there's no in-app form for it on purpose (real API secrets
              shouldn't be pasted into a web page).
            </p>
            <p className="mt-2">
              A server operator can turn it on by setting three environment variables —{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">DODO_PAYMENTS_API_KEY</code>,{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">DODO_PAYMENTS_WEBHOOK_KEY</code>, and{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">DODO_PRODUCT_ID</code> —
              on the machine running the backend, then restarting it. See{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">backend/.env.example</code>{" "}
              for exactly where to get the values and how to set them on Windows/PowerShell,
              macOS/Linux, systemd, or Docker.
            </p>
          </div>
        )}

        {!loading && !error && status && status.configured && (
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-900">
                Current plan: {status.tier === "pro" ? "Pro" : "Free"}
              </span>
              {status.tier === "pro" ? (
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                  Unlimited AI operations
                </span>
              ) : (
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  Free tier
                </span>
              )}
            </div>

            {status.limit !== null && (
              <p className="mt-2 text-sm text-slate-600">
                {status.used} / {status.limit} AI operations used this month.
              </p>
            )}
            {nearLimit && (
              <p className="mt-1 text-sm font-medium text-red-600">
                You've reached this month's free-tier limit — AI-Mode actions are blocked until
                next month or until you upgrade. Free Mode features are unaffected.
              </p>
            )}
            {closeToLimit && (
              <p className="mt-1 text-sm font-medium text-amber-600">
                You're close to this month's free-tier limit.
              </p>
            )}
            {status.subscription?.currentPeriodEnd && status.tier === "pro" && (
              <p className="mt-1 text-xs text-slate-400">
                Current period ends {new Date(status.subscription.currentPeriodEnd).toLocaleDateString()}.
              </p>
            )}

            {status.tier === "free" && (
              <div className="mt-3">
                <button
                  className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  disabled={checkoutBusy}
                  onClick={handleUpgrade}
                >
                  {checkoutBusy ? "Redirecting to checkout…" : "Upgrade to Pro"}
                </button>
                {checkoutError && <p className="mt-2 text-sm text-red-600">{checkoutError}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
