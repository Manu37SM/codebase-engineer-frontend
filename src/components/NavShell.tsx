import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import CommandPalette, { OPEN_EVENT } from "./CommandPalette";
import KeyboardShortcutsModal, { OPEN_SHORTCUTS_EVENT } from "./KeyboardShortcutsModal";

const NAV_SECTIONS = [
  { to: "/", label: "Dashboard", icon: "⌂" },
  { to: "/repositories", label: "Repositories", icon: "▤" },
  { to: "/architecture", label: "Architecture", icon: "◈" },
  { to: "/findings", label: "Findings", icon: "⚑" },
  { to: "/changes", label: "Changes", icon: "⇄" },
  { to: "/tests", label: "Tests", icon: "✓" },
  { to: "/audit", label: "Audit", icon: "☰" },
  { to: "/ai-mode", label: "AI Mode", icon: "✦" },
  { to: "/settings", label: "Settings", icon: "⚙" },
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
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(readPersistedCollapsed);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      } catch {

      }
      return next;
    });
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <nav
        aria-label="Primary"
        className={`sticky top-0 flex h-screen shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white py-4 transition-[width] duration-150 dark:border-slate-800 dark:bg-slate-900 ${
          collapsed ? "w-14 px-2" : "w-56 px-3"
        }`}
      >
        <div className={`mb-6 flex items-center px-2 ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && (
            <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Codebase Engineer
            </span>
          )}
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <span aria-hidden="true" className="text-sm leading-none">
              {collapsed ? "»" : "«"}
            </span>
          </button>
        </div>

        <button
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_EVENT))}
          title="Search (⌘K)"
          className={`mt-4 mb-4 flex items-center rounded border border-slate-200 py-1.5 text-left text-xs text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 ${
            collapsed ? "justify-center px-1.5" : "justify-between px-2"
          }`}
        >
          {collapsed ? (
            <span aria-hidden="true">⌕</span>
          ) : (
            <>
              <span>Search…</span>
              <span className="rounded border border-slate-300 bg-slate-50 px-1 font-mono dark:border-slate-600 dark:bg-slate-800">
                {isMac() ? "⌘K" : "Ctrl K"}
              </span>
            </>
          )}
        </button>

        <button
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_SHORTCUTS_EVENT))}
          title="Keyboard shortcuts (?)"
          aria-label="Keyboard shortcuts"
          className={`mb-4 flex items-center rounded border border-slate-200 py-1.5 text-left text-xs text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 ${
            collapsed ? "justify-center px-1.5" : "justify-between px-2"
          }`}
        >
          {collapsed ? (
            <span aria-hidden="true">?</span>
          ) : (
            <>
              <span>Keyboard shortcuts</span>
              <span className="rounded border border-slate-300 bg-slate-50 px-1 font-mono dark:border-slate-600 dark:bg-slate-800">
                ?
              </span>
            </>
          )}
        </button>

        <ul className="flex-1 space-y-1">
          {NAV_SECTIONS.map((section) => (
            <li key={section.to}>
              <NavLink
                to={section.to}
                end={section.to === "/"}
                title={collapsed ? section.label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded px-2 py-1.5 text-sm ${collapsed ? "justify-center" : ""} ${
                    isActive
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`
                }
              >
                <span aria-hidden="true">{section.icon}</span>
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
              className={`mt-1 flex w-full items-center rounded px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 ${
                collapsed ? "justify-center" : "text-left"
              }`}
            >
              {collapsed ? <span aria-hidden="true">⎋</span> : "Sign out"}
            </button>
          </div>
        )}
      </nav>
      <main className="flex-1 p-6">
        <Outlet />
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
