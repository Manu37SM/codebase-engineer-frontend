import type {
  AIModelInfo,
  AIProviderConfig,
  AIProviderStatus,
  AnalysisRun,
  ArchitectureView,
  AuditReport,
  ContextBundle,
  DependencyAnalysisResult,
  ExplainFindingResult,
  FailureDiagnosisResult,
  FixPlanResult,
  GeneratePatchResult,
  GeneratedTestRecord,
  GenerateTestResult,
  PatchRecord,
  RootCauseAnalysisResult,
  SelfReviewResult,
  WriteAndRunTestResult,
  StoredExplanation,
  StoredFailureDiagnosis,
  StoredFixPlan,
  StoredRootCauseAnalysis,
  StoredSelfReview,
  DiscoveryResult,
  FileRecord,
  FindingRecord,
  GitAnalysisResult,
  IndexSummary,
  Project,
  RepositorySnapshot,
  TestRunRecord,
  BillingStatus,
  CheckoutOrder,
  ChangesResult,
  AnalysisHistoryResult,
} from "./types";

/**
 * Thin typed fetch wrapper around the backend API. Requests are relative
 * (`/api/v1/...`) so they work both via the Vite dev proxy (see
 * vite.config.ts) and once frontend+backend are served together in a
 * packaged build (Phase 24).
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    // Only attach Content-Type: application/json when there's an actual
    // body to describe. A bodyless GET/DELETE that still carries this
    // header can end up with an empty-string body once it passes through
    // some proxy layers (e.g. Vite's dev proxy, which can add
    // `Content-Length: 0`) — Fastify's default JSON body parser treats
    // Content-Type: application/json + a zero-length body as an error
    // (`FST_ERR_CTP_EMPTY_JSON_BODY`, a real 400 "Bad Request" this app
    // hit in practice on every GET, since app.inject()-based tests don't
    // go through a real HTTP proxy and never exercised this path).
    // Omitting the header on bodyless requests avoids the ambiguity
    // entirely, regardless of which layer would have added the
    // zero-length Content-Length.
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Request to ${path} failed with status ${response.status}`;
    try {
      const body = await response.json();
      // Prefer `message` (the specific detail) over `error` — Fastify's
      // own framework-level errors (as opposed to this app's own routes)
      // put a generic HTTP reason phrase like "Bad Request" in `error`
      // and the actually useful text in `message`; this app's own routes
      // only ever set `error`, so falling back to it keeps those intact.
      if (body?.message) message = body.message;
      else if (body?.error) message = body.error;
    } catch {
      // response body wasn't JSON — keep the generic message
    }
    throw new ApiError(message, response.status);
  }

  // 204 No Content (e.g. DELETE) has no body to parse.
  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

export function listProjects(): Promise<{ projects: Project[] }> {
  return request("/api/v1/projects");
}

export function createProject(name: string, rootPath: string): Promise<{ project: Project }> {
  return request("/api/v1/projects", {
    method: "POST",
    body: JSON.stringify({ name, rootPath }),
  });
}

export function getProject(
  id: string
): Promise<{ project: Project; latestSnapshot: RepositorySnapshot | null }> {
  return request(`/api/v1/projects/${id}`);
}

export function discoverProject(
  id: string
): Promise<{ snapshot: RepositorySnapshot; result: DiscoveryResult }> {
  return request(`/api/v1/projects/${id}/discover`, { method: "POST" });
}

export function indexProject(id: string): Promise<IndexSummary> {
  return request(`/api/v1/projects/${id}/index`, { method: "POST" });
}

export function listFiles(
  id: string,
  params?: { language?: string; isTest?: boolean; limit?: number; offset?: number }
): Promise<{ files: FileRecord[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.language) query.set("language", params.language);
  if (params?.isTest !== undefined) query.set("isTest", String(params.isTest));
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  if (params?.offset !== undefined) query.set("offset", String(params.offset));
  const qs = query.toString();
  return request(`/api/v1/projects/${id}/files${qs ? `?${qs}` : ""}`);
}

export function getArchitecture(id: string, depth = 2): Promise<ArchitectureView> {
  return request(`/api/v1/projects/${id}/architecture?depth=${depth}`);
}

export function runProjectAnalysis(
  id: string
): Promise<{ run: AnalysisRun; findingsCount: number }> {
  return request(`/api/v1/projects/${id}/analysis`, { method: "POST" });
}

export function listFindings(
  id: string,
  params?: { severity?: string; category?: string; limit?: number; offset?: number }
): Promise<{ findings: FindingRecord[]; total: number; latestRun: AnalysisRun | null }> {
  const query = new URLSearchParams();
  if (params?.severity) query.set("severity", params.severity);
  if (params?.category) query.set("category", params.category);
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  if (params?.offset !== undefined) query.set("offset", String(params.offset));
  const qs = query.toString();
  return request(`/api/v1/projects/${id}/findings${qs ? `?${qs}` : ""}`);
}

/** Real analysis-run history (oldest first), behind the Dashboard's findings-trend chart. */
export function getAnalysisHistory(id: string): Promise<AnalysisHistoryResult> {
  return request(`/api/v1/projects/${id}/analysis/history`);
}

