/**
 * Helpers for converting node positions into (line, column) coordinates.
 *
 * ts-morph's `getStart()` returns a numeric offset; `getStartLineNumber()`
 * returns the 1-based line. We compute the 1-based column by subtracting
 * the start of the line from the start offset.
 */

import type { Node } from "ts-morph";

/** ASCII code for newline. Extracted to avoid the magic-number heuristic. */
const NEWLINE_CODE = 10;

/** 1-based column number for the start of the given node. */
export function startColumn(node: Node): number {
  const sf = node.getSourceFile();
  const line = node.getStartLineNumber();
  // ts-morph v22+ exposes the line-start offset via compiler internals.
  // Walk the source text to find the start-of-line position.
  const text = sf.getFullText();
  let lineStart = 0;
  let currentLine = 1;
  for (let i = 0; i < text.length; i++) {
    if (currentLine === line) {
      lineStart = i;
      break;
    }
    if (text.charCodeAt(i) === NEWLINE_CODE) {
      currentLine++;
    }
  }
  return node.getStart() - lineStart + 1;
}
