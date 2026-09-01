import { describe, expect, it } from "vitest";
import { Project, SyntaxKind } from "ts-morph";

import { iterFunctions } from "../../src/ast.js";
import { checkSlowPathNoLog } from "../../src/checks/slow-path-no-log.js";

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

describe("slow-path-no-log", () => {
  it("flags a slow-marked function with no log emission", () => {
    const { functions } = loadFunctions("slow-path-violation.ts");
    const result = checkSlowPathNoLog("slow-path-violation.ts", functions);
    expect(result.findings).toHaveLength(1);
    const finding = result.findings[0]!;
    expect(finding.check).toBe("slow-path-no-log");
    expect(finding.severity).toBe("warn");
    expect(finding.file).toBe("slow-path-violation.ts");
    expect(finding.message).toContain("resolvePermissionsSlow");
    expect(finding.suggestedFix).toBeDefined();
    expect(finding.suggestedFix!.replacement).toContain('adsa_path: "slow"');
    // The test passes a basename-only path, so the inference falls back to the file basename.
    expect(finding.suggestedFix!.replacement).toContain('adsa_area: "slow-path-violation"');
  });

  it("does not flag a slow-marked function that emits the log line", () => {
    const { functions } = loadFunctions("slow-path-clean.ts");
    const result = checkSlowPathNoLog("slow-path-clean.ts", functions);
    expect(result.findings).toHaveLength(0);
  });

  it("does not flag a function without a slow marker", () => {
    const { functions } = loadFunctions("clean.ts");
    const result = checkSlowPathNoLog("clean.ts", functions);
    expect(result.findings).toHaveLength(0);
  });
});
