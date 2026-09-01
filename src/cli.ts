#!/usr/bin/env node
/**
 * stapes-adsa CLI entry point.
 *
 * Subcommands and flags:
 *   (default)            run all enabled checks
 *   --check <name>       run a single check by name
 *   --list               list check names and exit
 *   --strict             treat warnings as blocks
 *   --json               emit the v1 JSON shape on stdout; stderr is empty
 *   --no-color           disable ANSI colour in human output
 *   --fix                dry-run: report what would be auto-fixed
 *   --fix-confirm        apply the safe auto-fixes
 *   --init               install the pre-commit hook (idempotent)
 *   --uninstall          remove the pre-commit hook
 *   --root <path>        project root (default: cwd)
 *   --version
 *   --help
 *
 * Exit codes per SPEC.md invariant #3:
 *   0 clean (or warn-only without --strict)
 *   1 blocked findings (or warn under --strict)
 *   2 invalid args / runtime error
 */

import { readFileSync } from "node:fs";

import { Command } from "commander";

import { run, formatHuman } from "./runner.js";
import { applyFixes } from "./fix.js";
import { installHook, uninstallHook } from "./hook-install.js";
import { CHECKS, listCheckNames } from "./checks/index.js";
import { NAME_COL_WIDTH, SEVERITY_COL_WIDTH } from "./util.js";

const COLORS = {
  red: (s: string) => `[31m${s}[0m`,
  green: (s: string) => `[32m${s}[0m`,
  yellow: (s: string) => `[33m${s}[0m`,
  cyan: (s: string) => `[36m${s}[0m`,
  dim: (s: string) => `[2m${s}[0m`,
};

const program = new Command();

program
  .name("stapes-adsa")
  .description(
    "AST-based ADSA (Adaptive Dual-System Architecture) linter for TypeScript. " +
      "Flags slow paths without logging, fast paths doing I/O, decision points without routing, " +
      "async boundaries missing the adsa_path log line, and invalid log shapes.",
  )
  .version(readVersion())
  .option("--root <path>", "project root", process.cwd())
  .option("--check <name>", "run a single check by name (repeatable)", collect, [])
  .option("--strict", "treat warnings as blocks", false)
  .option("--json", "emit JSON on stdout (stable v1 schema)", false)
  .option("--no-color", "disable ANSI colour in human output")
  .option("--fix", "dry-run: report auto-fixable findings", false)
  .option("--fix-confirm", "apply safe auto-fixes", false)
  .option("--init", "install the pre-commit hook (idempotent)", false)
  .option("--uninstall", "remove the pre-commit hook", false)
  .option("--list", "list available check names", false)
  .exitOverride();

try {
  program.parse(process.argv);
} catch (err) {
  // Commander throws on --help / --version (exitCode 0) and on unknown
  // args (exitCode 1). Forward the code; emit message on stderr.
  const code = (err as { exitCode?: number }).exitCode ?? 2;
  const msg = (err as Error).message ?? "";
  if (msg) process.stderr.write(msg + "\n");
  process.exit(code === 0 ? 0 : 2);
}

const opts = program.opts();

function collect(value: string, prev: string[]): string[] {
  return prev.concat([value]);
}

// --list — exit early, no scan.
if (opts.list) {
  for (const c of CHECKS) {
    const sev = c.severityDefault === "block" ? "block" : "warn";
    const on = c.defaultEnabled ? "on " : "off";
    const line = `  ${c.name.padEnd(NAME_COL_WIDTH)} [${on}] [${sev.padEnd(SEVERITY_COL_WIDTH)}]  ${c.description}`;
    process.stdout.write(line + "\n");
  }
  process.exit(0);
}

// --init / --uninstall — operate on the hook, no scan.
if (opts.init) {
  try {
    const r = installHook(opts.root);
    const msg = `[${r.status}] hook at ${r.hookPath}`;
    if (opts.json) {
      process.stdout.write(JSON.stringify({ op: "init", ...r }) + "\n");
    } else {
      process.stdout.write(msg + "\n");
    }
    process.exit(0);
  } catch (err) {
    if (opts.json) {
      process.stdout.write(
        JSON.stringify({ op: "init", error: (err as Error).message }) + "\n",
      );
      process.exit(2);
    }
    process.stderr.write((err as Error).message + "\n");
    process.exit(2);
  }
}

if (opts.uninstall) {
  const r = uninstallHook(opts.root);
  if (opts.json) {
    process.stdout.write(JSON.stringify({ op: "uninstall", ...r }) + "\n");
  } else {
    process.stdout.write(`[${r.status}] hook at ${r.hookPath}\n`);
  }
  process.exit(0);
}

// Validate --check names up front.
if (opts.check.length > 0) {
  const known = new Set(listCheckNames());
  const unknown = opts.check.filter((n: string) => !known.has(n));
  if (unknown.length > 0) {
    const msg = `unknown check name(s): ${unknown.join(", ")}. Run --list to see available.`;
    if (opts.json) {
      process.stdout.write(JSON.stringify({ error: msg }) + "\n");
    } else {
      process.stderr.write(msg + "\n");
    }
    process.exit(2);
  }
}

// Run.
let report;
try {
  report = run({
    root: opts.root,
    checks: opts.check.length > 0 ? opts.check : undefined,
    strict: opts.strict,
  });
} catch (err) {
  if (opts.json) {
    process.stdout.write(
      JSON.stringify({ error: (err as Error).message }) + "\n",
    );
    process.exit(2);
  }
  process.stderr.write((err as Error).message + "\n");
  process.exit(2);
}

// --fix / --fix-confirm.
if (opts.fix || opts.fixConfirm) {
  const fixReport = applyFixes(report.findings, {
    write: Boolean(opts.fixConfirm),
  });
  if (opts.json) {
    process.stdout.write(
      JSON.stringify({ ...report, fix: fixReport }) + "\n",
    );
  } else {
    process.stdout.write(
      `fix dry-run: ${fixReport.applied + fixReport.skipped + fixReport.failed} candidate(s)\n` +
        `  would-apply: ${fixReport.applied + fixReport.skipped}  (run --fix-confirm to apply)\n` +
        `  failed:      ${fixReport.failed}\n`,
    );
  }
  // Exit code stays the same as the run report.
  process.exit(report.exitCode);
}

// Output.
if (opts.json) {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  process.exit(report.exitCode);
} else {
  process.stdout.write(formatHuman(report) + "\n");
  process.exit(report.exitCode);
}

// --- helpers ---

function readVersion(): string {
  try {
    const pkgPath = new URL("../package.json", import.meta.url);
    const raw = readFileSync(pkgPath.pathname, "utf8");
    const pkg = JSON.parse(raw) as { version: string };
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}

// Silence unused-import warnings for COLORS in --json mode.
void COLORS;
