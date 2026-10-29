import type { AuditReport } from "./types";
import { SEVERITY_ORDER, computeHealthFromCounts, toSeverityCounts } from "./health";

/** Compact Markdown summary of an audit report — meant for pasting into a PR, ticket or chat. */
export function buildAuditSummary(report: AuditReport): string {
  const lines: string[] = [];
  const counts = toSeverityCounts(report.findings.counts.bySeverity);
  const health = computeHealthFromCounts(counts);

  lines.push(`# Audit summary — ${report.project.name}`);
  lines.push(`_Generated ${new Date(report.generatedAt).toISOString()}_`);
  lines.push("");

  if (report.findings.latestRun) {
    const breakdown = SEVERITY_ORDER.filter((s) => counts[s] > 0)
      .map((s) => `${counts[s]} ${s}`)
      .join(", ");
    lines.push(
      `- **Health:** ${health.score}/100 (grade ${health.grade}) — ${report.findings.counts.total} finding${
        report.findings.counts.total === 1 ? "" : "s"
      }${breakdown ? ` (${breakdown})` : ""}`
    );
  } else {
    lines.push("- **Health:** analysis has not been run yet");
  }

  if (report.snapshot) {
    lines.push(`- **Files:** ${report.snapshot.totalFiles} (${report.snapshot.testFiles} test)`);
    if (report.snapshot.frameworks.length) lines.push(`- **Frameworks:** ${report.snapshot.frameworks.join(", ")}`);
  }

  const sec = report.security.findings;
  lines.push(`- **Security scan:** ${sec.length === 0 ? "no findings" : `${sec.length} finding${sec.length === 1 ? "" : "s"}`}`);
  for (const f of sec.slice(0, 10)) {
    lines.push(`  - [${f.severity}] \`${f.filePath}${f.lineStart ? `:${f.lineStart}` : ""}\` — ${f.explanation}`);
  }
  if (sec.length > 10) lines.push(`  - …and ${sec.length - 10} more`);

  const deps = report.dependencies;
  lines.push(
    deps.ecosystem === null
      ? `- **Dependencies:** ${deps.duplicatesNote ?? "no supported manifest"}`
      : `- **Dependencies:** ${deps.totalDirect} direct ${deps.ecosystem}, ${deps.duplicates.length} duplicate version group${
          deps.duplicates.length === 1 ? "" : "s"
        }`
  );

  lines.push(
    report.git.isGitRepository
      ? `- **Git:** branch ${report.git.branch ?? "—"}, ${report.git.recentCommits.length} recent commits${
          report.git.uncommittedChanges?.filesChanged ? `, ${report.git.uncommittedChanges.filesChanged} uncommitted file(s)` : ""
        }`
      : "- **Git:** not a Git repository"
  );

  const t = report.latestTestRun;
  lines.push(
    t
      ? `- **Tests:** ${t.status} — ${t.passed ?? 0} passed, ${t.failed ?? 0} failed, ${t.skipped ?? 0} skipped`
      : "- **Tests:** no run recorded"
  );

  return lines.join("\n") + "\n";
}
