import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useProjects } from "../context/ProjectContext";
import ActivityIndicator from "../components/ActivityIndicator";
import {
  analyzeRootCause,
  applyPatch,
  approveGeneratedTest,
  approveGeneratedTestWrite,
  approvePatch,
  approvePatchApply,
  createGeneratedTest,
  createPatch,
  explainFinding,
  generatePatch,
  generateTest,
  getFindingContext,
  getFindingExplanation,
  getFindingFixPlan,
  getFindingRootCause,
  getPatchSelfReview,
  listAiProviders,
  listFindingGeneratedTests,
  listFindingPatches,
  listFindings,
  planFix,
  rejectGeneratedTest,
  rejectGeneratedTestWrite,
  rejectPatch,
  rejectPatchApply,
  runProjectAnalysis,
  selfReviewPatch,
  writeAndRunGeneratedTest,
} from "../lib/api";
import type {
  ContextBundle,
  FindingRecord,
  GeneratedTestRecord,
  PatchRecord,
  SelfReviewData,
  Severity,
  StoredExplanation,
  StoredFixPlan,
  StoredRootCauseAnalysis,
} from "../lib/types";

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-slate-100 text-slate-700",
};

const SEVERITY_OPTIONS: Severity[] = ["critical", "high", "medium", "low"];
const CATEGORY_OPTIONS = ["maintainability", "testing", "security"];

