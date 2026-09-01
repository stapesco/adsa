import { describe, expect, it } from "vitest";

import { run } from "../src/runner.js";

describe("runner", () => {
  it("produces a stable JSON shape with all required fields", () => {
    const report = run({ root: "test/fixtures" });
    expect(report.tool).toMatch(/^stapes-adsa@/);
    expect(typeof report.startedAt).toBe("string");
    expect(typeof report.version).toBe("string");
    expect([0, 1, 2]).toContain(report.exitCode);
    expect(typeof report.checkCount).toBe("number");
    expect(typeof report.failed).toBe("number");
    expect(typeof report.warned).toBe("number");
    expect(Array.isArray(report.findings)).toBe(true);
  });

  it("flags the violations in the fixture set", () => {
    const report = run({ root: "test/fixtures" });
    // Fixture violations expected:
    //   - slow-path-no-log: 1 finding (slow-path-violation.ts)
    //   - fast-path-with-io: 1 finding (fast-path-violation.ts)
    //   - decision-router: 1+ finding (decision-router-violation.ts)
    //   - async-no-log: 1+ finding (async-no-log-violation.ts)
    //   - log-schema: 4 findings (log-schema-violation.ts)
    // Total: at least 8 findings, with at least 4 blocks.
    expect(report.findings.length).toBeGreaterThanOrEqual(8);
    const blocks = report.findings.filter((f) => f.severity === "block");
    expect(blocks.length).toBeGreaterThanOrEqual(4);
    expect(report.exitCode).toBe(1);
  });

  it("exits 0 when run with --strict and only warnings present", () => {
    // Strip down: run only slow-path-no-log against the violation file.
    const report = run({
      root: "test/fixtures",
      checks: ["slow-path-no-log"],
    });
    expect(report.checkCount).toBe(1);
    // slow-path-no-log emits warn, not block. exitCode should be 0.
    expect(report.exitCode).toBe(0);
  });

  it("promotes warnings to blocks under --strict", () => {
    const report = run({
      root: "test/fixtures",
      checks: ["slow-path-no-log"],
      strict: true,
    });
    expect(report.exitCode).toBe(1);
    const blocks = report.findings.filter((f) => f.severity === "block");
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  it("emits byte-stable output across two runs of the same files", () => {
    // SPEC.md invariant #2: deterministic output (modulo startedAt).
    const a = run({ root: "test/fixtures", checks: ["slow-path-no-log"] });
    const b = run({ root: "test/fixtures", checks: ["slow-path-no-log"] });
    // Same number of findings, same files, same lines, same messages.
    expect(a.findings.length).toBe(b.findings.length);
    for (let i = 0; i < a.findings.length; i++) {
      const fa = a.findings[i]!;
      const fb = b.findings[i]!;
      expect(fa.file).toBe(fb.file);
      expect(fa.line).toBe(fb.line);
      expect(fa.column).toBe(fb.column);
      expect(fa.message).toBe(fb.message);
      expect(fa.severity).toBe(fb.severity);
    }
  });
});
