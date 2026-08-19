import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DashboardPage from "./Dashboard";
import { ProjectProvider } from "../context/ProjectContext";
import * as api from "../lib/api";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof api>("../lib/api");
  return {
    ...actual,
    listProjects: vi.fn(),
    getProject: vi.fn(),
    listFiles: vi.fn(),
    getGitAnalysis: vi.fn(),
    getDependencies: vi.fn(),
  };
});

const mockedApi = api as unknown as {
  listProjects: ReturnType<typeof vi.fn>;
  getProject: ReturnType<typeof vi.fn>;
  listFiles: ReturnType<typeof vi.fn>;
  getGitAnalysis: ReturnType<typeof vi.fn>;
  getDependencies: ReturnType<typeof vi.fn>;
};

const NON_GIT_RESULT = {
  isGitRepository: false,
  branch: null,
  workingTreeStatus: null,
  recentCommits: [],
  fileChurn: [],
  uncommittedChanges: null,
  churnWindowDays: 90,
  analyzedAt: "now",
};

const NO_DEPS_RESULT = {
  ecosystem: null,
  direct: [],
  totalDirect: 0,
  duplicates: [],
  duplicatesSource: null,
  duplicatesNote: "No supported manifest found (pom.xml or package.json).",
  analyzedAt: "now",
};

const PROJECT = { id: "p1", name: "my-app", root_path: "/tmp/my-app", created_at: "now" };