/**
 * Fetches the `ContextBundle` an AI provider would receive for a single
 * finding (Phase 13). Nothing consumes this yet — Phase 14 will pass it to
 * `AIProvider.complete()` — this is a preview only, so people can see
 * exactly what would be sent and why anything was left out, before any
 * AI feature exists that actually sends it anywhere.
 */
export function getFindingContext(id: string, findingId: string, budgetTokens?: number): Promise<ContextBundle> {
  const qs = budgetTokens !== undefined ? `?budgetTokens=${budgetTokens}` : "";
  return request(`/api/v1/projects/${id}/findings/${findingId}/context${qs}`);
}

/**
 * Phase 14's first real AI call: asks the configured (enabled) provider to
 * explain a finding, using the Phase 13 context bundle as grounding
 * content. Only fires on an explicit call from a button click — never
 * automatically — per docs/AI_MODE.md §1's "no AI action auto-executes"
 * rule.
 */
export function explainFinding(
  id: string,
  findingId: string,
  options?: { providerId?: string; budgetTokens?: number }
): Promise<ExplainFindingResult> {
  return request(`/api/v1/projects/${id}/findings/${findingId}/explain`, {
    method: "POST",
    body: JSON.stringify(options ?? {}),
  });
}

/** Read-only: the most recent successful explanation on file, if any — never calls a provider. */
export function getFindingExplanation(id: string, findingId: string): Promise<StoredExplanation> {
  return request(`/api/v1/projects/${id}/findings/${findingId}/explanation`);
}

/**
 * Phase 15's AI call: asks the configured provider to separate evidence
 * from inference for a finding. Only fires on an explicit call — never
 * automatically.
 */
export function analyzeRootCause(
  id: string,
  findingId: string,
  options?: { providerId?: string; budgetTokens?: number }
): Promise<RootCauseAnalysisResult> {
  return request(`/api/v1/projects/${id}/findings/${findingId}/root-cause`, {
    method: "POST",
    body: JSON.stringify(options ?? {}),
  });
}

/** Read-only: the most recent successful root-cause analysis on file, if any — never calls a provider. */
export function getFindingRootCause(id: string, findingId: string): Promise<StoredRootCauseAnalysis> {
  return request(`/api/v1/projects/${id}/findings/${findingId}/root-cause`);
}

/**
 * Phase 16's AI call: asks the configured provider for the seven-section
 * fix plan docs/AI_MODE.md §5 defines. Advisory only — never fires
 * automatically, and produces no diff or applied change.
 */
export function planFix(
  id: string,
  findingId: string,
  options?: { providerId?: string; budgetTokens?: number }
): Promise<FixPlanResult> {
  return request(`/api/v1/projects/${id}/findings/${findingId}/fix-plan`, {
    method: "POST",
    body: JSON.stringify(options ?? {}),
  });
}

/** Read-only: the most recent successful fix plan on file, if any — never calls a provider. */
export function getFindingFixPlan(id: string, findingId: string): Promise<StoredFixPlan> {
  return request(`/api/v1/projects/${id}/findings/${findingId}/fix-plan`);
}

// AI Mode — Patch Generation (Phase 17). Creating a patch never calls a
// provider — it only registers intent, in 'pending_approval'. Approving
// is the first human-approval gate; generating is the only call that
// actually spends tokens, and only works once approved (enforced
// server-side, not just by this client hiding the button).

export function listFindingPatches(id: string, findingId: string): Promise<{ patches: PatchRecord[] }> {
  return request(`/api/v1/projects/${id}/findings/${findingId}/patches`);
}

export function createPatch(id: string, findingId: string, description?: string): Promise<{ patch: PatchRecord }> {
  return request(`/api/v1/projects/${id}/findings/${findingId}/patches`, {
    method: "POST",
    body: JSON.stringify(description ? { description } : {}),
  });
}

export function approvePatch(id: string, patchId: string, reviewerNote?: string): Promise<{ patch: PatchRecord }> {
  return request(`/api/v1/projects/${id}/patches/${patchId}/approve`, {
    method: "POST",
    body: JSON.stringify(reviewerNote ? { reviewerNote } : {}),
  });
}

export function rejectPatch(id: string, patchId: string, reviewerNote?: string): Promise<{ patch: PatchRecord }> {
  return request(`/api/v1/projects/${id}/patches/${patchId}/reject`, {
    method: "POST",
    body: JSON.stringify(reviewerNote ? { reviewerNote } : {}),
  });
}

