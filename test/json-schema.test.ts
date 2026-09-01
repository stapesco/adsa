import { describe, expect, it } from "vitest";

import { run } from "../src/runner.js";

/**
 * SPEC.md invariant #5: stable JSON shape.
 * Validates the v1 contract via runtime checks. (No external schema lib
 * — runtime assertions are sufficient and stay MIT-only.)
 */
describe("--json schema", () => {
  const REQUIRED_TOP = ["startedAt", "tool", "version", "exitCode", "checkCount", "failed", "warned", "findings"];

  it("has all required top-level fields", () => {
    const r = run({ root: "test/fixtures", checks: ["slow-path-no-log"] });
    for (const k of REQUIRED_TOP) {
      expect(r).toHaveProperty(k);
    }
  });

  it("exitCode is one of {0, 1, 2}", () => {
    const r = run({ root: "test/fixtures" });
    expect([0, 1, 2]).toContain(r.exitCode);
  });

  it("tool string matches stapes-adsa@<version>", () => {
    const r = run({ root: "test/fixtures", checks: ["slow-path-no-log"] });
    expect(r.tool).toMatch(/^stapes-adsa@\d+\.\d+\.\d+/);
  });

  it("findings array elements have the required shape", () => {
    const r = run({ root: "test/fixtures" });
    const REQUIRED_FINDING = ["check", "file", "line", "column", "message", "severity", "evidence"];
    for (const f of r.findings) {
      for (const k of REQUIRED_FINDING) {
        expect(f).toHaveProperty(k);
      }
      expect(["block", "warn"]).toContain(f.severity);
      expect(typeof f.line).toBe("number");
      expect(typeof f.column).toBe("number");
    }
  });

  it("failed + warned counts match the findings array", () => {
    const r = run({ root: "test/fixtures" });
    const blocks = r.findings.filter((f) => f.severity === "block").length;
    const warns = r.findings.filter((f) => f.severity === "warn").length;
    expect(r.failed).toBe(blocks);
    expect(r.warned).toBe(warns);
  });
});
