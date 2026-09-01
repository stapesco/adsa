import { describe, expect, it } from "vitest";
import { Project } from "ts-morph";

import { iterFunctions } from "../../src/ast.js";
import { checkDecisionRouter } from "../../src/checks/decision-router.js";

const FIXTURE_DIR = "test/fixtures";

function loadFunctions(filename: string) {
  const project = new Project({
    useInMemoryFileSystem: false,
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  });
  const sf = project.addSourceFileAtPath(`${FIXTURE_DIR}/${filename}`);
  return { sf, functions: Array.from(iterFunctions(sf)) };
}

describe("decision-router", () => {
  it("flags a fast-marked function with an if-branch that does I/O", () => {
    const { functions } = loadFunctions("decision-router-violation.ts");
    const result = checkDecisionRouter(
      "decision-router-violation.ts",
      functions,
    );
    expect(result.findings.length).toBeGreaterThanOrEqual(1);
    const finding = result.findings[0]!;
    expect(finding.check).toBe("decision-router");
    expect(finding.severity).toBe("warn");
    expect(finding.message).toContain("verifyTokenFast");
    expect(finding.message).toContain("implicit fast/slow split");
  });

  it("does not flag a fast-marked function with no I/O branches", () => {
    const { functions } = loadFunctions("fast-path-clean.ts");
    const result = checkDecisionRouter("fast-path-clean.ts", functions);
    expect(result.findings).toHaveLength(0);
  });

  it("does not flag a function without a fast marker", () => {
    const { functions } = loadFunctions("clean.ts");
    const result = checkDecisionRouter("clean.ts", functions);
    expect(result.findings).toHaveLength(0);
  });
});
