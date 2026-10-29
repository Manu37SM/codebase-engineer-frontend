import { useMemo, useState } from "react";
import { useProjects } from "../context/ProjectContext";
import {
  deleteProject,
  discoverProject,
  indexProject,
  runProjectAnalysis,
  detectSubProjects,
  registerSubProject,
  listChanges,
  type MultiProjectDetectionResult,
} from "../lib/api";
import { ApiError } from "../lib/api";
import { getAutoScanOnRegister } from "../lib/settings";
import ActivityIndicator from "../components/ActivityIndicator";
import RegisterProjectForm from "../components/RegisterProjectForm";
import AiProviderReminder from "../components/AiProviderReminder";
import { BTN_SECONDARY, Icon, PageHeader, Skeleton } from "../components/ui";

export default function RepositoriesPage() {
  const { projects, loading, error, selectedProjectId, selectProject, refresh } = useProjects();
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [checkingRemoveId, setCheckingRemoveId] = useState<string | null>(null);

  const [removeWarning, setRemoveWarning] = useState<{ projectId: string; projectName: string; patchCount: number } | null>(
    null
  );
  const [subProjectsById, setSubProjectsById] = useState<Record<string, MultiProjectDetectionResult>>({});
  const [detectingId, setDetectingId] = useState<string | null>(null);
  const [registeringKey, setRegisteringKey] = useState<string | null>(null);

  const [showAiReminder, setShowAiReminder] = useState(false);
  const [filter, setFilter] = useState("");

  const visibleProjects = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q
      ? projects.filter((p) => p.name.toLowerCase().includes(q) || p.root_path.toLowerCase().includes(q))
      : projects;
  }, [projects, filter]);

  async function handleRegistered(projectId: string) {
    await refresh();
    selectProject(projectId);
    setShowAiReminder(true);

    if (getAutoScanOnRegister()) {
      await handleDiscoverAndIndex(projectId);
    }
  }

  async function handleDiscoverAndIndex(projectId: string) {
    setBusyProjectId(projectId);
    setActionMessage(null);
    try {
      await discoverProject(projectId);
      const summary = await indexProject(projectId);

      const analysis = await runProjectAnalysis(projectId);
      setActionMessage(
        `Scanned ${summary.totalFiles} files (${summary.testFiles} test, ${summary.generatedFiles} generated) — ${analysis.findingsCount} finding${analysis.findingsCount === 1 ? "" : "s"}.`
      );
      await refresh();
    } catch (err) {
      setActionMessage(err instanceof ApiError ? err.message : "Scan failed.");
    } finally {
      setBusyProjectId(null);
    }
  }

  async function handleDetectSubProjects(projectId: string) {

    if (subProjectsById[projectId]) {
      setSubProjectsById((prev) => {
        const next = { ...prev };
        delete next[projectId];
        return next;
      });
      return;
    }
    setDetectingId(projectId);
    setActionMessage(null);
    try {
      const result = await detectSubProjects(projectId);
      setSubProjectsById((prev) => ({ ...prev, [projectId]: result }));
    } catch (err) {
      setActionMessage(err instanceof ApiError ? err.message : "Failed to scan for nested projects.");
    } finally {
      setDetectingId(null);
    }
  }

  async function handleRegisterSubProject(projectId: string, relativePath: string) {
    const key = `${projectId}:${relativePath}`;
    setRegisteringKey(key);
    setActionMessage(null);
    try {
      const { project } = await registerSubProject(projectId, relativePath);
      setActionMessage(`Registered "${project.name}" as a separate project.`);
      await refresh();
    } catch (err) {
      setActionMessage(err instanceof ApiError ? err.message : "Failed to register the nested project.");
    } finally {
      setRegisteringKey(null);
    }
  }

  async function handleRemove(projectId: string) {
    setRemovingId(projectId);
    setActionMessage(null);
    try {
      await deleteProject(projectId);
      if (selectedProjectId === projectId) selectProject(null);
      await refresh();
      setActionMessage("Repository removed from the workspace. Its actual files were not touched.");
    } catch (err) {
      setActionMessage(err instanceof ApiError ? err.message : "Failed to remove repository.");
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

  return (
    <div>
      <PageHeader
        title="Repositories"
        subtitle="Register a local repository by its absolute path, then scan it. Nothing is uploaded — all discovery and indexing runs against the path on this machine."
      />

      <RegisterProjectForm
        onRegistered={handleRegistered}
        className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900"
      />

      {showAiReminder && <AiProviderReminder onDismiss={() => setShowAiReminder(false)} />}

      {actionMessage && (
        <p role="status" className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          {actionMessage}
        </p>
      )}

      <div className="mt-6">
        {loading && (
          <div role="status" aria-live="polite" className="space-y-2">
            <span className="sr-only">Loading repositories…</span>
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {!loading && !error && projects.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">No repositories registered yet.</p>
        )}
        {!loading && !error && projects.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-xs text-slate-400 dark:text-slate-500">
              "Remove" only forgets Codebase Engineer's own record of a repository (findings, scan
              history, etc.) — it never touches the actual files on disk.
            </p>
            {projects.length > 4 && (
              <div className="relative w-full max-w-xs">
                <Icon
                  name="search"
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  aria-label="Filter repositories"
                  placeholder="Filter repositories…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
            )}
          </div>
        )}
        {filter && visibleProjects.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">No repositories match "{filter}".</p>
        )}
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white shadow-sm empty:hidden dark:divide-slate-800 dark:border-slate-700/70 dark:bg-slate-900">
          {visibleProjects.map((project) => {
            const subResult = subProjectsById[project.id];
            const nestedCandidates = subResult?.candidates.filter((c) => c.relativePath !== "") ?? [];
            return (
              <li key={project.id} className="flex flex-col gap-2 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{project.name}</div>
                    <div className="truncate text-xs text-slate-500 dark:text-slate-400" title={project.root_path}>
                      {project.root_path}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {}
                    {busyProjectId === project.id && (
                      <ActivityIndicator label="Discovering & indexing files" />
                    )}
                    {selectedProjectId === project.id ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                        <Icon name="check" className="h-3 w-3" />
                        Selected
                      </span>
                    ) : (
                      <button
                        className={BTN_SECONDARY}
                        onClick={() => selectProject(project.id)}
                      >
                        Select
                      </button>
                    )}
                    <button
                      className={BTN_SECONDARY}
                      disabled={busyProjectId === project.id}
                      onClick={() => handleDiscoverAndIndex(project.id)}
                    >
                      {busyProjectId === project.id ? "Scanning…" : "Scan"}
                    </button>
                    <button
                      className={BTN_SECONDARY}
                      disabled={detectingId === project.id}
                      onClick={() => handleDetectSubProjects(project.id)}
                    >
                      {detectingId === project.id
                        ? "Scanning…"
                        : subResult
                          ? "Hide sub-projects"
                          : "Detect sub-projects"}
                    </button>
                    {confirmRemoveId === project.id ? (
                      <span className="flex items-center gap-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Remove from workspace?</span>
                        <button
                          className="inline-flex items-center rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/50"
                          disabled={removingId === project.id}
                          onClick={() => handleRemove(project.id)}
                        >
                          {removingId === project.id ? "Removing…" : "Confirm"}
                        </button>
                        <button
                          className={BTN_SECONDARY}
                          disabled={removingId === project.id}
                          onClick={() => setConfirmRemoveId(null)}
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                        disabled={checkingRemoveId === project.id}
                        onClick={() => handleRemoveClick(project.id, project.name)}
                      >
                        {checkingRemoveId === project.id ? "Checking…" : "Remove"}
                      </button>
                    )}
                  </div>
                </div>

                {subResult && (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs dark:border-slate-700 dark:bg-slate-950/50">
                    {nestedCandidates.length === 0 ? (
                      <p className="text-slate-500">No other project roots detected inside this folder.</p>
                    ) : (
                      <>
                        <p className="mb-1 text-slate-600">
                          This folder looks like it contains {nestedCandidates.length} other project
                          {nestedCandidates.length === 1 ? "" : "s"} — register any of them separately:
                        </p>
                        <ul className="space-y-1">
                          {nestedCandidates.map((c) => {
                            const key = `${project.id}:${c.relativePath}`;
                            return (
                              <li key={c.relativePath} className="flex items-center justify-between gap-2">
                                <span className="font-mono text-slate-700">
                                  {c.relativePath}{" "}
                                  <span className="text-slate-400">({c.markers.join(", ")})</span>
                                </span>
                                <button
                                  className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                                  disabled={registeringKey === key}
                                  onClick={() => handleRegisterSubProject(project.id, c.relativePath)}
                                >
                                  {registeringKey === key ? "Registering…" : "Register"}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {removeWarning && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-warning-heading"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <h2 id="remove-warning-heading" className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Remove "{removeWarning.projectName}"?
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              This project has {removeWarning.patchCount} AI-generated patch{removeWarning.patchCount === 1 ? "" : "es"}.
              Removing it deletes Codebase Engineer's record of {removeWarning.patchCount === 1 ? "it" : "them"} too —
              your actual files on disk are never touched.
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              If you're on the free tier, any AI usage already spent generating {removeWarning.patchCount === 1 ? "it" : "them"}{" "}
              won't be refunded to your monthly limit.
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
                onClick={() => handleRemove(removeWarning.projectId)}
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
