/**
 * --init / --uninstall — install or remove a marker-block pre-commit hook.
 *
 * Behaviour (matches stapes-precommit):
 *   - Reads .git/hooks/pre-commit if it exists.
 *   - If our marker block is already present, --init is a no-op.
 *   - If a foreign hook (Husky, lefthook) is present, our block is
 *     appended inside our marker so the foreign hook still runs.
 *   - --uninstall removes only our marker block, leaves the rest.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

/** Marker block delimiters. Keep stable. */
const MARKER_START = "# >>> stapes-adsa hook >>>";
const MARKER_END = "# <<< stapes-adsa hook <<<";

/** Path to the hook script we install. Runs `stapes-adsa` via npx. */
const HOOK_BODY = `#!/usr/bin/env sh
${MARKER_START}
# This block is managed by 'stapes-adsa --init'. Do not edit.
# To remove, run 'stapes-adsa --uninstall'.
set -e
npx --no-install stapes-adsa --run --json
${MARKER_END}
`;

export interface InitResult {
  hookPath: string;
  status: "created" | "appended" | "already-installed";
}

/**
 * Install the pre-commit hook. Idempotent.
 *
 * Returns the path and a status string:
 *   - "created": hook file did not exist, created with our block
 *   - "appended": hook file existed with a foreign hook, appended our block
 *   - "already-installed": our marker was already present, no-op
 */
export function installHook(repoRoot: string): InitResult {
  const gitDir = join(repoRoot, ".git");
  if (!existsSync(gitDir)) {
    throw new Error(`not a git repository: ${repoRoot}`);
  }
  const hooksDir = join(gitDir, "hooks");
  mkdirSync(hooksDir, { recursive: true });
  const hookPath = join(hooksDir, "pre-commit");

  if (!existsSync(hookPath)) {
    writeFileSync(hookPath, HOOK_BODY, { mode: 0o755 });
    return { hookPath, status: "created" };
  }

  const existing = readFileSync(hookPath, "utf8");
  if (existing.includes(MARKER_START)) {
    return { hookPath, status: "already-installed" };
  }

  // Append our block inside our marker. Use a newline separator
  // so the foreign hook runs first.
  const next = existing.trimEnd() + "\n\n" + HOOK_BODY;
  writeFileSync(hookPath, next, { mode: 0o755 });
  return { hookPath, status: "appended" };
}

export interface UninstallResult {
  hookPath: string;
  status: "removed" | "deleted" | "not-installed";
}

/**
 * Remove our marker block from the pre-commit hook. If the file ends up
 * empty after removal, delete it. Foreign hooks are left untouched.
 */
export function uninstallHook(repoRoot: string): UninstallResult {
  const hookPath = join(repoRoot, ".git", "hooks", "pre-commit");
  if (!existsSync(hookPath)) {
    return { hookPath, status: "not-installed" };
  }
  const existing = readFileSync(hookPath, "utf8");
  if (!existing.includes(MARKER_START)) {
    return { hookPath, status: "not-installed" };
  }

  // Strip our marker block (inclusive of surrounding blank lines).
  const blockStart = existing.indexOf(MARKER_START);
  let blockEnd = existing.indexOf(MARKER_END, blockStart);
  if (blockEnd >= 0) {
    blockEnd += MARKER_END.length;
  } else {
    blockEnd = existing.length;
  }
  let remaining = existing.slice(0, blockStart) + existing.slice(blockEnd);
  // Tidy up trailing blank lines but keep one newline at EOF if anything remains.
  remaining = remaining.replace(/\n+$/, "");
  // If only the shebang line that we wrote remains, delete the file.
  // (We wrote the shebang as part of HOOK_BODY, so "only shebang" means "only ours".)
  const shebangOnly = /^#!.*\n?$/.test(remaining.trimEnd()) || /^#!.*$/.test(remaining);
  if (remaining.length === 0 || shebangOnly) {
    unlinkSync(hookPath);
    return { hookPath, status: "deleted" };
  }
  writeFileSync(hookPath, remaining + "\n", { mode: 0o755 });
  return { hookPath, status: "removed" };
}

/** Test helper — also exported for the unit tests. */
export const __MARKER_START = MARKER_START;
export const __MARKER_END = MARKER_END;
export const __HOOK_BODY = HOOK_BODY;
