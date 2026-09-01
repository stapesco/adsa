/**
 * Check #1 — slow-path-no-log
 *
 * A function is explicitly marked as a slow path (via @adsa:slow JSDoc,
 * // adsa:slow inline comment, or `Slow`/`SlowPath` name suffix)
 * but its body does not emit a log call with `{adsa_path: "slow", ...}`.
 *
 * Without that log line, the path is invisible in observability — the
 * fast_path_rate metric becomes meaningless.
 *
 * Severity: warn.
 * Fix: insert the missing log line at the top of the body.
 */

import { ArrowFunction, FunctionDeclaration, MethodDeclaration, SyntaxKind } from "ts-morph";

import type { CheckResult, Finding, SuggestedFix } from "../types.js";
import { inferAdsaArea, truncate } from "../util.js";
import { startColumn } from "../column.js";
import {
  AnyFunction,
  getAdsaPathMarker,
  hasAdsaLogCall,
} from "../ast.js";

export function checkSlowPathNoLog(
  file: string,
  functions: AnyFunction[],
): CheckResult {
  const findings: Finding[] = [];
  for (const fn of functions) {
    const marker = getAdsaPathMarker(fn);
    if (marker !== "slow") continue;
    if (hasAdsaLogCall(fn)) continue;

    const name = getFnName(fn);
    const line = fn.getStartLineNumber();
    const column = startColumn(fn);
    const body = fn.getBody();
    const insertLine = body ? body.getStartLineNumber() : line + 1;
    const insertColumn = body ? 1 : 1;
    const area = inferAdsaArea(file);

    // Expression-bodied arrows cannot be safely auto-fixed.
    const isExpressionBody =
      fn.isKind(SyntaxKind.ArrowFunction) &&
      !(fn as ArrowFunction).getBody().isKind(SyntaxKind.Block);

    const fix: SuggestedFix | undefined = isExpressionBody
      ? undefined
      : {
          description: `Insert slow-path log emission at top of ${name || "anonymous"}`,
          replacement: `log.info({ adsa_path: "slow", adsa_area: "${area}" });\n`,
          line: insertLine,
          column: insertColumn,
        };

    findings.push({
      check: "slow-path-no-log",
      file,
      line,
      column,
      message: `Function "${name || "<anonymous>"}" marked slow has no {adsa_path: "slow"} log emission`,
      severity: "warn",
      evidence: truncate(`async function ${name}() { /* slow path, no log */ }`),
      suggestedFix: fix,
    });
  }
  return {
    name: "slow-path-no-log",
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
