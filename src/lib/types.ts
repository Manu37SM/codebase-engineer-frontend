export interface Project {
  id: string;
  name: string;
  root_path: string;
  created_at: string;
  /** Task #90: whether AI-Mode's "apply" writes an approved patch straight to disk ("direct", the default) or refuses in favor of a zip download ("download"). */
  apply_mode: "direct" | "download";
}

export interface WorkingTreeStatus {
  modified: number;
  staged: number;
  untracked: number;
  clean: boolean;
}

export interface LanguageStat {
  language: string;
  fileCount: number;
  approxLoc: number;
}

export interface RepositorySnapshot {
  id: string;
  project_id: string;
  languages: string; // JSON-encoded LanguageStat[]
  frameworks: string; // JSON-encoded string[]
  build_system: string; // JSON-encoded string[]
  package_managers: string; // JSON-encoded string[]
  git_branch: string | null;
  working_tree_status: string; // JSON-encoded WorkingTreeStatus | null
  indexed_at: string;
}

export interface DiscoveryResult {
  root: string;
  isGitRepository: boolean;
  gitBranch: string | null;
  workingTreeStatus: WorkingTreeStatus | null;
  languages: LanguageStat[];
  totalFiles: number;
  otherFiles: number;
  buildSystems: string[];
  packageManagers: string[];
  frameworks: string[];
  dependencyManifests: string[];
  discoveredAt: string;
}

export interface IndexSummary {
  totalFiles: number;
  testFiles: number;
  generatedFiles: number;
  indexedAt: string;
}

export interface FileRecord {
  id: string;
  project_id: string;
  relative_path: string;
  language: string | null;
  loc: number | null;
  size_bytes: number;
  is_test: number;
  is_generated: number;
  content_hash: string | null;
  imports: string[];
}

export interface ModuleNode {
  id: string;
  fileCount: number;
  testFileCount: number;
  totalLoc: number;
  languages: string[];
}

export interface ModuleEdge {
  from: string;
  to: string;
  weight: number;
}

export interface ExternalDependency {
  specifier: string;
  referenceCount: number;
}

export interface ArchitectureView {
  depth: number;
  nodes: ModuleNode[];
  edges: ModuleEdge[];
  externalDependencies: ExternalDependency[];
  generatedAt: string;
  empty: boolean;
}

export type Severity = "critical" | "high" | "medium" | "low";
export type FindingCategory = "maintainability" | "testing" | "security";

export interface FindingRecord {
  id: string;
  project_id: string;
  rule_id: string;
  severity: Severity;
  category: FindingCategory;
  file_path: string | null;
  line_start: number | null;
  line_end: number | null;
  evidence: string | null;
  explanation: string | null;
  recommendation: string | null;
  source: string;
  created_at: string;
}

export interface AnalysisRun {
  id: string;
  project_id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  findings_count: number;
  // Per-severity snapshot taken when this run finished (migration 013).
  // Null on runs from before that migration, or on a failed run — never
  // fabricated as 0. See backend/src/db/migrations/013_*.sql.
  critical_count: number | null;
  high_count: number | null;
  medium_count: number | null;
  low_count: number | null;
}

export interface AnalysisHistoryResult {
  runs: AnalysisRun[];
}

export type DependencyType = "dependency" | "devDependency";

export interface DependencyInfo {
  name: string;
  versionRange: string | null;
  type: DependencyType;
}

export interface DuplicateVersionGroup {
  name: string;
  versions: string[];
}

export interface DependencyAnalysisResult {
  ecosystem: "npm" | "maven" | null;
  direct: DependencyInfo[];
  totalDirect: number;
  duplicates: DuplicateVersionGroup[];
  duplicatesSource: string | null;
  duplicatesNote: string | null;
  analyzedAt: string;
}

export type TestRunStatus = "passed" | "failed" | "unsupported" | "timeout" | "unknown";