function renderPage() {
  return render(
    <MemoryRouter>
      <ProjectProvider>
        <DashboardPage />
      </ProjectProvider>
    </MemoryRouter>
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    mockedApi.listProjects.mockReset();
    mockedApi.getProject.mockReset();
    mockedApi.listFiles.mockReset();
    mockedApi.getGitAnalysis.mockReset();
    mockedApi.getGitAnalysis.mockResolvedValue(NON_GIT_RESULT);
    mockedApi.getDependencies.mockReset();
    mockedApi.getDependencies.mockResolvedValue(NO_DEPS_RESULT);
    window.localStorage.clear();
  });

  it("prompts to register a repository when none is selected", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [] });
    renderPage();
    expect(await screen.findByText(/No repository selected yet/)).toBeInTheDocument();
  });

  it("prompts to scan when the selected repository has no snapshot yet", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.getProject.mockResolvedValue({ project: PROJECT, latestSnapshot: null });
    mockedApi.listFiles.mockResolvedValue({ files: [], total: 0 });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/hasn't been scanned yet/)).toBeInTheDocument();
    });
  });

  it("renders a full dashboard summary from a snapshot", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.getProject.mockResolvedValue({
      project: PROJECT,
      latestSnapshot: {
        id: "s1",
        project_id: "p1",
        languages: JSON.stringify([{ language: "TypeScript", fileCount: 3, approxLoc: 42 }]),
        frameworks: JSON.stringify(["React"]),
        build_system: JSON.stringify(["npm"]),
        package_managers: JSON.stringify(["npm"]),
        git_branch: "main",
        working_tree_status: JSON.stringify({ modified: 0, staged: 0, untracked: 0, clean: true }),
        indexed_at: "2026-08-18T00:00:00.000Z",
      },
    });
    mockedApi.listFiles
      .mockResolvedValueOnce({ files: [], total: 10 })
      .mockResolvedValueOnce({ files: [], total: 2 });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();

    // Asserted inside a single `waitFor` rather than one `findByText` up
    // front followed by synchronous `getByText`s: the initial data load
    // resolves two independent promise chains a render apart (the fetch's
    // `.then` that sets `snapshot`/`fileTotals`, then a separate `.finally`
    // microtask that flips `loading` false), and this page also depends on
    // `ProjectContext`'s own async project-list load completing first. A
    // single `findByText("my-app")` only guarantees *a* render containing
    // that text happened at some point — not that the render RTL happened
    // to observe was the final, fully-settled one. On a slower or
    // differently-scheduled event loop (seen in practice on Windows) the
    // synchronous follow-up assertions could run against a DOM snapshot
    // that had already moved on. Polling the whole assertion group together
    // removes that race: it only succeeds once every field is present
    // simultaneously, in the same commit.
    await waitFor(() => {
      expect(screen.getByText("my-app")).toBeInTheDocument();
      expect(screen.getByText("main")).toBeInTheDocument();
      expect(screen.getByText("clean")).toBeInTheDocument();
      expect(screen.getByText("TypeScript")).toBeInTheDocument();
      expect(screen.getByText("React")).toBeInTheDocument();
      expect(screen.getByText("10")).toBeInTheDocument(); // total files stat tile
      expect(screen.getByText("2")).toBeInTheDocument(); // test files stat tile
    });
  });

  const SNAPSHOT = {
    id: "s1",
    project_id: "p1",
    languages: JSON.stringify([{ language: "TypeScript", fileCount: 3, approxLoc: 42 }]),
    frameworks: JSON.stringify(["React"]),
    build_system: JSON.stringify(["npm"]),
    package_managers: JSON.stringify(["npm"]),
    git_branch: "main",
    working_tree_status: JSON.stringify({ modified: 0, staged: 0, untracked: 0, clean: true }),
    indexed_at: "2026-08-18T00:00:00.000Z",
  };

  function mockDashboardBasics() {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.getProject.mockResolvedValue({ project: PROJECT, latestSnapshot: SNAPSHOT });
    mockedApi.listFiles
      .mockResolvedValueOnce({ files: [], total: 10 })
      .mockResolvedValueOnce({ files: [], total: 2 });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");
  }

  it("shows 'Not a Git repository' when the project has no .git directory", async () => {
    mockDashboardBasics();
    mockedApi.getGitAnalysis.mockResolvedValue(NON_GIT_RESULT);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Not a Git repository.")).toBeInTheDocument();
    });
  });

  it("renders recent commits, file churn, and uncommitted changes", async () => {
    mockDashboardBasics();
    mockedApi.getGitAnalysis.mockResolvedValue({
      isGitRepository: true,
      branch: "main",
      workingTreeStatus: { modified: 1, staged: 0, untracked: 0, clean: false },
      recentCommits: [
        {
          hash: "a".repeat(40),
          shortHash: "aaaaaaa",
          authorName: "Dev",
          authorEmail: "dev@example.com",
          date: "2026-08-18T00:00:00+00:00",
          message: "fix bug",
        },
      ],
      fileChurn: [{ path: "src/hot.ts", commitCount: 5 }],
      uncommittedChanges: { filesChanged: 1, insertions: 3, deletions: 1, files: [] },
      churnWindowDays: 90,
      analyzedAt: "now",
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("fix bug")).toBeInTheDocument();
    });
    expect(screen.getByText("aaaaaaa")).toBeInTheDocument();
    expect(screen.getByText("src/hot.ts")).toBeInTheDocument();
    expect(screen.getByText("5 commits")).toBeInTheDocument();
    expect(screen.getByText(/1 file changed, \+3 \/ -1/)).toBeInTheDocument();
  });

  it("shows a Git error without blocking the rest of the dashboard", async () => {
    mockDashboardBasics();
    mockedApi.getGitAnalysis.mockRejectedValue(new Error("git not installed"));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("git not installed")).toBeInTheDocument();
    });
    // The rest of the dashboard still rendered despite the Git failure.
    expect(screen.getByText("my-app")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
  });

  it("renders direct dependency count and duplicate versions", async () => {
    mockDashboardBasics();
    mockedApi.getDependencies.mockResolvedValue({
      ecosystem: "npm",
      direct: [{ name: "react", versionRange: "^18.0.0", type: "dependency" }],
      totalDirect: 12,
      duplicates: [{ name: "lodash", versions: ["3.10.1", "4.17.21"] }],
      duplicatesSource: "package-lock.json",
      duplicatesNote: null,
      analyzedAt: "now",
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("12 direct npm dependencies")).toBeInTheDocument();
    });
    expect(screen.getByText("lodash")).toBeInTheDocument();
    expect(screen.getByText("3.10.1, 4.17.21")).toBeInTheDocument();
  });

  it("shows a dependencies error without blocking the rest of the dashboard", async () => {
    mockDashboardBasics();
    mockedApi.getDependencies.mockRejectedValue(new Error("dependency scan failed"));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("dependency scan failed")).toBeInTheDocument();
    });
    expect(screen.getByText("my-app")).toBeInTheDocument();
  });
});
