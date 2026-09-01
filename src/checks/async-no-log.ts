/**
 * Check #4 — async-no-log
 *
 * An async function whose body is non-trivial (>5 lines), does not
 * already have a `@adsa:slow` marker, and does not emit a log call
 * with `{adsa_path: "slow", ...}`. Such a function is a "candidate"
 * slow path that has not declared itself.
 *
 * This is a heuristic — small async helpers (e.g. `async function id(x)
 * { return x }`) are excluded by the line-count gate. The intent is
 * to surface the common case of "I wrote an async function, it does
 * real work, but I forgot to log which path it is."
 *
 * Severity: warn.
 * Fix: insert the slow-path log line at the top of the body.
 */

import { ArrowFunction, FunctionDeclaration, MethodDeclaration, SyntaxKind } from "ts-morph";

import type { CheckResult, Finding, SuggestedFix } from "../types.js";
import { inferAdsaArea, truncate } from "../util.js";
import { startColumn } from "../column.js";
import {
  AnyFunction,
  functionLineCount,
  getAdsaPathMarker,
  hasAdsaLogCall,
  isAsyncFunction,
} from "../ast.js";

/** Minimum body lines to count as a non-trivial async function. */
const MIN_BODY_LINES = 5;

export function checkAsyncNoLog(
  file: string,
  functions: AnyFunction[],
): CheckResult {
  const findings: Finding[] = [];
  for (const fn of functions) {
    if (!isAsyncFunction(fn)) continue;
    if (functionLineCount(fn) < MIN_BODY_LINES) continue;
    if (hasAdsaLogCall(fn)) continue;
    if (getAdsaPathMarker(fn) === "fast") continue;

    const name = getFnName(fn);
    const line = fn.getStartLineNumber();
    const column = startColumn(fn);
    const body = fn.getBody();
    const insertLine = body ? body.getStartLineNumber() : line + 1;
    const area = inferAdsaArea(file);

    const isExpressionBody =
      fn.isKind(SyntaxKind.ArrowFunction) &&
      !(fn as ArrowFunction).getBody().isKind(SyntaxKind.Block);

    const fix: SuggestedFix | undefined = isExpressionBody
      ? undefined
      : {
          description: `Insert slow-path log emission at top of ${name || "anonymous"}`,
          replacement: `log.info({ adsa_path: "slow", adsa_area: "${area}" });\n`,
          line: insertLine,
          column: 1,
        };

    findings.push({
      check: "async-no-log",
      file,
      line,
      column,
      message: `Async function "${name || "<anonymous>"}" has no {adsa_path: "slow"} log emission — likely a slow path that is not declaring itself`,
      severity: "warn",
      evidence: truncate(`async function ${name}() { /* ${functionLineCount(fn)} lines, no log */ }`),
      suggestedFix: fix,
    });
  }
  return {
    name: "async-no-log",
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