export interface TestRunRecord {
  id: string;
  project_id: string;
  framework: string | null;
  command: string | null;
  exit_code: number | null;
  duration_ms: number | null;
  /** null means the run's framework's output couldn't be parsed for counts — never fabricated as 0. */
  passed: number | null;
  failed: number | null;
  skipped: number | null;
  stdout_ref?: string | null;
  stderr_ref?: string | null;
  status: TestRunStatus;
  reason: string | null;
  started_at: string;
}

export interface CommitSummary {
  hash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  date: string;
  message: string;
}

export interface FileChurn {
  path: string;
  commitCount: number;
}

export interface FileDiffStat {
  path: string;
  insertions: number | null;
  deletions: number | null;
}

export interface DiffStatSummary {
  filesChanged: number;
  insertions: number;
  deletions: number;
  files: FileDiffStat[];
}

export interface GitAnalysisResult {
  isGitRepository: boolean;
  branch: string | null;
  workingTreeStatus: WorkingTreeStatus | null;
  recentCommits: CommitSummary[];
  fileChurn: FileChurn[];
  uncommittedChanges: DiffStatSummary | null;
  churnWindowDays: number;
  analyzedAt: string;
}

export interface AuditSnapshotSummary {
  languages: LanguageStat[];
  frameworks: string[];
  buildSystems: string[];
  packageManagers: string[];
  totalFiles: number;
  testFiles: number;
  indexedAt: string;
}

export interface FindingCounts {
  total: number;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
}

/** A live, computed-fresh finding (e.g. from the security scan) — camelCase fields, no DB id/timestamps. */
export interface LiveFinding {
  ruleId: string;
  severity: Severity;
  category: FindingCategory;
  filePath: string;
  lineStart: number | null;
  lineEnd: number | null;
  evidence: string;
  explanation: string;
  recommendation: string;
}

export interface AuditReport {
  project: { id: string; name: string; rootPath: string };
  generatedAt: string;
  snapshot: AuditSnapshotSummary | null;
  findings: {
    latestRun: AnalysisRun | null;
    counts: FindingCounts;
  };
  security: {
    findings: LiveFinding[];
    scannedAt: string;
  };
  dependencies: DependencyAnalysisResult;
  git: GitAnalysisResult;
  latestTestRun: TestRunRecord | null;
}

// AI Mode — Context Selection (Phase 13). A `ContextBundle` is what
// `selectContextForFinding()` builds for a single Finding: the items chosen
// to send to an AI provider (Phase 14, not yet implemented) plus an honest
// record of what was left out and why, so a person previewing this in the
// UI can see exactly what would be sent and why anything is missing.
export interface ContextItem {
  path: string;
  reason: string;
  tokens: number;
}

export interface ExcludedItem {
  path: string;
  reason: string;
}

export interface ContextBundle {
  targetId: string;
  budgetTokens: number;
  selected: ContextItem[];
  excluded: ExcludedItem[];
  totalTokens: number;
}

// AI Mode — Finding Explanation (Phase 14). The first AI-Mode feature that
// actually calls a provider's `complete()`, using a Phase 13 `ContextBundle`
// as the prompt's grounding content.
export interface ExplainFindingResult {
  explanation: string;
  provider: string;
  model: string;
  usage: { promptTokens: number | null; completionTokens: number | null };
  contextBundle: ContextBundle;
}

export interface StoredExplanation {
  explanation: string | null;
  provider?: string;
  model?: string;
  generatedAt?: string;
}

// AI Mode — Root Cause Analysis (Phase 15). Distinguishes evidence (what
// the shown code directly demonstrates) from inference (the AI's
// hypothesis beyond that), per docs/AI_MODE.md §4's workflow diagram.
// Any field the model's response didn't clearly contain is `null` — the
// backend never fabricates structure the response doesn't have.
export interface RootCauseAnalysisData {
  evidence: string[] | null;
  inference: string | null;
  confidence: "high" | "medium" | "low" | null;
  raw: string;
}

export interface RootCauseAnalysisResult {
  analysis: RootCauseAnalysisData;
  provider: string;
  model: string;
  usage: { promptTokens: number | null; completionTokens: number | null };
  contextBundle: ContextBundle;
}

export interface StoredRootCauseAnalysis {
  analysis: RootCauseAnalysisData | null;
  provider?: string;
  model?: string;
  generatedAt?: string;
}

