import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listAiProviders } from "../lib/api";

interface AiProviderReminderProps {
  onDismiss: () => void;
}

/**
 * A one-time, blocking modal shown right after registering a repository.
 * Per the user's explicit request: "AI MODE is no longer optional it is
 * needed" — a passive banner that scrolled with the page was too easy to
 * miss, so this is now a modal overlay demanding an explicit choice
 * ("Register AI provider now!" or "Skip / Add later") instead of something
 * that could go unnoticed. It is still not a hard gate: "Skip" genuinely
 * skips, with no feature disabled by leaving a provider unset — this is
 * about making the choice unmissable, not about removing the choice. Free
 * Mode (scanning, findings, dependencies, Git activity) keeps working with
 * zero setup either way; explanations, fix plans, patch generation, and
 * generated tests are what actually need a provider.
 *
 * Self-checks whether a provider already exists (any provider, enabled or
 * not — the point is "have you been through AI Mode's setup at all", not
 * "is one currently active") so callers can render this unconditionally
 * after a successful registration and trust it to no-op when there's
 * nothing to remind about.
 */
export default function AiProviderReminder({ onDismiss }: AiProviderReminderProps) {
  const [hasProvider, setHasProvider] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAiProviders()
      .then((res) => {
        if (!cancelled) setHasProvider(res.providers.length > 0);
      })
      .catch(() => {
        // Fail safe: an error checking shouldn't nag — assume a provider
        // might already exist rather than showing a possibly-wrong reminder.
        if (!cancelled) setHasProvider(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (hasProvider !== false) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-provider-reminder-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
    >
      <div className="w-full max-w-md rounded-lg border border-amber-300 bg-white p-5 shadow-xl dark:border-amber-800 dark:bg-slate-900">
        <h2
          id="ai-provider-reminder-title"
          className="text-base font-semibold text-amber-900 dark:text-amber-200"
        >
          An AI provider is necessary
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          This repository is registered, but nothing here can actually get fixed yet. Explaining a
          finding, generating a fix plan, generating a patch, and generating a test all require an
          AI provider — without one, this app can only scan and report, never act. Free Mode
          (findings, dependencies, Git activity) keeps working either way, so you can skip this and
          add one later, but you won't get real fixes until you do.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Skip / Add later
          </button>
          <Link
            to="/ai-mode"
            onClick={onDismiss}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
          >
            Register AI provider now!
          </Link>
        </div>
      </div>
    </div>
  );
}
