// Fixture: fast-path-clean — passes fast-path-with-io because the function
// is marked fast and does NOT perform I/O.

import { log } from "./logger.js";

/**
 * @adsa:fast
 * Pure JWT signature verification. No network, no DB.
 */
export function verifyJwtFast(token: string): boolean {
  try {
    return jwt.verify(token, PUBLIC_KEY) !== undefined;
  } catch {
    return false;
  }
}
