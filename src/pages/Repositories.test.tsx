import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import RepositoriesPage from "./Repositories";
import { ProjectProvider } from "../context/ProjectContext";
import { AuthProvider } from "../context/AuthContext";
import * as api from "../lib/api";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof api>("../lib/api");
  return {
    ...actual,
    listProjects: vi.fn(),
    importProject: vi.fn(),
    discoverProject: vi.fn(),
    indexProject: vi.fn(),
    runProjectAnalysis: vi.fn(),
    deleteProject: vi.fn(),
    getCurrentUser: vi.fn(),
    detectSubProjects: vi.fn(),
    registerSubProject: vi.fn(),
  };
});

const mockedApi = api as unknown as {
  listProjects: ReturnType<typeof vi.fn>;
  importProject: ReturnType<typeof vi.fn>;
  discoverProject: ReturnType<typeof vi.fn>;
  indexProject: ReturnType<typeof vi.fn>;
  runProjectAnalysis: ReturnType<typeof vi.fn>;
  deleteProject: ReturnType<typeof vi.fn>;
  getCurrentUser: ReturnType<typeof vi.fn>;
  detectSubProjects: ReturnType<typeof vi.fn>;
  registerSubProject: ReturnType<typeof vi.fn>;
};

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ProjectProvider>
          <RepositoriesPage />
        </ProjectProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("RepositoriesPage", () => {
  beforeEach(() => {
    mockedApi.getCurrentUser.mockReset().mockResolvedValue({ authRequired: false, user: null });
    mockedApi.listProjects.mockReset().mockResolvedValue({ projects: [] });
    mockedApi.importProject.mockReset();
    // Registering (via the auto-scan setting, on by default) triggers a
    // discover+index right after — give these harmless defaults so tests
    // that don't care about scanning aren't tripped up by it.
    mockedApi.discoverProject.mockReset().mockResolvedValue({});
    mockedApi.indexProject.mockReset().mockResolvedValue({
      totalFiles: 0,
      testFiles: 0,
      generatedFiles: 0,
      indexedAt: "now",
    });
    mockedApi.runProjectAnalysis.mockReset().mockResolvedValue({
      run: { id: "r0", project_id: "p0", started_at: "now", finished_at: "now", status: "completed", findings_count: 0, critical_count: 0, high_count: 0, medium_count: 0, low_count: 0 },
      findingsCount: 0,
    });
    mockedApi.deleteProject.mockReset();
    mockedApi.detectSubProjects.mockReset();
    mockedApi.registerSubProject.mockReset();
    window.localStorage.clear();
    // Pre-agree to RegisterProjectForm's one-time disclosure dialog (must
    // come after the clear() above) — its own gating behavior is covered
    // by RegisterProjectForm.test.tsx; these tests are about the
    // Repositories page around it.
    window.localStorage.setItem("codebase-engineer.registerDisclosureAgreed", "1");
  });

  it("shows an empty state when there are no repositories", async () => {
    renderPage();
    expect(await screen.findByText("No repositories registered yet.")).toBeInTheDocument();
  });

  it("registers a new repository (via Git URL, the default tab) and lists it", async () => {
    mockedApi.listProjects.mockResolvedValueOnce({ projects: [] }).mockResolvedValue({
      // Not "Once" — handleRegistered's auto-scan (on by default) refreshes
      // the project list an extra time after registering, so this needs to
      // keep answering with the registered project for every call after
      // the first (empty) one, not just a single follow-up call.
      projects: [{ id: "p1", name: "my-app", root_path: "/data/my-app", created_at: "now", apply_mode: "download" }],
    });
    mockedApi.importProject.mockResolvedValue({
      project: { id: "p1", name: "my-app", root_path: "/data/my-app", created_at: "now", apply_mode: "download" },
    });

    renderPage();
    await screen.findByText("No repositories registered yet.");

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Name"), "my-app");
    await user.type(screen.getByLabelText("Git URL"), "https://github.com/user/archive.git");
    await user.click(screen.getByRole("button", { name: "Register & continue" }));

    expect(mockedApi.importProject).toHaveBeenCalledWith("my-app", "git", "https://github.com/user/archive.git");
    expect(await screen.findByText("my-app")).toBeInTheDocument();
    expect(screen.getByText("/data/my-app")).toBeInTheDocument();
  });

  it("shows a form error when a field is missing", async () => {
    renderPage();
    await screen.findByText("No repositories registered yet.");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Register & continue" }));

    expect(await screen.findByText("Both a name and a git URL are required.")).toBeInTheDocument();
    expect(mockedApi.importProject).not.toHaveBeenCalled();
  });

  it("scans a repository via discover + index + analysis, so findings are ready right away", async () => {
    mockedApi.listProjects.mockResolvedValue({
      projects: [{ id: "p1", name: "my-app", root_path: "/tmp/my-app", created_at: "now", apply_mode: "direct" }],
    });
    mockedApi.discoverProject.mockResolvedValue({});
    mockedApi.indexProject.mockResolvedValue({
      totalFiles: 5,
      testFiles: 1,
      generatedFiles: 0,
      indexedAt: "now",
    });
    mockedApi.runProjectAnalysis.mockResolvedValue({
      run: { id: "r1", project_id: "p1", started_at: "now", finished_at: "now", status: "completed", findings_count: 3, critical_count: 0, high_count: 1, medium_count: 2, low_count: 0 },
      findingsCount: 3,
    });

    renderPage();
    const user = userEvent.setup();
    const scanButton = await screen.findByRole("button", { name: "Scan" });
    await user.click(scanButton);

    await waitFor(() => expect(mockedApi.discoverProject).toHaveBeenCalledWith("p1"));
    expect(mockedApi.indexProject).toHaveBeenCalledWith("p1");
    expect(mockedApi.runProjectAnalysis).toHaveBeenCalledWith("p1");
    expect(
      await screen.findByText("Scanned 5 files (1 test, 0 generated) — 3 findings.")
    ).toBeInTheDocument();
  });

  it("removes a repository after a confirm step, without touching real files (Task #94)", async () => {
    mockedApi.listProjects
      .mockResolvedValueOnce({
        projects: [{ id: "p1", name: "my-app", root_path: "/tmp/my-app", created_at: "now", apply_mode: "direct" }],
      })
      .mockResolvedValueOnce({ projects: [] });
    mockedApi.deleteProject.mockResolvedValue(undefined);

    renderPage();
    const user = userEvent.setup();
    await screen.findByText("my-app");

    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByText("Remove from workspace?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(mockedApi.deleteProject).toHaveBeenCalledWith("p1"));
    expect(
      await screen.findByText("Repository removed from the workspace. Its actual files were not touched.")
    ).toBeInTheDocument();
  });

  it("cancels a remove without calling the API", async () => {
    mockedApi.listProjects.mockResolvedValue({
      projects: [{ id: "p1", name: "my-app", root_path: "/tmp/my-app", created_at: "now", apply_mode: "direct" }],
    });

    renderPage();
    const user = userEvent.setup();
    await screen.findByText("my-app");

    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Remove from workspace?")).not.toBeInTheDocument();
    expect(mockedApi.deleteProject).not.toHaveBeenCalled();
  });

  it("detects and registers a nested sub-project (Task #87)", async () => {
    mockedApi.listProjects.mockResolvedValue({
      projects: [{ id: "p1", name: "monorepo", root_path: "/tmp/monorepo", created_at: "now", apply_mode: "direct" }],
    });
    mockedApi.detectSubProjects.mockResolvedValue({
      isMultiProject: true,
      candidates: [
        { relativePath: "", markers: ["package.json"] },
        { relativePath: "backend", markers: ["pyproject.toml"] },
      ],
      truncated: false,
    });
    mockedApi.registerSubProject.mockResolvedValue({
      project: { id: "p2", name: "backend", root_path: "/tmp/monorepo/backend", created_at: "now", apply_mode: "direct" },
    });

    renderPage();
    const user = userEvent.setup();
    await screen.findByText("monorepo");

    await user.click(screen.getByRole("button", { name: "Detect sub-projects" }));
    expect(mockedApi.detectSubProjects).toHaveBeenCalledWith("p1");

    expect(await screen.findByText(/looks like it contains 1 other project/)).toBeInTheDocument();
    expect(screen.getByText("backend", { exact: false })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Register" }));
    await waitFor(() => expect(mockedApi.registerSubProject).toHaveBeenCalledWith("p1", "backend"));
    expect(await screen.findByText('Registered "backend" as a separate project.')).toBeInTheDocument();
  });

  it("toggles the sub-project panel closed without a second fetch", async () => {
    mockedApi.listProjects.mockResolvedValue({
      projects: [{ id: "p1", name: "single-project", root_path: "/tmp/single", created_at: "now", apply_mode: "direct" }],
    });
    mockedApi.detectSubProjects.mockResolvedValue({ isMultiProject: false, candidates: [], truncated: false });

    renderPage();
    const user = userEvent.setup();
    await screen.findByText("single-project");

    await user.click(screen.getByRole("button", { name: "Detect sub-projects" }));
    expect(await screen.findByText("No other project roots detected inside this folder.")).toBeInTheDocument();
    expect(mockedApi.detectSubProjects).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Hide sub-projects" }));
    expect(screen.queryByText("No other project roots detected inside this folder.")).not.toBeInTheDocument();
    expect(mockedApi.detectSubProjects).toHaveBeenCalledTimes(1);
  });

  it("no longer repeats the \"AI apply: Download as zip\" label on every row — it's a fixed, unchangeable fact now disclosed once in the registration dialog instead", async () => {
    mockedApi.listProjects.mockResolvedValue({
      projects: [{ id: "p1", name: "my-app", root_path: "/data/my-app", created_at: "now", apply_mode: "download" }],
    });

    renderPage();
    await screen.findByText("my-app");

    expect(screen.queryByText("Download as zip")).not.toBeInTheDocument();
    expect(screen.queryByText(/AI apply:/)).not.toBeInTheDocument();
  });
});
