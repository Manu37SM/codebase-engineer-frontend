import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import FindingsPage from "./Findings";
import { ProjectProvider } from "../context/ProjectContext";
import * as api from "../lib/api";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof api>("../lib/api");
  return {
    ...actual,
    listProjects: vi.fn(),
    listFindings: vi.fn(),
    runProjectAnalysis: vi.fn(),
    getFindingContext: vi.fn(),
    listAiProviders: vi.fn(),
    getFindingExplanation: vi.fn(),
    explainFinding: vi.fn(),
    getFindingRootCause: vi.fn(),
    analyzeRootCause: vi.fn(),
    getFindingFixPlan: vi.fn(),
    planFix: vi.fn(),
    listFindingPatches: vi.fn(),
    createPatch: vi.fn(),
    approvePatch: vi.fn(),
    rejectPatch: vi.fn(),
    generatePatch: vi.fn(),
    approvePatchApply: vi.fn(),
    rejectPatchApply: vi.fn(),
    applyPatch: vi.fn(),
    listFindingGeneratedTests: vi.fn(),
    createGeneratedTest: vi.fn(),
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
  listFindings: ReturnType<typeof vi.fn>;
  runProjectAnalysis: ReturnType<typeof vi.fn>;
  getFindingContext: ReturnType<typeof vi.fn>;
  listAiProviders: ReturnType<typeof vi.fn>;
  getFindingExplanation: ReturnType<typeof vi.fn>;
  explainFinding: ReturnType<typeof vi.fn>;
  getFindingRootCause: ReturnType<typeof vi.fn>;
  analyzeRootCause: ReturnType<typeof vi.fn>;
  getFindingFixPlan: ReturnType<typeof vi.fn>;
  planFix: ReturnType<typeof vi.fn>;
  listFindingPatches: ReturnType<typeof vi.fn>;
  createPatch: ReturnType<typeof vi.fn>;
  approvePatch: ReturnType<typeof vi.fn>;
  rejectPatch: ReturnType<typeof vi.fn>;
  generatePatch: ReturnType<typeof vi.fn>;
  approvePatchApply: ReturnType<typeof vi.fn>;
  rejectPatchApply: ReturnType<typeof vi.fn>;
  applyPatch: ReturnType<typeof vi.fn>;
  listFindingGeneratedTests: ReturnType<typeof vi.fn>;
  createGeneratedTest: ReturnType<typeof vi.fn>;
  approveGeneratedTest: ReturnType<typeof vi.fn>;
  rejectGeneratedTest: ReturnType<typeof vi.fn>;
  generateTest: ReturnType<typeof vi.fn>;
  approveGeneratedTestWrite: ReturnType<typeof vi.fn>;
  rejectGeneratedTestWrite: ReturnType<typeof vi.fn>;
  writeAndRunGeneratedTest: ReturnType<typeof vi.fn>;
};

const PROJECT = { id: "p1", name: "my-app", root_path: "/tmp/my-app", created_at: "now" };

const RUN = {
  id: "run1",
  project_id: "p1",
  started_at: "now",
  finished_at: "now",
  status: "completed",
  findings_count: 1,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ProjectProvider>
        <FindingsPage />
      </ProjectProvider>
    </MemoryRouter>
  );
}

