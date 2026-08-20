/**
 * Cloudflare Turnstile wiring — the frontend half of Task #81's bot
 * protection. The backend has verified tokens since the feature was first
 * built (see auth/turnstile.ts), but nothing on the frontend ever loaded
 * the widget script or rendered it — this file plus TurnstileWidget.tsx
 * closes that gap (flagged as an open item in the pre-launch security
 * audit, docs/SECURITY.md §10).
 *
 * `VITE_TURNSTILE_SITE_KEY` is a Vite build-time env var, baked into the
 * built JS bundle (see deploy/Dockerfile's frontend-build stage ARG) — it
 * is meant to be public, unlike every other Turnstile/OAuth/Razorpay
 * value, which stay server-side only. Leaving it unset keeps the whole
 * feature off: TurnstileWidget renders nothing, and the login/register
 * forms behave exactly as they did before this file existed.
 */

export const TURNSTILE_SITE_KEY: string | undefined = (
  import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined
)?.trim() || undefined;

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

let scriptLoadPromise: Promise<void> | null = null;

/** Loads the Turnstile script at most once per page load, shared across every widget instance. */
export function loadTurnstileScript(): Promise<void> {
  if (typeof window !== "undefined" && window.turnstile) {
    return Promise.resolve();
  }
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Turnstile script")));
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Turnstile script"));
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}
