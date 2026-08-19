import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { ProjectProvider } from "./context/ProjectContext";
import { ThemeProvider } from "./context/ThemeContext";
import * as api from "./lib/api";

vi.mock("./lib/api", async () => {
  const actual = await vi.importActual<typeof api>("./lib/api");
  return { ...actual, listProjects: vi.fn() };
});

const mockedApi = api as unknown as { listProjects: ReturnType<typeof vi.fn> };

describe("App shell", () => {
  beforeEach(() => {
    mockedApi.listProjects.mockReset().mockResolvedValue({ projects: [] });
  });

  it("renders the top-level navigation sections without crashing", async () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/"]}>
          <ProjectProvider>
            <App />
          </ProjectProvider>
        </MemoryRouter>
      </ThemeProvider>
    );

    expect(screen.getByText("Codebase Engineer")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Primary" });
    for (const label of [
      "Dashboard",
      "Repositories",
      "Architecture",
      "Findings",
      "Changes",
      "Tests",
      "Audit",
      "AI Mode",
      "Settings",
    ]) {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    }

    expect(await screen.findByText(/No repository selected yet/)).toBeInTheDocument();
  });
});