describe("FindingsPage", () => {
  beforeEach(() => {
    mockedApi.listProjects.mockReset();
    mockedApi.listFindings.mockReset();
    mockedApi.runProjectAnalysis.mockReset();
    mockedApi.getFindingContext.mockReset();
    mockedApi.listAiProviders.mockReset();
    mockedApi.getFindingExplanation.mockReset();
    mockedApi.explainFinding.mockReset();
    mockedApi.getFindingRootCause.mockReset();
    mockedApi.analyzeRootCause.mockReset();
    mockedApi.getFindingFixPlan.mockReset();
    mockedApi.planFix.mockReset();
    mockedApi.listFindingPatches.mockReset();
    mockedApi.createPatch.mockReset();
    mockedApi.approvePatch.mockReset();
    mockedApi.rejectPatch.mockReset();
    mockedApi.generatePatch.mockReset();
    mockedApi.approvePatchApply.mockReset();
    mockedApi.rejectPatchApply.mockReset();
    mockedApi.applyPatch.mockReset();
    mockedApi.listFindingGeneratedTests.mockReset();
    mockedApi.createGeneratedTest.mockReset();
    mockedApi.approveGeneratedTest.mockReset();
    mockedApi.rejectGeneratedTest.mockReset();
    mockedApi.generateTest.mockReset();
    mockedApi.approveGeneratedTestWrite.mockReset();
    mockedApi.rejectGeneratedTestWrite.mockReset();
    mockedApi.writeAndRunGeneratedTest.mockReset();
    mockedApi.listAiProviders.mockResolvedValue({ providers: [] });
    window.localStorage.clear();
  });

  it("prompts to select a repository when none is selected", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [] });
    renderPage();
    expect(await screen.findByText(/No repository selected yet/)).toBeInTheDocument();
  });

  it("prompts to run analysis when it hasn't been run yet", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({ findings: [], total: 0, latestRun: null });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Analysis hasn't been run yet/)).toBeInTheDocument();
    });
  });

  it("shows a no-matches message when filters exclude all findings", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({ findings: [], total: 0, latestRun: RUN });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    expect(await screen.findByText(/No findings match the current filters/)).toBeInTheDocument();
  });

  it("renders a list of findings with severity badges", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({
      findings: [
        {
          id: "f1",
          project_id: "p1",
          rule_id: "large-file",
          severity: "high",
          category: "maintainability",
          file_path: "src/big.ts",
          line_start: 1,
          line_end: 900,
          evidence: "File has 900 lines",
          explanation: "Large files are harder to maintain.",
          recommendation: "Split it up.",
          source: "deterministic",
          created_at: "now",
        },
      ],
      total: 1,
      latestRun: RUN,
    });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();

    const item = (await screen.findByText("src/big.ts:1")).closest("li")!;
    expect(within(item).getByText("high")).toBeInTheDocument();
    expect(screen.getByText("File has 900 lines")).toBeInTheDocument();
    expect(screen.getByText(/Split it up\./)).toBeInTheDocument();
    expect(screen.getByText("1 findings")).toBeInTheDocument();
  });

  it("runs analysis and reloads findings when the button is clicked", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({ findings: [], total: 0, latestRun: null });
    mockedApi.runProjectAnalysis.mockResolvedValue({ run: RUN, findingsCount: 0 });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Analysis hasn't been run yet/)).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Run Analysis" }));

    expect(mockedApi.runProjectAnalysis).toHaveBeenCalledWith("p1");
    expect(mockedApi.listFindings).toHaveBeenCalledTimes(2);
  });

  it("filters by severity using the dropdown", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({ findings: [], total: 0, latestRun: RUN });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await screen.findByText(/No findings match the current filters/);

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Filter by severity"), "critical");

    expect(mockedApi.listFindings).toHaveBeenLastCalledWith("p1", {
      severity: "critical",
      category: undefined,
    });
  });

  it("previews the AI context bundle for a finding, then hides it again", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({
      findings: [
        {
          id: "f1",
          project_id: "p1",
          rule_id: "large-file",
          severity: "high",
          category: "maintainability",
          file_path: "src/big.ts",
          line_start: 1,
          line_end: 900,
          evidence: "File has 900 lines",
          explanation: "Large files are harder to maintain.",
          recommendation: "Split it up.",
          source: "deterministic",
          created_at: "now",
        },
      ],
      total: 1,
      latestRun: RUN,
    });
    mockedApi.getFindingContext.mockResolvedValue({
      targetId: "f1",
      budgetTokens: 4000,
      selected: [{ path: "src/big.ts", reason: "Directly affected file — where the finding was reported.", tokens: 120 }],
      excluded: [{ path: "src/other.ts", reason: "Excluded: needs ~50 tokens, 0 remaining in the budget." }],
      totalTokens: 120,
    });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await screen.findByText("src/big.ts:1");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Preview AI context" }));

    expect(mockedApi.getFindingContext).toHaveBeenCalledWith("p1", "f1");
    expect(await screen.findByText("120 / 4000 tokens used")).toBeInTheDocument();
    expect(screen.getByText(/needs ~50 tokens/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hide AI context preview" }));
    expect(screen.queryByText("120 / 4000 tokens used")).not.toBeInTheDocument();
  });

  const FINDING = {
    id: "f1",
    project_id: "p1",
    rule_id: "large-file",
    severity: "high" as const,
    category: "maintainability",
    file_path: "src/big.ts",
    line_start: 1,
    line_end: 900,
    evidence: "File has 900 lines",
    explanation: "Large files are harder to maintain.",
    recommendation: "Split it up.",
    source: "deterministic",
    created_at: "now",
  };

  it("disables 'Generate explanation' when no AI provider is enabled, with an explanatory message", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({ findings: [FINDING], total: 1, latestRun: RUN });
    mockedApi.listAiProviders.mockResolvedValue({ providers: [{ id: "p1", enabled: false }] });
    mockedApi.getFindingExplanation.mockResolvedValue({ explanation: null });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await screen.findByText("src/big.ts:1");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "AI explanation" }));

    expect(await screen.findByText("No AI explanation generated yet.")).toBeInTheDocument();
    const generateButton = screen.getByRole("button", { name: "Generate explanation" });
    expect(generateButton).toBeDisabled();
    expect(screen.getByText(/No AI provider is configured and enabled/)).toBeInTheDocument();
  });

  it("generates and displays an AI explanation when a provider is enabled", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({ findings: [FINDING], total: 1, latestRun: RUN });
    mockedApi.listAiProviders.mockResolvedValue({ providers: [{ id: "p1", enabled: true }] });
    mockedApi.getFindingExplanation.mockResolvedValue({ explanation: null });
    mockedApi.explainFinding.mockResolvedValue({
      explanation: "This file is too large, making it hard to review and test.",
      provider: "openai-compatible",
      model: "gpt-test",
      usage: { promptTokens: 100, completionTokens: 20 },
      contextBundle: { targetId: "f1", budgetTokens: 4000, selected: [], excluded: [], totalTokens: 0 },
    });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await screen.findByText("src/big.ts:1");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "AI explanation" }));
    await screen.findByText("No AI explanation generated yet.");

    await user.click(screen.getByRole("button", { name: "Generate explanation" }));

    expect(mockedApi.explainFinding).toHaveBeenCalledWith("p1", "f1");
    expect(
      await screen.findByText("This file is too large, making it hard to review and test.")
    ).toBeInTheDocument();
    expect(screen.getByText(/openai-compatible \/ gpt-test/)).toBeInTheDocument();
  });

  it("shows a previously-generated explanation without calling explainFinding again", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({ findings: [FINDING], total: 1, latestRun: RUN });
    mockedApi.listAiProviders.mockResolvedValue({ providers: [{ id: "p1", enabled: true }] });
    mockedApi.getFindingExplanation.mockResolvedValue({
      explanation: "Previously generated explanation.",
      provider: "openai-compatible",
      model: "gpt-test",
      generatedAt: "2026-08-18",
    });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await screen.findByText("src/big.ts:1");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "AI explanation" }));

    expect(await screen.findByText("Previously generated explanation.")).toBeInTheDocument();
    expect(mockedApi.explainFinding).not.toHaveBeenCalled();
  });

  it("disables 'Generate root-cause analysis' when no AI provider is enabled", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({ findings: [FINDING], total: 1, latestRun: RUN });
    mockedApi.listAiProviders.mockResolvedValue({ providers: [{ id: "p1", enabled: false }] });
    mockedApi.getFindingRootCause.mockResolvedValue({ analysis: null });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await screen.findByText("src/big.ts:1");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Root-cause analysis" }));

    expect(await screen.findByText("No AI root-cause analysis generated yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate root-cause analysis" })).toBeDisabled();
  });

  it("generates and displays a root-cause analysis with evidence and inference kept distinct", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({ findings: [FINDING], total: 1, latestRun: RUN });
    mockedApi.listAiProviders.mockResolvedValue({ providers: [{ id: "p1", enabled: true }] });
    mockedApi.getFindingRootCause.mockResolvedValue({ analysis: null });
    mockedApi.analyzeRootCause.mockResolvedValue({
      analysis: {
        evidence: ["File spans 900 lines"],
        inference: "The file accumulated responsibilities over time without being split up.",
        confidence: "medium",
        raw: "EVIDENCE:\n- File spans 900 lines\n\nINFERENCE:\nThe file accumulated responsibilities over time without being split up.\n\nCONFIDENCE: medium",
      },
      provider: "openai-compatible",
      model: "gpt-test",
      usage: { promptTokens: 80, completionTokens: 25 },
      contextBundle: { targetId: "f1", budgetTokens: 4000, selected: [], excluded: [], totalTokens: 0 },
    });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await screen.findByText("src/big.ts:1");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Root-cause analysis" }));
    await screen.findByText("No AI root-cause analysis generated yet.");

    await user.click(screen.getByRole("button", { name: "Generate root-cause analysis" }));

    expect(mockedApi.analyzeRootCause).toHaveBeenCalledWith("p1", "f1");
    expect(await screen.findByText("File spans 900 lines")).toBeInTheDocument();
    expect(
      screen.getByText("The file accumulated responsibilities over time without being split up.")
    ).toBeInTheDocument();
    expect(screen.getByText(/^Confidence:/)).toHaveTextContent("Confidence: medium");
  });

  it("shows raw response as a fallback when evidence/inference weren't parsed", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({ findings: [FINDING], total: 1, latestRun: RUN });
    mockedApi.listAiProviders.mockResolvedValue({ providers: [{ id: "p1", enabled: true }] });
    mockedApi.getFindingRootCause.mockResolvedValue({
      analysis: { evidence: null, inference: null, confidence: null, raw: "The model didn't follow the format." },
      provider: "openai-compatible",
      model: "gpt-test",
    });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await screen.findByText("src/big.ts:1");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Root-cause analysis" }));

    expect(
      await screen.findByText("Not reported in the expected format — see raw response below.")
    ).toBeInTheDocument();
    await user.click(screen.getByText("Raw response"));
    expect(screen.getByText("The model didn't follow the format.")).toBeInTheDocument();
  });

  const FULL_PLAN = {
    problem: "An API key is hardcoded in source.",
    rootCause: "A real credential was pasted during testing and never removed.",
    filesAffected: ["src/big.ts"],
    proposedChanges: "Move the key to an environment variable.",
    risks: "The app could fail to start if the env var is unset.",
    requiredTests: "Add a test for the missing-env-var startup failure.",
    validationStrategy: "A reviewer should confirm no secret remains in the diff.",
    raw: "PROBLEM:\n...",
  };

  it("disables 'Generate fix plan' when no AI provider is enabled", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({ findings: [FINDING], total: 1, latestRun: RUN });
    mockedApi.listAiProviders.mockResolvedValue({ providers: [{ id: "p1", enabled: false }] });
    mockedApi.getFindingFixPlan.mockResolvedValue({ plan: null });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await screen.findByText("src/big.ts:1");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Fix plan" }));

    expect(await screen.findByText("No AI fix plan generated yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate fix plan" })).toBeDisabled();
  });

  it("generates and displays a fix plan with all seven sections", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({ findings: [FINDING], total: 1, latestRun: RUN });
    mockedApi.listAiProviders.mockResolvedValue({ providers: [{ id: "p1", enabled: true }] });
    mockedApi.getFindingFixPlan.mockResolvedValue({ plan: null });
    mockedApi.planFix.mockResolvedValue({
      plan: FULL_PLAN,
      usedPriorRootCauseAnalysis: false,
      provider: "openai-compatible",
      model: "gpt-test",
      usage: { promptTokens: 60, completionTokens: 40 },
      contextBundle: { targetId: "f1", budgetTokens: 4000, selected: [], excluded: [], totalTokens: 0 },
    });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await screen.findByText("src/big.ts:1");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Fix plan" }));
    await screen.findByText("No AI fix plan generated yet.");

    await user.click(screen.getByRole("button", { name: "Generate fix plan" }));

    expect(mockedApi.planFix).toHaveBeenCalledWith("p1", "f1");
    expect(await screen.findByText("src/big.ts")).toBeInTheDocument();
    expect(screen.getByText("An API key is hardcoded in source.")).toBeInTheDocument();
    expect(screen.getByText("Move the key to an environment variable.")).toBeInTheDocument();
    expect(screen.getByText("A reviewer should confirm no secret remains in the diff.")).toBeInTheDocument();
  });

  it("shows a previously-generated fix plan without calling planFix again", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({ findings: [FINDING], total: 1, latestRun: RUN });
    mockedApi.listAiProviders.mockResolvedValue({ providers: [{ id: "p1", enabled: true }] });
    mockedApi.getFindingFixPlan.mockResolvedValue({
      plan: FULL_PLAN,
      provider: "openai-compatible",
      model: "gpt-test",
      generatedAt: "2026-08-18",
    });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await screen.findByText("src/big.ts:1");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Fix plan" }));

    expect(await screen.findByText("An API key is hardcoded in source.")).toBeInTheDocument();
    expect(mockedApi.planFix).not.toHaveBeenCalled();
  });

  const PATCH_PENDING = {
    id: "patch1",
    project_id: "p1",
    finding_id: "f1",
    description: "Move the key to an environment variable.",
    diff_text: null,
    status: "pending_approval",
    apply_error: null,
    created_at: "now",
  };

  it("shows an empty state and lets a user create a patch", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({ findings: [FINDING], total: 1, latestRun: RUN });
    mockedApi.listAiProviders.mockResolvedValue({ providers: [{ id: "p1", enabled: true }] });
    mockedApi.listFindingPatches.mockResolvedValue({ patches: [] });
    mockedApi.createPatch.mockResolvedValue({ patch: PATCH_PENDING });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await screen.findByText("src/big.ts:1");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Patches" }));

    expect(await screen.findByText("No patches created yet for this finding.")).toBeInTheDocument();

    mockedApi.listFindingPatches.mockResolvedValue({ patches: [PATCH_PENDING] });
    await user.click(screen.getByRole("button", { name: "Create patch (requires a fix plan)" }));

    expect(mockedApi.createPatch).toHaveBeenCalledWith("p1", "f1");
    expect(await screen.findByText(/Move the key to an environment variable\./)).toBeInTheDocument();
    expect(screen.getByText(/pending_approval/)).toBeInTheDocument();
  });

  it("approves a pending patch, then shows the 'Generate diff' action once approved", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({ findings: [FINDING], total: 1, latestRun: RUN });
    mockedApi.listAiProviders.mockResolvedValue({ providers: [{ id: "p1", enabled: true }] });
    mockedApi.listFindingPatches.mockResolvedValue({ patches: [PATCH_PENDING] });
    mockedApi.approvePatch.mockResolvedValue({ patch: { ...PATCH_PENDING, status: "approved" } });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await screen.findByText("src/big.ts:1");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Patches" }));
    await screen.findByRole("button", { name: "Approve for generation" });

    mockedApi.listFindingPatches.mockResolvedValue({ patches: [{ ...PATCH_PENDING, status: "approved" }] });
    await user.click(screen.getByRole("button", { name: "Approve for generation" }));

    expect(mockedApi.approvePatch).toHaveBeenCalledWith("p1", "patch1");
    expect(await screen.findByRole("button", { name: "Generate diff" })).toBeInTheDocument();
  });

  it("rejects a pending patch", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({ findings: [FINDING], total: 1, latestRun: RUN });
    mockedApi.listAiProviders.mockResolvedValue({ providers: [{ id: "p1", enabled: true }] });
    mockedApi.listFindingPatches.mockResolvedValue({ patches: [PATCH_PENDING] });
    mockedApi.rejectPatch.mockResolvedValue({ patch: { ...PATCH_PENDING, status: "rejected" } });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await screen.findByText("src/big.ts:1");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Patches" }));
    await screen.findByRole("button", { name: "Reject" });

    mockedApi.listFindingPatches.mockResolvedValue({ patches: [{ ...PATCH_PENDING, status: "rejected" }] });
    await user.click(screen.getByRole("button", { name: "Reject" }));

    expect(mockedApi.rejectPatch).toHaveBeenCalledWith("p1", "patch1");
    expect(await screen.findByText("Rejected before generation.")).toBeInTheDocument();
  });

  it("generates a diff for an approved patch and renders it", async () => {
    const APPROVED_PATCH = { ...PATCH_PENDING, status: "approved" };
    const GENERATED_PATCH = { ...APPROVED_PATCH, status: "proposed", diff_text: "--- a/src/big.ts\n+++ b/src/big.ts\n@@ -1 +1 @@\n-old\n+new\n" };
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({ findings: [FINDING], total: 1, latestRun: RUN });
    mockedApi.listAiProviders.mockResolvedValue({ providers: [{ id: "p1", enabled: true }] });
    mockedApi.listFindingPatches.mockResolvedValue({ patches: [APPROVED_PATCH] });
    mockedApi.generatePatch.mockResolvedValue({
      patch: GENERATED_PATCH,
      usedFixPlan: true,
      provider: "openai-compatible",
      model: "gpt-test",
      usage: { promptTokens: 80, completionTokens: 30 },
      contextBundle: { targetId: "f1", budgetTokens: 4000, selected: [], excluded: [], totalTokens: 0 },
    });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await screen.findByText("src/big.ts:1");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Patches" }));
    await screen.findByRole("button", { name: "Generate diff" });

    mockedApi.listFindingPatches.mockResolvedValue({ patches: [GENERATED_PATCH] });
    await user.click(screen.getByRole("button", { name: "Generate diff" }));

    expect(mockedApi.generatePatch).toHaveBeenCalledWith("p1", "patch1");
    expect(await screen.findByText(/--- a\/src\/big\.ts/)).toBeInTheDocument();
  });

  it("disables 'Generate diff' when no AI provider is enabled", async () => {
    const APPROVED_PATCH = { ...PATCH_PENDING, status: "approved" };
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({ findings: [FINDING], total: 1, latestRun: RUN });
    mockedApi.listAiProviders.mockResolvedValue({ providers: [{ id: "p1", enabled: false }] });
    mockedApi.listFindingPatches.mockResolvedValue({ patches: [APPROVED_PATCH] });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await screen.findByText("src/big.ts:1");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Patches" }));

    const generateButton = await screen.findByRole("button", { name: "Generate diff" });
    expect(generateButton).toBeDisabled();
    expect(screen.getAllByText(/No AI provider is configured and enabled/).length).toBeGreaterThan(0);
    expect(mockedApi.generatePatch).not.toHaveBeenCalled();
  });

  const PATCH_PROPOSED = {
    ...PATCH_PENDING,
    status: "proposed",
    diff_text: "--- a/src/big.ts\n+++ b/src/big.ts\n@@ -1 +1 @@\n-old\n+new\n",
    apply_error: null,
  };

  it("approves a diff for apply (the second gate), then shows the 'Apply patch' action", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({ findings: [FINDING], total: 1, latestRun: RUN });
    mockedApi.listAiProviders.mockResolvedValue({ providers: [{ id: "p1", enabled: true }] });
    mockedApi.listFindingPatches.mockResolvedValue({ patches: [PATCH_PROPOSED] });
    mockedApi.approvePatchApply.mockResolvedValue({ patch: { ...PATCH_PROPOSED, status: "approved_for_apply" } });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await screen.findByText("src/big.ts:1");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Patches" }));
    await screen.findByRole("button", { name: "Approve diff for apply" });

    mockedApi.listFindingPatches.mockResolvedValue({ patches: [{ ...PATCH_PROPOSED, status: "approved_for_apply" }] });
    await user.click(screen.getByRole("button", { name: "Approve diff for apply" }));

    expect(mockedApi.approvePatchApply).toHaveBeenCalledWith("p1", "patch1");
    expect(await screen.findByRole("button", { name: "Apply patch" })).toBeInTheDocument();
  });

  it("rejects a diff after review and never shows an apply action", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({ findings: [FINDING], total: 1, latestRun: RUN });
    mockedApi.listAiProviders.mockResolvedValue({ providers: [{ id: "p1", enabled: true }] });
    mockedApi.listFindingPatches.mockResolvedValue({ patches: [PATCH_PROPOSED] });
    mockedApi.rejectPatchApply.mockResolvedValue({ patch: { ...PATCH_PROPOSED, status: "rejected" } });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await screen.findByText("src/big.ts:1");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Patches" }));
    await screen.findByRole("button", { name: "Reject" });

    mockedApi.listFindingPatches.mockResolvedValue({ patches: [{ ...PATCH_PROPOSED, status: "rejected" }] });
    await user.click(screen.getByRole("button", { name: "Reject" }));

    expect(mockedApi.rejectPatchApply).toHaveBeenCalledWith("p1", "patch1");
    expect(await screen.findByText("Rejected before generation.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply patch" })).not.toBeInTheDocument();
  });

  it("applies an approved diff to disk and shows the success message", async () => {
    const APPROVED_FOR_APPLY = { ...PATCH_PROPOSED, status: "approved_for_apply" };
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({ findings: [FINDING], total: 1, latestRun: RUN });
    mockedApi.listAiProviders.mockResolvedValue({ providers: [{ id: "p1", enabled: true }] });
    mockedApi.listFindingPatches.mockResolvedValue({ patches: [APPROVED_FOR_APPLY] });
    mockedApi.applyPatch.mockResolvedValue({ patch: { ...APPROVED_FOR_APPLY, status: "applied" } });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await screen.findByText("src/big.ts:1");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Patches" }));
    await screen.findByRole("button", { name: "Apply patch" });

    mockedApi.listFindingPatches.mockResolvedValue({ patches: [{ ...APPROVED_FOR_APPLY, status: "applied" }] });
    await user.click(screen.getByRole("button", { name: "Apply patch" }));

    expect(mockedApi.applyPatch).toHaveBeenCalledWith("p1", "patch1");
    expect(await screen.findByText("Applied to disk.")).toBeInTheDocument();
  });

  it("shows a failed apply's real error and offers a retry that doesn't re-approve", async () => {
    const APPROVED_FOR_APPLY = { ...PATCH_PROPOSED, status: "approved_for_apply" };
    const FAILED_PATCH = { ...APPROVED_FOR_APPLY, status: "failed", apply_error: "error: patch does not apply" };
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({ findings: [FINDING], total: 1, latestRun: RUN });
    mockedApi.listAiProviders.mockResolvedValue({ providers: [{ id: "p1", enabled: true }] });
    mockedApi.listFindingPatches.mockResolvedValue({ patches: [APPROVED_FOR_APPLY] });
    mockedApi.applyPatch.mockResolvedValue({ patch: FAILED_PATCH });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await screen.findByText("src/big.ts:1");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Patches" }));
    await screen.findByRole("button", { name: "Apply patch" });

    mockedApi.listFindingPatches.mockResolvedValue({ patches: [FAILED_PATCH] });
    await user.click(screen.getByRole("button", { name: "Apply patch" }));

    expect(await screen.findByText(/Apply failed: error: patch does not apply/)).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: "Retry apply" });
    expect(retryButton).toBeInTheDocument();

    mockedApi.applyPatch.mockResolvedValue({ patch: { ...FAILED_PATCH, status: "applied", apply_error: null } });
    mockedApi.listFindingPatches.mockResolvedValue({ patches: [{ ...FAILED_PATCH, status: "applied", apply_error: null }] });
    await user.click(retryButton);

    expect(mockedApi.applyPatch).toHaveBeenLastCalledWith("p1", "patch1");
    expect(await screen.findByText("Applied to disk.")).toBeInTheDocument();
  });

  const GEN_TEST_PENDING = {
    id: "gt1",
    project_id: "p1",
    finding_id: "f1",
    target_path: null,
    description: "Cover the hardcoded secret finding.",
    test_code: null,
    status: "pending_approval",
    test_run_id: null,
    created_at: "now",
  };

  it("shows an empty state and lets a user create a generated test", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({ findings: [FINDING], total: 1, latestRun: RUN });
    mockedApi.listAiProviders.mockResolvedValue({ providers: [{ id: "p1", enabled: true }] });
    mockedApi.listFindingGeneratedTests.mockResolvedValue({ generatedTests: [] });
    mockedApi.createGeneratedTest.mockResolvedValue({ generatedTest: GEN_TEST_PENDING });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await screen.findByText("src/big.ts:1");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Generated tests" }));

    expect(await screen.findByText("No tests generated yet for this finding.")).toBeInTheDocument();

    mockedApi.listFindingGeneratedTests.mockResolvedValue({ generatedTests: [GEN_TEST_PENDING] });
    await user.click(screen.getByRole("button", { name: "Create generated test" }));

    expect(mockedApi.createGeneratedTest).toHaveBeenCalledWith("p1", "f1");
    expect(await screen.findByText(/Cover the hardcoded secret finding\./)).toBeInTheDocument();
    expect(screen.getByText(/pending_approval/)).toBeInTheDocument();
  });

  it("approves a pending generated test, then shows the 'Generate test' action", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({ findings: [FINDING], total: 1, latestRun: RUN });
    mockedApi.listAiProviders.mockResolvedValue({ providers: [{ id: "p1", enabled: true }] });
    mockedApi.listFindingGeneratedTests.mockResolvedValue({ generatedTests: [GEN_TEST_PENDING] });
    mockedApi.approveGeneratedTest.mockResolvedValue({ generatedTest: { ...GEN_TEST_PENDING, status: "approved" } });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await screen.findByText("src/big.ts:1");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Generated tests" }));
    await screen.findByRole("button", { name: "Approve for generation" });

    mockedApi.listFindingGeneratedTests.mockResolvedValue({ generatedTests: [{ ...GEN_TEST_PENDING, status: "approved" }] });
    await user.click(screen.getByRole("button", { name: "Approve for generation" }));

    expect(mockedApi.approveGeneratedTest).toHaveBeenCalledWith("p1", "gt1");
    expect(await screen.findByRole("button", { name: "Generate test" })).toBeInTheDocument();
  });

  const GEN_TEST_PROPOSED = {
    ...GEN_TEST_PENDING,
    status: "proposed",
    target_path: "src/big.test.ts",
    test_code: "describe('big', () => { it('works', () => { expect(true).toBe(true); }); });",
  };

  it("generates test code for an approved registration and renders it", async () => {
    const APPROVED = { ...GEN_TEST_PENDING, status: "approved" };
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({ findings: [FINDING], total: 1, latestRun: RUN });
    mockedApi.listAiProviders.mockResolvedValue({ providers: [{ id: "p1", enabled: true }] });
    mockedApi.listFindingGeneratedTests.mockResolvedValue({ generatedTests: [APPROVED] });
    mockedApi.generateTest.mockResolvedValue({
      generatedTest: GEN_TEST_PROPOSED,
      usedFixPlan: false,
      provider: "openai-compatible",
      model: "gpt-test",
      usage: { promptTokens: 80, completionTokens: 30 },
      contextBundle: { targetId: "f1", budgetTokens: 4000, selected: [], excluded: [], totalTokens: 0 },
    });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await screen.findByText("src/big.ts:1");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Generated tests" }));
    await screen.findByRole("button", { name: "Generate test" });

    mockedApi.listFindingGeneratedTests.mockResolvedValue({ generatedTests: [GEN_TEST_PROPOSED] });
    await user.click(screen.getByRole("button", { name: "Generate test" }));

    expect(mockedApi.generateTest).toHaveBeenCalledWith("p1", "gt1");
    expect(await screen.findByText(/describe\('big'/)).toBeInTheDocument();
    expect(screen.getByText("Target: src/big.test.ts")).toBeInTheDocument();
  });

  it("approves generated code for write (the second gate), then writes and runs it", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({ findings: [FINDING], total: 1, latestRun: RUN });
    mockedApi.listAiProviders.mockResolvedValue({ providers: [{ id: "p1", enabled: true }] });
    mockedApi.listFindingGeneratedTests.mockResolvedValue({ generatedTests: [GEN_TEST_PROPOSED] });
    mockedApi.approveGeneratedTestWrite.mockResolvedValue({ generatedTest: { ...GEN_TEST_PROPOSED, status: "approved_for_write" } });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await screen.findByText("src/big.ts:1");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Generated tests" }));
    await screen.findByRole("button", { name: "Approve test for write" });

    mockedApi.listFindingGeneratedTests.mockResolvedValue({ generatedTests: [{ ...GEN_TEST_PROPOSED, status: "approved_for_write" }] });
    await user.click(screen.getByRole("button", { name: "Approve test for write" }));

    expect(mockedApi.approveGeneratedTestWrite).toHaveBeenCalledWith("p1", "gt1");
    const writeButton = await screen.findByRole("button", { name: "Write and run" });

    const PASSED = { ...GEN_TEST_PROPOSED, status: "passed", test_run_id: "run1" };
    mockedApi.writeAndRunGeneratedTest.mockResolvedValue({
      generatedTest: PASSED,
      testRun: { id: "run1", project_id: "p1", framework: "vitest", command: "npm test", exit_code: 0, duration_ms: 10, passed: 1, failed: 0, skipped: 0, status: "passed", reason: null, started_at: "now" },
      supported: true,
    });
    mockedApi.listFindingGeneratedTests.mockResolvedValue({ generatedTests: [PASSED] });
    await user.click(writeButton);

    expect(mockedApi.writeAndRunGeneratedTest).toHaveBeenCalledWith("p1", "gt1");
    expect(await screen.findByText("Written and the project's real test suite passed.")).toBeInTheDocument();
  });

  it("rejects generated code after review and never shows a write action", async () => {
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({ findings: [FINDING], total: 1, latestRun: RUN });
    mockedApi.listAiProviders.mockResolvedValue({ providers: [{ id: "p1", enabled: true }] });
    mockedApi.listFindingGeneratedTests.mockResolvedValue({ generatedTests: [GEN_TEST_PROPOSED] });
    mockedApi.rejectGeneratedTestWrite.mockResolvedValue({ generatedTest: { ...GEN_TEST_PROPOSED, status: "rejected" } });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await screen.findByText("src/big.ts:1");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Generated tests" }));
    await screen.findByRole("button", { name: "Reject" });

    mockedApi.listFindingGeneratedTests.mockResolvedValue({ generatedTests: [{ ...GEN_TEST_PROPOSED, status: "rejected" }] });
    await user.click(screen.getByRole("button", { name: "Reject" }));

    expect(mockedApi.rejectGeneratedTestWrite).toHaveBeenCalledWith("p1", "gt1");
    expect(await screen.findByText("Rejected.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Write and run" })).not.toBeInTheDocument();
  });

  it("shows a failed test run and offers a re-run", async () => {
    const APPROVED_FOR_WRITE = { ...GEN_TEST_PROPOSED, status: "approved_for_write" };
    const FAILED = { ...GEN_TEST_PROPOSED, status: "failed_tests", test_run_id: "run2" };
    mockedApi.listProjects.mockResolvedValue({ projects: [PROJECT] });
    mockedApi.listFindings.mockResolvedValue({ findings: [FINDING], total: 1, latestRun: RUN });
    mockedApi.listAiProviders.mockResolvedValue({ providers: [{ id: "p1", enabled: true }] });
    mockedApi.listFindingGeneratedTests.mockResolvedValue({ generatedTests: [APPROVED_FOR_WRITE] });
    mockedApi.writeAndRunGeneratedTest.mockResolvedValue({
      generatedTest: FAILED,
      testRun: { id: "run2", project_id: "p1", framework: "vitest", command: "npm test", exit_code: 1, duration_ms: 10, passed: 0, failed: 1, skipped: 0, status: "failed", reason: null, started_at: "now" },
      supported: true,
    });
    window.localStorage.setItem("codebase-engineer.selectedProjectId", "p1");

    renderPage();
    await screen.findByText("src/big.ts:1");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Generated tests" }));
    await screen.findByRole("button", { name: "Write and run" });

    mockedApi.listFindingGeneratedTests.mockResolvedValue({ generatedTests: [FAILED] });
    await user.click(screen.getByRole("button", { name: "Write and run" }));

    expect(await screen.findByText("Written, but the project's real test suite failed.")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Re-run tests" })).toBeInTheDocument();
  });
});
