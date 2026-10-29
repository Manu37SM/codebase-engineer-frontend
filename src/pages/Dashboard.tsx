import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useProjects } from "../context/ProjectContext";
import {
  ApiError,
  deleteProject,
  discoverProject,
  getAnalysisHistory,
  getDependencies,
  getGitAnalysis,
  getProject,
  indexProject,
  listChanges,
  listFiles,
  listFindings,
  runProjectAnalysis,
} from "../lib/api";
import {
  parseSnapshot,
  type AnalysisRun,
  type DependencyAnalysisResult,
  type FindingRecord,
  type GitAnalysisResult,
  type RepositorySnapshot,
} from "../lib/types";
import { ChurnHotspotsChart, FindingsTrendChart, SeverityBreakdownChart } from "../components/Charts";
import ActivityIndicator from "../components/ActivityIndicator";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  Card,
  CopyButton,
  HealthRing,
  Icon,
  MeterBar,
  PageHeader,
  PageSkeleton,
  Skeleton,
  StatCard,
} from "../components/ui";
import {
  SEVERITY_ORDER,
  SEVERITY_WEIGHTS,
  computeHealth,
  timeAgo,
  topFindingFiles,
} from "../lib/health";
import RegisterProjectForm from "../components/RegisterProjectForm";
import AiProviderReminder from "../components/AiProviderReminder";
import { getAutoScanOnRegister } from "../lib/settings";

