import { useEffect, useState } from "react";

/**
 * A live progress indicator for actions that genuinely take a while
 * (repository scans, analysis runs, test runs, AI calls) — Task #78,
 * replacing static "Loading…"/"Running…" text.
 *
 * This app's long-running actions (`POST /discover`, `/analysis`,
 * `/tests`, the AI workflow routes) are each a single request that blocks
 * until the whole operation finishes — the backend has no incremental
 * "40% done" signal to report, and fabricating one would violate this
 * project's "never fabricate" convention just as much as a fake test
 * count would. What IS real and worth showing live: that the action is
 * actively running (an animated spinner, not a static string) and exactly
 * how long it's been running — both drawn from the browser's own clock,
 * not guessed. That's enough to tell a user "this hasn't hung" without
 * inventing a percentage that doesn't exist.
 */
export default function ActivityIndicator({ label }: { label: string }) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const start = performance.now();
    setElapsedMs(0);
    const interval = setInterval(() => setElapsedMs(performance.now() - start), 100);
    return () => clearInterval(interval);
  }, [label]);

  const seconds = (elapsedMs / 1000).toFixed(1);

  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
      <span
        aria-hidden="true"
        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-slate-600 dark:border-t-slate-300"
      />
      <span>
        {label} <span className="tabular-nums text-slate-400 dark:text-slate-500">({seconds}s)</span>
      </span>
    </span>
  );
}
