export interface Project {
  id: string;
  name: string;
  root_path: string;
  created_at: string;

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
  languages: string; 
  frameworks: string; 
  build_system: string; 
  package_managers: string; 
  git_branch: string | null;
  working_tree_status: string; 
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