// AI Mode — Failure Diagnosis (Phase 20). docs/AI_MODE.md §4's "(if
// failure) AI Diagnosis" workflow step, for a failed TestRun rather than
// a Finding. Mirrors root-cause analysis's evidence/inference split:
// likelyCause is the AI's hypothesis, evidence is what it can point to
// directly in the captured output, suggestedDirection is a short pointer
// toward a fix — never a diff or a fix plan itself. Any field the
// response didn't clearly contain is `null` — never fabricated.
export interface FailureDiagnosisData {
  likelyCause: string | null;
  evidence: string[] | null;
  suggestedDirection: string | null;
  raw: string;
}

export interface FailureDiagnosisResult {
  diagnosis: FailureDiagnosisData;
  provider: string;
  model: string;
  usage: { promptTokens: number | null; completionTokens: number | null };
  contextBundle: ContextBundle;
}

export interface StoredFailureDiagnosis {
  diagnosis: FailureDiagnosisData | null;
  provider?: string;
  model?: string;
  generatedAt?: string;
}

// AI Mode — Fix Plan (Phase 16). Every AI fix plan has exactly these seven
// sections per docs/AI_MODE.md §5. Advisory only — nothing here is a diff
// or gets applied to disk; patch generation (Phase 17) is separate and
// human-approval gated.
export interface FixPlanData {
  problem: string | null;
  rootCause: string | null;
  filesAffected: string[] | null;
  proposedChanges: string | null;
  risks: string | null;
  requiredTests: string | null;
  validationStrategy: string | null;
  raw: string;
}

export interface FixPlanResult {
  plan: FixPlanData;
  usedPriorRootCauseAnalysis: boolean;
  provider: string;
  model: string;
  usage: { promptTokens: number | null; completionTokens: number | null };
  contextBundle: ContextBundle;
}

export interface StoredFixPlan {
  plan: FixPlanData | null;
  provider?: string;
  model?: string;
  generatedAt?: string;
}

// AI Mode — Patch Generation (Phase 17) + Diff Review & Apply (Phase 18).
// The first phases to produce/apply anything that could change a file on
// disk, so it's a real persisted state machine rather than a single
// request/response call:
//   pending_approval -> approved -> proposed (has a diff)
//   proposed -> approved_for_apply -> applied
//            \-> rejected                \-> failed (retryable via /apply)
export interface PatchRecord {
  id: string;
  project_id: string;
  finding_id: string | null;
  description: string | null;
  diff_text: string | null;
  status: string;
  apply_error: string | null;
  created_at: string;
}

export interface GeneratePatchResult {
  patch: PatchRecord;
  usedFixPlan: boolean;
  provider: string;
  model: string;
  usage: { promptTokens: number | null; completionTokens: number | null };
  contextBundle: ContextBundle;
}

// AI Mode — Self-Review (Phase 21). docs/AI_MODE.md §6's checklist run
// against a real proposed patch's real diff: correctness, scope creep,
// regressions, security, missing tests, unnecessary complexity, and
// consistency with existing architecture. Advisory only — shown
// alongside the diff, never used to auto-approve; a self-review never
// changes a patch's `status`. Any check the response didn't clearly
// address has `status: null` — never fabricated.
export type SelfReviewStatus = "pass" | "concern" | "fail" | null;

export interface SelfReviewCheck {
  status: SelfReviewStatus;
  note: string | null;
}

export interface SelfReviewData {
  correctness: SelfReviewCheck;
  scopeCreep: SelfReviewCheck;
  regressions: SelfReviewCheck;
  security: SelfReviewCheck;
  missingTests: SelfReviewCheck;
  unnecessaryComplexity: SelfReviewCheck;
  architectureConsistency: SelfReviewCheck;
  raw: string;
}

export interface SelfReviewResult {
  review: SelfReviewData;
  provider: string;
  model: string;
  usage: { promptTokens: number | null; completionTokens: number | null };
  contextBundle: ContextBundle;
}

