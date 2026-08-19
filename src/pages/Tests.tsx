import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useProjects } from "../context/ProjectContext";
import {
  diagnoseTestFailure,
  getTestFailureDiagnosis,
  getTestRun,
  listAiProviders,
  listTestRuns,
  runProjectTests,
} from "../lib/api";
import type { FailureDiagnosisData, TestRunRecord, TestRunStatus } from "../lib/types";

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
  const [hasEnabledProvider, setHasEnabledProvider] = useState(false);
  const [diagnosisOpen, setDiagnosisOpen] = useState(false);
  const [diagnoses, setDiagnoses] = useState<Record<string, FailureDiagnosisData>>({});
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);

  useEffect(() => {
    listAiProviders()
      .then((res) => setHasEnabledProvider(res.providers.some((p) => p.enabled)))
      .catch(() => setHasEnabledProvider(false));
  }, []);

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
    setDiagnosisOpen(false);
    setDiagnosisError(null);
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
    setDiagnosisOpen(false);
    setDiagnosisError(null);
    try {
      const full = await getTestRun(selectedProject.id, run.id);
      setSelectedRun(full.run);
    } catch {
      setSelectedRun(run);
    }
  }

  async function toggleDiagnosis() {
    if (!selectedProject || !selectedRun) return;
    if (diagnosisOpen) {
      setDiagnosisOpen(false);
      return;
    }
    setDiagnosisOpen(true);
    setDiagnosisError(null);
    if (diagnoses[selectedRun.id]) return;
    setDiagnosisLoading(true);
    try {
      const stored = await getTestFailureDiagnosis(selectedProject.id, selectedRun.id);
      if (stored.diagnosis) {
        setDiagnoses((prev) => ({ ...prev, [selectedRun.id]: stored.diagnosis! }));
      }
    } catch (err) {
      setDiagnosisError(err instanceof Error ? err.message : "Failed to load AI failure diagnosis.");
    } finally {
      setDiagnosisLoading(false);
    }
  }

  async function generateDiagnosis() {
    if (!selectedProject || !selectedRun) return;
    setDiagnosisError(null);
    setDiagnosisLoading(true);
    try {
      const result = await diagnoseTestFailure(selectedProject.id, selectedRun.id);
      setDiagnoses((prev) => ({ ...prev, [selectedRun.id]: result.diagnosis }));
    } catch (err) {
      setDiagnosisError(err instanceof Error ? err.message : "Failed to generate AI failure diagnosis.");
    } finally {
      setDiagnosisLoading(false);
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

          {selectedRun.status === "failed" && (
            <div className="mt-3">
              <button
                onClick={toggleDiagnosis}
                className="text-xs font-medium text-slate-600 underline"
              >
                {diagnosisOpen ? "Hide AI diagnosis" : "AI diagnosis"}
              </button>

              {diagnosisOpen && (
                <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                  {diagnosisLoading && <p className="text-slate-500">Loading…</p>}
                  {diagnosisError && !diagnosisLoading && <p className="text-red-600">{diagnosisError}</p>}
                  {!diagnosisLoading && diagnoses[selectedRun.id] && (
                    <FailureDiagnosisView diagnosis={diagnoses[selectedRun.id]} />
                  )}
                  {!diagnosisLoading && !diagnoses[selectedRun.id] && !diagnosisError && (
                    <div>
                      <p className="text-slate-500">No AI diagnosis generated yet.</p>
                      <button
                        onClick={generateDiagnosis}
                        disabled={!hasEnabledProvider}
                        title={
                          hasEnabledProvider
                            ? undefined
                            : "No AI provider is configured and enabled. Configure one in AI Mode first."
                        }
                        className="mt-1 rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                      >
                        Diagnose failure
                      </button>
                      {!hasEnabledProvider && (
                        <p className="mt-1 text-slate-400">
                          No AI provider is configured and enabled. Configure one in AI Mode first.
                        </p>
                      )}
                    </div>
                  )}
                </div>
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

/**
 * Renders a Phase 20 failure diagnosis, mirroring Findings.tsx's
 * `RootCauseView` — likely cause as prose, evidence as a bulleted list,
 * suggested direction as prose. Any field the model's response didn't
 * clearly contain is shown as "Not reported" rather than hidden or
 * guessed. Deliberately does not render a diff or code — this workflow
 * is read-only diagnosis, not patch generation; the existing fix-plan /
 * patch flow on the Findings page is the human-approval-gated path for
 * an actual change.
 */
function FailureDiagnosisView({ diagnosis }: { diagnosis: FailureDiagnosisData }) {
  return (
    <div>
      <p className="font-medium text-slate-700">Likely cause</p>
      <p className="text-slate-800">{diagnosis.likelyCause ?? "Not reported in the expected format."}</p>

      <p className="mt-2 font-medium text-slate-700">Evidence</p>
      {diagnosis.evidence ? (
        <ul className="mt-1 list-disc pl-4 text-slate-800">
          {diagnosis.evidence.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-400">Not reported in the expected format — see raw response below.</p>
      )}

      <p className="mt-2 font-medium text-slate-700">Suggested direction</p>
      <p className="text-slate-800">{diagnosis.suggestedDirection ?? "Not reported in the expected format."}</p>

      <details className="mt-2">
        <summary className="cursor-pointer text-slate-500">Raw response</summary>
        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-slate-600">{diagnosis.raw}</pre>
      </details>
    </div>
  );
}
