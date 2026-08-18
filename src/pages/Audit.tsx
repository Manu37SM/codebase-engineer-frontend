import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useProjects } from "../context/ProjectContext";
import { getAudit, getAuditExportUrl } from "../lib/api";
import type { AuditReport, Severity } from "../lib/types";

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-slate-100 text-slate-700",
};

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

  if (!selectedProject) {
    return (
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Audit</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          No repository selected yet. Go to{" "}
          <Link to="/repositories" className="underline">
            Repositories
          </Link>{" "}
          to register and scan one.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Audit</h1>
        {report && (
          <a
            href={getAuditExportUrl(selectedProject.id)}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            Download report (.md)
          </a>
        )}
      </div>

      {loading && <p className="mt-4 text-sm text-slate-500">Loading…</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {!loading && !error && report && (
        <div className="mt-4 space-y-6">
          <section>
            <h2 className="text-sm font-semibold text-slate-900">Repository snapshot</h2>
            {!report.snapshot ? (
              <p className="mt-1 text-sm text-slate-500">
                This repository hasn't been scanned yet. Go to{" "}
                <Link to="/repositories" className="underline">
                  Repositories
                </Link>{" "}
                and click Scan.
              </p>
            ) : (
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-700 sm:grid-cols-4">
                <StatTile label="Total files" value={report.snapshot.totalFiles} />
                <StatTile label="Test files" value={report.snapshot.testFiles} />
                <StatTile label="Build system" value={report.snapshot.buildSystems.join(", ") || "—"} />
                <StatTile label="Frameworks" value={report.snapshot.frameworks.join(", ") || "—"} />
              </dl>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-900">Static analysis findings</h2>
            {!report.findings.latestRun ? (
              <p className="mt-1 text-sm text-slate-500">
                Analysis hasn't been run yet. Go to{" "}
                <Link to="/findings" className="underline">
                  Findings
                </Link>{" "}
                and click "Run Analysis".
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-700">
                {report.findings.counts.total} findings from the last analysis run —{" "}
                {formatCounts(report.findings.counts.bySeverity)}
              </p>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-900">
              Security scan (live, {report.security.findings.length} finding
              {report.security.findings.length === 1 ? "" : "s"})
            </h2>
            {report.security.findings.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">No security findings.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {report.security.findings.map((f, i) => (
                  <li key={`${f.ruleId}-${f.filePath}-${i}`} className="rounded border border-slate-200 bg-white p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium uppercase ${SEVERITY_STYLES[f.severity]}`}
                      >
                        {f.severity}
                      </span>
                      <span className="font-mono text-xs text-slate-700">
                        {f.filePath}
                        {f.lineStart ? `:${f.lineStart}` : ""}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{f.explanation}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-900">Dependencies</h2>
            {report.dependencies.ecosystem === null ? (
              <p className="mt-1 text-sm text-slate-500">{report.dependencies.duplicatesNote}</p>
            ) : (
              <p className="mt-1 text-sm text-slate-700">
                {report.dependencies.totalDirect} direct {report.dependencies.ecosystem} dependencies,{" "}
                {report.dependencies.duplicates.length} duplicate version group
                {report.dependencies.duplicates.length === 1 ? "" : "s"}
              </p>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-900">Git activity</h2>
            {!report.git.isGitRepository ? (
              <p className="mt-1 text-sm text-slate-500">Not a Git repository.</p>
            ) : (
              <p className="mt-1 text-sm text-slate-700">
                Branch {report.git.branch ?? "—"} · {report.git.recentCommits.length} recent commit
                {report.git.recentCommits.length === 1 ? "" : "s"}
                {report.git.uncommittedChanges && report.git.uncommittedChanges.filesChanged > 0 && (
                  <> · {report.git.uncommittedChanges.filesChanged} uncommitted file change(s)</>
                )}
              </p>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-900">Tests</h2>
            {!report.latestTestRun ? (
              <p className="mt-1 text-sm text-slate-500">
                No test run recorded yet. Go to{" "}
                <Link to="/tests" className="underline">
                  Tests
                </Link>{" "}
                to run them.
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-700">
                {report.latestTestRun.status} — {report.latestTestRun.passed} passed,{" "}
                {report.latestTestRun.failed} failed, {report.latestTestRun.skipped} skipped
              </p>
            )}
          </section>

          <p className="text-xs text-slate-400">
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

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-slate-200 bg-white p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}
