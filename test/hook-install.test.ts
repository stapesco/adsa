import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { installHook, uninstallHook } from "../src/hook-install.js";

const TMP_ROOT = "/tmp/stapes-adsa-hook-test";

function setupRepo(): string {
  if (existsSync(TMP_ROOT)) rmSync(TMP_ROOT, { recursive: true, force: true });
  mkdirSync(join(TMP_ROOT, ".git", "hooks"), { recursive: true });
  return TMP_ROOT;
}

afterEach(() => {
  if (existsSync(TMP_ROOT)) rmSync(TMP_ROOT, { recursive: true, force: true });
});

describe("hook-install", () => {
  it("--init creates the hook on a clean repo", () => {
    const root = setupRepo();
    const r = installHook(root);
    expect(r.status).toBe("created");
    expect(existsSync(r.hookPath)).toBe(true);
    const content = readFileSync(r.hookPath, "utf8");
    expect(content).toContain("# >>> stapes-adsa hook >>>");
    expect(content).toContain("npx --no-install stapes-adsa --run --json");
  });

  it("--init is idempotent: a second call returns already-installed", () => {
    const root = setupRepo();
    installHook(root);
    const r2 = installHook(root);
    expect(r2.status).toBe("already-installed");
  });

  it("--init appends to a foreign hook without clobbering it", () => {
    const root = setupRepo();
    const foreignHook = "#!/usr/bin/env sh\necho 'husky: foreign hook runs first'\n";
    writeFileSync(
      join(root, ".git", "hooks", "pre-commit"),
      foreignHook,
      { mode: 0o755 },
    );
    const r = installHook(root);
    expect(r.status).toBe("appended");
    const content = readFileSync(r.hookPath, "utf8");
    expect(content).toContain("husky: foreign hook runs first");
    expect(content).toContain("# >>> stapes-adsa hook >>>");
  });

  it("--uninstall removes only the marker block, leaves foreign hook intact", () => {
    const root = setupRepo();
    const foreignHook = "#!/usr/bin/env sh\necho 'husky'\n";
    writeFileSync(
      join(root, ".git", "hooks", "pre-commit"),
      foreignHook,
      { mode: 0o755 },
    );
    installHook(root);
    const r = uninstallHook(root);
    expect(r.status).toBe("removed");
    const content = readFileSync(r.hookPath, "utf8");
    expect(content).toContain("husky");
    expect(content).not.toContain("# >>> stapes-adsa hook >>>");
  });

  it("--uninstall deletes the file when the hook is only ours", () => {
    const root = setupRepo();
    installHook(root);
    const r = uninstallHook(root);
    expect(r.status).toBe("deleted");
    expect(existsSync(r.hookPath)).toBe(false);
  });

  it("--uninstall returns not-installed when nothing is there", () => {
    const root = setupRepo();
    const r = uninstallHook(root);
    expect(r.status).toBe("not-installed");
  });

  it("throws on a non-git directory", () => {
    const tmp = "/tmp/stapes-adsa-no-git";
    if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });
    expect(() => installHook(tmp)).toThrow(/not a git repository/);
    rmSync(tmp, { recursive: true, force: true });
  });
});
