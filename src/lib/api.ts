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
  CheckoutSession,
  ChangesResult,
  AnalysisHistoryResult,
} from "./types";

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

    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Request to ${path} failed with status ${response.status}`;
    try {
      const body = await response.json();

      if (body?.message) message = body.message;
      else if (body?.error) message = body.error;
    } catch {

    }
    throw new ApiError(message, response.status);
  }

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

export function importProject(
  name: string,
  sourceType: "git" | "zip",
  sourceUrl: string
): Promise<{ project: Project }> {
  return request("/api/v1/projects/import", {
    method: "POST",
    body: JSON.stringify({ name, sourceType, sourceUrl }),
  });
}

export interface SubProjectCandidate {

  relativePath: string;
  markers: string[];
}

export interface MultiProjectDetectionResult {
  isMultiProject: boolean;
  candidates: SubProjectCandidate[];
  truncated: boolean;
}

export function detectSubProjects(projectId: string): Promise<MultiProjectDetectionResult> {
  return request(`/api/v1/projects/${projectId}/subprojects`);
}

export function registerSubProject(
  projectId: string,
  relativePath: string,
  name?: string
): Promise<{ project: Project }> {
  return request(`/api/v1/projects/${projectId}/subprojects/register`, {
    method: "POST",
    body: JSON.stringify({ relativePath, name }),
  });
}

export function getProject(
  id: string
): Promise<{ project: Project; latestSnapshot: RepositorySnapshot | null }> {
  return request(`/api/v1/projects/${id}`);
}

export function deleteProject(id: string): Promise<void> {
  return request(`/api/v1/projects/${id}`, { method: "DELETE" });
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

export function getAnalysisHistory(id: string): Promise<AnalysisHistoryResult> {
  return request(`/api/v1/projects/${id}/analysis/history`);
}

export function getFindingContext(id: string, findingId: string, budgetTokens?: number): Promise<ContextBundle> {
  const qs = budgetTokens !== undefined ? `?budgetTokens=${budgetTokens}` : "";
  return request(`/api/v1/projects/${id}/findings/${findingId}/context${qs}`);
}

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

export function getFindingExplanation(id: string, findingId: string): Promise<StoredExplanation> {
  return request(`/api/v1/projects/${id}/findings/${findingId}/explanation`);
}

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

export function getFindingRootCause(id: string, findingId: string): Promise<StoredRootCauseAnalysis> {
  return request(`/api/v1/projects/${id}/findings/${findingId}/root-cause`);
}

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

export function getFindingFixPlan(id: string, findingId: string): Promise<StoredFixPlan> {
  return request(`/api/v1/projects/${id}/findings/${findingId}/fix-plan`);
}

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

export interface BulkFixResult {
  attempted: number;
  succeeded: number;
  failed: number;

  skipped: number;
  results: Array<{ findingId?: string; patchId: string | null; error: string | null }>;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export function fixAllFindings(
  id: string,
  options?: { providerId?: string; budgetTokens?: number }
): Promise<BulkFixResult> {
  return request(`/api/v1/projects/${id}/findings/fix-all`, {
    method: "POST",
    body: JSON.stringify(options ?? {}),
  });
}

export function generateAllPatches(
  id: string,
  options?: { providerId?: string; budgetTokens?: number }
): Promise<BulkFixResult> {
  return request(`/api/v1/projects/${id}/patches/generate-all`, {
    method: "POST",
    body: JSON.stringify(options ?? {}),
  });
}

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

export interface BulkRejectResult {
  attempted: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: Array<{ patchId: string; error: string | null }>;
}

export function rejectAllPatches(id: string, reviewerNote?: string): Promise<BulkRejectResult> {
  return request(`/api/v1/projects/${id}/patches/reject-all`, {
    method: "POST",
    body: JSON.stringify(reviewerNote ? { reviewerNote } : {}),
  });
}

export function applyPatch(id: string, patchId: string): Promise<{ patch: PatchRecord }> {
  return request(`/api/v1/projects/${id}/patches/${patchId}/apply`, { method: "POST" });
}

export function updateProjectApplyMode(id: string, applyMode: "direct" | "download"): Promise<{ project: Project }> {
  return request(`/api/v1/projects/${id}/settings`, {
    method: "PATCH",
    body: JSON.stringify({ applyMode }),
  });
}

export function getPatchDownloadZipUrl(id: string, patchId: string): string {
  return `/api/v1/projects/${id}/patches/${patchId}/download-zip`;
}

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

export function getPatchSelfReview(id: string, patchId: string): Promise<StoredSelfReview> {
  return request(`/api/v1/projects/${id}/patches/${patchId}/self-review`);
}

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

export function deleteTestRun(id: string, runId: string): Promise<{ deleted: boolean }> {
  return request(`/api/v1/projects/${id}/tests/${runId}`, { method: "DELETE" });
}

export function deleteAllTestRuns(id: string): Promise<{ deleted: number }> {
  return request(`/api/v1/projects/${id}/tests`, { method: "DELETE" });
}

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

export function getTestFailureDiagnosis(id: string, runId: string): Promise<StoredFailureDiagnosis> {
  return request(`/api/v1/projects/${id}/tests/${runId}/diagnosis`);
}

export function getDependencies(id: string): Promise<DependencyAnalysisResult> {
  return request(`/api/v1/projects/${id}/dependencies`);
}

export function getAudit(id: string): Promise<AuditReport> {
  return request(`/api/v1/projects/${id}/audit`);
}

export function getAuditExportUrl(id: string): string {
  return `/api/v1/projects/${id}/audit/export`;
}

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

export function createBillingCheckout(): Promise<CheckoutSession> {
  return request("/api/v1/billing/checkout", { method: "POST" });
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;

  githubConnected: boolean;

  driveConnected: boolean;
}

export interface AuthMeResult {
  authRequired: boolean;
  user: AuthUser | null;
}

export function getCurrentUser(): Promise<AuthMeResult> {
  return request("/api/v1/auth/me");
}

export function registerAccount(input: {
  email: string;
  password: string;
  displayName?: string;
  turnstileToken?: string;
}): Promise<{ user: AuthUser }> {
  return request("/api/v1/auth/register", { method: "POST", body: JSON.stringify(input) });
}

export function login(input: {
  email: string;
  password: string;
  turnstileToken?: string;
}): Promise<{ user: AuthUser }> {
  return request("/api/v1/auth/login", { method: "POST", body: JSON.stringify(input) });
}

export function logout(): Promise<{ ok: boolean }> {
  return request("/api/v1/auth/logout", { method: "POST" });
}

export function getGoogleSignInUrl(): string {
  return "/api/v1/auth/google/start";
}
export function getGitHubSignInUrl(): string {
  return "/api/v1/auth/github/start";
}

export function getAuthProviders(): Promise<{ google: boolean; github: boolean }> {
  return request("/api/v1/auth/providers");
}

export interface GitHubRepoSummary {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
  description: string | null;
  defaultBranch: string;
  updatedAt: string;
  fork: boolean;
}

export function listGitHubRepos(): Promise<{ repos: GitHubRepoSummary[]; truncated: boolean }> {
  return request("/api/v1/github/repos");
}

export function importGitHubRepo(fullName: string, name?: string): Promise<{ project: Project }> {
  return request("/api/v1/github/import", {
    method: "POST",
    body: JSON.stringify({ fullName, name }),
  });
}

export interface DriveFileSummary {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size: string | null;
}

export function listDriveZipFiles(): Promise<{ files: DriveFileSummary[]; truncated: boolean }> {
  return request("/api/v1/google-drive/zips");
}

export function importDriveZipFile(fileId: string, name?: string): Promise<{ project: Project }> {
  return request("/api/v1/google-drive/import", {
    method: "POST",
    body: JSON.stringify({ fileId, name }),
  });
}
