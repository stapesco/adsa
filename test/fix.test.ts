import { describe, expect, it } from "vitest";

import { run } from "../src/runner.js";
import { applyFixes } from "../src/fix.js";

describe("--fix", () => {
  it("dry-run reports what would be applied without writing files", () => {
    const report = run({
      root: "test/fixtures",
      checks: ["slow-path-no-log", "async-no-log"],
    });
    const fixReport = applyFixes(report.findings, { write: false });
    // slow-path-violation.ts has 1 fixable finding; async-no-log-violation.ts has 1.
    expect(fixReport.applied).toBe(0); // dry-run
    expect(fixReport.skipped).toBeGreaterThanOrEqual(2);
    expect(fixReport.failed).toBe(0);
    const dryRunFiles = fixReport.files.filter(
      (f) => f.reason === "dry-run (--fix-confirm not set)",
    );
    expect(dryRunFiles.length).toBeGreaterThanOrEqual(2);
  });

  it("never auto-fixes fast-path-with-io findings (refactor required)", () => {
    const report = run({
      root: "test/fixtures",
      checks: ["fast-path-with-io"],
    });
    const fixReport = applyFixes(report.findings, { write: true });
    expect(fixReport.applied).toBe(0);
    expect(fixReport.skipped).toBe(0);
    // No file entries because the check name is not in FIXABLE_CHECKS.
    expect(fixReport.files).toHaveLength(0);
  });

  it("never auto-fixes log-schema findings (developer judgment required)", () => {
    const report = run({
      root: "test/fixtures",
      checks: ["log-schema"],
    });
    const fixReport = applyFixes(report.findings, { write: true });
    expect(fixReport.applied).toBe(0);
    expect(fixReport.files).toHaveLength(0);
  });
});
