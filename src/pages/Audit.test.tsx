import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AuditPage from "./Audit";
import { ProjectProvider } from "../context/ProjectContext";
import * as api from "../lib/api";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof api>("../lib/api");
  return { ...actual, listProjects: vi.fn(), getAudit: vi.fn() };
});

const mockedApi = api as unknown as {
  listProjects: ReturnType<typeof vi.fn>;
  getAudit: ReturnType<typeof vi.fn>;
};

const PROJECT = { id: "p1", name: "my-app", root_path: "/tmp/my-app", created_at: "now" };

const EMPTY_REPORT = {
  project: { id: "p1", name: "my-app", rootPath: "/tmp/my-app" },
  generatedAt: "2026-08-18T00:00:00.000Z",
  snapshot: null,
  findings: { latestRun: null, counts: { total: 0, bySeverity: {}, byCategory: {} } },
  security: { findings: [], scannedAt: "2026-08-18T00:00:00.000Z" },
  dependencies: {
    ecosystem: null,
    direct: [],
    totalDirect: 0,
    duplicates: [],
    duplicatesSource: null,
    duplicatesNote: "No supported manifest found (pom.xml or package.json).",
    analyzedAt: "2026-08-18T00:00:00.000Z",
  },
  git: {
    isGitRepository: false,
    branch: null,
    workingTreeStatus: null,
    recentCommits: [],
    fileChurn: [],
    uncommittedChanges: null,
    churnWindowDays: 90,
    analyzedAt: "2026-08-18T00:00:00.000Z",
  },
  latestTestRun: null,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ProjectProvider>
        <AuditPage />
      </ProjectProvider>
    </MemoryRouter>
  );
}

describe("AuditPage", () => {
  beforeEach(() => {
    mockedApi.listProjects.mockReset();
    mockedApi.getAudit.mockReset();
    window.localStorage.clear();
  });

  it("prompts to select a repository when none is selected", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/No repository selected yet/)).toBeInTheDocument();
    });
  });

  it("renders honest empty-state messages for a never-scanned project", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.getAudit.mockResolvedValue(EMPTY_REPORT);
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/hasn't been scanned yet/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Analysis hasn't been run yet/)).toBeInTheDocument();
    expect(screen.getByText("No security findings.")).toBeInTheDocument();
    expect(screen.getByText(/No supported manifest found/)).toBeInTheDocument();
    expect(screen.getByText("Not a Git repository.")).toBeInTheDocument();
    expect(screen.getByText(/No test run recorded yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download report (.md)" })).toHaveAttribute(
      "href",
      "/api/v1/projects/p1/audit/export"
    );
  });

  it("renders a fully populated audit summary", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.getAudit.mockResolvedValue({
      ...EMPTY_REPORT,
      snapshot: {
        languages: [{ language: "TypeScript", fileCount: 3, approxLoc: 42 }],
        frameworks: ["React"],
        buildSystems: ["npm"],
        packageManagers: ["npm"],
        totalFiles: 10,
        testFiles: 2,
        indexedAt: "2026-08-18T00:00:00.000Z",
      },
      findings: {
        latestRun: {
          id: "run1",
          project_id: "p1",
          started_at: "now",
          finished_at: "now",
          status: "completed",
          findings_count: 2,
        },
        counts: { total: 2, bySeverity: { high: 1, medium: 1 }, byCategory: { security: 1, maintainability: 1 } },
      },
      security: {
        scannedAt: "2026-08-18T00:00:00.000Z",
        findings: [
          {
            ruleId: "env-file-committed",
            severity: "high",
            category: "security",
            filePath: ".env",
            lineStart: null,
            lineEnd: null,
            evidence: "[REDACTED]",
            explanation: "A .env-style file is committed to the repository.",
            recommendation: "Remove it and rotate any secrets.",
          },
        ],
      },
      dependencies: {
        ecosystem: "npm",
        direct: [{ name: "react", versionRange: "^18.0.0", type: "dependency" }],
        totalDirect: 12,
        duplicates: [{ name: "lodash", versions: ["3.10.1", "4.17.21"] }],
        duplicatesSource: "package-lock.json",
        duplicatesNote: null,
        analyzedAt: "2026-08-18T00:00:00.000Z",
      },
      git: {
        isGitRepository: true,
        branch: "main",
        workingTreeStatus: { modified: 1, staged: 0, untracked: 0, clean: false },
        recentCommits: [
          { hash: "a".repeat(40), shortHash: "aaaaaaa", authorName: "Dev", authorEmail: "d@x.com", date: "now", message: "fix bug" },
        ],
        fileChurn: [{ path: "src/hot.ts", commitCount: 5 }],
        uncommittedChanges: { filesChanged: 1, insertions: 3, deletions: 1, files: [] },
        churnWindowDays: 90,
        analyzedAt: "2026-08-18T00:00:00.000Z",
      },
      latestTestRun: {
        id: "t1",
        project_id: "p1",
        framework: "vitest",
        command: "npm test",
        exit_code: 0,
        duration_ms: 1234,
        passed: 10,
        failed: 0,
        skipped: 1,
        status: "passed",
        reason: null,
        started_at: "now",
      },
    });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/2 findings from the last analysis run/)).toBeInTheDocument();
    });
    expect(screen.getByText(".env")).toBeInTheDocument();
    expect(screen.getByText(/A \.env-style file is committed/)).toBeInTheDocument();
    expect(screen.getByText(/12 direct npm dependencies/)).toBeInTheDocument();
    expect(screen.getByText(/1 duplicate version group/)).toBeInTheDocument();
    expect(screen.getByText(/Branch main/)).toBeInTheDocument();
    expect(screen.getByText(/passed — 10 passed, 0 failed, 1 skipped/)).toBeInTheDocument();
  });

  it("shows an error without crashing when the audit fetch fails", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.getAudit.mockRejectedValue(new Error("audit failed"));
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("audit failed")).toBeInTheDocument();
    });
  });
});
