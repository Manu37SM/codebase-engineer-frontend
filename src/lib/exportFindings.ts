import type { FindingRecord } from "./types";

const CSV_COLUMNS: Array<keyof FindingRecord> = [
  "id",
  "severity",
  "category",
  "file_path",
  "line_start",
  "line_end",
  "evidence",
  "explanation",
  "recommendation",
  "source",
  "created_at",
];

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function findingsToCsv(findings: FindingRecord[]): string {
  const header = CSV_COLUMNS.join(",");
  const rows = findings.map((f) => CSV_COLUMNS.map((col) => csvEscape(f[col])).join(","));
  return [header, ...rows].join("\n");
}

export function findingsToJson(findings: FindingRecord[]): string {
  return JSON.stringify(findings, null, 2);
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadFindingsCsv(findings: FindingRecord[], projectName: string) {
  triggerDownload(findingsToCsv(findings), `${slugify(projectName)}-findings.csv`, "text/csv;charset=utf-8;");
}

export function downloadFindingsJson(findings: FindingRecord[], projectName: string) {
  triggerDownload(findingsToJson(findings), `${slugify(projectName)}-findings.json`, "application/json;charset=utf-8;");
}

function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "findings";
}