export function generatePatch(
  id: string,
  patchId: string,
  options?: { providerId?: string; budgetTokens?: number }
): Promise<GeneratePatchResult> {
  return request(`/api/v1/projects/${id}/patches/${patchId}/generate`, {
    method: "POST",
    body: JSON.stringify(options ?? {}),
  });
}

// AI Mode — Diff Review & Apply (Phase 18). The second human-approval
// gate: a generated diff must be reviewed and approved again — separately
// from approving that generation should happen at all — before /apply
// will touch any file. /apply is the only call in this product that
// writes to disk, and only works once approved (enforced server-side).

export function approvePatchApply(id: string, patchId: string, reviewerNote?: string): Promise<{ patch: PatchRecord }> {
  return request(`/api/v1/projects/${id}/patches/${patchId}/approve-apply`, {
    method: "POST",
    body: JSON.stringify(reviewerNote ? { reviewerNote } : {}),
  });
}

export function rejectPatchApply(id: string, patchId: string, reviewerNote?: string): Promise<{ patch: PatchRecord }> {
  return request(`/api/v1/projects/${id}/patches/${patchId}/reject-apply`, {
    method: "POST",
    body: JSON.stringify(reviewerNote ? { reviewerNote } : {}),
  });
}

export function applyPatch(id: string, patchId: string): Promise<{ patch: PatchRecord }> {
  return request(`/api/v1/projects/${id}/patches/${patchId}/apply`, { method: "POST" });
}

// AI Mode — Self-Review (Phase 21). docs/AI_MODE.md §6's checklist,
// advisory only — never changes a patch's status and is never a
// precondition for approve-apply/apply. Can be requested at any point
// once the patch has a real diff.

export function selfReviewPatch(
  id: string,
  patchId: string,
  options?: { providerId?: string; budgetTokens?: number }
): Promise<SelfReviewResult> {
  return request(`/api/v1/projects/${id}/patches/${patchId}/self-review`, {
    method: "POST",
    body: JSON.stringify(options ?? {}),
  });
}

/** Read-only: the most recent successful self-review on file for a patch, if any — never calls a provider. */
export function getPatchSelfReview(id: string, patchId: string): Promise<StoredSelfReview> {
  return request(`/api/v1/projects/${id}/patches/${patchId}/self-review`);
}

// AI Mode — AI Test Generation (Phase 19). Mirrors the patch lifecycle's
// two gates: creating never calls a provider, generating never writes a
// file, and write-and-run always executes the project's real test
// command after writing — the "reviewed & executed" half of
// docs/AI_MODE.md §1's requirement, enforced server-side.

export function listFindingGeneratedTests(id: string, findingId: string): Promise<{ generatedTests: GeneratedTestRecord[] }> {
  return request(`/api/v1/projects/${id}/findings/${findingId}/generated-tests`);
}

export function createGeneratedTest(id: string, findingId: string, description?: string): Promise<{ generatedTest: GeneratedTestRecord }> {
  return request(`/api/v1/projects/${id}/findings/${findingId}/generated-tests`, {
    method: "POST",
    body: JSON.stringify(description ? { description } : {}),
  });
}

export function approveGeneratedTest(id: string, testId: string, reviewerNote?: string): Promise<{ generatedTest: GeneratedTestRecord }> {
  return request(`/api/v1/projects/${id}/generated-tests/${testId}/approve`, {
    method: "POST",
    body: JSON.stringify(reviewerNote ? { reviewerNote } : {}),
  });
}

export function rejectGeneratedTest(id: string, testId: string, reviewerNote?: string): Promise<{ generatedTest: GeneratedTestRecord }> {
  return request(`/api/v1/projects/${id}/generated-tests/${testId}/reject`, {
    method: "POST",
    body: JSON.stringify(reviewerNote ? { reviewerNote } : {}),
  });
}

export function generateTest(
  id: string,
  testId: string,
  options?: { providerId?: string; budgetTokens?: number }
): Promise<GenerateTestResult> {
  return request(`/api/v1/projects/${id}/generated-tests/${testId}/generate`, {
    method: "POST",
    body: JSON.stringify(options ?? {}),
  });
}

export function approveGeneratedTestWrite(id: string, testId: string, reviewerNote?: string): Promise<{ generatedTest: GeneratedTestRecord }> {
  return request(`/api/v1/projects/${id}/generated-tests/${testId}/approve-write`, {
    method: "POST",
    body: JSON.stringify(reviewerNote ? { reviewerNote } : {}),
  });
}

export function rejectGeneratedTestWrite(id: string, testId: string, reviewerNote?: string): Promise<{ generatedTest: GeneratedTestRecord }> {
  return request(`/api/v1/projects/${id}/generated-tests/${testId}/reject-write`, {
    method: "POST",
    body: JSON.stringify(reviewerNote ? { reviewerNote } : {}),
  });
}

