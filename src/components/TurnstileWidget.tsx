import { useEffect, useRef, useState } from "react";
import { loadTurnstileScript, TURNSTILE_SITE_KEY } from "../lib/turnstile";

/**
 * Renders the Cloudflare Turnstile challenge when `VITE_TURNSTILE_SITE_KEY`
 * is configured at build time; renders nothing at all otherwise, so the
 * login/register forms are unaffected on installs that never turn this on
 * (see docs/AUTH.md §4 — bot protection is fully opt-in).
 *
 * Calls `onToken` with the verification token once solved, and with
 * `null` if the widget expires or errors, so the caller can re-disable
 * submission until it's solved again.
 */
export default function TurnstileWidget({ onToken }: { onToken: (token: string | null) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !containerRef.current) return;
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => onToken(token),
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null),
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
    // Runs once per mount — TURNSTILE_SITE_KEY is a build-time constant and onToken identity churn shouldn't re-render the widget.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!TURNSTILE_SITE_KEY) return null;

  return (
    <div className="mt-1">
      <div ref={containerRef} />
      {failed && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          Couldn't load the verification widget — check your connection and reload the page.
        </p>
      )}
    </div>
  );
}
