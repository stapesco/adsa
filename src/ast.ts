/**
 * AST helpers shared across checks.
 *
 * All checks operate on `ts-morph` SourceFile nodes. These helpers
 * extract the ADSA-relevant signals:
 *
 *   - `getFunctionName`            — name for marker regex matching
 *   - `getAdsaPathMarker`          — "fast" | "slow" | undefined, from JSDoc/name/comment
 *   - `isAsyncFunction`            — function is declared `async`
 *   - `hasAdsaLogCall`             — body contains a log call with {adsa_path: "fast"|"slow"}
 *   - `containsIoCall`             — body contains a callee matching IO_CALLEE_PATTERNS
 *   - `iterFunctions`              — walk all function-like nodes in a source file
 */

import {
  ArrowFunction,
  FunctionDeclaration,
  FunctionExpression,
  FunctionLikeDeclaration,
  MethodDeclaration,
  Node,
  ObjectLiteralExpression,
  PropertyAssignment,
  SyntaxKind,
  CallExpression,
  SourceFile,
  SyntaxList,
  JSDoc,
  JSDocTag,
} from "ts-morph";

import {
  ADSA_FAST_TAG,
  ADSA_SLOW_TAG,
  ADSA_INLINE_FAST,
  ADSA_INLINE_SLOW,
  FAST_NAME_REGEX,
  SLOW_NAME_REGEX,
  IO_CALLEE_PATTERNS,
} from "./patterns.js";

/** A function-like node we care about. */
export type AnyFunction =
  | FunctionDeclaration
  | MethodDeclaration
  | FunctionExpression
  | ArrowFunction;

/**
 * Get the textual name of a function. Anonymous arrows return "".
 */
export function getFunctionName(fn: AnyFunction): string {
  if (fn.isKind(SyntaxKind.FunctionDeclaration)) {
    return (fn as FunctionDeclaration).getName() ?? "";
  }
  if (fn.isKind(SyntaxKind.MethodDeclaration)) {
    return (fn as MethodDeclaration).getName();
  }
  const parent = fn.getParent();
  if (parent && parent.isKind(SyntaxKind.VariableDeclaration)) {
    return parent.getName();
  }
  return "";
}

/**
 * Read the ADSA path marker attached to a function.
 *
 * Resolution order (most explicit wins):
 *   1. JSDoc tag `@adsa:fast` / `@adsa:slow`
 *   2. Inline comment `// adsa:fast` / `// adsa:slow` immediately preceding
 *   3. Function name suffix `Fast` / `Slow`
 *
 * Returns undefined when no marker is present.
 */
export function getAdsaPathMarker(fn: AnyFunction): "fast" | "slow" | undefined {
  // 1. JSDoc tags
  for (const tag of collectJsDocTags(fn)) {
    const t = tag.getText();
    if (t.includes(ADSA_FAST_TAG)) return "fast";
    if (t.includes(ADSA_SLOW_TAG)) return "slow";
  }
  // 2. Inline leading comment
  const leading = fn.getLeadingCommentRanges() ?? [];
  for (const range of leading) {
    const text = range.getText();
    if (ADSA_INLINE_FAST.test(text)) return "fast";
    if (ADSA_INLINE_SLOW.test(text)) return "slow";
  }
  // 3. Name pattern
  const name = getFunctionName(fn);
  if (!name) return undefined;
  if (FAST_NAME_REGEX.test(name)) return "fast";
  if (SLOW_NAME_REGEX.test(name)) return "slow";
  return undefined;
}

/** Collect all JSDoc tag nodes attached to a function, or its container. */
function collectJsDocTags(fn: AnyFunction): JSDocTag[] {
  const tags: JSDocTag[] = [];
  for (const jsdoc of fn.getJsDocs()) {
    tags.push(...jsdoc.getTags());
  }
  return tags;
}

/** True if the function is declared `async`. */
export function isAsyncFunction(fn: AnyFunction): boolean {
  return fn.isAsync();
}

/**
 * True if the function body contains a log call with an `{adsa_path: "fast"|"slow"}` shape.
 *
 * "log call" = a CallExpression whose callee identifier / member name matches
 *   ./^log(_|$)|logger|console$|pino|winston|bunyan/i
 *
 * The first object-literal argument is inspected for an `adsa_path` property
 * with a string-literal value of "fast" or "slow".
 */
export function hasAdsaLogCall(fn: AnyFunction): boolean {
  let found = false;
  fn.forEachDescendant((node) => {
    if (found) return;
    if (!node.isKind(SyntaxKind.CallExpression)) return;
    const call = node as CallExpression;
    if (!isLogCallee(call)) return;
    const args = call.getArguments();
    for (const arg of args) {
      if (arg.isKind(SyntaxKind.ObjectLiteralExpression)) {
        if (objectLiteralHasAdsaPath(arg as ObjectLiteralExpression)) {
          found = true;
          return;
        }
      }
    }
  });
  return found;
}

/** True if the callee of `call` looks like a logging function. */
function isLogCallee(call: CallExpression): boolean {
  const expr = call.getExpression();
  const text = expr.getText();
  return /\b(log|logger|console|pino|winston|bunyan)(\.|\(|$)/i.test(text);
}

/** True if the object literal contains `adsa_path: "fast"|"slow"`. */
function objectLiteralHasAdsaPath(ol: ObjectLiteralExpression): boolean {
  for (const prop of ol.getProperties()) {
    if (!prop.isKind(SyntaxKind.PropertyAssignment)) continue;
    const pa = prop as PropertyAssignment;
    if (pa.getName() !== "adsa_path") continue;
    const init = pa.getInitializer();
    if (!init) return false;
    if (init.isKind(SyntaxKind.StringLiteral)) {
      const v = init.getLiteralText();
      return v === "fast" || v === "slow";
    }
    return false;
  }
  return false;
}

/**
 * True if the function body contains an I/O call per IO_CALLEE_PATTERNS.
 *
 * `ignoreCallee` allows a check to skip its own log emission when scanning.
 */
export function containsIoCall(fn: AnyFunction, ignoreCallee?: string): boolean {
  let found = false;
  fn.forEachDescendant((node) => {
    if (found) return;
    if (!node.isKind(SyntaxKind.CallExpression)) return;
    const call = node as CallExpression;
    const calleeText = call.getExpression().getText();
    if (ignoreCallee && calleeText === ignoreCallee) return;
    const fullText = call.getText();
    for (const rx of IO_CALLEE_PATTERNS) {
      if (rx.test(fullText) || rx.test(calleeText)) {
        found = true;
        return;
      }
    }
  });
  return found;
}

/**
 * Walk every function-like node in a SourceFile. Yields each one exactly once.
 */
export function* iterFunctions(sf: SourceFile): Generator<AnyFunction> {
  for (const node of sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)) {
    yield node as FunctionDeclaration;
  }
  for (const node of sf.getDescendantsOfKind(SyntaxKind.MethodDeclaration)) {
    yield node as MethodDeclaration;
  }
  for (const node of sf.getDescendantsOfKind(SyntaxKind.FunctionExpression)) {
    yield node as FunctionExpression;
  }
  for (const node of sf.getDescendantsOfKind(SyntaxKind.ArrowFunction)) {
    yield node as ArrowFunction;
  }
}

/** Count lines in a function body (approximate; uses node text). */
export function functionLineCount(fn: AnyFunction): number {
  const text = fn.getBody()?.getText() ?? fn.getText();
  return text.split("\n").length;
}
