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
    listAiProviders: vi.fn(),
    diagnoseTestFailure: vi.fn(),
    getTestFailureDiagnosis: vi.fn(),
    deleteTestRun: vi.fn(),
    deleteAllTestRuns: vi.fn(),
    getBillingStatus: vi.fn(),
  };
});

const mockedApi = api as unknown as {
  listProjects: ReturnType<typeof vi.fn>;
  listTestRuns: ReturnType<typeof vi.fn>;
  getTestRun: ReturnType<typeof vi.fn>;
  runProjectTests: ReturnType<typeof vi.fn>;
  listAiProviders: ReturnType<typeof vi.fn>;
  diagnoseTestFailure: ReturnType<typeof vi.fn>;
  getTestFailureDiagnosis: ReturnType<typeof vi.fn>;
  deleteTestRun: ReturnType<typeof vi.fn>;
  deleteAllTestRuns: ReturnType<typeof vi.fn>;
  getBillingStatus: ReturnType<typeof vi.fn>;
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

const FAILED_RUN = {
  ...PASSED_RUN,
  id: "run-failed",
  exit_code: 1,
  passed: 8,
  failed: 2,
  stdout_ref: "FAIL src/a.test.ts",
  stderr_ref: "AssertionError: expected 3 but got -1",
  status: "failed" as const,
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
    mockedApi.listAiProviders.mockReset();
    mockedApi.listAiProviders.mockResolvedValue({ providers: [] });
    mockedApi.diagnoseTestFailure.mockReset();
    mockedApi.getTestFailureDiagnosis.mockReset();
    mockedApi.getTestFailureDiagnosis.mockResolvedValue({ diagnosis: null });
    mockedApi.deleteTestRun.mockReset();
    mockedApi.deleteAllTestRuns.mockReset();
    mockedApi.getBillingStatus.mockReset().mockResolvedValue({
      configured: true,
      tier: "free",
      limit: 50,
      used: 0,
      subscription: null,
    });
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

  it("does not show an AI diagnosis toggle for a passed run", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listTestRuns.mockResolvedValue({ runs: [PASSED_RUN] });
    mockedApi.getTestRun.mockResolvedValue({ run: PASSED_RUN });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("run-status")).toHaveTextContent("passed");
    });
    expect(screen.queryByRole("button", { name: "AI diagnosis" })).not.toBeInTheDocument();
  });

  it("shows a disabled 'Diagnose failure' button when no AI provider is enabled", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listTestRuns.mockResolvedValue({ runs: [FAILED_RUN] });
    mockedApi.getTestRun.mockResolvedValue({ run: FAILED_RUN });
    mockedApi.listAiProviders.mockResolvedValue({ providers: [{ id: "p1", name: "P", kind: "openai-compatible", enabled: false }] });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("run-status")).toHaveTextContent("failed");
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "AI diagnosis" }));

    await waitFor(() => {
      expect(screen.getByText("No AI diagnosis generated yet.")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Diagnose failure" })).toBeDisabled();
  });

  it("generates and displays an AI failure diagnosis for a failed run", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listTestRuns.mockResolvedValue({ runs: [FAILED_RUN] });
    mockedApi.getTestRun.mockResolvedValue({ run: FAILED_RUN });
    mockedApi.listAiProviders.mockResolvedValue({ providers: [{ id: "p1", name: "P", kind: "openai-compatible", enabled: true }] });
    mockedApi.diagnoseTestFailure.mockResolvedValue({
      diagnosis: {
        likelyCause: "add() subtracts instead of adding.",
        evidence: ["expected 3 but got -1"],
        suggestedDirection: "Fix the operator in add().",
        raw: "raw response",
      },
      provider: "openai-compatible",
      model: "gpt-test",
      usage: { promptTokens: 10, completionTokens: 5 },
      contextBundle: { targetId: "run-failed", budgetTokens: 4000, selected: [], excluded: [], totalTokens: 0 },
    });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("run-status")).toHaveTextContent("failed");
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "AI diagnosis" }));
    await waitFor(() => {
      expect(screen.getByText("No AI diagnosis generated yet.")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Diagnose failure" }));

    expect(mockedApi.diagnoseTestFailure).toHaveBeenCalledWith("p1", "run-failed");
    await waitFor(() => {
      expect(screen.getByText("add() subtracts instead of adding.")).toBeInTheDocument();
    });
    expect(screen.getByText("expected 3 but got -1")).toBeInTheDocument();
    expect(screen.getByText("Fix the operator in add().")).toBeInTheDocument();
  });

  it("shows a previously-generated diagnosis on toggle without a fresh generate call", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listTestRuns.mockResolvedValue({ runs: [FAILED_RUN] });
    mockedApi.getTestRun.mockResolvedValue({ run: FAILED_RUN });
    mockedApi.listAiProviders.mockResolvedValue({ providers: [{ id: "p1", name: "P", kind: "openai-compatible", enabled: true }] });
    mockedApi.getTestFailureDiagnosis.mockResolvedValue({
      diagnosis: {
        likelyCause: "Stored cause.",
        evidence: ["stored evidence"],
        suggestedDirection: "Stored direction.",
        raw: "stored raw",
      },
      provider: "openai-compatible",
      model: "gpt-test",
      generatedAt: "2026-08-18T00:00:00.000Z",
    });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("run-status")).toHaveTextContent("failed");
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "AI diagnosis" }));

    await waitFor(() => {
      expect(screen.getByText("Stored cause.")).toBeInTheDocument();
    });
    expect(mockedApi.diagnoseTestFailure).not.toHaveBeenCalled();
  });

  describe("deleting run history — user request: delete one run, and Pro-only delete all", () => {
    it("deletes a single run from the history after a confirm click, and reloads", async () => {
      mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
      mockedApi.listTestRuns
        .mockResolvedValueOnce({ runs: [PASSED_RUN, FAILED_RUN] })
        .mockResolvedValue({ runs: [FAILED_RUN] });
      mockedApi.getTestRun.mockResolvedValue({ run: PASSED_RUN });
      mockedApi.deleteTestRun.mockResolvedValue({ deleted: true });
      window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

      renderPage();
      await screen.findByText("Run history");

      const user = userEvent.setup();

      await user.click(screen.getAllByRole("button", { name: /Delete run from/ })[0]);
      await user.click(screen.getByRole("button", { name: "Confirm" }));

      expect(mockedApi.deleteTestRun).toHaveBeenCalledWith("p1", "run1");
      await waitFor(() => {
        expect(mockedApi.listTestRuns).toHaveBeenCalledTimes(2);
      });
    });

    it("Cancel on a single-run delete leaves the run untouched", async () => {
      mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
      mockedApi.listTestRuns.mockResolvedValue({ runs: [PASSED_RUN] });
      mockedApi.getTestRun.mockResolvedValue({ run: PASSED_RUN });
      window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

      renderPage();
      await screen.findByText("Run history");

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /Delete run from/ }));
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(mockedApi.deleteTestRun).not.toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();
    });

    it("does not show \"Delete all\" on the free tier", async () => {
      mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
      mockedApi.listTestRuns.mockResolvedValue({ runs: [PASSED_RUN] });
      mockedApi.getTestRun.mockResolvedValue({ run: PASSED_RUN });
      window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

      renderPage();
      await screen.findByText("Run history");

      expect(screen.queryByRole("button", { name: "Delete all" })).not.toBeInTheDocument();
    });

    it("Pro tier: \"Delete all\" confirms, deletes, and reloads an empty history", async () => {
      mockedApi.getBillingStatus.mockResolvedValue({
        configured: true,
        tier: "pro",
        limit: null,
        used: 5,
        subscription: { status: "active", currentPeriodEnd: null },
      });
      mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
      mockedApi.listTestRuns
        .mockResolvedValueOnce({ runs: [PASSED_RUN, FAILED_RUN] })
        .mockResolvedValue({ runs: [] });
      mockedApi.getTestRun.mockResolvedValue({ run: PASSED_RUN });
      mockedApi.deleteAllTestRuns.mockResolvedValue({ deleted: 2 });
      window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

      renderPage();
      const deleteAllButton = await screen.findByRole("button", { name: "Delete all" });

      const user = userEvent.setup();
      await user.click(deleteAllButton);
      await screen.findByText("Delete all run history?");

      const dialogButtons = screen.getAllByRole("button", { name: "Delete all" });
      await user.click(dialogButtons[dialogButtons.length - 1]);

      expect(mockedApi.deleteAllTestRuns).toHaveBeenCalledWith("p1");
      await waitFor(() => {
        expect(screen.getByText(/No tests have been run yet/)).toBeInTheDocument();
      });
    });
  });
});
