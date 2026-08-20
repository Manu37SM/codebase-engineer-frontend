import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useProjects } from "../context/ProjectContext";
import {
  ApiError,
  discoverProject,
  getAnalysisHistory,
  getDependencies,
  getGitAnalysis,
  getProject,
  indexProject,
  listFiles,
  listFindings,
} from "../lib/api";
import {
  parseSnapshot,
  type AnalysisRun,
  type DependencyAnalysisResult,
  type FindingRecord,
  type GitAnalysisResult,
  type RepositorySnapshot,
} from "../lib/types";
import {
  ChurnHotspotsChart,
  FindingsTrendChart,
  LanguageBreakdownChart,
  SeverityBreakdownChart,
} from "../components/Charts";
import ActivityIndicator from "../components/ActivityIndicator";
import RegisterProjectForm from "../components/RegisterProjectForm";

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

    // Fetched independently — a Git failure (e.g. `git` not installed)
    // shouldn't block the rest of the dashboard from rendering.
    setGitAnalysis(null);
    setGitError(null);
    getGitAnalysis(selectedProject.id)
      .then((result) => {
        if (!cancelled) setGitAnalysis(result);
      })
      .catch((err) => {
        if (!cancelled) setGitError(err instanceof Error ? err.message : "Failed to load Git activity");
      });

    // Also fetched independently, same reasoning as Git activity above.
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

    // Also fetched independently — charts should degrade individually,
    // not take down the whole dashboard if one call fails.
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
    // `scanVersion` is a deliberate extra dependency, not read inside the
    // effect — it's bumped by handleScanNow() below purely to force this
    // whole fetch to re-run after an inline scan completes, without
    // needing `selectedProject` itself to change identity.
  }, [selectedProject, scanVersion]);

  async function handleScanNow() {
    if (!selectedProject) return;
    setScanning(true);
    setScanError(null);
    try {
      await discoverProject(selectedProject.id);
      await indexProject(selectedProject.id);
      await refreshProjects();
      setScanVersion((v) => v + 1);
    } catch (err) {
      setScanError(err instanceof ApiError ? err.message : "Scan failed.");
    } finally {
      setScanning(false);
    }
  }

  // No project selected yet — the app's very first screen for a new
  // install. Task #93: this used to be a single sentence pointing at the
  // Repositories page in the sidebar; now the same actions happen right
  // here, so a first-time user never has to go hunting in the nav to get
  // started.
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
              onRegistered={(id) => selectProject(id)}
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

    // Repositories already exist — offer a one-click picker instead of a
    // plain link, so returning to a multi-project setup doesn't require a
    // detour through the sidebar either.
    return (
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Choose a repository</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Select a repository to see its dashboard, or{" "}
          <Link to="/repositories" className="underline">
            register a new one
          </Link>
          .
        </p>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {projects.map((project) => (
            <li key={project.id}>
              <button
                onClick={() => selectProject(project.id)}
                className="w-full rounded border border-slate-200 bg-white p-4 text-left hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-500"
              >
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{project.name}</div>
                <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{project.root_path}</div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{selectedProject.name}</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{selectedProject.name}</h1>
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{selectedProject.name}</h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{selectedProject.root_path}</p>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          This repository hasn't been scanned yet.
        </p>
        <button
          onClick={handleScanNow}
          disabled={scanning}
          className="mt-3 rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          {scanning ? "Scanning…" : "Scan now"}
        </button>
        {scanning && (
          <div className="mt-2">
            <ActivityIndicator label="Discovering & indexing files" />
          </div>
        )}
        {scanError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{scanError}</p>}
      </div>
    );
  }

  const parsed = parseSnapshot(snapshot);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{selectedProject.name}</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{selectedProject.root_path}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleScanNow}
            disabled={scanning}
            className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {scanning ? "Rescanning…" : "Rescan"}
          </button>
          <Link
            to="/findings"
            className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            View findings
          </Link>
        </div>
      </div>
      {scanning && (
        <div className="mt-2">
          <ActivityIndicator label="Discovering & indexing files" />
        </div>
      )}
      {scanError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{scanError}</p>}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total files" value={fileTotals?.total ?? "—"} />
        <StatTile label="Test files" value={fileTotals?.test ?? "—"} />
        <StatTile
          label="Git branch"
          value={parsed.gitBranch ?? "—"}
        />
        <StatTile
          label="Working tree"
          value={
            parsed.workingTreeStatus === null
              ? "n/a"
              : parsed.workingTreeStatus.clean
                ? "clean"
                : "dirty"
          }
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <section>
          <h2 className="text-sm font-semibold text-slate-900">Languages</h2>
          {parsed.languages.length === 0 ? (
            <p className="mt-1 text-sm text-slate-500">None detected.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {parsed.languages.map((l) => (
                <li key={l.language} className="flex justify-between">
                  <span>{l.language}</span>
                  <span className="text-slate-500">
                    {l.fileCount} files · ~{l.approxLoc} LOC
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-900">Build &amp; dependencies</h2>
          <dl className="mt-2 space-y-1 text-sm text-slate-700">
            <div className="flex justify-between">
              <dt className="text-slate-500">Build system</dt>
              <dd>{parsed.buildSystems.join(", ") || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Package manager</dt>
              <dd>{parsed.packageManagers.join(", ") || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Frameworks</dt>
              <dd>{parsed.frameworks.join(", ") || "—"}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Findings by severity</h2>
          <div className="mt-2">
            {findingsError && <p className="text-sm text-red-600 dark:text-red-400">{findingsError}</p>}
            {!findingsError && findings === null && <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
            {!findingsError && findings !== null && <SeverityBreakdownChart findings={findings} />}
          </div>
        </div>

        <div className="rounded border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Findings trend</h2>
          <div className="mt-2">
            {analysisRunsError && <p className="text-sm text-red-600 dark:text-red-400">{analysisRunsError}</p>}
            {!analysisRunsError && analysisRuns === null && (
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
            )}
            {!analysisRunsError && analysisRuns !== null && <FindingsTrendChart runs={analysisRuns} />}
          </div>
        </div>

        <div className="rounded border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Languages (by file count)</h2>
          <div className="mt-2">
            <LanguageBreakdownChart languages={parsed.languages} />
          </div>
        </div>

        <div className="rounded border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Churn hotspots{gitAnalysis?.isGitRepository ? ` (last ${gitAnalysis.churnWindowDays} days)` : ""}
          </h2>
          <div className="mt-2">
            {gitError && (
              <p className="text-sm text-slate-500 dark:text-slate-400">Unavailable — see Git activity below.</p>
            )}
            {!gitError && !gitAnalysis && <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
            {!gitError && gitAnalysis && !gitAnalysis.isGitRepository && (
              <p className="text-sm text-slate-500 dark:text-slate-400">Not applicable — not a Git repository.</p>
            )}
            {!gitError && gitAnalysis?.isGitRepository && <ChurnHotspotsChart churn={gitAnalysis.fileChurn} />}
          </div>
        </div>
      </section>

      <DependenciesSection dependencies={dependencies} dependenciesError={dependenciesError} />

      <GitActivitySection gitAnalysis={gitAnalysis} gitError={gitError} />

      <p className="mt-6 text-xs text-slate-400">
        Last scanned {new Date(parsed.indexedAt).toLocaleString()}
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
    <section className="mt-6">
      <h2 className="text-sm font-semibold text-slate-900">Dependencies</h2>

      {dependenciesError && <p className="mt-2 text-sm text-red-600">{dependenciesError}</p>}

      {!dependenciesError && !dependencies && <p className="mt-2 text-sm text-slate-500">Loading…</p>}

      {!dependenciesError && dependencies && dependencies.ecosystem === null && (
        <p className="mt-2 text-sm text-slate-500">{dependencies.duplicatesNote}</p>
      )}

      {!dependenciesError && dependencies && dependencies.ecosystem !== null && (
        <div className="mt-2">
          <p className="text-sm text-slate-700">
            {dependencies.totalDirect} direct {dependencies.ecosystem} dependenc
            {dependencies.totalDirect === 1 ? "y" : "ies"}
          </p>

          {dependencies.duplicates.length > 0 ? (
            <div className="mt-3">
              <h3 className="text-xs font-medium text-slate-500">
                Duplicate versions ({dependencies.duplicates.length})
              </h3>
              <ul className="mt-1 space-y-1 text-sm text-slate-700">
                {dependencies.duplicates.slice(0, 10).map((dup) => (
                  <li key={dup.name} className="flex justify-between gap-2">
                    <span className="truncate font-mono text-xs">{dup.name}</span>
                    <span className="text-slate-500">{dup.versions.join(", ")}</span>
                  </li>
                ))}
              </ul>
              {dependencies.duplicates.length > 10 && (
                <p className="mt-1 text-xs text-slate-400">
                  +{dependencies.duplicates.length - 10} more
                </p>
              )}
            </div>
          ) : (
            dependencies.duplicatesNote && (
              <p className="mt-2 text-xs text-slate-400">{dependencies.duplicatesNote}</p>
            )
          )}
        </div>
      )}
    </section>
  );
}

function GitActivitySection({
  gitAnalysis,
  gitError,
}: {
  gitAnalysis: GitAnalysisResult | null;
  gitError: string | null;
}) {
  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold text-slate-900">Git activity</h2>

      {gitError && <p className="mt-2 text-sm text-red-600">{gitError}</p>}

      {!gitError && !gitAnalysis && (
        <p className="mt-2 text-sm text-slate-500">Loading…</p>
      )}

      {!gitError && gitAnalysis && !gitAnalysis.isGitRepository && (
        <p className="mt-2 text-sm text-slate-500">Not a Git repository.</p>
      )}

      {!gitError && gitAnalysis && gitAnalysis.isGitRepository && (
        <div className="mt-2 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-medium text-slate-500">Recent commits</h3>
            {gitAnalysis.recentCommits.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">No commits yet.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm text-slate-700">
                {gitAnalysis.recentCommits.map((commit) => (
                  <li key={commit.hash} className="flex items-baseline justify-between gap-2">
                    <span className="truncate">{commit.message}</span>
                    <span className="shrink-0 font-mono text-xs text-slate-400">
                      {commit.shortHash}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-xs font-medium text-slate-500">
              Most-churned files (last {gitAnalysis.churnWindowDays} days)
            </h3>
            {gitAnalysis.fileChurn.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">No churn in this window.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {gitAnalysis.fileChurn.map((entry) => (
                  <li key={entry.path} className="flex justify-between">
                    <span className="truncate font-mono text-xs">{entry.path}</span>
                    <span className="text-slate-500">{entry.commitCount} commits</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {gitAnalysis.uncommittedChanges && (
            <div className="sm:col-span-2">
              <h3 className="text-xs font-medium text-slate-500">Uncommitted changes</h3>
              {gitAnalysis.uncommittedChanges.filesChanged === 0 ? (
                <p className="mt-1 text-sm text-slate-500">Working tree matches HEAD.</p>
              ) : (
                <p className="mt-1 text-sm text-slate-700">
                  {gitAnalysis.uncommittedChanges.filesChanged} file
                  {gitAnalysis.uncommittedChanges.filesChanged === 1 ? "" : "s"} changed, +
                  {gitAnalysis.uncommittedChanges.insertions} / -
                  {gitAnalysis.uncommittedChanges.deletions}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-slate-200 bg-white p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}
