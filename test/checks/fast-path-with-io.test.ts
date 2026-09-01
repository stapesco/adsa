import { describe, expect, it } from "vitest";
import { Project } from "ts-morph";

import { iterFunctions } from "../../src/ast.js";
import { checkFastPathWithIo } from "../../src/checks/fast-path-with-io.js";

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

describe("fast-path-with-io", () => {
  it("flags a fast-marked function that calls fetch", () => {
    const { functions } = loadFunctions("fast-path-violation.ts");
    const result = checkFastPathWithIo("fast-path-violation.ts", functions);
    expect(result.findings).toHaveLength(1);
    const finding = result.findings[0]!;
    expect(finding.check).toBe("fast-path-with-io");
    expect(finding.severity).toBe("block");
    expect(finding.message).toContain("checkRateLimitFast");
    expect(finding.message).toContain("performs I/O");
    // No suggestedFix for this check — it's a refactor, not an insertion.
    expect(finding.suggestedFix).toBeUndefined();
  });

  it("does not flag a pure fast-marked function", () => {
    const { functions } = loadFunctions("fast-path-clean.ts");
    const result = checkFastPathWithIo("fast-path-clean.ts", functions);
    expect(result.findings).toHaveLength(0);
  });

  it("does not flag a function without a fast marker", () => {
    const { functions } = loadFunctions("clean.ts");
    const result = checkFastPathWithIo("clean.ts", functions);
    expect(result.findings).toHaveLength(0);
  });
});