export default function FindingsPage() {
  const { selectedProject } = useProjects();
  const [findings, setFindings] = useState<FindingRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [hasRun, setHasRun] = useState(false);
  const [severity, setSeverity] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [contextOpenFor, setContextOpenFor] = useState<string | null>(null);
  const [contextBundles, setContextBundles] = useState<Record<string, ContextBundle>>({});
  const [contextLoading, setContextLoading] = useState<string | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);

  const [hasEnabledProvider, setHasEnabledProvider] = useState(false);
  const [explainOpenFor, setExplainOpenFor] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<Record<string, StoredExplanation>>({});
  const [explainLoading, setExplainLoading] = useState<string | null>(null);
  const [explainError, setExplainError] = useState<string | null>(null);

  const [rootCauseOpenFor, setRootCauseOpenFor] = useState<string | null>(null);
  const [rootCauses, setRootCauses] = useState<Record<string, StoredRootCauseAnalysis>>({});
  const [rootCauseLoading, setRootCauseLoading] = useState<string | null>(null);
  const [rootCauseError, setRootCauseError] = useState<string | null>(null);

  const [fixPlanOpenFor, setFixPlanOpenFor] = useState<string | null>(null);
  const [fixPlans, setFixPlans] = useState<Record<string, StoredFixPlan>>({});
  const [fixPlanLoading, setFixPlanLoading] = useState<string | null>(null);
  const [fixPlanError, setFixPlanError] = useState<string | null>(null);

  const [patchesOpenFor, setPatchesOpenFor] = useState<string | null>(null);
  const [patches, setPatches] = useState<Record<string, PatchRecord[]>>({});
  const [patchesLoading, setPatchesLoading] = useState<string | null>(null);
  const [patchesError, setPatchesError] = useState<string | null>(null);
  const [patchActionBusy, setPatchActionBusy] = useState<string | null>(null);

  const [selfReviewOpenFor, setSelfReviewOpenFor] = useState<string | null>(null);
  const [selfReviews, setSelfReviews] = useState<Record<string, SelfReviewData>>({});
  const [selfReviewLoading, setSelfReviewLoading] = useState<string | null>(null);
  const [selfReviewError, setSelfReviewError] = useState<string | null>(null);

  const [generatedTestsOpenFor, setGeneratedTestsOpenFor] = useState<string | null>(null);
  const [generatedTests, setGeneratedTests] = useState<Record<string, GeneratedTestRecord[]>>({});
  const [generatedTestsLoading, setGeneratedTestsLoading] = useState<string | null>(null);
  const [generatedTestsError, setGeneratedTestsError] = useState<string | null>(null);
  const [generatedTestActionBusy, setGeneratedTestActionBusy] = useState<string | null>(null);

  useEffect(() => {
    listAiProviders()
      .then((res) => setHasEnabledProvider(res.providers.some((p) => p.enabled)))
      .catch(() => setHasEnabledProvider(false));
  }, []);

  function load() {
    if (!selectedProject) return;
    setLoading(true);
    setError(null);
    listFindings(selectedProject.id, {
      severity: severity || undefined,
      category: category || undefined,
    })
      .then((res) => {
        setFindings(res.findings);
        setTotal(res.total);
        setHasRun(res.latestRun !== null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load findings"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [selectedProject, severity, category]);

  async function handleRunAnalysis() {
    if (!selectedProject) return;
    setRunning(true);
    setError(null);
    try {
      await runProjectAnalysis(selectedProject.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setRunning(false);
    }
  }

  async function togglePreview(findingId: string) {
    if (contextOpenFor === findingId) {
      setContextOpenFor(null);
      return;
    }
    setContextOpenFor(findingId);
    setContextError(null);
    if (contextBundles[findingId] || !selectedProject) return;
    setContextLoading(findingId);
    try {
      const bundle = await getFindingContext(selectedProject.id, findingId);
      setContextBundles((prev) => ({ ...prev, [findingId]: bundle }));
    } catch (err) {
      setContextError(err instanceof Error ? err.message : "Failed to load AI context preview.");
    } finally {
      setContextLoading(null);
    }
  }

  async function toggleExplanation(findingId: string) {
    if (explainOpenFor === findingId) {
      setExplainOpenFor(null);
      return;
    }
    setExplainOpenFor(findingId);
    setExplainError(null);
    if (explanations[findingId] || !selectedProject) return;
    setExplainLoading(findingId);
    try {
      const stored = await getFindingExplanation(selectedProject.id, findingId);
      setExplanations((prev) => ({ ...prev, [findingId]: stored }));
    } catch (err) {
      setExplainError(err instanceof Error ? err.message : "Failed to load AI explanation.");
    } finally {
      setExplainLoading(null);
    }
  }

  async function generateExplanation(findingId: string) {
    if (!selectedProject) return;
    setExplainError(null);
    setExplainLoading(findingId);
    try {
      const result = await explainFinding(selectedProject.id, findingId);
      setExplanations((prev) => ({
        ...prev,
        [findingId]: { explanation: result.explanation, provider: result.provider, model: result.model },
      }));
    } catch (err) {
      setExplainError(err instanceof Error ? err.message : "Failed to generate AI explanation.");
    } finally {
      setExplainLoading(null);
    }
  }

  async function toggleRootCause(findingId: string) {
    if (rootCauseOpenFor === findingId) {
      setRootCauseOpenFor(null);
      return;
    }
    setRootCauseOpenFor(findingId);
    setRootCauseError(null);
    if (rootCauses[findingId] || !selectedProject) return;
    setRootCauseLoading(findingId);
    try {
      const stored = await getFindingRootCause(selectedProject.id, findingId);
      setRootCauses((prev) => ({ ...prev, [findingId]: stored }));
    } catch (err) {
      setRootCauseError(err instanceof Error ? err.message : "Failed to load AI root-cause analysis.");
    } finally {
      setRootCauseLoading(null);
    }
  }

  async function generateRootCause(findingId: string) {
    if (!selectedProject) return;
    setRootCauseError(null);
    setRootCauseLoading(findingId);
    try {
      const result = await analyzeRootCause(selectedProject.id, findingId);
      setRootCauses((prev) => ({
        ...prev,
        [findingId]: { analysis: result.analysis, provider: result.provider, model: result.model },
      }));
    } catch (err) {
      setRootCauseError(err instanceof Error ? err.message : "Failed to generate AI root-cause analysis.");
    } finally {
      setRootCauseLoading(null);
    }
  }

  async function toggleFixPlan(findingId: string) {
    if (fixPlanOpenFor === findingId) {
      setFixPlanOpenFor(null);
      return;
    }
    setFixPlanOpenFor(findingId);
    setFixPlanError(null);
    if (fixPlans[findingId] || !selectedProject) return;
    setFixPlanLoading(findingId);
    try {
      const stored = await getFindingFixPlan(selectedProject.id, findingId);
      setFixPlans((prev) => ({ ...prev, [findingId]: stored }));
    } catch (err) {
      setFixPlanError(err instanceof Error ? err.message : "Failed to load AI fix plan.");
    } finally {
      setFixPlanLoading(null);
    }
  }

  async function generateFixPlan(findingId: string) {
    if (!selectedProject) return;
    setFixPlanError(null);
    setFixPlanLoading(findingId);
    try {
      const result = await planFix(selectedProject.id, findingId);
      setFixPlans((prev) => ({
        ...prev,
        [findingId]: { plan: result.plan, provider: result.provider, model: result.model },
      }));
    } catch (err) {
      setFixPlanError(err instanceof Error ? err.message : "Failed to generate AI fix plan.");
    } finally {
      setFixPlanLoading(null);
    }
  }

  async function togglePatches(findingId: string) {
    if (patchesOpenFor === findingId) {
      setPatchesOpenFor(null);
      return;
    }
    setPatchesOpenFor(findingId);
    setPatchesError(null);
    await loadPatches(findingId);
  }

  async function loadPatches(findingId: string) {
    if (!selectedProject) return;
    setPatchesLoading(findingId);
    try {
      const res = await listFindingPatches(selectedProject.id, findingId);
      setPatches((prev) => ({ ...prev, [findingId]: res.patches }));
    } catch (err) {
      setPatchesError(err instanceof Error ? err.message : "Failed to load patches.");
    } finally {
      setPatchesLoading(null);
    }
  }

  async function handleCreatePatch(findingId: string) {
    if (!selectedProject) return;
    setPatchesError(null);
    setPatchActionBusy(`create:${findingId}`);
    try {
      await createPatch(selectedProject.id, findingId);
      await loadPatches(findingId);
    } catch (err) {
      setPatchesError(err instanceof Error ? err.message : "Failed to create patch.");
    } finally {
      setPatchActionBusy(null);
    }
  }

  async function handleApprovePatch(findingId: string, patchId: string) {
    if (!selectedProject) return;
    setPatchesError(null);
    setPatchActionBusy(`approve:${patchId}`);
    try {
      await approvePatch(selectedProject.id, patchId);
      await loadPatches(findingId);
    } catch (err) {
      setPatchesError(err instanceof Error ? err.message : "Failed to approve patch.");
    } finally {
      setPatchActionBusy(null);
    }
  }

  async function handleRejectPatch(findingId: string, patchId: string) {
    if (!selectedProject) return;
    setPatchesError(null);
    setPatchActionBusy(`reject:${patchId}`);
    try {
      await rejectPatch(selectedProject.id, patchId);
      await loadPatches(findingId);
    } catch (err) {
      setPatchesError(err instanceof Error ? err.message : "Failed to reject patch.");
    } finally {
      setPatchActionBusy(null);
    }
  }

  async function handleGeneratePatch(findingId: string, patchId: string) {
    if (!selectedProject) return;
    setPatchesError(null);
    setPatchActionBusy(`generate:${patchId}`);
    try {
      await generatePatch(selectedProject.id, patchId);
      await loadPatches(findingId);
    } catch (err) {
      setPatchesError(err instanceof Error ? err.message : "Failed to generate patch.");
    } finally {
      setPatchActionBusy(null);
    }
  }

  // Phase 18's second human-approval gate: reviewing and approving the
  // generated diff is a separate decision from approving that generation
  // should happen at all (handled above). Only after this can /apply run.
  async function handleApprovePatchApply(findingId: string, patchId: string) {
    if (!selectedProject) return;
    setPatchesError(null);
    setPatchActionBusy(`approve-apply:${patchId}`);
    try {
      await approvePatchApply(selectedProject.id, patchId);
      await loadPatches(findingId);
    } catch (err) {
      setPatchesError(err instanceof Error ? err.message : "Failed to approve diff for apply.");
    } finally {
      setPatchActionBusy(null);
    }
  }

  async function handleRejectPatchApply(findingId: string, patchId: string) {
    if (!selectedProject) return;
    setPatchesError(null);
    setPatchActionBusy(`reject-apply:${patchId}`);
    try {
      await rejectPatchApply(selectedProject.id, patchId);
      await loadPatches(findingId);
    } catch (err) {
      setPatchesError(err instanceof Error ? err.message : "Failed to reject diff.");
    } finally {
      setPatchActionBusy(null);
    }
  }

  /** The only action in this product that writes to a file on disk. */
  async function handleApplyPatch(findingId: string, patchId: string) {
    if (!selectedProject) return;
    setPatchesError(null);
    setPatchActionBusy(`apply:${patchId}`);
    try {
      await applyPatch(selectedProject.id, patchId);
      await loadPatches(findingId);
    } catch (err) {
      setPatchesError(err instanceof Error ? err.message : "Failed to apply patch.");
    } finally {
      setPatchActionBusy(null);
    }
  }

  // Phase 21: AI self-review — advisory only, never changes a patch's
  // status, so it's just a toggle-and-generate pair (like root-cause
  // analysis), not a gated action like the patch lifecycle handlers above.
  async function toggleSelfReview(patchId: string) {
    if (selfReviewOpenFor === patchId) {
      setSelfReviewOpenFor(null);
      return;
    }
    setSelfReviewOpenFor(patchId);
    setSelfReviewError(null);
    if (selfReviews[patchId] || !selectedProject) return;
    setSelfReviewLoading(patchId);
    try {
      const stored = await getPatchSelfReview(selectedProject.id, patchId);
      if (stored.review) {
        setSelfReviews((prev) => ({ ...prev, [patchId]: stored.review! }));
      }
    } catch (err) {
      setSelfReviewError(err instanceof Error ? err.message : "Failed to load AI self-review.");
    } finally {
      setSelfReviewLoading(null);
    }
  }

  async function generateSelfReview(patchId: string) {
    if (!selectedProject) return;
    setSelfReviewError(null);
    setSelfReviewLoading(patchId);
    try {
      const result = await selfReviewPatch(selectedProject.id, patchId);
      setSelfReviews((prev) => ({ ...prev, [patchId]: result.review }));
    } catch (err) {
      setSelfReviewError(err instanceof Error ? err.message : "Failed to generate AI self-review.");
    } finally {
      setSelfReviewLoading(null);
    }
  }

  // Phase 19: AI test generation, mirroring the patch lifecycle's handler
  // shape exactly — same two gates, plus a final "write-and-run" step
  // that both writes a new file and actually executes the suite.
  async function toggleGeneratedTests(findingId: string) {
    if (generatedTestsOpenFor === findingId) {
      setGeneratedTestsOpenFor(null);
      return;
    }
    setGeneratedTestsOpenFor(findingId);
    setGeneratedTestsError(null);
    await loadGeneratedTests(findingId);
  }

  async function loadGeneratedTests(findingId: string) {
    if (!selectedProject) return;
    setGeneratedTestsLoading(findingId);
    try {
      const res = await listFindingGeneratedTests(selectedProject.id, findingId);
      setGeneratedTests((prev) => ({ ...prev, [findingId]: res.generatedTests }));
    } catch (err) {
      setGeneratedTestsError(err instanceof Error ? err.message : "Failed to load generated tests.");
    } finally {
      setGeneratedTestsLoading(null);
    }
  }

  async function handleCreateGeneratedTest(findingId: string) {
    if (!selectedProject) return;
    setGeneratedTestsError(null);
    setGeneratedTestActionBusy(`create:${findingId}`);
    try {
      await createGeneratedTest(selectedProject.id, findingId);
      await loadGeneratedTests(findingId);
    } catch (err) {
      setGeneratedTestsError(err instanceof Error ? err.message : "Failed to create generated test.");
    } finally {
      setGeneratedTestActionBusy(null);
    }
  }

  async function handleApproveGeneratedTest(findingId: string, testId: string) {
    if (!selectedProject) return;
    setGeneratedTestsError(null);
    setGeneratedTestActionBusy(`approve:${testId}`);
    try {
      await approveGeneratedTest(selectedProject.id, testId);
      await loadGeneratedTests(findingId);
    } catch (err) {
      setGeneratedTestsError(err instanceof Error ? err.message : "Failed to approve generated test.");
    } finally {
      setGeneratedTestActionBusy(null);
    }
  }

  async function handleRejectGeneratedTest(findingId: string, testId: string) {
    if (!selectedProject) return;
    setGeneratedTestsError(null);
    setGeneratedTestActionBusy(`reject:${testId}`);
    try {
      await rejectGeneratedTest(selectedProject.id, testId);
      await loadGeneratedTests(findingId);
    } catch (err) {
      setGeneratedTestsError(err instanceof Error ? err.message : "Failed to reject generated test.");
    } finally {
      setGeneratedTestActionBusy(null);
    }
  }

  async function handleGenerateTest(findingId: string, testId: string) {
    if (!selectedProject) return;
    setGeneratedTestsError(null);
    setGeneratedTestActionBusy(`generate:${testId}`);
    try {
      await generateTest(selectedProject.id, testId);
      await loadGeneratedTests(findingId);
    } catch (err) {
      setGeneratedTestsError(err instanceof Error ? err.message : "Failed to generate test.");
    } finally {
      setGeneratedTestActionBusy(null);
    }
  }

  async function handleApproveGeneratedTestWrite(findingId: string, testId: string) {
    if (!selectedProject) return;
    setGeneratedTestsError(null);
    setGeneratedTestActionBusy(`approve-write:${testId}`);
    try {
      await approveGeneratedTestWrite(selectedProject.id, testId);
      await loadGeneratedTests(findingId);
    } catch (err) {
      setGeneratedTestsError(err instanceof Error ? err.message : "Failed to approve test for write.");
    } finally {
      setGeneratedTestActionBusy(null);
    }
  }

  async function handleRejectGeneratedTestWrite(findingId: string, testId: string) {
    if (!selectedProject) return;
    setGeneratedTestsError(null);
    setGeneratedTestActionBusy(`reject-write:${testId}`);
    try {
      await rejectGeneratedTestWrite(selectedProject.id, testId);
      await loadGeneratedTests(findingId);
    } catch (err) {
      setGeneratedTestsError(err instanceof Error ? err.message : "Failed to reject generated test.");
    } finally {
      setGeneratedTestActionBusy(null);
    }
  }

  /** Writes the generated test to disk and actually runs the project's real test command. */
  async function handleWriteAndRunGeneratedTest(findingId: string, testId: string) {
    if (!selectedProject) return;
    setGeneratedTestsError(null);
    setGeneratedTestActionBusy(`write-and-run:${testId}`);
    try {
      await writeAndRunGeneratedTest(selectedProject.id, testId);
      await loadGeneratedTests(findingId);
    } catch (err) {
      setGeneratedTestsError(err instanceof Error ? err.message : "Failed to write and run generated test.");
    } finally {
      setGeneratedTestActionBusy(null);
    }
  }

  if (!selectedProject) {
    return (
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Findings</h1>
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
        <h1 className="text-lg font-semibold text-slate-900">Findings</h1>
        <div className="flex items-center gap-3">
          {running && <ActivityIndicator label="Scanning the repository for findings" />}
          <button
            onClick={handleRunAnalysis}
            disabled={running}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {running ? "Running…" : "Run Analysis"}
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <select
          aria-label="Filter by severity"
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1"
        >
          <option value="">All severities</option>
          {SEVERITY_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1"
        >
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {!loading && <span className="text-slate-500">{total} findings</span>}
      </div>

      {loading && <p className="mt-4 text-sm text-slate-500">Loading…</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {!loading && !error && !hasRun && (
        <p className="mt-4 text-sm text-slate-500">
          Analysis hasn't been run yet for this repository. Click "Run Analysis" above.
        </p>
      )}

      {!loading && !error && hasRun && findings.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">No findings match the current filters.</p>
      )}

      {!loading && !error && findings.length > 0 && (
        <ul className="mt-4 space-y-2">
          {findings.map((finding) => (
            <li key={finding.id} className="rounded border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium uppercase ${SEVERITY_STYLES[finding.severity]}`}
                >
                  {finding.severity}
                </span>
                <span className="text-xs text-slate-500">{finding.category}</span>
                <span className="font-mono text-xs text-slate-700">
                  {finding.file_path}
                  {finding.line_start ? `:${finding.line_start}` : ""}
                </span>
              </div>
              {finding.evidence && (
                <p className="mt-2 text-sm text-slate-800">{finding.evidence}</p>
              )}
              {finding.explanation && (
                <p className="mt-1 text-xs text-slate-500">{finding.explanation}</p>
              )}
              {finding.recommendation && (
                <p className="mt-1 text-xs text-slate-600">
                  <span className="font-medium">Recommendation: </span>
                  {finding.recommendation}
                </p>
              )}

              <button
                onClick={() => togglePreview(finding.id)}
                className="mt-2 text-xs font-medium text-slate-500 underline hover:text-slate-700"
              >
                {contextOpenFor === finding.id ? "Hide AI context preview" : "Preview AI context"}
              </button>

              {contextOpenFor === finding.id && (
                <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                  {contextLoading === finding.id && <p className="text-slate-500">Loading context preview…</p>}
                  {contextError && contextLoading !== finding.id && (
                    <p className="text-red-600">{contextError}</p>
                  )}
                  {contextBundles[finding.id] && contextLoading !== finding.id && (
                    <ContextPreview bundle={contextBundles[finding.id]} />
                  )}
                </div>
              )}

              <button
                onClick={() => toggleExplanation(finding.id)}
                className="mt-2 ml-3 text-xs font-medium text-slate-500 underline hover:text-slate-700"
              >
                {explainOpenFor === finding.id ? "Hide AI explanation" : "AI explanation"}
              </button>

              {explainOpenFor === finding.id && (
                <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                  {explainLoading === finding.id && <ActivityIndicator label="Asking the AI provider to explain this finding" />}
                  {explainError && explainLoading !== finding.id && (
                    <p className="text-red-600">{explainError}</p>
                  )}
                  {explainLoading !== finding.id && explanations[finding.id]?.explanation && (
                    <div>
                      <p className="whitespace-pre-wrap text-slate-800">{explanations[finding.id].explanation}</p>
                      {explanations[finding.id].provider && (
                        <p className="mt-1 text-slate-400">
                          via {explanations[finding.id].provider} / {explanations[finding.id].model}
                        </p>
                      )}
                    </div>
                  )}
                  {explainLoading !== finding.id && !explanations[finding.id]?.explanation && !explainError && (
                    <div>
                      <p className="text-slate-500">No AI explanation generated yet.</p>
                      <button
                        onClick={() => generateExplanation(finding.id)}
                        disabled={!hasEnabledProvider}
                        title={
                          hasEnabledProvider
                            ? undefined
                            : "No AI provider is configured and enabled. Configure one in AI Mode first."
                        }
                        className="mt-1 rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                      >
                        Generate explanation
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

              <button
                onClick={() => toggleRootCause(finding.id)}
                className="mt-2 ml-3 text-xs font-medium text-slate-500 underline hover:text-slate-700"
              >
                {rootCauseOpenFor === finding.id ? "Hide root-cause analysis" : "Root-cause analysis"}
              </button>

              {rootCauseOpenFor === finding.id && (
                <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                  {rootCauseLoading === finding.id && <ActivityIndicator label="Asking the AI provider for a root-cause analysis" />}
                  {rootCauseError && rootCauseLoading !== finding.id && (
                    <p className="text-red-600">{rootCauseError}</p>
                  )}
                  {rootCauseLoading !== finding.id && rootCauses[finding.id]?.analysis && (
                    <RootCauseView analysis={rootCauses[finding.id].analysis!} provider={rootCauses[finding.id].provider} model={rootCauses[finding.id].model} />
                  )}
                  {rootCauseLoading !== finding.id && !rootCauses[finding.id]?.analysis && !rootCauseError && (
                    <div>
                      <p className="text-slate-500">No AI root-cause analysis generated yet.</p>
                      <button
                        onClick={() => generateRootCause(finding.id)}
                        disabled={!hasEnabledProvider}
                        title={
                          hasEnabledProvider
                            ? undefined
                            : "No AI provider is configured and enabled. Configure one in AI Mode first."
                        }
                        className="mt-1 rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                      >
                        Generate root-cause analysis
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

              <button
                onClick={() => toggleFixPlan(finding.id)}
                className="mt-2 ml-3 text-xs font-medium text-slate-500 underline hover:text-slate-700"
              >
                {fixPlanOpenFor === finding.id ? "Hide fix plan" : "Fix plan"}
              </button>

              {fixPlanOpenFor === finding.id && (
                <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                  {fixPlanLoading === finding.id && <ActivityIndicator label="Asking the AI provider for a fix plan" />}
                  {fixPlanError && fixPlanLoading !== finding.id && (
                    <p className="text-red-600">{fixPlanError}</p>
                  )}
                  {fixPlanLoading !== finding.id && fixPlans[finding.id]?.plan && (
                    <FixPlanView plan={fixPlans[finding.id].plan!} provider={fixPlans[finding.id].provider} model={fixPlans[finding.id].model} />
                  )}
                  {fixPlanLoading !== finding.id && !fixPlans[finding.id]?.plan && !fixPlanError && (
                    <div>
                      <p className="text-slate-500">No AI fix plan generated yet.</p>
                      <button
                        onClick={() => generateFixPlan(finding.id)}
                        disabled={!hasEnabledProvider}
                        title={
                          hasEnabledProvider
                            ? undefined
                            : "No AI provider is configured and enabled. Configure one in AI Mode first."
                        }
                        className="mt-1 rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                      >
                        Generate fix plan
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

              <button
                onClick={() => togglePatches(finding.id)}
                className="mt-2 ml-3 text-xs font-medium text-slate-500 underline hover:text-slate-700"
              >
                {patchesOpenFor === finding.id ? "Hide patches" : "Patches"}
              </button>

              {patchesOpenFor === finding.id && (
                <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                  {patchesLoading === finding.id && <p className="text-slate-500">Loading…</p>}
                  {patchesError && patchesLoading !== finding.id && (
                    <p className="text-red-600">{patchesError}</p>
                  )}
                  {patchesLoading !== finding.id && (
                    <PatchesView
                      findingId={finding.id}
                      patchList={patches[finding.id] ?? []}
                      hasEnabledProvider={hasEnabledProvider}
                      busy={patchActionBusy}
                      onCreate={() => handleCreatePatch(finding.id)}
                      onApprove={(patchId) => handleApprovePatch(finding.id, patchId)}
                      onReject={(patchId) => handleRejectPatch(finding.id, patchId)}
                      onGenerate={(patchId) => handleGeneratePatch(finding.id, patchId)}
                      onApproveApply={(patchId) => handleApprovePatchApply(finding.id, patchId)}
                      onRejectApply={(patchId) => handleRejectPatchApply(finding.id, patchId)}
                      onApply={(patchId) => handleApplyPatch(finding.id, patchId)}
                      selfReviewOpenFor={selfReviewOpenFor}
                      selfReviews={selfReviews}
                      selfReviewLoading={selfReviewLoading}
                      selfReviewError={selfReviewError}
                      onToggleSelfReview={toggleSelfReview}
                      onGenerateSelfReview={generateSelfReview}
                    />
                  )}
                </div>
              )}

              <button
                onClick={() => toggleGeneratedTests(finding.id)}
                className="mt-2 ml-3 text-xs font-medium text-slate-500 underline hover:text-slate-700"
              >
                {generatedTestsOpenFor === finding.id ? "Hide generated tests" : "Generated tests"}
              </button>

              {generatedTestsOpenFor === finding.id && (
                <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                  {generatedTestsLoading === finding.id && <p className="text-slate-500">Loading…</p>}
                  {generatedTestsError && generatedTestsLoading !== finding.id && (
                    <p className="text-red-600">{generatedTestsError}</p>
                  )}
                  {generatedTestsLoading !== finding.id && (
                    <GeneratedTestsView
                      findingId={finding.id}
                      testList={generatedTests[finding.id] ?? []}
                      hasEnabledProvider={hasEnabledProvider}
                      busy={generatedTestActionBusy}
                      onCreate={() => handleCreateGeneratedTest(finding.id)}
                      onApprove={(testId) => handleApproveGeneratedTest(finding.id, testId)}
                      onReject={(testId) => handleRejectGeneratedTest(finding.id, testId)}
                      onGenerate={(testId) => handleGenerateTest(finding.id, testId)}
                      onApproveWrite={(testId) => handleApproveGeneratedTestWrite(finding.id, testId)}
                      onRejectWrite={(testId) => handleRejectGeneratedTestWrite(finding.id, testId)}
                      onWriteAndRun={(testId) => handleWriteAndRunGeneratedTest(finding.id, testId)}
                    />
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The patch lifecycle UI, matching `db/patchRepo.ts`'s full state machine:
 *   pending_approval -> approved -> proposed (has a diff)          [Phase 17]
 *   proposed -> approved_for_apply -> applied                      [Phase 18]
 *            \-> rejected                \-> failed (retry via Apply again)
 * This is the first AI-Mode surface with explicit "approve before this AI
 * action proceeds" steps in the UI itself, mirroring the two server-side
 * gates docs/AI_MODE.md §4 requires — approving here is a real API call
 * the server checks before /generate or /apply will do anything, not just
 * a UI-only confirmation. "Apply patch" is the only button anywhere in
 * this product that results in a real file on disk changing.
 */
function PatchesView({
  patchList,
  hasEnabledProvider,
  busy,
  onCreate,
  onApprove,
  onReject,
  onGenerate,
  onApproveApply,
  onRejectApply,
  onApply,
  selfReviewOpenFor,
  selfReviews,
  selfReviewLoading,
  selfReviewError,
  onToggleSelfReview,
  onGenerateSelfReview,
}: {
  findingId: string;
  patchList: PatchRecord[];
  hasEnabledProvider: boolean;
  busy: string | null;
  onCreate: () => void;
  onApprove: (patchId: string) => void;
  onReject: (patchId: string) => void;
  onGenerate: (patchId: string) => void;
  onApproveApply: (patchId: string) => void;
  onRejectApply: (patchId: string) => void;
  onApply: (patchId: string) => void;
  selfReviewOpenFor: string | null;
  selfReviews: Record<string, SelfReviewData>;
  selfReviewLoading: string | null;
  selfReviewError: string | null;
  onToggleSelfReview: (patchId: string) => void;
  onGenerateSelfReview: (patchId: string) => void;
}) {
  const disabledTitle = hasEnabledProvider
    ? undefined
    : "No AI provider is configured and enabled. Configure one in AI Mode first.";

  return (
    <div>
      <button
        onClick={onCreate}
        disabled={busy !== null}
        className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
      >
        Create patch (requires a fix plan)
      </button>

      {patchList.length === 0 && <p className="mt-2 text-slate-500">No patches created yet for this finding.</p>}

      {patchList.length > 0 && (
        <ul className="mt-2 space-y-2">
          {patchList.map((patch) => (
            <li key={patch.id} className="rounded border border-slate-200 bg-white p-2">
              <p className="font-medium text-slate-700">
                {patch.description ?? "(no description)"} — <span className="font-normal text-slate-500">{patch.status}</span>
              </p>

              {patch.status === "pending_approval" && (
                <div className="mt-1 flex gap-2">
                  <button
                    onClick={() => onApprove(patch.id)}
                    disabled={busy !== null}
                    className="rounded bg-emerald-700 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                  >
                    Approve for generation
                  </button>
                  <button
                    onClick={() => onReject(patch.id)}
                    disabled={busy !== null}
                    className="rounded bg-red-700 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                  >
                    Reject
                  </button>
                </div>
              )}

              {patch.status === "approved" && (
                <button
                  onClick={() => onGenerate(patch.id)}
                  disabled={busy !== null || !hasEnabledProvider}
                  title={disabledTitle}
                  className="mt-1 rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                >
                  Generate diff
                </button>
              )}
              {patch.status === "approved" && !hasEnabledProvider && (
                <p className="mt-1 text-slate-400">No AI provider is configured and enabled. Configure one in AI Mode first.</p>
              )}

              {patch.status === "rejected" && <p className="mt-1 text-slate-400">Rejected before generation.</p>}

              {/* Phase 18's second human-approval gate: review the diff itself before it can ever be applied. */}
              {patch.status === "proposed" && (
                <div className="mt-1 flex gap-2">
                  <button
                    onClick={() => onApproveApply(patch.id)}
                    disabled={busy !== null}
                    className="rounded bg-emerald-700 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                  >
                    Approve diff for apply
                  </button>
                  <button
                    onClick={() => onRejectApply(patch.id)}
                    disabled={busy !== null}
                    className="rounded bg-red-700 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                  >
                    Reject
                  </button>
                </div>
              )}

              {(patch.status === "approved_for_apply" || patch.status === "failed") && (
                <button
                  onClick={() => onApply(patch.id)}
                  disabled={busy !== null}
                  className="mt-1 rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                >
                  {patch.status === "failed" ? "Retry apply" : "Apply patch"}
                </button>
              )}

              {patch.status === "applied" && (
                <p className="mt-1 font-medium text-emerald-700">Applied to disk.</p>
              )}

              {patch.status === "failed" && patch.apply_error && (
                <p className="mt-1 text-red-600">Apply failed: {patch.apply_error}</p>
              )}

              {patch.diff_text && (
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-slate-900 p-2 font-mono text-[11px] text-slate-100">
                  {patch.diff_text}
                </pre>
              )}

              {patch.diff_text && (
                <div className="mt-2">
                  <button
                    onClick={() => onToggleSelfReview(patch.id)}
                    className="text-xs font-medium text-slate-500 underline hover:text-slate-700"
                  >
                    {selfReviewOpenFor === patch.id ? "Hide AI self-review" : "AI self-review"}
                  </button>

                  {selfReviewOpenFor === patch.id && (
                    <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2">
                      {selfReviewLoading === patch.id && <ActivityIndicator label="Asking the AI provider to self-review this diff" />}
                      {selfReviewError && selfReviewLoading !== patch.id && (
                        <p className="text-red-600">{selfReviewError}</p>
                      )}
                      {selfReviewLoading !== patch.id && selfReviews[patch.id] && (
                        <SelfReviewView review={selfReviews[patch.id]} />
                      )}
                      {selfReviewLoading !== patch.id && !selfReviews[patch.id] && !selfReviewError && (
                        <div>
                          <p className="text-slate-500">No AI self-review generated yet.</p>
                          <button
                            onClick={() => onGenerateSelfReview(patch.id)}
                            disabled={!hasEnabledProvider}
                            title={disabledTitle}
                            className="mt-1 rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                          >
                            Generate self-review
                          </button>
                          {!hasEnabledProvider && <p className="mt-1 text-slate-400">{disabledTitle}</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const SELF_REVIEW_STATUS_STYLES: Record<string, string> = {
  pass: "bg-emerald-100 text-emerald-800",
  concern: "bg-amber-100 text-amber-800",
  fail: "bg-red-100 text-red-800",
};

const SELF_REVIEW_CHECKS: { key: keyof Omit<SelfReviewData, "raw">; label: string }[] = [
  { key: "correctness", label: "Correctness" },
  { key: "scopeCreep", label: "Scope creep" },
  { key: "regressions", label: "Regressions" },
  { key: "security", label: "Security" },
  { key: "missingTests", label: "Missing tests" },
  { key: "unnecessaryComplexity", label: "Unnecessary complexity" },
  { key: "architectureConsistency", label: "Architecture consistency" },
];

/**
 * Renders a Phase 21 self-review, per docs/AI_MODE.md §6's seven-item
 * checklist. Advisory only, same visual register as `RootCauseView` and
 * the Tests page's `FailureDiagnosisView` — a colored status chip per
 * check plus its one-sentence note, "unknown" (not hidden or guessed)
 * for anything the model's response didn't clearly address.
 */
function SelfReviewView({ review }: { review: SelfReviewData }) {
  return (
    <div>
      <ul className="space-y-1">
        {SELF_REVIEW_CHECKS.map(({ key, label }) => {
          const check = review[key];
          return (
            <li key={key} className="flex items-start gap-2">
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                  check.status ? SELF_REVIEW_STATUS_STYLES[check.status] : "bg-slate-100 text-slate-500"
                }`}
              >
                {check.status ?? "unknown"}
              </span>
              <span className="text-slate-700">
                <span className="font-medium">{label}:</span> {check.note ?? "Not reported in the expected format."}
              </span>
            </li>
          );
        })}
      </ul>

      <details className="mt-2">
        <summary className="cursor-pointer text-slate-500">Raw response</summary>
        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-slate-600">{review.raw}</pre>
      </details>
    </div>
  );
}

/**
 * Phase 19's AI test generation UI, mirroring `PatchesView`'s two-gate
 * shape exactly, plus a final step patch generation doesn't have: writing
 * the file is inseparable here from actually running it — the whole
 * point of "write-and-run" is that nothing is trusted until the project's
 * real test command has actually executed it (docs/AI_MODE.md §1).
 */
function GeneratedTestsView({
  testList,
  hasEnabledProvider,
  busy,
  onCreate,
  onApprove,
  onReject,
  onGenerate,
  onApproveWrite,
  onRejectWrite,
  onWriteAndRun,
}: {
  findingId: string;
  testList: GeneratedTestRecord[];
  hasEnabledProvider: boolean;
  busy: string | null;
  onCreate: () => void;
  onApprove: (testId: string) => void;
  onReject: (testId: string) => void;
  onGenerate: (testId: string) => void;
  onApproveWrite: (testId: string) => void;
  onRejectWrite: (testId: string) => void;
  onWriteAndRun: (testId: string) => void;
}) {
  const disabledTitle = hasEnabledProvider
    ? undefined
    : "No AI provider is configured and enabled. Configure one in AI Mode first.";

  return (
    <div>
      <button
        onClick={onCreate}
        disabled={busy !== null}
        className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
      >
        Create generated test
      </button>

      {testList.length === 0 && <p className="mt-2 text-slate-500">No tests generated yet for this finding.</p>}

      {testList.length > 0 && (
        <ul className="mt-2 space-y-2">
          {testList.map((t) => (
            <li key={t.id} className="rounded border border-slate-200 bg-white p-2">
              <p className="font-medium text-slate-700">
                {t.description ?? "(no description)"} — <span className="font-normal text-slate-500">{t.status}</span>
              </p>

              {t.status === "pending_approval" && (
                <div className="mt-1 flex gap-2">
                  <button
                    onClick={() => onApprove(t.id)}
                    disabled={busy !== null}
                    className="rounded bg-emerald-700 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                  >
                    Approve for generation
                  </button>
                  <button
                    onClick={() => onReject(t.id)}
                    disabled={busy !== null}
                    className="rounded bg-red-700 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                  >
                    Reject
                  </button>
                </div>
              )}

              {t.status === "approved" && (
                <button
                  onClick={() => onGenerate(t.id)}
                  disabled={busy !== null || !hasEnabledProvider}
                  title={disabledTitle}
                  className="mt-1 rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                >
                  Generate test
                </button>
              )}
              {t.status === "approved" && !hasEnabledProvider && (
                <p className="mt-1 text-slate-400">No AI provider is configured and enabled. Configure one in AI Mode first.</p>
              )}

              {t.status === "rejected" && <p className="mt-1 text-slate-400">Rejected.</p>}

              {/* Second gate: review the generated code itself before it's ever written to disk. */}
              {t.status === "proposed" && (
                <div className="mt-1 flex gap-2">
                  <button
                    onClick={() => onApproveWrite(t.id)}
                    disabled={busy !== null}
                    className="rounded bg-emerald-700 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                  >
                    Approve test for write
                  </button>
                  <button
                    onClick={() => onRejectWrite(t.id)}
                    disabled={busy !== null}
                    className="rounded bg-red-700 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                  >
                    Reject
                  </button>
                </div>
              )}

              {(t.status === "approved_for_write" || t.status === "written" || t.status === "failed_tests" || t.status === "passed") && (
                <button
                  onClick={() => onWriteAndRun(t.id)}
                  disabled={busy !== null}
                  className="mt-1 rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                >
                  {t.status === "approved_for_write" ? "Write and run" : "Re-run tests"}
                </button>
              )}

              {t.status === "written" && (
                <p className="mt-1 text-amber-700">
                  Written to disk, but no supported test command was found to actually run it.
                </p>
              )}
              {t.status === "passed" && (
                <p className="mt-1 font-medium text-emerald-700">Written and the project's real test suite passed.</p>
              )}
              {t.status === "failed_tests" && (
                <p className="mt-1 font-medium text-red-600">Written, but the project's real test suite failed.</p>
              )}

              {t.target_path && <p className="mt-1 text-slate-500">Target: {t.target_path}</p>}

              {t.test_code && (
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-slate-900 p-2 font-mono text-[11px] text-slate-100">
                  {t.test_code}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Renders a Phase 16 fix plan's seven sections (docs/AI_MODE.md §5). This
 * is advisory only — nothing here is a diff, and nothing on this page can
 * apply it; patch generation (Phase 17) is a separate, later, human-
 * approval-gated workflow. Any section the model's response didn't
 * clearly contain is shown as "Not reported" rather than hidden or
 * guessed, with a raw-response fallback for anything not fully parsed.
 */
function FixPlanView({
  plan,
  provider,
  model,
}: {
  plan: {
    problem: string | null;
    rootCause: string | null;
    filesAffected: string[] | null;
    proposedChanges: string | null;
    risks: string | null;
    requiredTests: string | null;
    validationStrategy: string | null;
    raw: string;
  };
  provider?: string;
  model?: string;
}) {
  const sections: { label: string; value: string | null }[] = [
    { label: "Problem", value: plan.problem },
    { label: "Root cause", value: plan.rootCause },
    { label: "Proposed changes", value: plan.proposedChanges },
    { label: "Risks", value: plan.risks },
    { label: "Required tests", value: plan.requiredTests },
    { label: "Validation strategy", value: plan.validationStrategy },
  ];
  const anyMissing = !plan.problem || !plan.rootCause || !plan.filesAffected || !plan.proposedChanges || !plan.risks || !plan.requiredTests || !plan.validationStrategy;

  return (
    <div>
      <p className="font-medium text-slate-700">Files affected</p>
      {plan.filesAffected ? (
        <ul className="mt-1 list-disc pl-4 font-mono text-slate-800">
          {plan.filesAffected.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-400">Not reported in the expected format.</p>
      )}

      {sections.map((s) => (
        <div key={s.label}>
          <p className="mt-2 font-medium text-slate-700">{s.label}</p>
          <p className="text-slate-800">{s.value ?? "Not reported in the expected format."}</p>
        </div>
      ))}

      {anyMissing && (
        <details className="mt-2">
          <summary className="cursor-pointer text-slate-500">Raw response</summary>
          <p className="mt-1 whitespace-pre-wrap text-slate-600">{plan.raw}</p>
        </details>
      )}

      {provider && (
        <p className="mt-2 text-slate-400">
          via {provider} / {model}
        </p>
      )}
    </div>
  );
}

/**
 * Renders a Phase 15 root-cause analysis, keeping evidence and inference
 * visually distinct per docs/AI_MODE.md §4 — evidence as a bulleted list
 * (what the code directly shows), inference as prose (the AI's
 * hypothesis beyond that). Any field the model's response didn't clearly
 * contain is shown as "Not reported" rather than hidden or guessed, and
 * the full raw response is always available so nothing is lost to a
 * parsing miss.
 */
function RootCauseView({
  analysis,
  provider,
  model,
}: {
  analysis: { evidence: string[] | null; inference: string | null; confidence: string | null; raw: string };
  provider?: string;
  model?: string;
}) {
  return (
    <div>
      <p className="font-medium text-slate-700">Evidence</p>
      {analysis.evidence ? (
        <ul className="mt-1 list-disc pl-4 text-slate-800">
          {analysis.evidence.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-400">Not reported in the expected format — see raw response below.</p>
      )}

      <p className="mt-2 font-medium text-slate-700">Inference</p>
      <p className="text-slate-800">{analysis.inference ?? "Not reported in the expected format."}</p>

      <p className="mt-2 font-medium text-slate-700">
        Confidence: <span className="font-normal text-slate-600">{analysis.confidence ?? "unknown"}</span>
      </p>

      {(!analysis.evidence || !analysis.inference || !analysis.confidence) && (
        <details className="mt-2">
          <summary className="cursor-pointer text-slate-500">Raw response</summary>
          <p className="mt-1 whitespace-pre-wrap text-slate-600">{analysis.raw}</p>
        </details>
      )}

      {provider && (
        <p className="mt-2 text-slate-400">
          via {provider} / {model}
        </p>
      )}
    </div>
  );
}

/**
 * Shows exactly what `selectContextForFinding()` (Phase 13) chose to send
 * for this finding, and what it left out and why. Phase 14's "AI
 * explanation" affordance below is the first real consumer of a bundle
 * like this one — this preview panel itself still triggers no AI call.
 */
function ContextPreview({ bundle }: { bundle: ContextBundle }) {
  return (
    <div>
      <p className="text-slate-600">
        {bundle.totalTokens} / {bundle.budgetTokens} tokens used
      </p>
      {bundle.selected.length > 0 && (
        <div className="mt-1">
          <p className="font-medium text-slate-700">Included</p>
          <ul className="mt-1 space-y-1">
            {bundle.selected.map((item) => (
              <li key={item.path} className="font-mono text-slate-700">
                {item.path} <span className="text-slate-400">({item.tokens} tok)</span>
                <div className="font-sans text-slate-500">{item.reason}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {bundle.excluded.length > 0 && (
        <div className="mt-2">
          <p className="font-medium text-slate-700">Excluded</p>
          <ul className="mt-1 space-y-1">
            {bundle.excluded.map((item) => (
              <li key={item.path} className="font-mono text-slate-700">
                {item.path}
                <div className="font-sans text-slate-500">{item.reason}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