export default function DashboardPage() {
  const {
    projects,
    loading: projectsLoading,
    selectedProject,
    selectProject,
    refresh: refreshProjects,
  } = useProjects();
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanVersion, setScanVersion] = useState(0);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [checkingRemoveId, setCheckingRemoveId] = useState<string | null>(null);

  const [removeWarning, setRemoveWarning] = useState<{ projectId: string; projectName: string; patchCount: number } | null>(
    null
  );
  const [pickerActionMessage, setPickerActionMessage] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<RepositorySnapshot | null>(null);
  const [fileTotals, setFileTotals] = useState<{ total: number; test: number } | null>(null);
  const [gitAnalysis, setGitAnalysis] = useState<GitAnalysisResult | null>(null);
  const [gitError, setGitError] = useState<string | null>(null);
  const [dependencies, setDependencies] = useState<DependencyAnalysisResult | null>(null);
  const [dependenciesError, setDependenciesError] = useState<string | null>(null);
  const [findings, setFindings] = useState<FindingRecord[] | null>(null);
  const [findingsError, setFindingsError] = useState<string | null>(null);
  const [analysisRuns, setAnalysisRuns] = useState<AnalysisRun[] | null>(null);
  const [analysisRunsError, setAnalysisRunsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showAiReminder, setShowAiReminder] = useState(false);

  useEffect(() => {
    if (!selectedProject) {
      setSnapshot(null);
      setFileTotals(null);
      setGitAnalysis(null);
      setGitError(null);
      setDependencies(null);
      setDependenciesError(null);
      setFindings(null);
      setFindingsError(null);
      setAnalysisRuns(null);
      setAnalysisRunsError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getProject(selectedProject.id),
      listFiles(selectedProject.id, { limit: 1 }),
      listFiles(selectedProject.id, { limit: 1, isTest: true }),
    ])
      .then(([projectRes, allFiles, testFiles]) => {
        if (cancelled) return;
        setSnapshot(projectRes.latestSnapshot);
        setFileTotals({ total: allFiles.total, test: testFiles.total });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load dashboard");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    setGitAnalysis(null);
    setGitError(null);
    getGitAnalysis(selectedProject.id)
      .then((result) => {
        if (!cancelled) setGitAnalysis(result);
      })
      .catch((err) => {
        if (!cancelled) setGitError(err instanceof Error ? err.message : "Failed to load Git activity");
      });

    setDependencies(null);
    setDependenciesError(null);
    getDependencies(selectedProject.id)
      .then((result) => {
        if (!cancelled) setDependencies(result);
      })
      .catch((err) => {
        if (!cancelled)
          setDependenciesError(err instanceof Error ? err.message : "Failed to load dependencies");
      });

    setFindings(null);
    setFindingsError(null);
    listFindings(selectedProject.id)
      .then((result) => {
        if (!cancelled) setFindings(result.findings);
      })
      .catch((err) => {
        if (!cancelled) setFindingsError(err instanceof Error ? err.message : "Failed to load findings");
      });

    setAnalysisRuns(null);
    setAnalysisRunsError(null);
    getAnalysisHistory(selectedProject.id)
      .then((result) => {
        if (!cancelled) setAnalysisRuns(result.runs);
      })
      .catch((err) => {
        if (!cancelled)
          setAnalysisRunsError(err instanceof Error ? err.message : "Failed to load analysis history");
      });

    return () => {
      cancelled = true;
    };

  }, [selectedProject, scanVersion]);

  async function scanProject(projectId: string) {
    setScanning(true);
    setScanError(null);
    try {
      await discoverProject(projectId);
      await indexProject(projectId);
      await runProjectAnalysis(projectId);
      await refreshProjects();
      setScanVersion((v) => v + 1);
    } catch (err) {
      setScanError(err instanceof ApiError ? err.message : "Scan failed.");
    } finally {
      setScanning(false);
    }
  }

  async function handleRegistered(projectId: string) {
    await refreshProjects();
    selectProject(projectId);
    setShowAiReminder(true);
    if (getAutoScanOnRegister()) {
      await scanProject(projectId);
    }
  }

  async function handleScanNow() {
    if (!selectedProject) return;
    await scanProject(selectedProject.id);
  }

  async function handleRemoveProject(projectId: string) {
    setRemovingId(projectId);
    setPickerActionMessage(null);
    try {
      await deleteProject(projectId);
      await refreshProjects();
      setPickerActionMessage("Repository removed from the workspace. Its actual files were not touched.");
    } catch (err) {
      setPickerActionMessage(err instanceof ApiError ? err.message : "Failed to remove repository.");
    } finally {
      setRemovingId(null);
      setConfirmRemoveId(null);
      setRemoveWarning(null);
    }
  }

  async function handleRemoveClick(projectId: string, projectName: string) {
    setCheckingRemoveId(projectId);
    try {
      const { patches } = await listChanges(projectId);
      if (patches.length > 0) {
        setRemoveWarning({ projectId, projectName, patchCount: patches.length });
      } else {
        setConfirmRemoveId(projectId);
      }
    } catch {
      setConfirmRemoveId(projectId);
    } finally {
      setCheckingRemoveId(null);
    }
  }

  if (!selectedProject) {
    if (projectsLoading) {
      return (
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        </div>
      );
    }

    if (projects.length === 0) {
      return (
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Welcome to Codebase Engineer</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Register a local repository to get started — nothing is uploaded, everything runs
            against the path on this machine. Once it's registered, scan it from here to see
            findings, dependencies, and Git activity.
          </p>
          <div className="mt-4 max-w-3xl">
            <RegisterProjectForm
              onRegistered={handleRegistered}
              className="flex flex-wrap items-end gap-3 rounded border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
            Prefer to manage repositories in a dedicated list?{" "}
            <Link to="/repositories" className="underline">
              Open Repositories
            </Link>
            .
          </p>
        </div>
      );
    }

    return (
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Choose a repository</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Select a repository to open its workspace, or{" "}
          <Link to="/repositories" className="underline">
            register a new one
          </Link>
          .
        </p>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {projects.map((project) => (
            <li key={project.id} className="rounded border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <button
                onClick={() => selectProject(project.id)}
                className="w-full text-left"
              >
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{project.name}</div>
                <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{project.root_path}</div>
              </button>
              <div className="mt-3">
                {confirmRemoveId === project.id ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Remove from workspace?</span>
                    <button
                      className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                      disabled={removingId === project.id}
                      onClick={() => handleRemoveProject(project.id)}
                    >
                      {removingId === project.id ? "Removing…" : "Confirm"}
                    </button>
                    <button
                      className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                      disabled={removingId === project.id}
                      onClick={() => setConfirmRemoveId(null)}
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-red-950"
                    disabled={checkingRemoveId === project.id}
                    onClick={() => handleRemoveClick(project.id, project.name)}
                  >
                    {checkingRemoveId === project.id ? "Checking…" : "Remove"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {pickerActionMessage && <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{pickerActionMessage}</p>}

        {removeWarning && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-remove-warning-heading"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          >
            <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <h2 id="dashboard-remove-warning-heading" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Remove "{removeWarning.projectName}"?
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                This project has {removeWarning.patchCount} AI-generated patch{removeWarning.patchCount === 1 ? "" : "es"}.
                Removing it deletes Codebase Engineer's record of {removeWarning.patchCount === 1 ? "it" : "them"} too —
                your actual files on disk are never touched.
              </p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                If you're on the free tier, any AI usage already spent generating{" "}
                {removeWarning.patchCount === 1 ? "it" : "them"} won't be refunded to your monthly limit.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRemoveWarning(null)}
                  className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={removingId === removeWarning.projectId}
                  onClick={() => handleRemoveProject(removeWarning.projectId)}
                  className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {removingId === removeWarning.projectId ? "Removing…" : "Remove anyway"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <PageHeader title={selectedProject.name} subtitle={selectedProject.root_path} />
        <PageSkeleton label="Loading dashboard" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title={selectedProject.name} subtitle={selectedProject.root_path} />
        <div
          role="alert"
          className="mt-4 flex max-w-2xl items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          <span>{error}</span>
          <button type="button" onClick={() => setScanVersion((v) => v + 1)} className={BTN_SECONDARY}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div>
        <PageHeader title={selectedProject.name} subtitle={selectedProject.root_path} />
        {showAiReminder && <AiProviderReminder onDismiss={() => setShowAiReminder(false)} />}
        <div className="mt-6 flex max-w-xl flex-col items-start gap-3 rounded-lg border border-dashed border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            This repository hasn't been scanned yet. A scan indexes the files, runs the static analysis rules and
            builds the dashboard — it works fully offline.
          </p>
          <button onClick={handleScanNow} disabled={scanning} className={BTN_PRIMARY}>
            {scanning ? "Scanning…" : "Scan now"}
          </button>
          {scanning && <ActivityIndicator label="Discovering & indexing files" />}
          {scanError && <p className="text-sm text-red-600 dark:text-red-400">{scanError}</p>}
        </div>
      </div>
    );
  }

  const parsed = parseSnapshot(snapshot);
  const health = findings ? computeHealth(findings) : null;
  const hasCompletedRun = analysisRuns?.some((r) => r.status === "completed") ?? false;
  const hotspots = findings ? topFindingFiles(findings, 5) : [];
  const maxHotspot = hotspots[0]?.total ?? 0;
  const testRatio =
    fileTotals && fileTotals.total > 0 ? `${Math.round((fileTotals.test / fileTotals.total) * 100)}%` : "—";
  const totalLoc = parsed.languages.reduce((sum, l) => sum + l.approxLoc, 0);
  const maxLangFiles = Math.max(0, ...parsed.languages.map((l) => l.fileCount));
  const wt = parsed.workingTreeStatus;

  return (
    <div>
      <PageHeader
        title={
          projects.length > 1 ? (
            <div className="relative inline-block max-w-full">
              <select
                aria-label="Switch repository"
                value={selectedProject.id}
                onChange={(e) => selectProject(e.target.value)}
                className="w-full max-w-full cursor-pointer appearance-none truncate rounded bg-transparent py-0.5 pl-0 pr-6 text-xl font-semibold text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="pointer-events-none absolute right-1 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          ) : (
            selectedProject.name
          )
        }
        subtitle={
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-mono text-xs" title={selectedProject.root_path}>
              {selectedProject.root_path}
            </span>
            <CopyButton
              text={selectedProject.root_path}
              label="Copy"
              ariaLabel="Copy repository path"
              className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            />
          </span>
        }
        actions={
          <>
            <button onClick={handleScanNow} disabled={scanning} className={BTN_SECONDARY}>
              <Icon name="refresh" className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} />
              {scanning ? "Rescanning…" : "Rescan"}
            </button>
            <Link to="/audit" className={BTN_SECONDARY}>
              <Icon name="audit" className="h-3.5 w-3.5" />
              Audit report
            </Link>
            <Link to="/findings" className={BTN_PRIMARY}>
              View findings
              <Icon name="arrowRight" className="h-3.5 w-3.5" />
            </Link>
          </>
        }
      />
      {showAiReminder && <AiProviderReminder onDismiss={() => setShowAiReminder(false)} />}
      {scanning && (
        <div className="mt-2">
          <ActivityIndicator label="Discovering & indexing files" />
        </div>
      )}
      {scanError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{scanError}</p>}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Repository health">
          {health === null ? (
            <div className="flex items-center gap-4">
              <Skeleton className="h-[88px] w-[88px] rounded-full" />
              <Skeleton className="h-16 flex-1" />
            </div>
          ) : !hasCompletedRun && health.total === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No analysis has run yet. Rescan to compute a health score.
            </p>
          ) : (
            <div className="flex items-center gap-4">
              <HealthRing score={health.score} grade={health.grade} />
              <div className="min-w-0 text-sm">
                <p className="text-slate-700 dark:text-slate-200">
                  {health.total === 0
                    ? "No findings in the latest run."
                    : `${health.total} open finding${health.total === 1 ? "" : "s"}`}
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  {SEVERITY_ORDER.filter((sev) => health.counts[sev] > 0).map((sev) => (
                    <li key={sev} className="tabular-nums">
                      {`${health.counts[sev]} ${sev}`}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <p
            className="mt-3 text-[11px] leading-snug text-slate-400 dark:text-slate-500"
            title="Each finding subtracts points from 100, floored at 0."
          >
            Starts at 100; −{SEVERITY_WEIGHTS.critical} per critical, −{SEVERITY_WEIGHTS.high} high, −
            {SEVERITY_WEIGHTS.medium} medium, −{SEVERITY_WEIGHTS.low} low.
          </p>
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-2">
          <StatCard label="Total files" value={fileTotals?.total ?? "—"} />
          <StatCard label="Test files" value={fileTotals?.test ?? "—"} />
          <StatCard label="Test file ratio" value={testRatio} hint="of all indexed files" />
          <StatCard label="Git branch" value={parsed.gitBranch ?? "—"} />
          <StatCard
            label="Working tree"
            value={wt === null ? "n/a" : wt.clean ? "clean" : "dirty"}
            tone={wt === null ? "default" : wt.clean ? "good" : "warn"}
            hint={
              wt && !wt.clean
                ? `${wt.modified} modified · ${wt.staged} staged · ${wt.untracked} untracked`
                : undefined
            }
          />
          <StatCard
            label="Open findings"
            value={findings?.length ?? "—"}
            to="/findings"
            tone={health && (health.counts.critical > 0 || health.counts.high > 0) ? "bad" : "default"}
            hint={totalLoc > 0 ? `~${totalLoc.toLocaleString()} LOC indexed` : undefined}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Findings by severity">
          {findingsError && <p className="text-sm text-red-600 dark:text-red-400">{findingsError}</p>}
          {!findingsError && findings === null && <Skeleton className="h-40" />}
          {!findingsError && findings !== null && <SeverityBreakdownChart findings={findings} />}
        </Card>

        <Card title="Findings trend">
          {analysisRunsError && <p className="text-sm text-red-600 dark:text-red-400">{analysisRunsError}</p>}
          {!analysisRunsError && analysisRuns === null && <Skeleton className="h-40" />}
          {!analysisRunsError && analysisRuns !== null && <FindingsTrendChart runs={analysisRuns} />}
        </Card>

        <Card
          title="Files to look at first"
          action={
            hotspots.length > 0 ? (
              <Link to="/findings" className="text-xs text-slate-500 underline-offset-2 hover:underline dark:text-slate-400">
                All findings
              </Link>
            ) : undefined
          }
        >
          {findings === null ? (
            <Skeleton className="h-32" />
          ) : hotspots.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No file-level findings — nothing to triage.</p>
          ) : (
            <ul className="space-y-3">
              {hotspots.map((h) => (
                <li key={h.path}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-mono text-xs text-slate-700 dark:text-slate-200" title={h.path}>
                      {h.path}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      {h.total} finding{h.total === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-1">
                    <MeterBar
                      value={h.total}
                      max={maxHotspot}
                      className={
                        h.worst === "critical"
                          ? "bg-red-500"
                          : h.worst === "high"
                            ? "bg-orange-500"
                            : h.worst === "medium"
                              ? "bg-amber-500"
                              : "bg-slate-400"
                      }
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title={`Churn hotspots${gitAnalysis?.isGitRepository ? ` (last ${gitAnalysis.churnWindowDays} days)` : ""}`}
        >
          {gitError && (
            <p className="text-sm text-slate-500 dark:text-slate-400">Unavailable — see Git activity below.</p>
          )}
          {!gitError && !gitAnalysis && <Skeleton className="h-32" />}
          {!gitError && gitAnalysis && !gitAnalysis.isGitRepository && (
            <p className="text-sm text-slate-500 dark:text-slate-400">Not applicable — not a Git repository.</p>
          )}
          {!gitError && gitAnalysis?.isGitRepository && <ChurnHotspotsChart churn={gitAnalysis.fileChurn} />}
        </Card>

        <Card title="Languages">
          {parsed.languages.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">None detected.</p>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {parsed.languages.map((l) => (
                <li key={l.language}>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-800 dark:text-slate-100">{l.language}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {l.fileCount} files · ~{l.approxLoc} LOC
                    </span>
                  </div>
                  <div className="mt-1">
                    <MeterBar value={l.fileCount} max={maxLangFiles} className="bg-sky-500" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Build & dependencies">
          <dl className="space-y-2 text-sm">
            {[
              ["Build system", parsed.buildSystems],
              ["Package manager", parsed.packageManagers],
              ["Frameworks", parsed.frameworks],
            ].map(([label, values]) => (
              <div key={label as string} className="flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">{label as string}</dt>
                <dd className="text-right text-slate-800 dark:text-slate-100">
                  {(values as string[]).join(", ") || "—"}
                </dd>
              </div>
            ))}
          </dl>
          <DependenciesSection dependencies={dependencies} dependenciesError={dependenciesError} />
        </Card>
      </div>

      <Card title="Git activity" className="mt-4">
        <GitActivitySection gitAnalysis={gitAnalysis} gitError={gitError} />
      </Card>

      <p className="mt-6 text-xs text-slate-400 dark:text-slate-500">
        Last scanned{" "}
        <time dateTime={parsed.indexedAt} title={new Date(parsed.indexedAt).toLocaleString()}>
          {new Date(parsed.indexedAt).toLocaleString()}
        </time>{" "}
        ({timeAgo(parsed.indexedAt)})
      </p>
    </div>
  );
}

function DependenciesSection({
  dependencies,
  dependenciesError,
}: {
  dependencies: DependencyAnalysisResult | null;
  dependenciesError: string | null;
}) {
  return (
    <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Dependencies</h3>

      {dependenciesError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{dependenciesError}</p>}

      {!dependenciesError && !dependencies && <Skeleton className="mt-2 h-10" />}

      {!dependenciesError && dependencies && dependencies.ecosystem === null && (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{dependencies.duplicatesNote}</p>
      )}

      {!dependenciesError && dependencies && dependencies.ecosystem !== null && (
        <div className="mt-2">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            {dependencies.totalDirect} direct {dependencies.ecosystem} dependenc
            {dependencies.totalDirect === 1 ? "y" : "ies"}
          </p>

          {dependencies.duplicates.length > 0 ? (
            <div className="mt-3">
              <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Duplicate versions ({dependencies.duplicates.length})
              </h4>
              <ul className="mt-1 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                {dependencies.duplicates.slice(0, 10).map((dup) => (
                  <li key={dup.name} className="flex justify-between gap-2">
                    <span className="truncate font-mono text-xs">{dup.name}</span>
                    <span className="text-slate-500 dark:text-slate-400">{dup.versions.join(", ")}</span>
                  </li>
                ))}
              </ul>
              {dependencies.duplicates.length > 10 && (
                <p className="mt-1 text-xs text-slate-400">+{dependencies.duplicates.length - 10} more</p>
              )}
            </div>
          ) : (
            dependencies.duplicatesNote && (
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">{dependencies.duplicatesNote}</p>
            )
          )}
        </div>
      )}
    </div>
  );
}

function GitActivitySection({
  gitAnalysis,
  gitError,
}: {
  gitAnalysis: GitAnalysisResult | null;
  gitError: string | null;
}) {
  if (gitError) return <p className="text-sm text-red-600 dark:text-red-400">{gitError}</p>;

  if (!gitAnalysis) return <Skeleton className="h-24" />;

  if (!gitAnalysis.isGitRepository) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Not a Git repository.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <div>
        <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400">Recent commits</h3>
        {gitAnalysis.recentCommits.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">No commits yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            {gitAnalysis.recentCommits.map((commit) => (
              <li key={commit.hash} className="flex items-baseline justify-between gap-2">
                <span className="truncate">{commit.message}</span>
                <span className="shrink-0 font-mono text-xs text-slate-400 dark:text-slate-500">
                  {commit.shortHash}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Most-churned files (last {gitAnalysis.churnWindowDays} days)
        </h3>
        {gitAnalysis.fileChurn.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">No churn in this window.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
            {gitAnalysis.fileChurn.map((entry) => (
              <li key={entry.path} className="flex justify-between gap-2">
                <span className="truncate font-mono text-xs">{entry.path}</span>
                <span className="shrink-0 text-slate-500 dark:text-slate-400">{entry.commitCount} commits</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {gitAnalysis.uncommittedChanges && (
        <div className="sm:col-span-2">
          <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400">Uncommitted changes</h3>
          {gitAnalysis.uncommittedChanges.filesChanged === 0 ? (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Working tree matches HEAD.</p>
          ) : (
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
              {gitAnalysis.uncommittedChanges.filesChanged} file
              {gitAnalysis.uncommittedChanges.filesChanged === 1 ? "" : "s"} changed, +
              {gitAnalysis.uncommittedChanges.insertions} / -{gitAnalysis.uncommittedChanges.deletions}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
