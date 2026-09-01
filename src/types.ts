/**
 * Shared types for stapes-adsa.
 *
 * `Finding` is the atomic unit emitted by every check. `CheckResult`
 * is the per-check aggregate. The runner collects `CheckResult[]`
 * into the v1 `--json` shape (see runner.ts).
 */

/** Severity of a finding. Determines exit code and `--strict` behavior. */
export type Severity = "block" | "warn";

/** ADSA path classification. The four-field log contract uses this as the enum. */
export type AdsaPath = "fast" | "slow";

/** A single violation reported by a check. */
export interface Finding {
  /** Check that produced the finding, e.g. "slow-path-no-log". */
  check: string;
  /** Repo-relative path of the source file. */
  file: string;
  /** 1-based line number. */
  line: number;
  /** 1-based column number. */
  column: number;
  /** Human-readable message. No newlines, max 200 chars. */
  message: string;
  /** Severity per SPEC.md invariant #8. */
  severity: Severity;
  /** Verbatim source snippet (one line, truncated to 200 chars). */
  evidence: string;
  /** Optional suggested fix. `--fix` uses this when present and conservative. */
  suggestedFix?: SuggestedFix;
}

/** A safe auto-fix that the runner can apply. */
export interface SuggestedFix {
  /** Short label, e.g. "insert slow-path log line". */
  description: string;
  /** The exact text to insert at `line`, `column`. */
  replacement: string;
  /** 1-based line number where the fix applies. */
  line: number;
  /** 1-based column number where the fix applies. */
  column: number;
}

/** A check's aggregate output. */
export interface CheckResult {
  /** Check name, e.g. "slow-path-no-log". */
  name: string;
  /** All findings produced by this check run. */
  findings: Finding[];
  /** Total files inspected by this check. */
  filesScanned: number;
  /** Wall-clock duration in milliseconds. */
  durationMs: number;
}
