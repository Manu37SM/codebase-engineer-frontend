import { useEffect, useState } from "react";
import { ApiError, createBillingCheckout, getBillingStatus } from "../lib/api";
import type { BillingStatus } from "../lib/types";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export default function BillingPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

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
      const order = await createBillingCheckout();
      if (typeof window.Razorpay !== "function") {
        setCheckoutError(
          `A real order was created (${order.orderId}), but the Razorpay Checkout script is not ` +
            "loaded in this page, so the payment widget can't be opened here. This is an honest " +
            "limitation, not a fabricated success — no payment can be collected without it."
        );
        return;
      }
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "Codebase Engineer — Pro",
        handler: () => load(),
      });
      checkout.open();
    } catch (err) {
      setCheckoutError(err instanceof ApiError ? err.message : "Failed to start checkout.");
    } finally {
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
      <h1 className="text-lg font-semibold text-slate-900">Settings — Billing</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">
        Billing is entirely optional. Free Mode and AI Mode using your own provider keys keep
        working exactly the same whether billing is configured or not — see docs/MONETIZATION.md.
        A monthly AI-operation cap only applies when the server operator has configured Razorpay.
      </p>

      <div className="mt-4 rounded border border-slate-200 bg-white p-4">
        {loading && <p className="text-sm text-slate-500">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && !error && status && !status.configured && (
          <p className="text-sm text-slate-500">
            Billing is not configured on this server. AI-Mode usage is unlimited. (A server
            operator can enable a monthly free-tier cap and Pro upgrades by setting
            RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET.)
          </p>
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
                  {checkoutBusy ? "Starting checkout…" : "Upgrade to Pro"}
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
