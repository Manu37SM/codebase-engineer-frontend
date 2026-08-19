import { NavLink, Outlet } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import CommandPalette, { OPEN_EVENT } from "./CommandPalette";

const NAV_SECTIONS = [
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

export default function NavShell() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <nav
        aria-label="Primary"
        className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-6 flex items-center justify-between px-2">
          <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Codebase Engineer
          </span>
          <button
            onClick={toggleTheme}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            {isDark ? "☀" : "☾"}
          </button>
        </div>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_EVENT))}
          className="mb-4 flex items-center justify-between rounded border border-slate-200 px-2 py-1.5 text-left text-xs text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <span>Search…</span>
          <span className="rounded border border-slate-300 bg-slate-50 px-1 font-mono dark:border-slate-600 dark:bg-slate-800">
            {isMac() ? "⌘K" : "Ctrl K"}
          </span>
        </button>
        <ul className="flex-1 space-y-1">
          {NAV_SECTIONS.map((section) => (
            <li key={section.to}>
              <NavLink
                to={section.to}
                end={section.to === "/"}
                className={({ isActive }) =>
                  `block rounded px-2 py-1.5 text-sm ${
                    isActive
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`
                }
              >
                {section.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
      <CommandPalette />
    </div>
  );
}

function isMac(): boolean {
  try {
    return /Mac|iPhone|iPad/.test(window.navigator.platform ?? window.navigator.userAgent);
  } catch {
    return false;
  }
}
