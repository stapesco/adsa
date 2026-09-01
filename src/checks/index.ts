/**
 * Check registry.
 *
 * The runner imports `CHECKS` and dispatches each one against every
 * scanned file. Adding a new check = add an entry here + write the file.
 */

import { Project, SourceFile } from "ts-morph";

import type { CheckResult } from "../types.js";
import { iterFunctions } from "../ast.js";
import { normalizePath } from "../util.js";

import { checkSlowPathNoLog } from "./slow-path-no-log.js";
import { checkFastPathWithIo } from "./fast-path-with-io.js";
import { checkDecisionRouter } from "./decision-router.js";
import { checkAsyncNoLog } from "./async-no-log.js";
import { checkLogSchema } from "./log-schema.js";

export interface Check {
  name: string;
  description: string;
  defaultEnabled: boolean;
  severityDefault: "block" | "warn";
  /** Run this check against one source file. */
  run: (sf: SourceFile) => CheckResult;
}

export const CHECKS: ReadonlyArray<Check> = [
  {
    name: "slow-path-no-log",
    description:
      "Function marked slow (JSDoc, inline comment, or name suffix) without {adsa_path: \"slow\"} log emission",
    defaultEnabled: true,
    severityDefault: "warn",
    run: (sf: SourceFile) => {
      const functions = Array.from(iterFunctions(sf));
      const r = checkSlowPathNoLog(normalizePath(sf.getFilePath()), functions);
      return r;
    },
  },
  {
    name: "fast-path-with-io",
    description:
      "Function marked fast (JSDoc, inline comment, or name suffix) that contains I/O (network/db/cache/fs/queue)",
    defaultEnabled: true,
    severityDefault: "block",
    run: (sf: SourceFile) => {
      const functions = Array.from(iterFunctions(sf));
      const r = checkFastPathWithIo(normalizePath(sf.getFilePath()), functions);
      return r;
    },
  },
  {
    name: "decision-router",
    description:
      "Function marked fast with an if/else where one branch contains I/O — implicit fast/slow split hiding inside a conditional",
    defaultEnabled: true,
    severityDefault: "warn",
    run: (sf: SourceFile) => {
      const functions = Array.from(iterFunctions(sf));
      const r = checkDecisionRouter(normalizePath(sf.getFilePath()), functions);
      return r;
    },
  },
  {
    name: "async-no-log",
    description:
      "Async function with >5 body lines and no {adsa_path: ...} log emission — likely a slow path not declaring itself",
    defaultEnabled: true,
    severityDefault: "warn",
    run: (sf: SourceFile) => {
      const functions = Array.from(iterFunctions(sf));
      const r = checkAsyncNoLog(normalizePath(sf.getFilePath()), functions);
      return r;
    },
  },
  {
    name: "log-schema",
    description:
      "Validate {adsa_path, adsa_area} log object literals against the four-field contract",
    defaultEnabled: true,
    severityDefault: "block",
    run: (sf: SourceFile) => checkLogSchema(sf),
  },
];

export function getCheck(name: string): Check | undefined {
  return CHECKS.find((c) => c.name === name);
}

export function listCheckNames(): string[] {
  return CHECKS.map((c) => c.name);
}

/** ts-morph ESNext target enum value (ScriptTarget.ESNext = 99). */
const ESNEXT_TARGET = 99;

/** Project factory — kept here so the runner and CLI share the same config. */
export function createProject(): Project {
  return new Project({
    useInMemoryFileSystem: false,
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    compilerOptions: {
      target: ESNEXT_TARGET,
      allowJs: false,
      skipLibCheck: true,
      strict: false,
    },
  });
}
