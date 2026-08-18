import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import TestsPage from "./Tests";
import { ProjectProvider } from "../context/ProjectContext";
import * as api from "../lib/api";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof api>("../lib/api");
  return {
    ...actual,
    listProjects: vi.fn(),
    listTestRuns: vi.fn(),
    getTestRun: vi.fn(),
    runProjectTests: vi.fn(),
  };
});

const mockedApi = api as unknown as {
  listProjects: ReturnType<typeof vi.fn>;
  listTestRuns: ReturnType<typeof vi.fn>;
  getTestRun: ReturnType<typeof vi.fn>;
  runProjectTests: ReturnType<typeof vi.fn>;
};

const PROJECT = { id: "p1", name: "my-app", root_path: "/tmp/my-app", created_at: "now" };

const PASSED_RUN = {
  id: "run1",
  project_id: "p1",
  framework: "vitest",
  command: "npm run test",
  exit_code: 0,
  duration_ms: 1234,
  passed: 10,
  failed: 0,
  skipped: 1,
  stdout_ref: "all good",
  stderr_ref: "",
  status: "passed" as const,
  reason: null,
  started_at: "2026-08-18T00:00:00.000Z",
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ProjectProvider>
        <TestsPage />
      </ProjectProvider>
    </MemoryRouter>
  );
}

describe("TestsPage", () => {
  beforeEach(() => {
    mockedApi.listProjects.mockReset();
    mockedApi.listTestRuns.mockReset();
    mockedApi.getTestRun.mockReset();
    mockedApi.runProjectTests.mockReset();
    window.localStorage.clear();
  });

  it("prompts to select a repository when none is selected", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [] });
    renderPage();
    expect(await screen.findByText(/No repository selected yet/)).toBeInTheDocument();
  });

  it("prompts to run tests when there's no history yet", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listTestRuns.mockResolvedValue({ runs: [] });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/No tests have been run yet/)).toBeInTheDocument();
    });
  });

  it("renders a passed run's summary and output toggle", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listTestRuns.mockResolvedValue({ runs: [PASSED_RUN] });
    mockedApi.getTestRun.mockResolvedValue({ run: PASSED_RUN });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("run-status")).toHaveTextContent("passed");
    });
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("npm run test")).toBeInTheDocument();

    expect(screen.queryByText("all good")).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Show output" }));
    expect(screen.getByText("all good")).toBeInTheDocument();
  });

  it("shows the unsupported reason instead of pass/fail counts", async () => {
    const unsupportedRun = {
      ...PASSED_RUN,
      id: "run2",
      status: "unsupported" as const,
      reason: "No test script defined in package.json",
      passed: 0,
      failed: 0,
      skipped: 0,
      framework: null,
      command: null,
    };
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listTestRuns.mockResolvedValue({ runs: [unsupportedRun] });
    mockedApi.getTestRun.mockResolvedValue({ run: unsupportedRun });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No test script defined in package.json")).toBeInTheDocument();
    });
  });

  it("runs tests and reloads history when the button is clicked", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listTestRuns.mockResolvedValue({ runs: [] });
    mockedApi.runProjectTests.mockResolvedValue({ run: PASSED_RUN, supported: true });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/No tests have been run yet/)).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Run Tests" }));

    expect(mockedApi.runProjectTests).toHaveBeenCalledWith("p1");
    expect(mockedApi.listTestRuns).toHaveBeenCalledTimes(2);
  });

  it("shows run history and lets you select an older run", async () => {
    const olderRun = { ...PASSED_RUN, id: "run0", passed: 3, started_at: "2026-08-17T00:00:00.000Z" };
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listTestRuns.mockResolvedValue({ runs: [PASSED_RUN, olderRun] });
    mockedApi.getTestRun.mockImplementation((_id: string, runId: string) =>
      Promise.resolve({ run: runId === "run0" ? olderRun : PASSED_RUN })
    );
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Run history")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText(/3 passed, 0 failed, 1 skipped/));

    await waitFor(() => {
      expect(mockedApi.getTestRun).toHaveBeenLastCalledWith("p1", "run0");
    });
  });
});
