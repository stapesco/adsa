import { describe, expect, it } from "vitest";
import { Project } from "ts-morph";

import { iterFunctions } from "../../src/ast.js";
import { checkAsyncNoLog } from "../../src/checks/async-no-log.js";

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

describe("async-no-log", () => {
  it("flags a long async function with no log line", () => {
    const { functions } = loadFunctions("async-no-log-violation.ts");
    const result = checkAsyncNoLog("async-no-log-violation.ts", functions);
    expect(result.findings.length).toBeGreaterThanOrEqual(1);
    const finding = result.findings[0]!;
    expect(finding.check).toBe("async-no-log");
    expect(finding.severity).toBe("warn");
    expect(finding.message).toContain("ingestPayload");
    expect(finding.suggestedFix).toBeDefined();
    expect(finding.suggestedFix!.replacement).toContain('adsa_path: "slow"');
  });

  it("does not flag small async helpers (<5 lines)", () => {
    const { functions } = loadFunctions("clean.ts");
    const result = checkAsyncNoLog("clean.ts", functions);
    // `id<T>` in clean.ts is 1 line; should not be flagged.
    // `loadPermissionsSlow` already has a log line — should not be flagged.
    expect(result.findings).toHaveLength(0);
  });
});
