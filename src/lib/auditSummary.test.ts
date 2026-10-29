import { describe, it, expect } from "vitest";
import { buildAuditSummary } from "./auditSummary";
import type { AuditReport } from "./types";

const BASE: AuditReport = {
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
    duplicatesNote: "No supported manifest found.",
    analyzedAt: "now",
  },
  git: {
    isGitRepository: false,
    branch: null,
    workingTreeStatus: null,
    recentCommits: [],
    fileChurn: [],
    uncommittedChanges: null,
    churnWindowDays: 90,
    analyzedAt: "now",
  },
  latestTestRun: null,
};

describe("buildAuditSummary", () => {
  it("handles a brand-new, unscanned project", () => {
    const md = buildAuditSummary(BASE);
    expect(md).toContain("# Audit summary — my-app");
    expect(md).toContain("analysis has not been run yet");
    expect(md).toContain("not a Git repository");
    expect(md).toContain("no run recorded");
  });

  it("summarises findings, security hits and test results", () => {
    const md = buildAuditSummary({
      ...BASE,
      findings: {
        latestRun: { id: "r", project_id: "p1", started_at: "x", finished_at: "x", status: "completed", findings_count: 3, critical_count: 1, high_count: 0, medium_count: 2, low_count: 0 },
        counts: { total: 3, bySeverity: { critical: 1, medium: 2 }, byCategory: {} },
      },
      security: {
        scannedAt: "x",
        findings: [
          { ruleId: "env", severity: "critical", category: "security", filePath: ".env", lineStart: 3, lineEnd: 3, evidence: "", explanation: "Committed env file", recommendation: "" },
        ],
      },
      latestTestRun: { id: "t", project_id: "p1", framework: "vitest", command: null, exit_code: 0, duration_ms: 1, passed: 10, failed: 0, skipped: 1, status: "passed", reason: null, started_at: "x" },
    });
    expect(md).toContain("**Health:** 81/100 (grade B) — 3 findings (1 critical, 2 medium)");
    expect(md).toContain("[critical] `.env:3` — Committed env file");
    expect(md).toContain("passed — 10 passed, 0 failed, 1 skipped");
  });
});
