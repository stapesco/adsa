/**
 * Utility helpers for the checks and runner.
 *
 * - `walkTsFiles` — recursive .ts/.tsx file walker with default exclusions.
 * - `inferAdsaArea` — deterministic area inference (SPEC.md invariant #9).
 * - `isInsideLogCall` — true if a node is an argument to a log.*() call.
 * - `hasAdsaLogCall` — true if a function body contains any matching adsa_path log call.
 * - `truncate` — evidence truncation to 200 chars.
 */

import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** Extensions this tool recognises. Anything else is silently skipped. */
export const TS_EXTENSIONS = new Set([".ts", ".tsx"]);

/** Directories always excluded from the scan. */
export const ALWAYS_EXCLUDED_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
  ".git",
  ".next",
  ".turbo",
  ".cache",
]);

/** Recursively walk a directory and yield .ts/.tsx paths (relative to root). */
export function walkTsFiles(root: string): string[] {
  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (ALWAYS_EXCLUDED_DIRS.has(name)) continue;
      const full = join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        stack.push(full);
        continue;
      }
      const dot = name.lastIndexOf(".");
      if (dot < 0) continue;
      const ext = name.slice(dot).toLowerCase();
      if (TS_EXTENSIONS.has(ext)) out.push(relative(root, full));
    }
  }
  out.sort();
  return out;
}

/**
 * Deterministic ADSA area inference (SPEC.md invariant #9).
 *
 * Order:
 *   1. Deepest enclosing directory whose name is not `src`/`lib`/etc.
 *   2. Basename of the file without extension.
 *   3. "unscoped" fallback.
 */
export function inferAdsaArea(filePath: string): string {
  const parts = filePath.split(/[\\/]/).filter((p) => p.length > 0);
  // Drop the filename.
  const dirs = parts.slice(0, -1);
  // Find the deepest dir that is meaningful (not generic).
  const GENERIC = new Set(["src", "lib", "dist", "build", "out", "app", "index"]);
  let deepest: string | undefined;
  for (const d of dirs) {
    if (d && !GENERIC.has(d.toLowerCase())) deepest = d.toLowerCase();
  }
  if (deepest) return deepest;
  // Fallback to file basename without extension.
  const base = parts[parts.length - 1] ?? "unscoped";
  const dot = base.lastIndexOf(".");
  return (dot > 0 ? base.slice(0, dot) : base).toLowerCase();
}

/** Width of the check-name column in human-readable output. */
export const NAME_COL_WIDTH = 22;

/** Width of the severity column in --list output. */
export const SEVERITY_COL_WIDTH = 5;

/** Truncate a string to `max` chars, appending an ellipsis marker. */
export function truncate(s: string, max = 200): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 3) + "...";
}

/** Normalize a path to forward-slash relative form, for stable output. */
export function normalizePath(p: string): string {
  return p.split(sep).join("/");
}
