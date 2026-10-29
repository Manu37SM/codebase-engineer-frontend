import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useProjects } from "../context/ProjectContext";
import { getAudit, getAuditExportUrl } from "../lib/api";
import type { AuditReport } from "../lib/types";
import { buildAuditSummary } from "../lib/auditSummary";
import { SEVERITY_ORDER, computeHealthFromCounts, timeAgo, toSeverityCounts } from "../lib/health";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  Card,
  CopyButton,
  Icon,
  NoProjectState,
  PageHeader,
  PageSkeleton,
  SeverityBadge,
  StatCard,
} from "../components/ui";

export default function AuditPage() {
  const { selectedProject } = useProjects();
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedProject) {
      setReport(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAudit(selectedProject.id)
      .then((res) => {
        if (!cancelled) setReport(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load audit report");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProject]);

  const summary = useMemo(() => (report ? buildAuditSummary(report) : ""), [report]);

  if (!selectedProject) return <NoProjectState page="Audit" />;

  const counts = report ? toSeverityCounts(report.findings.counts.bySeverity) : null;
  const health = counts && report?.findings.latestRun ? computeHealthFromCounts(counts) : null;
  const testRun = report?.latestTestRun ?? null;

  return (
    <div>
      <PageHeader
        title="Audit"
        subtitle={report ? `${report.project.name} — generated ${timeAgo(report.generatedAt)}` : undefined}
        actions={
          report && (
            <div className="flex flex-wrap items-center gap-2" data-no-print>
              <CopyButton text={summary} label="Copy summary" ariaLabel="Copy audit summary as Markdown" />
              <button type="button" onClick={() => window.print()} className={BTN_SECONDARY}>
                Print
              </button>
              <a href={getAuditExportUrl(selectedProject.id)} className={BTN_PRIMARY}>
                <Icon name="download" className="h-3.5 w-3.5" />
                Download report (.md)
              </a>
            </div>
          )
        }
      />

      {loading && <PageSkeleton label="Loading audit report" />}
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {!loading && !error && report && (
        <div className="mt-4 space-y-4">
          <Card title="Repository snapshot">
            {!report.snapshot ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                This repository hasn't been scanned yet. Go to{" "}
                <Link to="/repositories" className="underline">
                  Repositories
                </Link>{" "}
                and click Scan.
              </p>
            ) : (
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <StatCard label="Total files" value={report.snapshot.totalFiles} />
                <StatCard label="Test files" value={report.snapshot.testFiles} />
                <StatCard label="Build system" value={report.snapshot.buildSystems.join(", ") || "—"} />
                <StatCard label="Frameworks" value={report.snapshot.frameworks.join(", ") || "—"} />
                <StatCard
                  label="Health"
                  value={health ? `${health.score} · ${health.grade}` : "—"}
                  tone={health ? (health.score >= 75 ? "good" : health.score >= 60 ? "warn" : "bad") : "default"}
                  hint={health ? "see Findings for detail" : "run analysis first"}
                />
              </dl>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Static analysis findings">
              {!report.findings.latestRun ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Analysis hasn't been run yet. Go to{" "}
                  <Link to="/findings" className="underline">
                    Findings
                  </Link>{" "}
                  and click "Run Analysis".
                </p>
              ) : (
                <>
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    {report.findings.counts.total} findings from the last analysis run —{" "}
                    {formatCounts(report.findings.counts.bySeverity)}
                  </p>
                  {counts && report.findings.counts.total > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {SEVERITY_ORDER.filter((sev) => counts[sev] > 0).map((sev) => (
                        <li key={sev} className="flex items-center gap-1.5 text-sm tabular-nums text-slate-600 dark:text-slate-300">
                          <SeverityBadge severity={sev} /> ×{counts[sev]}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </Card>

            <Card title="Tests">
              {!testRun ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No test run recorded yet. Go to{" "}
                  <Link to="/tests" className="underline">
                    Tests
                  </Link>{" "}
                  to run them.
                </p>
              ) : (
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  {testRun.status} — {testRun.passed} passed, {testRun.failed} failed, {testRun.skipped} skipped
                </p>
              )}
            </Card>
          </div>

          <Card
            title={`Security scan (live, ${report.security.findings.length} finding${
              report.security.findings.length === 1 ? "" : "s"
            })`}
          >
            {report.security.findings.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No security findings.</p>
            ) : (
              <ul className="space-y-2">
                {report.security.findings.map((f, i) => (
                  <li
                    key={`${f.ruleId}-${f.filePath}-${i}`}
                    className="rounded-md border border-slate-200 p-3 dark:border-slate-700/70"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={f.severity} />
                      <span className="font-mono text-xs text-slate-700 dark:text-slate-200">
                        {f.filePath}
                        {f.lineStart ? `:${f.lineStart}` : ""}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{f.explanation}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Dependencies">
              {report.dependencies.ecosystem === null ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{report.dependencies.duplicatesNote}</p>
              ) : (
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  {report.dependencies.totalDirect} direct {report.dependencies.ecosystem} dependencies,{" "}
                  {report.dependencies.duplicates.length} duplicate version group
                  {report.dependencies.duplicates.length === 1 ? "" : "s"}
                </p>
              )}
            </Card>

            <Card title="Git activity">
              {!report.git.isGitRepository ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Not a Git repository.</p>
              ) : (
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  Branch {report.git.branch ?? "—"} · {report.git.recentCommits.length} recent commit
                  {report.git.recentCommits.length === 1 ? "" : "s"}
                  {report.git.uncommittedChanges && report.git.uncommittedChanges.filesChanged > 0 && (
                    <> · {report.git.uncommittedChanges.filesChanged} uncommitted file change(s)</>
                  )}
                </p>
              )}
            </Card>
          </div>

          <p className="text-xs text-slate-400 dark:text-slate-500">
            Generated {new Date(report.generatedAt).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}

function formatCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) return "none";
  return entries.map(([key, value]) => `${value} ${key}`).join(", ");
}