export function writeAndRunGeneratedTest(id: string, testId: string): Promise<WriteAndRunTestResult> {
  return request(`/api/v1/projects/${id}/generated-tests/${testId}/write-and-run`, { method: "POST" });
}

// Changes page (unified review queue) — every patch and generated test for
// the whole project in one call, regardless of which finding produced it.
// Taking action on any listed item still goes through the existing
// per-item approve/reject/generate/apply/write-and-run functions above —
// this is read-only, just a different way of listing the same rows.
export function listChanges(id: string): Promise<ChangesResult> {
  return request(`/api/v1/projects/${id}/changes`);
}

export function getGitAnalysis(
  id: string,
  params?: { commitLimit?: number; churnDays?: number }
): Promise<GitAnalysisResult> {
  const query = new URLSearchParams();
  if (params?.commitLimit !== undefined) query.set("commitLimit", String(params.commitLimit));
  if (params?.churnDays !== undefined) query.set("churnDays", String(params.churnDays));
  const qs = query.toString();
  return request(`/api/v1/projects/${id}/git${qs ? `?${qs}` : ""}`);
}

export function runProjectTests(
  id: string
): Promise<{ run: TestRunRecord; supported: boolean; reason?: string }> {
  return request(`/api/v1/projects/${id}/tests/run`, { method: "POST" });
}

export function listTestRuns(id: string, limit?: number): Promise<{ runs: TestRunRecord[] }> {
  const qs = limit !== undefined ? `?limit=${limit}` : "";
  return request(`/api/v1/projects/${id}/tests${qs}`);
}

export function getTestRun(id: string, runId: string): Promise<{ run: TestRunRecord }> {
  return request(`/api/v1/projects/${id}/tests/${runId}`);
}

/**
 * Phase 20's AI call: docs/AI_MODE.md §4's "(if failure) AI Diagnosis"
 * step, for a failed TestRun. Only fires on an explicit call — never
 * automatically — and only succeeds server-side for a run whose status
 * is `failed`.
 */
export function diagnoseTestFailure(
  id: string,
  runId: string,
  options?: { providerId?: string; budgetTokens?: number }
): Promise<FailureDiagnosisResult> {
  return request(`/api/v1/projects/${id}/tests/${runId}/diagnose`, {
    method: "POST",
    body: JSON.stringify(options ?? {}),
  });
}

/** Read-only: the most recent successful failure diagnosis on file for a test run, if any — never calls a provider. */
export function getTestFailureDiagnosis(id: string, runId: string): Promise<StoredFailureDiagnosis> {
  return request(`/api/v1/projects/${id}/tests/${runId}/diagnosis`);
}

export function getDependencies(id: string): Promise<DependencyAnalysisResult> {
  return request(`/api/v1/projects/${id}/dependencies`);
}

export function getAudit(id: string): Promise<AuditReport> {
  return request(`/api/v1/projects/${id}/audit`);
}

/**
 * Relative path (not a `request()` call) — this is a file download, so the
 * caller renders it as a plain `<a href>` and lets the browser handle the
 * `Content-Disposition: attachment` response rather than fetching JSON.
 */
export function getAuditExportUrl(id: string): string {
  return `/api/v1/projects/${id}/audit/export`;
}

// AI Mode — provider configuration (Phase 12). Not project-scoped: a
// provider is configured once and can be used across every project.

export function listAiProviders(): Promise<{ providers: AIProviderConfig[] }> {
  return request("/api/v1/ai/providers");
}

export function createAiProvider(input: {
  name: string;
  kind: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
}): Promise<{ provider: AIProviderConfig }> {
  return request("/api/v1/ai/providers", { method: "POST", body: JSON.stringify(input) });
}

export function updateAiProvider(
  id: string,
  input: { name?: string; baseUrl?: string | null; model?: string | null; apiKey?: string | null; enabled?: boolean }
): Promise<{ provider: AIProviderConfig }> {
  return request(`/api/v1/ai/providers/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteAiProvider(id: string): Promise<void> {
  return request(`/api/v1/ai/providers/${id}`, { method: "DELETE" });
}

export function checkAiProviderStatus(id: string): Promise<AIProviderStatus> {
  return request(`/api/v1/ai/providers/${id}/check-status`, { method: "POST" });
}

export function listAiProviderModels(id: string): Promise<{ models: AIModelInfo[] }> {
  return request(`/api/v1/ai/providers/${id}/models`);
}

export function getBillingStatus(): Promise<BillingStatus> {
  return request("/api/v1/billing/status");
}

export function createBillingCheckout(): Promise<CheckoutOrder> {
  return request("/api/v1/billing/checkout", { method: "POST" });
}
