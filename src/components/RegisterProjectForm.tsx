import { FormEvent, useState } from "react";
import { createProject, ApiError } from "../lib/api";

interface RegisterProjectFormProps {
  /** Called after a successful register, with the new project's id — callers decide what to do next (e.g. select it, refresh a list). */
  onRegistered: (projectId: string) => void | Promise<void>;
  className?: string;
}

/**
 * The "register a repository by path" form, extracted out of Repositories.tsx
 * (Task #93) so the Dashboard's empty state can offer the same
 * register-right-here flow instead of forcing a click through to the
 * Repositories page just to get started — the whole point of the
 * navigation-UX pass this component was pulled out for.
 */
export default function RegisterProjectForm({ onRegistered, className }: RegisterProjectFormProps) {
  const [name, setName] = useState("");
  const [rootPath, setRootPath] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!name.trim() || !rootPath.trim()) {
      setFormError("Both a name and an absolute repository path are required.");
      return;
    }
    setSubmitting(true);
    try {
      const { project } = await createProject(name.trim(), rootPath.trim());
      setName("");
      setRootPath("");
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
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
      >
        {submitting ? "Registering…" : "Register & continue"}
      </button>
      {formError && <p className="w-full text-sm text-red-600 dark:text-red-400">{formError}</p>}
    </form>
  );
}
