import { useState } from "react";
import { useProjects } from "../context/ProjectContext";
import { discoverProject, indexProject } from "../lib/api";
import { ApiError } from "../lib/api";
import ActivityIndicator from "../components/ActivityIndicator";
import RegisterProjectForm from "../components/RegisterProjectForm";

export default function RepositoriesPage() {
  const { projects, loading, error, selectedProjectId, selectProject, refresh } = useProjects();
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function handleRegistered(projectId: string) {
    await refresh();
    selectProject(projectId);
  }

  async function handleDiscoverAndIndex(projectId: string) {
    setBusyProjectId(projectId);
    setActionMessage(null);
    try {
      await discoverProject(projectId);
      const summary = await indexProject(projectId);
      setActionMessage(
        `Scanned ${summary.totalFiles} files (${summary.testFiles} test, ${summary.generatedFiles} generated).`
      );
      await refresh();
    } catch (err) {
      setActionMessage(err instanceof ApiError ? err.message : "Scan failed.");
    } finally {
      setBusyProjectId(null);
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

      {actionMessage && <p className="mt-3 text-sm text-slate-600">{actionMessage}</p>}

      <div className="mt-6">
        {loading && <p className="text-sm text-slate-500">Loading repositories…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && projects.length === 0 && (
          <p className="text-sm text-slate-500">No repositories registered yet.</p>
        )}
        <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
          {projects.map((project) => (
            <li key={project.id} className="flex items-center justify-between gap-3 p-3">
              <div>
                <div className="text-sm font-medium text-slate-900">{project.name}</div>
                <div className="text-xs text-slate-500">{project.root_path}</div>
              </div>
              <div className="flex items-center gap-2">
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
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
