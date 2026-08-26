import { useEffect, useState } from "react";

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
