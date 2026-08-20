import { FormEvent, useEffect, useState } from "react";
import {
  createProject,
  importProject,
  importGitHubRepo,
  listGitHubRepos,
  getGitHubSignInUrl,
  importDriveZipFile,
  listDriveZipFiles,
  getGoogleSignInUrl,
  ApiError,
  type GitHubRepoSummary,
  type DriveFileSummary,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";

interface RegisterProjectFormProps {
  /** Called after a successful register, with the new project's id — callers decide what to do next (e.g. select it, refresh a list). */
  onRegistered: (projectId: string) => void | Promise<void>;
  className?: string;
}

type Mode = "local" | "git" | "zip" | "github" | "drive";

const MODE_LABELS: Record<Mode, string> = {
  local: "Local path",
  git: "Git URL",
  zip: "Zip URL",
  github: "GitHub",
  drive: "Google Drive",
};

/**
 * The "register a repository" form, extracted out of Repositories.tsx
 * (Task #93) so the Dashboard's empty state can offer the same
 * register-right-here flow. Task #85 added a remote git URL and a plain
 * zip/download URL as sources. Task #84 added browsing the repositories
 * of whichever GitHub account the user signed in with (Task #83) and
 * cloning one directly. Task #86 adds a fifth source: browse zip files in
 * whichever Google account the user signed in with (Task #82) and import
 * one directly. All five sources are still local-first: the result always
 * ends up as a plain directory on this machine's own data directory,
 * registered exactly like a manually-picked local path.
 */
export default function RegisterProjectForm({ onRegistered, className }: RegisterProjectFormProps) {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("local");
  const [name, setName] = useState("");
  const [rootPath, setRootPath] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [repos, setRepos] = useState<GitHubRepoSummary[] | null>(null);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [repoFilter, setRepoFilter] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<string>("");

  const [driveFiles, setDriveFiles] = useState<DriveFileSummary[] | null>(null);
  const [driveFilesLoading, setDriveFilesLoading] = useState(false);
  const [driveFilesError, setDriveFilesError] = useState<string | null>(null);
  const [selectedDriveFile, setSelectedDriveFile] = useState<string>("");

  const githubConnected = Boolean(user?.githubConnected);
  const driveConnected = Boolean(user?.driveConnected);

  useEffect(() => {
    if (mode !== "github" || !githubConnected || repos !== null || reposLoading) return;
    setReposLoading(true);
    setReposError(null);
    listGitHubRepos()
      .then((result) => setRepos(result.repos))
      .catch((err) => setReposError(err instanceof ApiError ? err.message : "Failed to load GitHub repositories."))
      .finally(() => setReposLoading(false));
  }, [mode, githubConnected, repos, reposLoading]);

  useEffect(() => {
    if (mode !== "drive" || !driveConnected || driveFiles !== null || driveFilesLoading) return;
    setDriveFilesLoading(true);
    setDriveFilesError(null);
    listDriveZipFiles()
      .then((result) => setDriveFiles(result.files))
      .catch((err) => setDriveFilesError(err instanceof ApiError ? err.message : "Failed to load Google Drive files."))
      .finally(() => setDriveFilesLoading(false));
  }, [mode, driveConnected, driveFiles, driveFilesLoading]);

  function reset() {
    setName("");
    setRootPath("");
    setSourceUrl("");
    setSelectedRepo("");
    setSelectedDriveFile("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (mode === "local") {
      if (!name.trim() || !rootPath.trim()) {
        setFormError("Both a name and an absolute repository path are required.");
        return;
      }
    } else if (mode === "github") {
      if (!selectedRepo) {
        setFormError("Pick a repository to import.");
        return;
      }
    } else if (mode === "drive") {
      if (!selectedDriveFile) {
        setFormError("Pick a zip file to import.");
        return;
      }
    } else if (!name.trim() || !sourceUrl.trim()) {
      setFormError(`Both a name and a ${mode === "git" ? "git" : "zip"} URL are required.`);
      return;
    }

    setSubmitting(true);
    try {
      const { project } =
        mode === "local"
          ? await createProject(name.trim(), rootPath.trim())
          : mode === "github"
            ? await importGitHubRepo(selectedRepo, name.trim() || undefined)
            : mode === "drive"
              ? await importDriveZipFile(selectedDriveFile, name.trim() || undefined)
              : await importProject(name.trim(), mode, sourceUrl.trim());
      reset();
      await onRegistered(project.id);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to register repository.");
    } finally {
      setSubmitting(false);
    }
  }

  const filteredRepos =
    repos?.filter((r) => r.fullName.toLowerCase().includes(repoFilter.trim().toLowerCase())) ?? [];
  const zipFiles = driveFiles ?? [];

  return (
    <form
      onSubmit={handleSubmit}
      className={
        className ??
        "flex flex-wrap items-end gap-3 rounded border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
      }
    >
      <div className="flex w-full gap-1 text-xs">
        {(["local", "git", "zip", "github", "drive"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setFormError(null);
            }}
            className={`rounded px-2 py-1 font-medium ${
              mode === m
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {mode === "github" ? (
        !githubConnected ? (
          <div className="w-full rounded border border-dashed border-slate-300 p-3 text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
            Connect your GitHub account to browse and import your repos directly (including private ones).
            <a
              href={getGitHubSignInUrl()}
              className="ml-2 inline-block rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-900"
            >
              Connect GitHub
            </a>
          </div>
        ) : (
          <>
            <div className="w-full">
              <label
                className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                htmlFor="register-project-github-filter"
              >
                Filter repositories
              </label>
              <input
                id="register-project-github-filter"
                className="mt-1 w-80 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                value={repoFilter}
                onChange={(e) => setRepoFilter(e.target.value)}
                placeholder="owner/repo"
              />
            </div>
            <div className="w-full">
              <label
                className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                htmlFor="register-project-github-repo"
              >
                Repository
              </label>
              {reposLoading ? (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Loading your repositories…</p>
              ) : reposError ? (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{reposError}</p>
              ) : (
                <select
                  id="register-project-github-repo"
                  className="mt-1 w-96 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={selectedRepo}
                  onChange={(e) => setSelectedRepo(e.target.value)}
                >
                  <option value="">Select a repository…</option>
                  {filteredRepos.map((r) => (
                    <option key={r.id} value={r.fullName}>
                      {r.fullName}
                      {r.private ? " (private)" : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label
                className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                htmlFor="register-project-name"
              >
                Name (optional)
              </label>
              <input
                id="register-project-name"
                className="mt-1 w-48 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="defaults to repo name"
              />
            </div>
          </>
        )
      ) : mode === "drive" ? (
        !driveConnected ? (
          <div className="w-full rounded border border-dashed border-slate-300 p-3 text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
            Connect your Google account to browse and import a zip file from your Drive.
            <a
              href={getGoogleSignInUrl()}
              className="ml-2 inline-block rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-900"
            >
              Connect Google
            </a>
          </div>
        ) : (
          <>
            <div className="w-full">
              <label
                className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                htmlFor="register-project-drive-file"
              >
                Zip file
              </label>
              {driveFilesLoading ? (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Loading your Drive files…</p>
              ) : driveFilesError ? (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{driveFilesError}</p>
              ) : zipFiles.length === 0 ? (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">No zip files found in your Drive.</p>
              ) : (
                <select
                  id="register-project-drive-file"
                  className="mt-1 w-96 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={selectedDriveFile}
                  onChange={(e) => setSelectedDriveFile(e.target.value)}
                >
                  <option value="">Select a zip file…</option>
                  {zipFiles.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label
                className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                htmlFor="register-project-name"
              >
                Name (optional)
              </label>
              <input
                id="register-project-name"
                className="mt-1 w-48 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="defaults to file name"
              />
            </div>
          </>
        )
      ) : (
        <>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor="register-project-name">
              Name
            </label>
            <input
              id="register-project-name"
              className="mt-1 w-48 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-app"
            />
          </div>

          {mode === "local" ? (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor="register-project-path">
                Absolute path
              </label>
              <input
                id="register-project-path"
                className="mt-1 w-80 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                value={rootPath}
                onChange={(e) => setRootPath(e.target.value)}
                placeholder="/home/me/projects/my-app"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor="register-project-url">
                {mode === "git" ? "Git URL" : "Zip download URL"}
              </label>
              <input
                id="register-project-url"
                className="mt-1 w-80 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder={
                  mode === "git" ? "https://github.com/user/repo.git" : "https://example.com/repo/archive.zip"
                }
              />
            </div>
          )}
        </>
      )}

      <button
        type="submit"
        disabled={
          submitting ||
          (mode === "github" && !githubConnected) ||
          (mode === "drive" && !driveConnected)
        }
        className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
      >
        {submitting
          ? mode === "local"
            ? "Registering…"
            : mode === "git"
              ? "Cloning…"
              : mode === "github"
                ? "Cloning…"
                : "Downloading…"
          : "Register & continue"}
      </button>
      {formError && <p className="w-full text-sm text-red-600 dark:text-red-400">{formError}</p>}
      {(mode === "git" || mode === "zip" || mode === "github" || mode === "drive") && !formError && (
        <p className="w-full text-xs text-slate-400">
          {mode === "git"
            ? "Cloning a large repository"
            : mode === "zip"
              ? "Downloading and extracting a large archive"
              : mode === "github"
                ? "Cloning a large repository"
                : "Downloading and extracting a large archive"}{" "}
          can take a minute — everything stays on this machine, nothing is uploaded anywhere.
        </p>
      )}
    </form>
  );
}
