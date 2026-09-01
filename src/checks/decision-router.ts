/**
 * Check #3 — decision-point-no-router
 *
 * A function marked fast has an `if` statement whose condition references
 * one of the function's parameters, and one of the branches contains
 * an I/O call. This is the pattern where the implicit fast/slow split
 * is hiding inside a conditional — the fast path is doing I/O on one
 * branch without declaring itself.
 *
 * Severity: warn.
 * Fix: none. Splitting the function into an explicit fast/slow pair
 * is a refactor.
 */

import {
  FunctionDeclaration,
  Identifier,
  IfStatement,
  MethodDeclaration,
  Node,
  SyntaxKind,
} from "ts-morph";

import type { CheckResult, Finding } from "../types.js";
import { truncate } from "../util.js";
import { AnyFunction, getAdsaPathMarker } from "../ast.js";
import { IO_CALLEE_PATTERNS } from "../patterns.js";
import { startColumn } from "../column.js";

export function checkDecisionRouter(
  file: string,
  functions: AnyFunction[],
): CheckResult {
  const findings: Finding[] = [];
  for (const fn of functions) {
    const marker = getAdsaPathMarker(fn);
    if (marker !== "fast") continue;

    const params = collectParamNames(fn);
    if (params.size === 0) continue;

    const ifStatements = fn.getDescendantsOfKind(SyntaxKind.IfStatement);
    for (const ifStmt of ifStatements) {
      if (!ifTestReferencesParam(ifStmt, params)) continue;

      const consequentIo = ifContainsIo(ifStmt.getThenStatement());
      const alternateIo =
        ifStmt.getElseStatement() != null
          ? ifContainsIo(ifStmt.getElseStatement()!)
          : false;

      if (!consequentIo && !alternateIo) continue;

      const name = getFnName(fn);
      const line = ifStmt.getStartLineNumber();
      const column = startColumn(ifStmt);

      findings.push({
        check: "decision-router",
        file,
        line,
        column,
        message: `Fast path "${name || "<anonymous>"}" has an implicit fast/slow split — extract the I/O branch into a separate slow path`,
        severity: "warn",
        evidence: truncate(ifStmt.getText()),
      });
    }
  }
  return {
    name: "decision-router",
    findings,
    filesScanned: 1,
    durationMs: 0,
  };
}

function collectParamNames(fn: AnyFunction): Set<string> {
  const names = new Set<string>();
  for (const p of fn.getParameters()) {
    names.add(p.getName());
  }
  return names;
}

function ifTestReferencesParam(ifStmt: IfStatement, params: Set<string>): boolean {
  const test = ifStmt.getExpression();
  // forEachDescendant does not visit the root; check the root first so
  // simple `if (paramName)` cases are caught.
  if (test.isKind(SyntaxKind.Identifier)) {
    if (params.has((test as Identifier).getText())) return true;
  }
  let referenced = false;
  test.forEachDescendant((node) => {
    if (referenced) return;
    if (node.isKind(SyntaxKind.Identifier)) {
      const id = node as Identifier;
      if (params.has(id.getText())) referenced = true;
    }
  });
  return referenced;
}

function ifContainsIo(stmt: Node): boolean {
  let found = false;
  stmt.forEachDescendant((node) => {
    if (found) return;
    if (!node.isKind(SyntaxKind.CallExpression)) return;
    const text = node.getText();
    for (const rx of IO_CALLEE_PATTERNS) {
      if (rx.test(text)) {
        found = true;
        return;
      }
    }
  });
  return found;
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
