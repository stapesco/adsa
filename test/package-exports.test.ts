import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * The package ships a runtime helper, `withAdsaLogging`, and the README
 * documents the import path `stapes-adsa/lib/instrument`. That path did
 * not resolve in a consumer install for v1.0.0 and v1.1.0, because the
 * package published `dist/` but declared no `exports` map.
 *
 * This test packs the package, installs the tarball into a scratch
 * project, and imports it through the documented path. It fails the build
 * if a consumer cannot import the helper.
 */

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

let workDir: string;
let consumerDir: string;

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), "stapes-adsa-exports-"));
  consumerDir = join(workDir, "consumer");

  // Build first. `dist/` is gitignored and the CI test job runs the suite
  // before `npm run build`, so a pack without this step produces a tarball
  // with no dist/ and every import below fails.
  execFileSync("npm", ["run", "build"], { cwd: repoRoot, encoding: "utf8" });

  const tarball = execFileSync(
    "npm",
    ["pack", "--silent", "--pack-destination", workDir, repoRoot],
    { encoding: "utf8" },
  )
    .trim()
    .split("\n")
    .pop();

  execFileSync("mkdir", ["-p", consumerDir]);
  writeFileSync(
    join(consumerDir, "package.json"),
    JSON.stringify({ name: "consumer", version: "1.0.0", private: true }, null, 2),
  );
  execFileSync("npm", ["install", "--silent", join(workDir, tarball as string)], {
    cwd: consumerDir,
    encoding: "utf8",
  });
}, 180_000);

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function importInConsumer(specifier: string): Promise<string> {
  const script = `import(${JSON.stringify(specifier)}).then((m) => console.log(Object.keys(m).join(","))).catch((e) => { console.error(e.code); process.exit(1); });`;
  return execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: consumerDir,
    encoding: "utf8",
  });
}

describe("consumer package imports", () => {
  it("the documented import path resolves", () => {
    const keys = importInConsumer("stapes-adsa/lib/instrument");
    expect(keys).toContain("withAdsaLogging");
  });

  it("the package root resolves", () => {
    const keys = importInConsumer("stapes-adsa");
    expect(keys).toContain("withAdsaLogging");
  });

  it("a deep dist import still resolves", () => {
    // The exports map must not lock out the pre-map deep path. Anyone who
    // found it before v1.1.2 could otherwise break on upgrade.
    const keys = importInConsumer("stapes-adsa/dist/lib/instrument.js");
    expect(keys).toContain("withAdsaLogging");
  });

  it("the CLI binary runs", () => {
    const out = execFileSync(
      process.execPath,
      [join(consumerDir, "node_modules/stapes-adsa/dist/cli.js"), "--version"],
      { encoding: "utf8" },
    );
    const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
      version: string;
    };
    expect(out.trim()).toBe(pkg.version);
  });
});
