// Fixture: log-schema-violation — fails log-schema.
// Multiple invalid shapes: wrong enum, missing area, unknown field.

import { log } from "./logger.js";

export function handlerA() {
  log.info({ adsa_path: "FAST", adsa_area: "auth" });           // wrong case
  log.info({ adsa_path: "fast" });                              // missing adsa_area
  log.info({ adsa_path: "slow", adsa_area: "x", adsa_zzz: 1 }); // unknown adsa_* field
  log.info({ adsa_path: "medium" });                            // invalid enum
}
