import { NavLink, Outlet } from "react-router-dom";

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
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <nav
        aria-label="Primary"
        className="w-56 shrink-0 border-r border-slate-200 bg-white px-3 py-4"
      >
        <div className="mb-6 px-2 text-sm font-semibold tracking-tight text-slate-900">
          Codebase Engineer
        </div>
        <ul className="space-y-1">
          {NAV_SECTIONS.map((section) => (
            <li key={section.to}>
              <NavLink
                to={section.to}
                end={section.to === "/"}
                className={({ isActive }) =>
                  `block rounded px-2 py-1.5 text-sm ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100"
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
    </div>
  );
}
