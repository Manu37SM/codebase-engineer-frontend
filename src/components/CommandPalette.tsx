import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProjects } from "../context/ProjectContext";

/** Dispatch `new CustomEvent(OPEN_EVENT)` from anywhere to open the palette imperatively (e.g. a visible button). */
export const OPEN_EVENT = "codebase-engineer:open-command-palette";

interface Command {
  id: string;
  label: string;
  hint?: string;
  keywords?: string;
  run: () => void;
}

const PAGES: { to: string; label: string }[] = [
  { to: "/", label: "Dashboard" },
  { to: "/repositories", label: "Repositories" },
  { to: "/architecture", label: "Architecture" },
  { to: "/findings", label: "Findings" },
  { to: "/changes", label: "Changes" },
  { to: "/tests", label: "Tests" },
  { to: "/audit", label: "Audit" },
  { to: "/ai-mode", label: "AI Mode" },
  { to: "/settings", label: "Settings" },
];

/**
 * A Cmd/Ctrl+K command palette (Task #77) for keyboard-driven navigation —
 * jump to any page or switch the selected repository without touching the
 * mouse. Mounted once in `NavShell` so it's always available regardless of
 * which page is showing.
 *
 * The theme-toggle command this used to include was removed (dark mode is
 * now the only mode — see ThemeContext.tsx) but the palette itself stays:
 * only that one command was cut, per explicit follow-up instruction, not
 * the whole feature.
 *
 * Deliberately simple: a case-insensitive substring filter over a small,
 * static command list (page nav + real registered projects), not a
 * fuzzy-match library — the command list here is small enough (under a few
 * dozen entries even with many repositories registered) that a substring
 * filter is both fast and predictable.
 */
export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { projects, selectedProjectId, selectProject } = useProjects();

  // Global open/close shortcut — Cmd+K on macOS, Ctrl+K everywhere else.
  // Registered once for the app's lifetime (empty dep array); the handler
  // reads `open` via the functional form of `setOpen` so it never needs to
  // be re-registered when `open` changes.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    // Also openable by dispatching this event — used by the visible
    // "Search (Ctrl K)" button in `NavShell` for anyone who doesn't know
    // (or can't use) the keyboard shortcut, without lifting `open` state
    // out of this component.
    function handleOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener(OPEN_EVENT, handleOpenEvent);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener(OPEN_EVENT, handleOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // Focus after the modal actually mounts.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const commands: Command[] = useMemo(() => {
    const nav: Command[] = PAGES.map((p) => ({
      id: `nav:${p.to}`,
      label: p.label,
      hint: "Go to page",
      run: () => navigate(p.to),
    }));

    const projectCommands: Command[] = projects.map((p) => ({
      id: `project:${p.id}`,
      label: p.name,
      hint: p.id === selectedProjectId ? "Current repository" : "Switch to this repository",
      keywords: p.root_path,
      run: () => selectProject(p.id),
    }));

    return [...nav, ...projectCommands];
  }, [projects, selectedProjectId, selectProject, navigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.hint?.toLowerCase().includes(q) || c.keywords?.toLowerCase().includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function runCommand(command: Command) {
    command.run();
    setOpen(false);
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (filtered.length === 0 ? 0 : (prev + 1) % filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (filtered.length === 0 ? 0 : (prev - 1 + filtered.length) % filtered.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const command = filtered[activeIndex];
      if (command) runCommand(command);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 p-4 pt-24"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          aria-label="Command palette search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Go to a page, or switch repository…"
          className="w-full border-b border-slate-700 bg-transparent px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
        />
        <ul className="max-h-72 overflow-y-auto">
          {filtered.map((command, i) => (
            <li key={command.id}>
              <button
                type="button"
                onClick={() => runCommand(command)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${
                  i === activeIndex ? "bg-slate-100 text-slate-900" : "text-slate-200"
                }`}
              >
                <span>{command.label}</span>
                {command.hint && <span className="text-xs text-slate-400">{command.hint}</span>}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-500">No matching pages or repositories.</li>
          )}
        </ul>
        <div className="border-t border-slate-700 px-4 py-2 text-xs text-slate-500">
          ↑↓ to navigate · Enter to select · Esc to close
        </div>
      </div>
    </div>
  );
}
