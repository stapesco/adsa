// Fixture: clean — passes all five ADSA checks.

import { log } from "./logger.js";

/**
 * @adsa:fast
 * Pure local check.
 */
export function isAdminFast(user: User): boolean {
  return user.role === "admin";
}

/**
 * @adsa:slow
 * Loads full permissions from the database.
 */
export async function loadPermissionsSlow(userId: string): Promise<Permission[]> {
  log.info({ adsa_path: "slow", adsa_area: "permission" });
  return db.permissions.findMany({ where: { userId } });
}

// A small async helper — does not trip async-no-log because it has <5 body lines.
export async function id<T>(x: T): Promise<T> { return x; }
