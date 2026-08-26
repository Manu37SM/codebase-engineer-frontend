import { describe, it, expect } from "vitest";
import { findingsToCsv, findingsToJson } from "./exportFindings";
import type { FindingRecord } from "./types";

const SAMPLE_FINDINGS: FindingRecord[] = [
  {
    id: "f1",
    project_id: "p1",
    rule_id: "large-file",
    severity: "high",
    category: "maintainability",
    file_path: "src/index.ts",
    line_start: 10,
    line_end: 20,
    evidence: 'contains a "quoted" value, and a comma',
    explanation: "the file is large",
    recommendation: "split it up",
    source: "deterministic",
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "f2",
    project_id: "p1",
    rule_id: "missing-test-file",
    severity: "low",
    category: "testing",
    file_path: null,
    line_start: null,
    line_end: null,
    evidence: null,
    explanation: null,
    recommendation: null,
    source: "deterministic",
    created_at: "2026-01-02T00:00:00.000Z",
  },
];

describe("findingsToCsv", () => {
  it("includes a header row and one row per finding", () => {
    const csv = findingsToCsv(SAMPLE_FINDINGS);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(
      "id,severity,category,file_path,line_start,line_end,evidence,explanation,recommendation,source,created_at"
    );
  });

  it("quotes and escapes fields containing commas or quotes", () => {
    const csv = findingsToCsv(SAMPLE_FINDINGS);
    expect(csv).toContain('"contains a ""quoted"" value, and a comma"');
  });

  it("renders null fields as empty, never a fabricated placeholder", () => {
    const csv = findingsToCsv(SAMPLE_FINDINGS);
    const secondRow = csv.split("\n")[2];
    expect(secondRow.startsWith("f2,low,testing,,,,,,,deterministic,")).toBe(true);
  });

  it("produces only the header row for an empty list", () => {
    expect(findingsToCsv([]).split("\n")).toHaveLength(1);
  });
});

describe("findingsToJson", () => {
  it("round-trips the exact findings passed in", () => {
    const json = findingsToJson(SAMPLE_FINDINGS);
    expect(JSON.parse(json)).toEqual(SAMPLE_FINDINGS);
  });
});
