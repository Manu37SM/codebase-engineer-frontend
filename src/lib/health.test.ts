import { describe, it, expect } from "vitest";
import { computeHealth, gradeFor, timeAgo, topFindingFiles } from "./health";
import type { Severity } from "./types";

const f = (severity: Severity, file_path: string | null = null) => ({ severity, file_path });

describe("computeHealth", () => {
  it("is 100 / A with no findings", () => {
    expect(computeHealth([])).toMatchObject({ score: 100, grade: "A", total: 0 });
  });

  it("subtracts severity-weighted penalties", () => {
    // 15 + 6 + 2 + 0.5 = 23.5 -> 76.5 -> rounds to 77 (B)
    const h = computeHealth([f("critical"), f("high"), f("medium"), f("low")]);
    expect(h.score).toBe(77);
    expect(h.grade).toBe("B");
    expect(h.counts).toEqual({ critical: 1, high: 1, medium: 1, low: 1 });
  });

  it("floors at 0", () => {
    const many = Array.from({ length: 20 }, () => f("critical"));
    expect(computeHealth(many)).toMatchObject({ score: 0, grade: "F" });
  });
});

describe("gradeFor", () => {
  it("maps score boundaries", () => {
    expect([100, 90, 89, 75, 74, 60, 59, 40, 39, 0].map(gradeFor)).toEqual([
      "A", "A", "B", "B", "C", "C", "D", "D", "F", "F",
    ]);
  });
});

describe("topFindingFiles", () => {
  it("ranks by weighted severity, ignores findings without a file", () => {
    const hot = topFindingFiles([
      f("low", "a.ts"), f("low", "a.ts"), f("low", "a.ts"),
      f("critical", "b.ts"),
      f("high", null),
      f("medium", "c.ts"),
    ]);
    // b: 15, c: 2, a: 3 x 0.5 = 1.5
    expect(hot.map((h) => h.path)).toEqual(["b.ts", "c.ts", "a.ts"]);
    expect(hot[0].worst).toBe("critical");
    expect(hot[2].total).toBe(3);
  });

  it("respects the limit", () => {
    const hot = topFindingFiles([f("low", "a"), f("low", "b"), f("low", "c")], 2);
    expect(hot).toHaveLength(2);
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-10-29T12:00:00Z").getTime();
  it("formats relative times", () => {
    expect(timeAgo("2026-10-29T11:59:50Z", now)).toBe("just now");
    expect(timeAgo("2026-10-29T11:55:00Z", now)).toBe("5 minutes ago");
    expect(timeAgo("2026-10-29T09:00:00Z", now)).toBe("3 hours ago");
    expect(timeAgo("2026-10-27T12:00:00Z", now)).toBe("2 days ago");
    expect(timeAgo("garbage", now)).toBe("unknown");
  });
});
