/**
 * Check #2 — fast-path-with-io
 *
 * A function is explicitly marked as a fast path (via @adsa:fast JSDoc,
 * // adsa:fast inline comment, or `Fast`/`FastPath` name suffix)
 * but its body contains an I/O call per IO_CALLEE_PATTERNS.
 *
 * This is the single biggest ADSA violation: the "cache" that calls
 * `fetch()`, the "permission check" that hits the DB, the "validation"
 * that makes an RPC. A fast path must be pure — no I/O.
 *
 * Severity: block.
 * Fix: none. Extracting the I/O call into a separate slow path is a
 * refactor, not a mechanical insertion. The runner will refuse to
 * auto-fix this check (SPEC.md invariant #7).
 */

import { FunctionDeclaration, MethodDeclaration, SyntaxKind } from "ts-morph";

import type { CheckResult, Finding } from "../types.js";
import { truncate } from "../util.js";
import { AnyFunction, containsIoCall, getAdsaPathMarker } from "../ast.js";
import { startColumn } from "../column.js";

export function checkFastPathWithIo(
  file: string,
  functions: AnyFunction[],
): CheckResult {
  const findings: Finding[] = [];
  for (const fn of functions) {
    const marker = getAdsaPathMarker(fn);
    if (marker !== "fast") continue;
    if (!containsIoCall(fn, "log")) continue;

    const name = getFnName(fn);
    const line = fn.getStartLineNumber();
    const column = startColumn(fn);

    findings.push({
      check: "fast-path-with-io",
      file,
      line,
      column,
      message: `Fast path "${name || "<anonymous>"}" performs I/O — fast paths must be pure (no network/db/cache/fs/queue)`,
      severity: "block",
      evidence: truncate(`function ${name}() { /* I/O inside fast path */ }`),
    });
  }
  return {
    name: "fast-path-with-io",
    findings,
    filesScanned: 1,
    durationMs: 0,
  };
}

function getFnName(fn: AnyFunction): string {
  if (fn.isKind(SyntaxKind.FunctionDeclaration)) {
    return (fn as FunctionDeclaration).getName() ?? "";
  }
  if (fn.isKind(SyntaxKind.MethodDeclaration)) {
    return (fn as MethodDeclaration).getName();
  }
  return "";
}
