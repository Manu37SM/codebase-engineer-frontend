import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import NavShell from "./NavShell";
import { ProjectProvider } from "../context/ProjectContext";
import { ThemeProvider } from "../context/ThemeContext";
import { AuthProvider } from "../context/AuthContext";
import * as api from "../lib/api";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof api>("../lib/api");
  return { ...actual, listProjects: vi.fn(), getCurrentUser: vi.fn() };
});

const mockedApi = api as unknown as {
  listProjects: ReturnType<typeof vi.fn>;
  getCurrentUser: ReturnType<typeof vi.fn>;
};

function renderShell() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider>
          <ProjectProvider>
            <Routes>
              <Route element={<NavShell />}>
                <Route index element={<div>page content</div>} />
              </Route>
            </Routes>
          </ProjectProvider>
        </AuthProvider>
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe("NavShell sidebar collapse (Task #88)", () => {
  beforeEach(() => {
    mockedApi.listProjects.mockReset().mockResolvedValue({ projects: [] });
    mockedApi.getCurrentUser.mockReset().mockResolvedValue({ authRequired: false, user: null });
    window.localStorage.clear();
  });

  it("shows full labels by default", async () => {
    renderShell();
    const nav = await screen.findByRole("navigation", { name: "Primary" });
    expect(within(nav).getByText("Repositories")).toBeInTheDocument();
    expect(within(nav).getByText("Codebase Engineer")).toBeInTheDocument();
  });

  it("collapses to icon-only on click, and persists the choice across a remount", async () => {
    const { unmount } = renderShell();
    const nav = await screen.findByRole("navigation", { name: "Primary" });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    expect(within(nav).queryByText("Repositories")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("codebase-engineer.sidebarCollapsed")).toBe("1");

    expect(within(nav).getByTitle("Repositories")).toBeInTheDocument();

    unmount();

    renderShell();
    const navAgain = await screen.findByRole("navigation", { name: "Primary" });
    expect(within(navAgain).queryByText("Repositories")).not.toBeInTheDocument();
  });

  it("expands again on a second click", async () => {
    renderShell();
    const nav = await screen.findByRole("navigation", { name: "Primary" });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    await user.click(screen.getByRole("button", { name: "Expand sidebar" }));

    expect(within(nav).getByText("Repositories")).toBeInTheDocument();
    expect(window.localStorage.getItem("codebase-engineer.sidebarCollapsed")).toBe("0");
  });
});

describe("NavShell repository switcher and mobile drawer", () => {
  const P1 = { id: "p1", name: "alpha-app", root_path: "/a", created_at: "now", apply_mode: "direct" };
  const P2 = { id: "p2", name: "beta-app", root_path: "/b", created_at: "now", apply_mode: "direct" };

  beforeEach(() => {
    mockedApi.listProjects.mockReset().mockResolvedValue({ projects: [P1, P2] });
    mockedApi.getCurrentUser.mockReset().mockResolvedValue({ authRequired: false, user: null });
    window.localStorage.clear();
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");
  });

  it("switches the active repository from the sidebar and remembers it", async () => {
    renderShell();
    const select = await screen.findByRole("combobox", { name: "Active repository" });
    expect(select).toHaveValue("p1");

    const user = userEvent.setup();
    await user.selectOptions(select, "p2");

    expect(window.localStorage.getItem("codebase-engineer.selectedProjectId")).toBe("p2");
    expect(select).toHaveValue("p2");
  });

  it("hides the repository switcher when no repository is registered", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [] });
    renderShell();
    await screen.findByRole("navigation", { name: "Primary" });
    expect(screen.queryByRole("combobox", { name: "Active repository" })).not.toBeInTheDocument();
  });

  it("opens the mobile menu, shows labels even if the sidebar is collapsed, and closes on Escape", async () => {
    window.localStorage.setItem("codebase-engineer.sidebarCollapsed", "1");
    renderShell();
    const nav = await screen.findByRole("navigation", { name: "Primary" });
    expect(within(nav).queryByText("Repositories")).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(within(nav).getByText("Repositories")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close menu" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(within(nav).queryByText("Repositories")).not.toBeInTheDocument();
  });
});
