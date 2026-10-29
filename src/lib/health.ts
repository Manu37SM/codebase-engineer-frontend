import type { FindingRecord, Severity } from "./types";

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

/** Penalty points per finding, by severity. Exposed so the UI can explain the score. */
export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 15,
  high: 6,
  medium: 2,
  low: 0.5,
};

export type HealthGrade = "A" | "B" | "C" | "D" | "F";

export interface HealthScore {
  /** 0–100, higher is healthier. */
  score: number;
  grade: HealthGrade;
  counts: Record<Severity, number>;
  total: number;
}

export function countBySeverity(findings: Pick<FindingRecord, "severity">[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    if (f.severity in counts) counts[f.severity]++;
  }
  return counts;
}

export function gradeFor(score: number): HealthGrade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

/**
 * Simple, explainable repository health score: start at 100 and subtract
 * severity-weighted penalty points (see SEVERITY_WEIGHTS), floored at 0.
 */
export function computeHealthFromCounts(counts: Record<Severity, number>): HealthScore {
  let penalty = 0;
  let total = 0;
  for (const sev of SEVERITY_ORDER) {
    penalty += counts[sev] * SEVERITY_WEIGHTS[sev];
    total += counts[sev];
  }
  const score = Math.max(0, Math.round(100 - penalty));
  return { score, grade: gradeFor(score), counts, total };
}

export function computeHealth(findings: Pick<FindingRecord, "severity">[]): HealthScore {
  return computeHealthFromCounts(countBySeverity(findings));
}

/** Normalise a loosely-typed `{ severity: n }` map (e.g. from the audit API) into full counts. */
export function toSeverityCounts(bySeverity: Record<string, number>): Record<Severity, number> {
  return {
    critical: bySeverity.critical ?? 0,
    high: bySeverity.high ?? 0,
    medium: bySeverity.medium ?? 0,
    low: bySeverity.low ?? 0,
  };
}

export interface FileHotspot {
  path: string;
  total: number;
  worst: Severity;
  counts: Record<Severity, number>;
}

/** Files carrying the most (and most severe) findings, worst first. */
export function topFindingFiles(
  findings: Pick<FindingRecord, "severity" | "file_path">[],
  limit = 5
): FileHotspot[] {
  const byFile = new Map<string, FileHotspot>();
  for (const f of findings) {
    if (!f.file_path) continue;
    let entry = byFile.get(f.file_path);
    if (!entry) {
      entry = {
        path: f.file_path,
        total: 0,
        worst: "low",
        counts: { critical: 0, high: 0, medium: 0, low: 0 },
      };
      byFile.set(f.file_path, entry);
    }
    entry.total++;
    entry.counts[f.severity]++;
    if (SEVERITY_ORDER.indexOf(f.severity) < SEVERITY_ORDER.indexOf(entry.worst)) entry.worst = f.severity;
  }
  const weight = (h: FileHotspot) =>
    SEVERITY_ORDER.reduce((sum, sev) => sum + h.counts[sev] * SEVERITY_WEIGHTS[sev], 0);
  return [...byFile.values()].sort((a, b) => weight(b) - weight(a) || b.total - a.total || a.path.localeCompare(b.path)).slice(0, limit);
}

/** "3 minutes ago" style label; falls back to a locale date for anything older than ~30 days. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days <= 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}
