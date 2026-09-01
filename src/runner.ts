/**
 * Runner — orchestrates check execution and produces the v1 --json shape.
 *
 * Inputs:
 *   - root directory (or list of files)
 *   - list of check names to run (default = all enabled)
 *   - whether --strict is on (warnings become blocks)
 *
 * Output:
 *   RunReport — see SPEC.md invariant #5 for the JSON shape.
 */

import { readFileSync } from "node:fs";
import { basename } from "node:path";

import type { CheckResult, Finding } from "./types.js";
import { CHECKS, createProject } from "./checks/index.js";
import { NAME_COL_WIDTH, normalizePath, walkTsFiles } from "./util.js";

/** Tool version, read from package.json at runtime. */
const VERSION = (() => {
  try {
    // dist/cli.js → ../package.json
    const pkgPath = new URL("../package.json", import.meta.url);
    const raw = readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(raw) as { version: string };
    return pkg.version;
  } catch {
    return "0.0.0";
  }
})();

/** Stable JSON shape per SPEC.md invariant #5. */
export interface RunReport {
  startedAt: string;
  tool: string;
  version: string;
  exitCode: 0 | 1 | 2;
  checkCount: number;
  failed: number;
  warned: number;
  findings: Finding[];
}

/** Runner options. */
export interface RunnerOptions {
  root: string;
  checks?: string[];
  strict?: boolean;
  files?: string[];
}

export function run(opts: RunnerOptions): RunReport {
  const startedAt = new Date().toISOString();
  const fileList = opts.files && opts.files.length > 0
    ? opts.files
    : walkTsFiles(opts.root);

  const project = createProject();
  const sourceFiles = fileList.map((f) => {
    const abs = f.startsWith("/") ? f : `${opts.root}/${f}`;
    return project.addSourceFileAtPath(abs);
  });

  const enabled = (opts.checks && opts.checks.length > 0)
    ? CHECKS.filter((c) => opts.checks!.includes(c.name))
    : CHECKS.filter((c) => c.defaultEnabled);

  const allFindings: Finding[] = [];
  for (const sf of sourceFiles) {
    for (const check of enabled) {
      const result: CheckResult = check.run(sf);
      for (const f of result.findings) {
        // --strict promotes warnings to blocks
        if (opts.strict && f.severity === "warn") {
          allFindings.push({ ...f, severity: "block" });
        } else {
          allFindings.push(f);
        }
      }
    }
  }

  const failed = allFindings.filter((f) => f.severity === "block").length;
  const warned = allFindings.filter((f) => f.severity === "warn").length;
  const exitCode: 0 | 1 | 2 =
    failed > 0 ? 1 : 0;

  return {
    startedAt,
    tool: `stapes-adsa@${VERSION}`,
    version: VERSION,
    exitCode,
    checkCount: enabled.length,
    failed,
    warned,
    findings: allFindings,
  };
}

/** Pretty-print the human-readable summary (no JSON). */
export function formatHuman(report: RunReport): string {
  const lines: string[] = [];
  lines.push(`${report.tool}`);
  lines.push("");
  if (report.findings.length === 0) {
    lines.push("✓ no findings");
    return lines.join("\n");
  }

  // Group by check.
  const byCheck = new Map<string, Finding[]>();
  for (const f of report.findings) {
    const arr = byCheck.get(f.check) ?? [];
    arr.push(f);
    byCheck.set(f.check, arr);
  }

  for (const [check, findings] of byCheck) {
    const block = findings.filter((f) => f.severity === "block").length;
    const warn = findings.filter((f) => f.severity === "warn").length;
    const symbol = block > 0 ? "✗" : warn > 0 ? "⚠" : "✓";
    lines.push(
      `${symbol} ${check.padEnd(NAME_COL_WIDTH)} ${findings.length} finding(s)`,
    );
    for (const f of findings) {
      lines.push(`  ${f.file}:${f.line}:${f.column}`);
      lines.push(`    [${f.severity}] ${f.message}`);
      lines.push(`    ${f.evidence}`);
    }
    lines.push("");
  }

  lines.push(`${report.failed} block(s), ${report.warned} warning(s).`);
  return lines.join("\n");
}

// Re-export basename for the CLI to use when listing tools.
export { basename };
