import { useState } from "react";
import { ApiError, type BulkFixResult } from "../lib/api";

interface BulkAiFixButtonProps {

  label: string;

  itemDescription: string;
  disabled?: boolean;
  onRun: () => Promise<BulkFixResult>;

  onDone: () => void;
}

type Step = "idle" | "confirm" | "running" | "summary" | "error";

export default function BulkAiFixButton({
  label,
  itemDescription,
  disabled,
  onRun,
  onDone,
}: BulkAiFixButtonProps) {
  const [step, setStep] = useState<Step>("idle");
  const [result, setResult] = useState<BulkFixResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setStep("running");
    setError(null);
    try {
      const res = await onRun();
      setResult(res);
      setStep("summary");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Bulk fix failed.");
      setStep("error");
    }
  }

  function handleDone() {
    setStep("idle");
    setResult(null);
    onDone();
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setStep("confirm")}
        className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {label}
      </button>

      {(step === "confirm" || step === "running") && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{label}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              This will run against {itemDescription}, generating a fix plan and a patch for each one
              automatically using your enabled AI provider. Nothing is written to disk — every
              generated patch still needs your review and a separate "Approve for apply" before it
              can touch a file.
            </p>
            {step === "running" ? (
              <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">Running…</p>
            ) : (
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStep("idle")}
                  className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  Confirm
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {step === "summary" && result && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Done</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {result.succeeded} of {result.attempted} succeeded
              {result.failed > 0 ? `, ${result.failed} failed` : ""}
              {result.skipped > 0 ? ` — ${result.skipped} left over this run's cap` : ""}.
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              AI token usage: {result.usage.promptTokens.toLocaleString()} prompt +{" "}
              {result.usage.completionTokens.toLocaleString()} completion ={" "}
              <span className="font-medium">{result.usage.totalTokens.toLocaleString()} total</span>.
            </p>
            {result.failed > 0 && (
              <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-red-600 dark:text-red-400">
                {result.results
                  .filter((r) => r.error)
                  .map((r, i) => (
                    <li key={i}>{r.error}</li>
                  ))}
              </ul>
            )}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleDone}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
              >
                Confirm — review the results
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "error" && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-red-300 bg-white p-5 shadow-xl dark:border-red-800 dark:bg-slate-900">
            <h2 className="text-base font-semibold text-red-700 dark:text-red-400">Bulk fix failed</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{error}</p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setStep("idle")}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
