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
    createProject: vi.fn(),
    discoverProject: vi.fn(),
    indexProject: vi.fn(),
    deleteProject: vi.fn(),
    getCurrentUser: vi.fn(),
    detectSubProjects: vi.fn(),
    registerSubProject: vi.fn(),
  };
});

const mockedApi = api as unknown as {
  listProjects: ReturnType<typeof vi.fn>;
  createProject: ReturnType<typeof vi.fn>;
  discoverProject: ReturnType<typeof vi.fn>;
  indexProject: ReturnType<typeof vi.fn>;
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
    mockedApi.createProject.mockReset();
    mockedApi.discoverProject.mockReset();
    mockedApi.indexProject.mockReset();
    mockedApi.deleteProject.mockReset();
    mockedApi.detectSubProjects.mockReset();
    mockedApi.registerSubProject.mockReset();
    window.localStorage.clear();
  });

  it("shows an empty state when there are no repositories", async () => {
    renderPage();
    expect(await screen.findByText("No repositories registered yet.")).toBeInTheDocument();
  });

  it("registers a new repository and lists it", async () => {
    mockedApi.listProjects.mockResolvedValueOnce({ projects: [] }).mockResolvedValueOnce({
      projects: [{ id: "p1", name: "my-app", root_path: "/tmp/my-app", created_at: "now" }],
    });
    mockedApi.createProject.mockResolvedValue({
      project: { id: "p1", name: "my-app", root_path: "/tmp/my-app", created_at: "now" },
    });

    renderPage();
    await screen.findByText("No repositories registered yet.");

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Name"), "my-app");
    await user.type(screen.getByLabelText("Absolute path"), "/tmp/my-app");
    await user.click(screen.getByRole("button", { name: "Register & continue" }));

    expect(mockedApi.createProject).toHaveBeenCalledWith("my-app", "/tmp/my-app");
    expect(await screen.findByText("my-app")).toBeInTheDocument();
    expect(screen.getByText("/tmp/my-app")).toBeInTheDocument();
  });

  it("shows a form error when a field is missing", async () => {
    renderPage();
    await screen.findByText("No repositories registered yet.");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Register & continue" }));

    expect(
      await screen.findByText("Both a name and an absolute repository path are required.")
    ).toBeInTheDocument();
    expect(mockedApi.createProject).not.toHaveBeenCalled();
  });

  it("scans a repository via discover + index", async () => {
    mockedApi.listProjects.mockResolvedValue({
      projects: [{ id: "p1", name: "my-app", root_path: "/tmp/my-app", created_at: "now" }],
    });
    mockedApi.discoverProject.mockResolvedValue({});
    mockedApi.indexProject.mockResolvedValue({
      totalFiles: 5,
      testFiles: 1,
      generatedFiles: 0,
      indexedAt: "now",
    });

    renderPage();
    const user = userEvent.setup();
    const scanButton = await screen.findByRole("button", { name: "Scan" });
    await user.click(scanButton);

    await waitFor(() => expect(mockedApi.discoverProject).toHaveBeenCalledWith("p1"));
    expect(mockedApi.indexProject).toHaveBeenCalledWith("p1");
    expect(
      await screen.findByText("Scanned 5 files (1 test, 0 generated).")
    ).toBeInTheDocument();
  });

  it("removes a repository after a confirm step, without touching real files (Task #94)", async () => {
    mockedApi.listProjects
      .mockResolvedValueOnce({
        projects: [{ id: "p1", name: "my-app", root_path: "/tmp/my-app", created_at: "now" }],
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
      projects: [{ id: "p1", name: "my-app", root_path: "/tmp/my-app", created_at: "now" }],
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
      projects: [{ id: "p1", name: "monorepo", root_path: "/tmp/monorepo", created_at: "now" }],
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
      project: { id: "p2", name: "backend", root_path: "/tmp/monorepo/backend", created_at: "now" },
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
      projects: [{ id: "p1", name: "single-project", root_path: "/tmp/single", created_at: "now" }],
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
});
