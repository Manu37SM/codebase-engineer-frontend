import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { ProjectProvider } from "./context/ProjectContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import * as api from "./lib/api";

vi.mock("./lib/api", async () => {
  const actual = await vi.importActual<typeof api>("./lib/api");
  return { ...actual, listProjects: vi.fn(), getCurrentUser: vi.fn(), getAuthProviders: vi.fn() };
});

const mockedApi = api as unknown as {
  listProjects: ReturnType<typeof vi.fn>;
  getCurrentUser: ReturnType<typeof vi.fn>;
  getAuthProviders: ReturnType<typeof vi.fn>;
};

function renderApp(initialPath: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <AuthProvider>
          <ProjectProvider>
            <App />
          </ProjectProvider>
        </AuthProvider>
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe("App shell", () => {
  beforeEach(() => {
    mockedApi.listProjects.mockReset().mockResolvedValue({ projects: [] });
    mockedApi.getCurrentUser.mockReset().mockResolvedValue({ authRequired: false, user: null });
    mockedApi.getAuthProviders.mockReset().mockResolvedValue({ google: false, github: false });
  });

  it("renders the top-level navigation sections without crashing", async () => {
    renderApp("/");

    expect(await screen.findByText("Codebase Engineer")).toBeInTheDocument();
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

    expect(await screen.findByText(/Welcome to Codebase Engineer/)).toBeInTheDocument();
  });

  it("redirects to /login when auth is required and no session exists (Task #91)", async () => {
    mockedApi.getCurrentUser.mockResolvedValue({ authRequired: true, user: null });
    renderApp("/");

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    // The real app pages never rendered — no navigation, no workspace content.
    expect(screen.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument();
  });

  it("lets a logged-in user through to the real app", async () => {
    mockedApi.getCurrentUser.mockResolvedValue({
      authRequired: true,
      user: { id: "u1", email: "a@b.com", displayName: "Alice", createdAt: "now" },
    });
    renderApp("/");

    expect(await screen.findByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Sign out")).toBeInTheDocument();
  });
});
