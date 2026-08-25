import { useState } from "react";
import { ApiError, type BulkRejectResult } from "../lib/api";

interface BulkRejectButtonProps {
  /** Only ever rendered by the caller when the current tier is "pro". */
  itemDescription: string;
  disabled?: boolean;
  onRun: () => Promise<BulkRejectResult>;
  /** Called once the summary is dismissed — lets the caller refresh its list. */
  onDone: () => void;
}

type Step = "idle" | "confirm" | "running" | "summary" | "error";

/**
 * Pro-tier "Reject all" — the bulk counterpart to the per-row Reject button
 * on a patch that's past the diff-review gate ('proposed' or
 * 'approved_for_apply'). Deliberately a separate, simpler component from
 * BulkAiFixButton: this never calls an AI provider (it's a pure DB status
 * change), so there's no token usage to show and no "using your AI
 * provider" copy — just a clear confirm step naming what will be rejected,
 * since rejecting is a one-way action a reviewer should not trigger by
 * accident.
 */
export default function BulkRejectButton({ itemDescription, disabled, onRun, onDone }: BulkRejectButtonProps) {
  const [step, setStep] = useState<Step>("idle");
  const [result, setResult] = useState<BulkRejectResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setStep("running");
    setError(null);
    try {
      const res = await onRun();
      setResult(res);
      setStep("summary");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reject all failed.");
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
        className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
      >
        Reject all
      </button>

      {(step === "confirm" || step === "running") && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Reject all</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              This will reject {itemDescription} awaiting review. Nothing on disk is affected — none of
              these have been applied — but this cannot be undone; a rejected patch would need to be
              regenerated from its finding.
            </p>
            {step === "running" ? (
              <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">Rejecting…</p>
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
                  className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
                >
                  Reject all
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
              Rejected {result.succeeded} of {result.attempted}.
            </p>
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
            <h2 className="text-base font-semibold text-red-700 dark:text-red-400">Reject all failed</h2>
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
