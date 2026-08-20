import { FormEvent, useState } from "react";
import { createProject, importProject, ApiError } from "../lib/api";

interface RegisterProjectFormProps {
  /** Called after a successful register, with the new project's id — callers decide what to do next (e.g. select it, refresh a list). */
  onRegistered: (projectId: string) => void | Promise<void>;
  className?: string;
}

type Mode = "local" | "git" | "zip";

/**
 * The "register a repository" form, extracted out of Repositories.tsx
 * (Task #93) so the Dashboard's empty state can offer the same
 * register-right-here flow. Task #85 added two more sources beyond a
 * local path — a remote git URL (cloned onto this machine) and a plain
 * zip/download URL (downloaded and extracted onto this machine) — still
 * local-first in both cases: nothing is ever stored anywhere but this
 * machine's own data directory.
 */
export default function RegisterProjectForm({ onRegistered, className }: RegisterProjectFormProps) {
  const [mode, setMode] = useState<Mode>("local");
  const [name, setName] = useState("");
  const [rootPath, setRootPath] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName("");
    setRootPath("");
    setSourceUrl("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (mode === "local") {
      if (!name.trim() || !rootPath.trim()) {
        setFormError("Both a name and an absolute repository path are required.");
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
          : await importProject(name.trim(), mode, sourceUrl.trim());
      reset();
      await onRegistered(project.id);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to register repository.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={
        className ??
        "flex flex-wrap items-end gap-3 rounded border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
      }
    >
      <div className="flex w-full gap-1 text-xs">
        {(["local", "git", "zip"] as const).map((m) => (
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
            {m === "local" ? "Local path" : m === "git" ? "Git URL" : "Zip URL"}
          </button>
        ))}
      </div>

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

      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
      >
        {submitting
          ? mode === "local"
            ? "Registering…"
            : mode === "git"
              ? "Cloning…"
              : "Downloading…"
          : "Register & continue"}
      </button>
      {formError && <p className="w-full text-sm text-red-600 dark:text-red-400">{formError}</p>}
      {mode !== "local" && !formError && (
        <p className="w-full text-xs text-slate-400">
          {mode === "git" ? "Cloning a large repository" : "Downloading and extracting a large archive"} can take a
          minute — everything stays on this machine, nothing is uploaded anywhere.
        </p>
      )}
    </form>
  );
}
