import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useProjects } from "../context/ProjectContext";
import CommandPalette, { OPEN_EVENT } from "./CommandPalette";
import KeyboardShortcutsModal, { OPEN_SHORTCUTS_EVENT } from "./KeyboardShortcutsModal";
import { Icon, type IconName } from "./ui";

const NAV_SECTIONS: { to: string; label: string; icon: IconName }[] = [
  { to: "/", label: "Dashboard", icon: "dashboard" },
  { to: "/repositories", label: "Repositories", icon: "repositories" },
  { to: "/architecture", label: "Architecture", icon: "architecture" },
  { to: "/findings", label: "Findings", icon: "findings" },
  { to: "/changes", label: "Changes", icon: "changes" },
  { to: "/tests", label: "Tests", icon: "tests" },
  { to: "/audit", label: "Audit", icon: "audit" },
  { to: "/ai-mode", label: "AI Mode", icon: "ai" },
  { to: "/settings", label: "Settings", icon: "settings" },
];

const SIDEBAR_COLLAPSED_STORAGE_KEY = "codebase-engineer.sidebarCollapsed";

function readPersistedCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export default function NavShell() {
  const { user, logout } = useAuth();
  const { projects, selectedProject, selectProject } = useProjects();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsedPref, setCollapsed] = useState(readPersistedCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // In the mobile drawer the sidebar is always shown expanded.
  const collapsed = collapsedPref && !drawerOpen;

  // Close the drawer whenever the route changes, or on Escape.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* storage unavailable — the toggle still works for this session */
      }
      return next;
    });
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const secondaryButton =
    "flex items-center rounded-md border border-slate-200 py-1.5 text-left text-xs text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800";
  const kbd =
    "rounded border border-slate-300 bg-slate-50 px-1 font-mono text-[10px] dark:border-slate-600 dark:bg-slate-800";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 md:flex-row dark:bg-slate-950 dark:text-slate-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-sky-600 focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-900/90">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
        >
          <Icon name="menu" className="h-4 w-4" />
        </button>
        <span className="truncate text-sm font-semibold tracking-tight">
          {NAV_SECTIONS.find((n) => (n.to === "/" ? location.pathname === "/" : location.pathname.startsWith(n.to)))?.label ?? "Menu"}
        </span>
      </header>

      {drawerOpen && (
        <div
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm md:hidden"
        />
      )}

      <nav
        aria-label="Primary"
        className={`fixed inset-y-0 left-0 z-40 flex shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white py-4 shadow-xl transition-all duration-150 md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0 md:shadow-none dark:border-slate-800 dark:bg-slate-900 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "w-14 px-2" : "w-60 px-3 md:w-56"}`}
      >
        <div className={`mb-5 flex items-center px-1 ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && (
            <span className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              <span
                aria-hidden="true"
                className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-sky-400 dark:bg-slate-800"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 8-4 4 4 4M15 8l4 4-4 4" />
                </svg>
              </span>
              Codebase Engineer
            </span>
          )}
          <button
            onClick={drawerOpen ? () => setDrawerOpen(false) : toggleCollapsed}
            title={drawerOpen ? "Close menu" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={drawerOpen ? "Close menu" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <Icon name={drawerOpen ? "close" : collapsed ? "chevronsRight" : "chevronsLeft"} className="h-3.5 w-3.5" />
          </button>
        </div>

        {!collapsed && projects.length > 0 && (
          <div className="mb-3 px-0.5">
            <label htmlFor="nav-active-repo" className="mb-1 block px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Repository
            </label>
            <select
              id="nav-active-repo"
              aria-label="Active repository"
              value={selectedProject?.id ?? ""}
              onChange={(e) => selectProject(e.target.value || null)}
              className="w-full truncate rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {!selectedProject && <option value="">Select a repository…</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-3 space-y-2">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent(OPEN_EVENT))}
            title="Search (⌘K)"
            className={`${secondaryButton} w-full ${collapsed ? "justify-center px-1.5" : "justify-between px-2"}`}
          >
            {collapsed ? (
              <Icon name="search" />
            ) : (
              <>
                <span className="flex items-center gap-2">
                  <Icon name="search" className="h-3.5 w-3.5" />
                  Search…
                </span>
                <span className={kbd}>{isMac() ? "⌘K" : "Ctrl K"}</span>
              </>
            )}
          </button>

          <button
            onClick={() => window.dispatchEvent(new CustomEvent(OPEN_SHORTCUTS_EVENT))}
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
            className={`${secondaryButton} w-full ${collapsed ? "justify-center px-1.5" : "justify-between px-2"}`}
          >
            {collapsed ? (
              <Icon name="keyboard" />
            ) : (
              <>
                <span className="flex items-center gap-2">
                  <Icon name="keyboard" className="h-3.5 w-3.5" />
                  Keyboard shortcuts
                </span>
                <span className={kbd}>?</span>
              </>
            )}
          </button>
        </div>

        <ul className="flex-1 space-y-0.5">
          {NAV_SECTIONS.map((section) => (
            <li key={section.to}>
              <NavLink
                to={section.to}
                end={section.to === "/"}
                title={collapsed ? section.label : undefined}
                className={({ isActive }) =>
                  `relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${collapsed ? "justify-center" : ""} ${
                    isActive
                      ? "bg-slate-900 font-medium text-white dark:bg-slate-800 dark:text-sky-300"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/70"
                  }`
                }
              >
                <Icon name={section.icon} />
                {!collapsed && <span>{section.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>

        {user && (
          <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800">
            {!collapsed && (
              <div className="truncate px-2 text-xs text-slate-500 dark:text-slate-400" title={user.email}>
                {user.displayName || user.email}
              </div>
            )}
            <button
              onClick={handleLogout}
              title={collapsed ? `Sign out (${user.email})` : undefined}
              className={`mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 ${
                collapsed ? "justify-center" : "text-left"
              }`}
            >
              {collapsed ? <Icon name="logout" /> : (
                <>
                  <Icon name="logout" className="h-4 w-4" />
                  Sign out
                </>
              )}
            </button>
          </div>
        )}
      </nav>
      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 p-4 outline-none sm:p-6">
        <div key={location.pathname} className="page-enter mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
      <CommandPalette />
      <KeyboardShortcutsModal />
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
