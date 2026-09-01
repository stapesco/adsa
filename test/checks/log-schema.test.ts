import { describe, expect, it } from "vitest";
import { Project } from "ts-morph";

import { checkLogSchema } from "../../src/checks/log-schema.js";

const FIXTURE_DIR = "test/fixtures";

function loadFile(filename: string) {
  const project = new Project({
    useInMemoryFileSystem: false,
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  });
  return project.addSourceFileAtPath(`${FIXTURE_DIR}/${filename}`);
}

describe("log-schema", () => {
  it("flags all four kinds of violation in one file", () => {
    const sf = loadFile("log-schema-violation.ts");
    const result = checkLogSchema(sf);
    // The fixture has:
    //   1. adsa_path: "FAST" (wrong case) → block
    //   2. adsa_path: "fast" with no adsa_area → block (missing area)
    //   3. adsa_path: "slow" with adsa_zzz → warn (unknown field)
    //   4. adsa_path: "medium" → block (invalid enum)
    // That's 4 findings: 3 block + 1 warn.
    expect(result.findings.length).toBeGreaterThanOrEqual(4);

    const blocks = result.findings.filter((f) => f.severity === "block");
    const warns = result.findings.filter((f) => f.severity === "warn");
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    expect(warns.length).toBeGreaterThanOrEqual(1);

    const messages = blocks.map((f) => f.message).join("\n");
    expect(messages).toContain("must be \"fast\" or \"slow\"");
  });

  it("does not flag a clean file", () => {
    const sf = loadFile("clean.ts");
    const result = checkLogSchema(sf);
    // clean.ts has no adsa_path-bearing log calls; result is empty.
    expect(result.findings).toHaveLength(0);
  });
});
