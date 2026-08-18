import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useProjects } from "../context/ProjectContext";
import { getTestRun, listTestRuns, runProjectTests } from "../lib/api";
import type { TestRunRecord, TestRunStatus } from "../lib/types";

const STATUS_STYLES: Record<TestRunStatus, string> = {
  passed: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  timeout: "bg-orange-100 text-orange-800",
  unsupported: "bg-slate-100 text-slate-700",
  unknown: "bg-slate-100 text-slate-700",
};

export default function TestsPage() {
  const { selectedProject } = useProjects();
  const [runs, setRuns] = useState<TestRunRecord[]>([]);
  const [selectedRun, setSelectedRun] = useState<TestRunRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOutput, setShowOutput] = useState(false);

  function loadHistory() {
    if (!selectedProject) return;
    setLoading(true);
    setError(null);
    listTestRuns(selectedProject.id)
      .then((res) => {
        setRuns(res.runs);
        if (res.runs.length > 0) {
          // The list endpoint omits stdout/stderr (kept light); fetch the
          // full record for the most recent run so its output can be shown.
          getTestRun(selectedProject.id, res.runs[0].id)
            .then((full) => setSelectedRun(full.run))
            .catch(() => setSelectedRun(res.runs[0]));
        } else {
          setSelectedRun(null);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load test runs"))
      .finally(() => setLoading(false));
  }

  useEffect(loadHistory, [selectedProject]);

  async function handleRunTests() {
    if (!selectedProject) return;
    setRunning(true);
    setError(null);
    setShowOutput(false);
    try {
      await runProjectTests(selectedProject.id);
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run tests.");
    } finally {
      setRunning(false);
    }
  }

  async function handleSelectRun(run: TestRunRecord) {
    if (!selectedProject) return;
    setShowOutput(false);
    try {
      const full = await getTestRun(selectedProject.id, run.id);
      setSelectedRun(full.run);
    } catch {
      setSelectedRun(run);
    }
  }

  if (!selectedProject) {
    return (
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Tests</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          No repository selected yet. Go to{" "}
          <Link to="/repositories" className="underline">
            Repositories
          </Link>{" "}
          to register and scan one.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Tests</h1>
        <button
          onClick={handleRunTests}
          disabled={running}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {running ? "Running…" : "Run Tests"}
        </button>
      </div>

      {loading && <p className="mt-4 text-sm text-slate-500">Loading…</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {!loading && !error && runs.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">
          No tests have been run yet for this repository. Click "Run Tests" above.
        </p>
      )}

      {!loading && !error && selectedRun && (
        <div className="mt-4 rounded border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              data-testid="run-status"
              className={`rounded px-2 py-0.5 text-xs font-medium uppercase ${STATUS_STYLES[selectedRun.status]}`}
            >
              {selectedRun.status}
            </span>
            {selectedRun.framework && (
              <span className="text-xs text-slate-500">{selectedRun.framework}</span>
            )}
            {selectedRun.command && (
              <span className="font-mono text-xs text-slate-500">{selectedRun.command}</span>
            )}
          </div>

          {selectedRun.status === "unsupported" ? (
            <p className="mt-3 text-sm text-slate-600">{selectedRun.reason}</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
              <span>
                <span className="font-medium text-emerald-700">{selectedRun.passed}</span> passed
              </span>
              <span>
                <span className="font-medium text-red-700">{selectedRun.failed}</span> failed
              </span>
              <span>
                <span className="font-medium text-slate-600">{selectedRun.skipped}</span> skipped
              </span>
              {selectedRun.duration_ms !== null && (
                <span className="text-slate-500">{(selectedRun.duration_ms / 1000).toFixed(1)}s</span>
              )}
            </div>
          )}

          {(selectedRun.stdout_ref || selectedRun.stderr_ref) && (
            <div className="mt-3">
              <button
                onClick={() => setShowOutput((v) => !v)}
                className="text-xs font-medium text-slate-600 underline"
              >
                {showOutput ? "Hide output" : "Show output"}
              </button>
              {showOutput && (
                <pre className="mt-2 max-h-64 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
                  {selectedRun.stdout_ref}
                  {selectedRun.stderr_ref}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {!loading && !error && runs.length > 1 && (
        <div className="mt-6">
          <h2 className="text-xs font-medium text-slate-500">Run history</h2>
          <ul className="mt-2 space-y-1">
            {runs.map((run) => (
              <li key={run.id}>
                <button
                  onClick={() => handleSelectRun(run)}
                  className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100 ${
                    selectedRun?.id === run.id ? "bg-slate-100" : ""
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium uppercase ${STATUS_STYLES[run.status]}`}
                    >
                      {run.status}
                    </span>
                    <span className="text-slate-700">
                      {run.passed} passed, {run.failed} failed, {run.skipped} skipped
                    </span>
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(run.started_at).toLocaleString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
