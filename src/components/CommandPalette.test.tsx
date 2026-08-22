import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import NavShell from "./NavShell";
import { ProjectProvider } from "../context/ProjectContext";
import { AuthProvider } from "../context/AuthContext";
import * as api from "../lib/api";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof api>("../lib/api");
  return {
    ...actual,
    listProjects: vi.fn(),
    getCurrentUser: vi.fn(),
  };
});

const mockedApi = api as unknown as {
  listProjects: ReturnType<typeof vi.fn>;
  getCurrentUser: ReturnType<typeof vi.fn>;
};

function renderWithRoutes(initialPath = "/") {
  return render(
    <AuthProvider>
      <ProjectProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route element={<NavShell />}>
              <Route path="/" element={<div>Dashboard page</div>} />
              <Route path="/repositories" element={<div>Repositories page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ProjectProvider>
    </AuthProvider>
  );
}

describe("CommandPalette (Ctrl/Cmd+K) — the palette itself stays; only its theme-toggle command was removed", () => {
  beforeEach(() => {
    mockedApi.listProjects.mockReset().mockResolvedValue({
      projects: [
        { id: "p1", name: "widget-app", root_path: "/repos/widget-app" },
        { id: "p2", name: "other-repo", root_path: "/repos/other-repo" },
      ],
    });
    mockedApi.getCurrentUser.mockReset().mockResolvedValue({ authRequired: false, user: null });
  });

  it("opens via the Ctrl+K keyboard shortcut", async () => {
    renderWithRoutes();
    const user = userEvent.setup();
    await user.keyboard("{Control>}k{/Control}");

    expect(await screen.findByLabelText("Command palette search")).toBeInTheDocument();
  });

  it("opens via the custom open event (the visible Search button's mechanism)", async () => {
    renderWithRoutes();
    const user = userEvent.setup();
    await user.click(screen.getByTitle("Search (⌘K)"));

    expect(await screen.findByLabelText("Command palette search")).toBeInTheDocument();
  });

  it("navigates to a page and closes", async () => {
    renderWithRoutes();
    const user = userEvent.setup();
    await user.keyboard("{Control>}k{/Control}");

    const input = await screen.findByLabelText("Command palette search");
    await user.type(input, "repositories");

    const dialog = screen.getByRole("dialog");
    await user.click(await within(dialog).findByText("Repositories"));

    await waitFor(() => {
      expect(screen.getByText("Repositories page")).toBeInTheDocument();
    });
    expect(screen.queryByLabelText("Command palette search")).not.toBeInTheDocument();
  });

  it("switches the selected repository via search", async () => {
    renderWithRoutes();
    const user = userEvent.setup();
    await user.keyboard("{Control>}k{/Control}");

    const input = await screen.findByLabelText("Command palette search");
    await user.type(input, "widget");

    expect(await screen.findByText("widget-app")).toBeInTheDocument();
    await user.click(screen.getByText("widget-app"));

    await waitFor(() => {
      expect(window.localStorage.getItem("codebase-engineer.selectedProjectId")).toBe("p1");
    });
  });

  it("closes on Escape", async () => {
    renderWithRoutes();
    const user = userEvent.setup();
    await user.keyboard("{Control>}k{/Control}");
    await screen.findByLabelText("Command palette search");

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByLabelText("Command palette search")).not.toBeInTheDocument();
    });
  });

  it("no longer offers a theme-toggle command — dark mode only, per explicit request", async () => {
    renderWithRoutes();
    const user = userEvent.setup();
    await user.keyboard("{Control>}k{/Control}");

    const input = await screen.findByLabelText("Command palette search");
    await user.type(input, "theme");

    expect(screen.queryByText("Switch to dark mode")).not.toBeInTheDocument();
    expect(screen.queryByText("Switch to light mode")).not.toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).queryByRole("button")).not.toBeInTheDocument();
  });
});
