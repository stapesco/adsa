// Fixture: slow-path-clean — passes slow-path-no-log because the function
// is marked slow AND emits the {adsa_path: "slow"} log line.

import { log } from "./logger.js";

/**
 * @adsa:slow
 * Loads the full user record from the database.
 */
export async function loadUser(userId: string) {
  log.info({ adsa_path: "slow", adsa_area: "auth" });
  return db.users.findUnique({ where: { id: userId } });
}
