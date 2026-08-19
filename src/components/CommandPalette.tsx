import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProjects } from "../context/ProjectContext";
import { useTheme } from "../context/ThemeContext";

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
 * jump to any page, switch the selected repository, or toggle the theme
 * without touching the mouse. Mounted once in `NavShell` so it's always
 * available regardless of which page is showing.
 *
 * Deliberately simple: a case-insensitive substring filter over a small,
 * static command list (page nav + real registered projects + theme
 * toggle), not a fuzzy-match library — the command list here is small
 * enough (under a few dozen entries even with many repositories
 * registered) that a substring filter is both fast and predictable.
 */
export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { projects, selectedProjectId, selectProject } = useProjects();
  const { toggleTheme, resolvedTheme } = useTheme();

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

    const themeCommand: Command = {
      id: "theme:toggle",
      label: resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode",
      hint: "Toggle theme",
      run: toggleTheme,
    };

    return [...nav, ...projectCommands, themeCommand];
  }, [projects, selectedProjectId, selectProject, navigate, resolvedTheme, toggleTheme]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.keywords?.toLowerCase().includes(q)
    );
  }, [commands, query]);

  function runCommand(cmd: Command) {
    cmd.run();
    setOpen(false);
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[activeIndex];
      if (cmd) runCommand(cmd);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleInputKeyDown}
          placeholder="Go to a page, switch repository, or toggle theme…"
          aria-label="Command palette search"
          className="w-full border-b border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <ul role="listbox" className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">No matches.</li>
          )}
          {filtered.map((cmd, i) => (
            <li key={cmd.id}>
              <button
                role="option"
                aria-selected={i === activeIndex}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => runCommand(cmd)}
                className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${
                  i === activeIndex
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-700 dark:text-slate-200"
                }`}
              >
                <span>{cmd.label}</span>
                {cmd.hint && (
                  <span className={i === activeIndex ? "text-slate-300 dark:text-slate-600" : "text-slate-400"}>
                    {cmd.hint}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-400 dark:border-slate-700">
          ↑↓ to navigate · Enter to select · Esc to close
        </div>
      </div>
    </div>
  );
}
