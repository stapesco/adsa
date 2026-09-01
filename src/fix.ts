/**
 * --fix — apply safe auto-fixes to findings produced by the runner.
 *
 * Conservative subset (SPEC.md invariant #7):
 *   - Insert slow-path log line at top of a function body
 *     (slow-path-no-log + async-no-log findings)
 *   - NEVER modify a file with fast-path-with-io / decision-router /
 *     log-schema findings — those require refactor / developer judgment.
 *
 * Dry-run by default. Pass `--fix-confirm` to actually write files.
 *
 * Output is a FixReport — list of per-file outcomes.
 */

import { readFileSync, writeFileSync } from "node:fs";

import type { Finding, SuggestedFix } from "./types.js";
import { CHECKS } from "./checks/index.js";

export interface FixReport {
  applied: number;
  skipped: number;
  failed: number;
  files: FileFixReport[];
}

export interface FileFixReport {
  file: string;
  status: "applied" | "skipped" | "failed";
  reason?: string;
  findingsBefore: number;
  findingsAfter: number;
}

/** Fixable check names — the conservative subset. */
const FIXABLE_CHECKS: ReadonlySet<string> = new Set([
  "slow-path-no-log",
  "async-no-log",
]);

export interface FixOptions {
  /** If false (dry-run), no files are written. */
  write: boolean;
}

export function applyFixes(findings: Finding[], opts: FixOptions): FixReport {
  const byFile = new Map<string, Finding[]>();
  for (const f of findings) {
    if (!FIXABLE_CHECKS.has(f.check)) continue;
    const arr = byFile.get(f.file) ?? [];
    arr.push(f);
    byFile.set(f.file, arr);
  }

  const report: FixReport = {
    applied: 0,
    skipped: 0,
    failed: 0,
    files: [],
  };

  for (const [file, fileFindings] of byFile) {
    const beforeCount = fileFindings.length;
    const fixable = fileFindings.filter((f) => f.suggestedFix);
    if (fixable.length === 0) {
      report.files.push({
        file,
        status: "skipped",
        reason: "no suggestedFix on findings",
        findingsBefore: beforeCount,
        findingsAfter: beforeCount,
      });
      report.skipped += beforeCount;
      continue;
    }

    if (!opts.write) {
      report.files.push({
        file,
        status: "skipped",
        reason: "dry-run (--fix-confirm not set)",
        findingsBefore: beforeCount,
        findingsAfter: beforeCount,
      });
      report.skipped += fixable.length;
      continue;
    }

    try {
      const src = readFileSync(file, "utf8");
      const lines = src.split("\n");
      // Apply insertions in reverse line order so earlier insertions don't shift later line numbers.
      const sortedFixes = [...fixable].sort(
        (a, b) => (b.suggestedFix!.line - a.suggestedFix!.line),
      );
      for (const f of sortedFixes) {
        const fix = f.suggestedFix!;
        // Insert the replacement text at `line`, `column`.
        // Line is 1-based, column is 1-based.
        const li = fix.line - 1;
        if (li < 0 || li >= lines.length) {
          report.failed++;
          continue;
        }
        const lineText = lines[li] ?? "";
        // Compute insertion offset: column - 1 (0-based), but clamp to line length.
        const colIdx = Math.max(0, Math.min(lineText.length, fix.column - 1));
        const before = lineText.slice(0, colIdx);
        const after = lineText.slice(colIdx);
        const replacement = fix.replacement.replace(/\n$/, "");
        // If the replacement is multi-line, split and insert.
        const newLines = replacement.split("\n");
        lines.splice(li, 1, before + newLines[0], ...newLines.slice(1), after);
      }
      writeFileSync(file, lines.join("\n"));
      report.applied += fixable.length;
      report.files.push({
        file,
        status: "applied",
        findingsBefore: beforeCount,
        findingsAfter: beforeCount - fixable.length,
      });
    } catch (err) {
      report.failed += fixable.length;
      report.files.push({
        file,
        status: "failed",
        reason: err instanceof Error ? err.message : String(err),
        findingsBefore: beforeCount,
        findingsAfter: beforeCount,
      });
    }
  }

  return report;
}

// Re-export for unit tests to enumerate fixable checks.
export const __FIXABLE_CHECKS = FIXABLE_CHECKS;
export const __ALL_CHECK_NAMES = CHECKS.map((c) => c.name);
