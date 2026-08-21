import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listAiProviders } from "../lib/api";

interface AiProviderReminderProps {
  onDismiss: () => void;
}

/**
 * A one-time nudge shown right after registering a repository: AI Mode
 * (explanations, fix plans, patch generation, generated tests) needs a
 * configured provider, and it's easy to register a repo, scan it, and
 * never notice the AI Mode tab needs setup first. Free Mode (scanning,
 * findings, dependencies, Git activity) works with zero setup either way,
 * so this is a reminder with a real "skip it" option, not a gate —
 * dismissing just hides it for this registration; nothing is disabled or
 * blocked by leaving it unset.
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
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
      <p className="text-amber-900 dark:text-amber-200">
        No AI provider is set up yet. AI Mode (explanations, fix plans, patch generation, generated
        tests) needs one — Free Mode (scanning, findings, dependencies, Git activity) works fine
        without it.
      </p>
      <div className="flex shrink-0 gap-2">
        <Link
          to="/ai-mode"
          className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-900"
        >
          Add a provider now
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Add later
        </button>
      </div>
    </div>
  );
}
