import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ChangesPage from "./Changes";
import { ProjectProvider } from "../context/ProjectContext";
import * as api from "../lib/api";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof api>("../lib/api");
  return {
    ...actual,
    listProjects: vi.fn(),
    listChanges: vi.fn(),
    approvePatch: vi.fn(),
    rejectPatch: vi.fn(),
    generatePatch: vi.fn(),
    approvePatchApply: vi.fn(),
    rejectPatchApply: vi.fn(),
    applyPatch: vi.fn(),
    approveGeneratedTest: vi.fn(),
    rejectGeneratedTest: vi.fn(),
    generateTest: vi.fn(),
    approveGeneratedTestWrite: vi.fn(),
    rejectGeneratedTestWrite: vi.fn(),
    writeAndRunGeneratedTest: vi.fn(),
  };
});

const mockedApi = api as unknown as {
  listProjects: ReturnType<typeof vi.fn>;
  listChanges: ReturnType<typeof vi.fn>;
  approvePatch: ReturnType<typeof vi.fn>;
  rejectPatch: ReturnType<typeof vi.fn>;
  generatePatch: ReturnType<typeof vi.fn>;
  applyPatch: ReturnType<typeof vi.fn>;
  approveGeneratedTest: ReturnType<typeof vi.fn>;
};

const PROJECT = { id: "p1", name: "my-app", root_path: "/tmp/my-app", created_at: "now" };

const PENDING_PATCH = {
  id: "patch1",
  project_id: "p1",
  finding_id: "f1",
  description: "Hardcoded secret.",
  diff_text: null,
  status: "pending_approval",
  apply_error: null,
  created_at: "2026-08-18T00:00:00.000Z",
  findingRuleId: "hardcoded-secret",
  findingFilePath: "src/config.ts",
  findingSeverity: "high",
};

const PROPOSED_PATCH = {
  ...PENDING_PATCH,
  id: "patch2",
  status: "proposed",
  diff_text: "--- a/src/config.ts\n+++ b/src/config.ts\n",
};

const PENDING_TEST = {
  id: "test1",
  project_id: "p1",
  finding_id: "f1",
  target_path: null,
  description: "Regression test",
  test_code: null,
  status: "pending_approval",
  test_run_id: null,
  created_at: "2026-08-18T00:00:00.000Z",
  findingRuleId: "hardcoded-secret",
  findingFilePath: "src/config.ts",
  findingSeverity: "high",
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ProjectProvider>
        <ChangesPage />
      </ProjectProvider>
    </MemoryRouter>
  );
}

describe("ChangesPage", () => {
  beforeEach(() => {
    mockedApi.listProjects.mockReset();
    mockedApi.listChanges.mockReset();
    mockedApi.approvePatch.mockReset();
    mockedApi.rejectPatch.mockReset();
    mockedApi.generatePatch.mockReset();
    mockedApi.applyPatch.mockReset();
    mockedApi.approveGeneratedTest.mockReset();
    window.localStorage.clear();
  });

  it("prompts to select a repository when none is selected", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [] });
    renderPage();
    expect(await screen.findByText(/No repository selected yet/)).toBeInTheDocument();
  });

  it("shows an empty state when there is nothing pending", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listChanges.mockResolvedValue({ patches: [], generatedTests: [] });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Nothing waiting on review right now/)).toBeInTheDocument();
    });
  });

  it("lists pending patches across findings, with finding context, and a pending count badge", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listChanges.mockResolvedValue({ patches: [PENDING_PATCH], generatedTests: [] });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Hardcoded secret\./)).toBeInTheDocument();
    });
    expect(screen.getByText(/hardcoded-secret/)).toBeInTheDocument();
    expect(screen.getByText(/src\/config\.ts/)).toBeInTheDocument();
    expect(screen.getByText("1 pending")).toBeInTheDocument();
  });

  it("approves a pending patch and reloads the queue", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listChanges
      .mockResolvedValueOnce({ patches: [PENDING_PATCH], generatedTests: [] })
      .mockResolvedValueOnce({ patches: [{ ...PENDING_PATCH, status: "approved" }], generatedTests: [] });
    mockedApi.approvePatch.mockResolvedValue({ patch: { ...PENDING_PATCH, status: "approved" } });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await waitFor(() => expect(screen.getByText(/Hardcoded secret\./)).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Approve for generation" }));

    await waitFor(() => expect(mockedApi.approvePatch).toHaveBeenCalledWith("p1", "patch1"));
    await waitFor(() => expect(mockedApi.listChanges).toHaveBeenCalledTimes(2));
  });

  it("shows a proposed patch's diff and an apply-review gate", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listChanges.mockResolvedValue({ patches: [PROPOSED_PATCH], generatedTests: [] });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/--- a\/src\/config\.ts/)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Approve diff for apply" })).toBeInTheDocument();
  });

  it("switches to the generated tests tab and lists pending tests", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listChanges.mockResolvedValue({ patches: [], generatedTests: [PENDING_TEST] });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await waitFor(() => expect(screen.getByText(/Generated tests \(1\)/)).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Generated tests \(1\)/ }));

    expect(await screen.findByText(/Regression test/)).toBeInTheDocument();
  });
});
