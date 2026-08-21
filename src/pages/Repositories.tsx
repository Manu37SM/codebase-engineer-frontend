import { useState } from "react";
import { useProjects } from "../context/ProjectContext";
import {
  deleteProject,
  discoverProject,
  indexProject,
  runProjectAnalysis,
  detectSubProjects,
  registerSubProject,
  type MultiProjectDetectionResult,
} from "../lib/api";
import { ApiError } from "../lib/api";
import { getAutoScanOnRegister } from "../lib/settings";
import ActivityIndicator from "../components/ActivityIndicator";
import RegisterProjectForm from "../components/RegisterProjectForm";
import AiProviderReminder from "../components/AiProviderReminder";

export default function RepositoriesPage() {
  const { projects, loading, error, selectedProjectId, selectProject, refresh } = useProjects();
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [subProjectsById, setSubProjectsById] = useState<Record<string, MultiProjectDetectionResult>>({});
  const [detectingId, setDetectingId] = useState<string | null>(null);
  const [registeringKey, setRegisteringKey] = useState<string | null>(null);
  // Shown once right after a successful registration — see
  // components/AiProviderReminder.tsx for why this isn't a hard gate.
  const [showAiReminder, setShowAiReminder] = useState(false);

  async function handleRegistered(projectId: string) {
    await refresh();
    selectProject(projectId);
    setShowAiReminder(true);
    // "Auto-scan after registering" (Settings) — on by default so a newly
    // registered repo shows findings/dependencies/Git activity right away
    // instead of requiring a separate manual "Scan" click.
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
      // "Scan" used to only discover+index files (languages, build system,
      // Git branch, etc.) and leave findings for a separate, easy-to-miss
      // "Run Analysis" click on the Findings page. Running the same
      // deterministic analysis here too means findings are ready the
      // moment a scan finishes — Run Analysis on the Findings page still
      // works exactly as before for a manual re-run.
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
    // Toggle closed if already shown, rather than re-fetching every click.
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
    }
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900">Repositories</h1>
      <p className="mt-1 text-sm text-slate-500">
        Register a local repository by its absolute path, then scan it. Nothing is uploaded — all
        discovery and indexing runs against the path on this machine.
      </p>

      <RegisterProjectForm onRegistered={handleRegistered} className="mt-4 flex flex-wrap items-end gap-3 rounded border border-slate-200 bg-white p-4" />

      {showAiReminder && <AiProviderReminder onDismiss={() => setShowAiReminder(false)} />}

      {actionMessage && <p className="mt-3 text-sm text-slate-600">{actionMessage}</p>}

      <div className="mt-6">
        {loading && <p className="text-sm text-slate-500">Loading repositories…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && projects.length === 0 && (
          <p className="text-sm text-slate-500">No repositories registered yet.</p>
        )}
        {!loading && !error && projects.length > 0 && (
          <p className="mb-2 text-xs text-slate-400">
            "Remove" only forgets Codebase Engineer's own record of a repository (findings, scan
            history, etc.) — it never touches the actual files on disk.
          </p>
        )}
        <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
          {projects.map((project) => {
            const subResult = subProjectsById[project.id];
            const nestedCandidates = subResult?.candidates.filter((c) => c.relativePath !== "") ?? [];
            return (
              <li key={project.id} className="flex flex-col gap-2 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{project.name}</div>
                    <div className="text-xs text-slate-500">{project.root_path}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/*
                      "Direct to disk" used to be a selectable option here,
                      but this instance runs on a remote server — writing
                      an approved AI-Mode patch "directly to disk" would
                      write it into the *server's* filesystem, not the
                      user's own machine, which isn't useful and was
                      confusing. Every project now runs in "download as
                      zip" mode (createProject defaults new projects to it,
                      migration 017 flipped existing ones), so this is a
                      static label rather than a dropdown with only one
                      real choice.
                    */}
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      AI apply: <span className="font-medium text-slate-700">Download as zip</span>
                    </span>
                    {busyProjectId === project.id && (
                      <ActivityIndicator label="Discovering & indexing files" />
                    )}
                    {selectedProjectId === project.id ? (
                      <span className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white">
                        Selected
                      </span>
                    ) : (
                      <button
                        className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        onClick={() => selectProject(project.id)}
                      >
                        Select
                      </button>
                    )}
                    <button
                      className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      disabled={busyProjectId === project.id}
                      onClick={() => handleDiscoverAndIndex(project.id)}
                    >
                      {busyProjectId === project.id ? "Scanning…" : "Scan"}
                    </button>
                    <button
                      className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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
                        <span className="text-xs text-slate-500">Remove from workspace?</span>
                        <button
                          className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                          disabled={removingId === project.id}
                          onClick={() => handleRemove(project.id)}
                        >
                          {removingId === project.id ? "Removing…" : "Confirm"}
                        </button>
                        <button
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          disabled={removingId === project.id}
                          onClick={() => setConfirmRemoveId(null)}
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                        onClick={() => setConfirmRemoveId(project.id)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {subResult && (
                  <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs">
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
    </div>
  );
}