export interface StoredSelfReview {
  review: SelfReviewData | null;
  provider?: string;
  model?: string;
  generatedAt?: string;
}

// AI Mode — AI Test Generation (Phase 19). Mirrors the Phase 17/18
// two-gate shape, plus one extra real step patch generation doesn't have:
// actually executing what got written, per docs/AI_MODE.md §1 ("AI-
// generated tests ... not trusted on compile alone").
//   pending_approval -> approved -> proposed (has target_path + test_code)
//   proposed -> approved_for_write -> written | passed | failed_tests
//            \-> rejected
// `written` means the file was created but the suite couldn't actually be
// run (no supported test command detected); `passed`/`failed_tests` mean
// the project's real test command actually ran (test_run_id links to the
// full `TestRunRecord`).
export interface GeneratedTestRecord {
  id: string;
  project_id: string;
  finding_id: string | null;
  target_path: string | null;
  description: string | null;
  test_code: string | null;
  status: string;
  test_run_id: string | null;
  created_at: string;
}

export interface GenerateTestResult {
  generatedTest: GeneratedTestRecord;
  usedFixPlan: boolean;
  provider: string;
  model: string;
  usage: { promptTokens: number | null; completionTokens: number | null };
  contextBundle: ContextBundle;
}

export interface WriteAndRunTestResult {
  generatedTest: GeneratedTestRecord;
  testRun: TestRunRecord;
  supported: boolean;
  reason?: string;
}

// Changes page (unified review queue, added alongside Phase 26). Both
// records below are project-wide (every finding, not just one), left-
// joined against `finding` on the backend so a patch/generated test still
// shows up even if its finding was somehow removed — `findingRuleId` etc.
// are null in that case rather than the row silently vanishing.
export interface PatchWithFindingContext extends PatchRecord {
  findingRuleId: string | null;
  findingFilePath: string | null;
  findingSeverity: string | null;
}

export interface GeneratedTestWithFindingContext extends GeneratedTestRecord {
  findingRuleId: string | null;
  findingFilePath: string | null;
  findingSeverity: string | null;
}

export interface ChangesResult {
  patches: PatchWithFindingContext[];
  generatedTests: GeneratedTestWithFindingContext[];
}

/** Parses the JSON-string columns on a RepositorySnapshot into usable values. */
export function parseSnapshot(snapshot: RepositorySnapshot) {
  return {
    languages: safeParse<LanguageStat[]>(snapshot.languages, []),
    frameworks: safeParse<string[]>(snapshot.frameworks, []),
    buildSystems: safeParse<string[]>(snapshot.build_system, []),
    packageManagers: safeParse<string[]>(snapshot.package_managers, []),
    workingTreeStatus: safeParse<WorkingTreeStatus | null>(snapshot.working_tree_status, null),
    gitBranch: snapshot.git_branch,
    indexedAt: snapshot.indexed_at,
  };
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Kinds this product can actually instantiate right now — kept in sync with backend/src/ai/provider/registry.ts. */
export const SUPPORTED_AI_PROVIDER_KINDS = ["openai-compatible"] as const;
export type AIProviderKind = (typeof SUPPORTED_AI_PROVIDER_KINDS)[number];

export interface AIProviderConfig {
  id: string;
  name: string;
  kind: string;
  baseUrl: string | null;
  model: string | null;
  apiKeyRef: string | null;
  hasApiKey: boolean;
  enabled: boolean;
  createdAt: string;
}

export type AIProviderStatusKind = "reachable" | "auth_error" | "rate_limited" | "unreachable";

export interface AIProviderStatus {
  status: AIProviderStatusKind;
  detail: string | null;
  checkedAt: string;
}

export interface AIModelInfo {
  id: string;
  contextWindow: number | null;
}

/** Phase 26 optional monetization architecture — see docs/MONETIZATION.md. */
export interface BillingStatus {
  configured: boolean;
  tier: "free" | "pro";
  limit: number | null;
  used: number;
  subscription: { status: "active" | "inactive"; currentPeriodEnd: string | null } | null;
}

export interface CheckoutSession {
  sessionId: string;
  checkoutUrl: string;
}
