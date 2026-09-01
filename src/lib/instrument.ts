/**
 * `withAdsaLogging` — a reference runtime helper.
 *
 * Wrap any async operation to get automatic `{adsa_path: "slow"}`
 * logging when it does I/O, and `{adsa_path: "fast"}` logging when
 * the predicate returns true without performing the operation.
 *
 * Usage:
 *
 *   import { withAdsaLogging } from "stapes-adsa/lib/instrument";
 *
 *   const result = await withAdsaLogging(
 *     "permission",
 *     async () => isAdmin(userId),       // fast predicate
 *     async () => loadPermissions(userId) // slow path
 *   );
 *
 *   // Logs: { adsa_path: "fast", adsa_area: "permission", adsa_reason: "predicate_true" }
 *   //    or { adsa_path: "slow", adsa_area: "permission", adsa_reason: "predicate_false" }
 *
 * The wrapper is intentionally minimal. It exists so engineers don't have
 * to remember the four-field log shape. Real-world code may use pino,
 * winston, bunyan, or a custom logger — pass yours via `log`.
 */

export interface LoggerLike {
  info: (obj: Record<string, unknown>, msg?: string) => void;
  warn?: (obj: Record<string, unknown>, msg?: string) => void;
  debug?: (obj: Record<string, unknown>, msg?: string) => void;
}

/** Minimal console-based logger used when none is supplied. */
const defaultLogger: LoggerLike = {
  info: (obj) => {
    process.stdout.write(JSON.stringify(obj) + "\n");
  },
};

export interface WithAdsaLoggingOptions<TFastResult, TSlowResult> {
  area: string;
  predicate: () => Promise<TFastResult> | TFastResult;
  slowPath: () => Promise<TSlowResult> | TSlowResult;
  log?: LoggerLike;
  /** Force the slow path even if the predicate succeeds. Useful for tests. */
  forceSlow?: boolean;
}

export type WithAdsaLoggingResult<TFastResult, TSlowResult> =
  | { path: "fast"; value: TFastResult }
  | { path: "slow"; value: TSlowResult };

/**
 * Route between a fast predicate and a slow path, emitting the
 * ADSA log line on each invocation.
 */
export async function withAdsaLogging<TFastResult, TSlowResult>(
  opts: WithAdsaLoggingOptions<TFastResult, TSlowResult>,
): Promise<WithAdsaLoggingResult<TFastResult, TSlowResult>> {
  const log = opts.log ?? defaultLogger;
  if (!opts.forceSlow) {
    try {
      const value = await opts.predicate();
      log.info(
        { adsa_path: "fast", adsa_area: opts.area, adsa_reason: "predicate_true" },
        "adsa fast path",
      );
      return { path: "fast", value };
    } catch (err) {
      log.info(
        { adsa_path: "slow", adsa_area: opts.area, adsa_reason: "predicate_threw" },
        "adsa slow path (predicate threw)",
      );
      const value = await opts.slowPath();
      return { path: "slow", value };
    }
  }
  log.info(
    { adsa_path: "slow", adsa_area: opts.area, adsa_reason: "force_slow" },
    "adsa slow path",
  );
  const value = await opts.slowPath();
  return { path: "slow", value };
}
