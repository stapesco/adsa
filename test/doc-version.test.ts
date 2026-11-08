import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The published package ships README.md and AGENTS.md. Both embed the
 * tool version in sample output. A version bump that misses those strings
 * publishes a package whose documentation contradicts its own version.
 *
 * This test fails the build when a bump leaves the docs behind, so the
 * mismatch cannot reach npm.
 */

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/**
 * Lines that legitimately name an older version. The README records a
 * measurement taken on 2026-09-01 with the 1.0.0 build; that line is a
 * historical fact and must not be rewritten when the version changes.
 */
const HISTORICAL_PREFIXES = ["On 2026-09-01 we ran"];

function readRepoFile(name: string): string {
  return readFileSync(`${repoRoot}${name}`, "utf8");
}

function packageVersion(): string {
  const pkg = JSON.parse(readRepoFile("package.json")) as { version: string };
  return pkg.version;
}

describe("documentation version strings", () => {
  const version = packageVersion();

  it("package.json has a semantic version", () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  const files = ["README.md", "AGENTS.md"];

  for (const file of files) {
    it(`${file} sample output names version ${version}`, () => {
      const content = readRepoFile(file);

      // The version banner printed by the tool.
      expect(content).toContain(`stapes-adsa@${version}`);

      // The --json sample shape.
      expect(content).toContain(`"tool": "stapes-adsa@${version}"`);
      expect(content).toContain(`"version": "${version}"`);

      // No stale version banner outside a dated historical line.
      for (const line of content.split("\n")) {
        if (HISTORICAL_PREFIXES.some((p) => line.startsWith(p))) continue;
        for (const match of line.match(/stapes-adsa@(\d+\.\d+\.\d+)/g) ?? []) {
          expect(match).toBe(`stapes-adsa@${version}`);
        }
      }
    });
  }

  it("AGENTS.md names the current version in its limitations heading", () => {
    const content = readRepoFile("AGENTS.md");
    expect(content).toContain(`## Known limitations (v${version})`);
  });
});
