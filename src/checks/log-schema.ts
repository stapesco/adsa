/**
 * Check #5 — adsa-log-schema
 *
 * Every `{adsa_path: ...}` object literal in the codebase must conform
 * to the four-field contract:
 *
 *   Required:  {adsa_path: "fast" | "slow", adsa_area: <string>}
 *   Optional:  {adsa_reason: <string>, adsa_save_pct: <number 0..100>}
 *   Forbidden: any other keys with the `adsa_` prefix
 *
 * "log call" = the call shape described in ast.ts (log/logger/console/... callee).
 *
 * Severity: block for required-field violations, warn for unknown adsa_ keys.
 * Fix: none.
 */

import {
  CallExpression,
  ObjectLiteralExpression,
  PropertyAssignment,
  SourceFile,
  SyntaxKind,
} from "ts-morph";

import type { CheckResult, Finding } from "../types.js";
import { truncate } from "../util.js";
import {
  LOG_REQUIRED_FIELDS,
  LOG_OPTIONAL_FIELDS,
  ADSA_PATH_VALUES,
} from "../patterns.js";

export function checkLogSchema(sf: SourceFile): CheckResult {
  const findings: Finding[] = [];
  const file = sf.getBaseName() ?? "<unknown>";

  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const ce = call as CallExpression;
    if (!isLogCallee(ce)) continue;

    const args = ce.getArguments();
    for (const arg of args) {
      if (!arg.isKind(SyntaxKind.ObjectLiteralExpression)) continue;
      validateObjectLiteral(arg as ObjectLiteralExpression, file, findings);
    }
  }

  return {
    name: "log-schema",
    findings,
    filesScanned: 1,
    durationMs: 0,
  };
}

function isLogCallee(ce: CallExpression): boolean {
  const text = ce.getExpression().getText();
  return /\b(log|logger|console|pino|winston|bunyan)(\.|\(|$)/i.test(text);
}

function validateObjectLiteral(
  ol: ObjectLiteralExpression,
  file: string,
  findings: Finding[],
): void {
  // Only inspect objects that contain an adsa_path property — otherwise
  // it's just a regular log call and not in scope.
  const present = new Map<string, PropertyAssignment>();
  let hasAdsaPath = false;
  for (const prop of ol.getProperties()) {
    if (!prop.isKind(SyntaxKind.PropertyAssignment)) continue;
    const pa = prop as PropertyAssignment;
    const name = pa.getName();
    present.set(name, pa);
    if (name === "adsa_path") hasAdsaPath = true;
  }
  if (!hasAdsaPath) return;

  // Required fields
  for (const required of LOG_REQUIRED_FIELDS) {
    if (!present.has(required)) {
      const line = ol.getStartLineNumber();
      findings.push({
        check: "log-schema",
        file,
        line,
        column: 1,
        message: `adsa log object is missing required field "${required}"`,
        severity: "block",
        evidence: truncate(ol.getText()),
      });
    }
  }

  // Enum check on adsa_path
  const adsaPathProp = present.get("adsa_path");
  if (adsaPathProp) {
    const init = adsaPathProp.getInitializer();
    if (init && init.isKind(SyntaxKind.StringLiteral)) {
      const v = init.getLiteralText();
      if (!ADSA_PATH_VALUES.includes(v as "fast" | "slow")) {
        findings.push({
          check: "log-schema",
          file,
          line: adsaPathProp.getStartLineNumber(),
          column: 1,
          message: `adsa_path must be "fast" or "slow" (got "${v}")`,
          severity: "block",
          evidence: truncate(adsaPathProp.getText()),
        });
      }
    } else if (init && !init.isKind(SyntaxKind.StringLiteral)) {
      findings.push({
        check: "log-schema",
        file,
        line: adsaPathProp.getStartLineNumber(),
        column: 1,
        message: `adsa_path must be a string literal`,
        severity: "block",
        evidence: truncate(adsaPathProp.getText()),
      });
    }
  }

  // Forbidden adsa_ prefix keys not in the contract
  for (const key of present.keys()) {
    if (!key.startsWith("adsa_")) continue;
    if ((LOG_REQUIRED_FIELDS as readonly string[]).includes(key)) continue;
    if ((LOG_OPTIONAL_FIELDS as readonly string[]).includes(key)) continue;
    findings.push({
      check: "log-schema",
      file,
      line: present.get(key)!.getStartLineNumber(),
      column: 1,
      message: `Unknown adsa_ field "${key}" — not in the four-field contract`,
      severity: "warn",
      evidence: truncate(present.get(key)!.getText()),
    });
  }
}
