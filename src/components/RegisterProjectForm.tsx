import { FormEvent, useEffect, useState } from "react";
import {
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

  onRegistered: (projectId: string) => void | Promise<void>;
  className?: string;
}

type Mode = "zip" | "git" | "github" | "drive";

const MODE_LABELS: Record<Mode, string> = {
  zip: "Zip URL",
  git: "Git URL",
  github: "GitHub",
  drive: "Google Drive",
};

const SHOW_ZIP_URL_TAB = false;
const VISIBLE_MODES = (["zip", "git", "github", "drive"] as const).filter((m) => m !== "zip" || SHOW_ZIP_URL_TAB);

const DISCLOSURE_AGREED_STORAGE_KEY = "codebase-engineer.registerDisclosureAgreed";

function hasAgreedToDisclosure(): boolean {
  try {
    return window.localStorage.getItem(DISCLOSURE_AGREED_STORAGE_KEY) === "1";
  } catch {
    return false; 
  }
}

function rememberDisclosureAgreed(): void {
  try {
    window.localStorage.setItem(DISCLOSURE_AGREED_STORAGE_KEY, "1");
  } catch {

  }
}

export default function RegisterProjectForm({ onRegistered, className }: RegisterProjectFormProps) {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>(SHOW_ZIP_URL_TAB ? "zip" : "git");
  const [name, setName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [repos, setRepos] = useState<GitHubRepoSummary[] | null>(null);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [reposSlow, setReposSlow] = useState(false);
  const [repoFilter, setRepoFilter] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<string>("");

  const [driveFiles, setDriveFiles] = useState<DriveFileSummary[] | null>(null);
  const [driveFilesLoading, setDriveFilesLoading] = useState(false);
  const [driveFilesError, setDriveFilesError] = useState<string | null>(null);
  const [driveFilesSlow, setDriveFilesSlow] = useState(false);
  const [driveFilter, setDriveFilter] = useState("");
  const [selectedDriveFile, setSelectedDriveFile] = useState<string>("");

  const githubConnected = Boolean(user?.githubConnected);
  const driveConnected = Boolean(user?.driveConnected);

  const SLOW_LOAD_MS = 10_000;

  useEffect(() => {

    if (mode !== "github" || !githubConnected || repos !== null || reposLoading) return;
    setReposLoading(true);
    setReposError(null);
    setReposSlow(false);
    const slowTimer = setTimeout(() => setReposSlow(true), SLOW_LOAD_MS);
    listGitHubRepos()
      .then((result) => setRepos(result.repos))
      .catch((err) => setReposError(err instanceof ApiError ? err.message : "Failed to load GitHub repositories."))
      .finally(() => {
        setReposLoading(false);
        clearTimeout(slowTimer);
      });
    return () => clearTimeout(slowTimer);

  }, [mode, githubConnected, repos]);

  useEffect(() => {

    if (mode !== "drive" || !driveConnected || driveFiles !== null || driveFilesLoading) return;
    setDriveFilesLoading(true);
    setDriveFilesError(null);
    setDriveFilesSlow(false);
    const slowTimer = setTimeout(() => setDriveFilesSlow(true), SLOW_LOAD_MS);
    listDriveZipFiles()
      .then((result) => setDriveFiles(result.files))
      .catch((err) => setDriveFilesError(err instanceof ApiError ? err.message : "Failed to load Google Drive files."))
      .finally(() => {
        setDriveFilesLoading(false);
        clearTimeout(slowTimer);
      });
    return () => clearTimeout(slowTimer);

  }, [mode, driveConnected, driveFiles]);

  const [showDisclosure, setShowDisclosure] = useState(false);

  function reset() {
    setName("");
    setSourceUrl("");
    setSelectedRepo("");
    setSelectedDriveFile("");
  }

  async function doImport() {
    setSubmitting(true);
    try {
      const { project } =
        mode === "github"
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (mode === "github") {
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

    if (hasAgreedToDisclosure()) {
      void doImport();
    } else {
      setShowDisclosure(true);
    }
  }

  function handleAgreeAndContinue() {
    rememberDisclosureAgreed();
    setShowDisclosure(false);
    void doImport();
  }

  const filteredRepos =
    repos?.filter((r) => r.fullName.toLowerCase().includes(repoFilter.trim().toLowerCase())) ?? [];
  const zipFiles = (driveFiles ?? []).filter((f) =>
    f.name.toLowerCase().includes(driveFilter.trim().toLowerCase())
  );

  return (
    <>
    <form
      onSubmit={handleSubmit}
      className={
        className ??
        "flex flex-wrap items-end gap-3 rounded border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
      }
    >
      <div className="flex w-full gap-1 text-xs">
        {VISIBLE_MODES.map((m) => (
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
                <div>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Loading your repositories…</p>
                  {reposSlow && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      This is taking longer than usual — if it doesn't finish shortly, your GitHub
                      connection may be stale. Try signing out and signing back in with the
                      "Continue with GitHub" button on the login page to re-authorize it.
                    </p>
                  )}
                </div>
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
                htmlFor="register-project-drive-filter"
              >
                Filter files
              </label>
              <input
                id="register-project-drive-filter"
                className="mt-1 w-80 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                value={driveFilter}
                onChange={(e) => setDriveFilter(e.target.value)}
                placeholder="type to search…"
              />
            </div>
            <div className="w-full">
              <label
                className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                htmlFor="register-project-drive-file"
              >
                Zip file
              </label>
              {driveFilesLoading ? (
                <div>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Loading your Drive files…</p>
                  {driveFilesSlow && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      This is taking longer than usual — if it doesn't finish shortly, your Google
                      connection may be stale. Try signing out and signing back in with the
                      "Continue with Google" button on the login page to re-authorize it.
                    </p>
                  )}
                </div>
              ) : driveFilesError ? (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{driveFilesError}</p>
              ) : zipFiles.length === 0 ? (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {(driveFiles ?? []).length === 0
                    ? "No zip files found in your Drive."
                    : "No zip files match your filter."}
                </p>
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
          ? mode === "git" || mode === "github"
            ? "Cloning…"
            : "Downloading…"
          : "Register & continue"}
      </button>
      {formError && <p className="w-full text-sm text-red-600 dark:text-red-400">{formError}</p>}
      {!formError && (
        <p className="w-full text-xs text-slate-400">
          {mode === "git" || mode === "github"
            ? "Cloning a large repository"
            : "Downloading and extracting a large archive"}{" "}
          can take a minute — everything stays on this server, nothing is uploaded to your browser.
        </p>
      )}
    </form>

    {showDisclosure && (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-disclosure-heading"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      >
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <h2 id="register-disclosure-heading" className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Before you register a repository
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li>
              • Your code isn't uploaded to any third party — it's downloaded or cloned straight into
              this server's own storage, the same one this app runs on.
            </li>
            <li>
              • AI-generated patches are never written to disk automatically. They can only be reviewed
              and downloaded as a zip, which you apply on your own machine yourself.
            </li>
            <li>• "Remove" only deletes this app's own records for a repository — never the files themselves.</li>
            <li>• You can register, scan, and remove as many repositories as you like.</li>
          </ul>
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
            This is shown once — you won't see it again on this browser.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowDisclosure(false)}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAgreeAndContinue}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
            >
              Agree and continue
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
