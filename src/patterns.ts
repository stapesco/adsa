/**
 * ADSA pattern definitions.
 *
 * These constants are the contract between the linter and the framework
 * described in SKILL.md. Changing them is a breaking change.
 *
 * - MARKER_PATTERNS: explicit declarations of fast/slow on a function.
 * - IO_PATTERNS: call shapes that count as "I/O" inside a fast path.
 * - LOG_FIELD_NAMES: the four-field {adsa_path, adsa_area, adsa_reason?, adsa_save_pct?}
 *   contract. Validated by the `log-schema` check.
 */

/** Function-name suffix that explicitly marks a fast path. */
export const FAST_NAME_REGEX = /(?:^|[_$])(?:Fast|fast)(?:Path|path)?(?:$|[^a-zA-Z0-9_$])/;

/** Function-name suffix that explicitly marks a slow path. */
export const SLOW_NAME_REGEX = /(?:^|[_$])(?:Slow|slow)(?:Path|path)?(?:$|[^a-zA-Z0-9_$])/;

/** JSDoc tag that explicitly marks a fast path. */
export const ADSA_FAST_TAG = "@adsa:fast";

/** JSDoc tag that explicitly marks a slow path. */
export const ADSA_SLOW_TAG = "@adsa:slow";

/** Inline single-line comment that marks a path. */
export const ADSA_INLINE_FAST = /^\s*\/\/\s*adsa:\s*fast\b/i;
export const ADSA_INLINE_SLOW = /^\s*\/\/\s*adsa:\s*slow\b/i;

/**
 * Call shapes that count as I/O. Used by `fast-path-with-io` and `decision-router`.
 * Match is against the *full* callee text (e.g. `fetch(...)`, `db.query(...)`).
 */
export const IO_CALLEE_PATTERNS: RegExp[] = [
  // Network
  /\bfetch\s*\(/,
  /\baxios\s*\(/,
  /\bgot\s*\(/,
  /\bnode-fetch\b/,
  /\bhttp\.(get|post|put|delete|patch|request)\s*\(/,
  /\bhttps\.(get|post|put|delete|patch|request)\s*\(/,
  // DB clients
  /\bdb\.(query|execute|find|findOne|findMany|insert|update|delete|raw|select)\s*\(/i,
  // ORM call shapes — `db.<table>.<verb>(`, `prisma.<model>.<verb>(`, `sql.<table>(`
  /\bdb\.\w+\.(query|execute|find|findOne|findMany|findUnique|findFirst|create|update|delete|upsert|insert|aggregate|count|groupBy|raw|select)\s*\(/i,
  /\bknex\s*\(/,
  /\bprisma\.\w+\.(find|findUnique|findMany|findFirst|create|update|delete|upsert|insert|aggregate|count|groupBy)\s*\(/i,
  /\bsql\.\w+\s*\(/i,
  /\bsql\.\w+\s*\(/i,
  /\bpg\.(query|connect)\s*\(/,
  /\bmysql\.(query|connect)\s*\(/,
  // Cache / KV
  /\bredis\.(get|set|del|hget|hset|lpush|rpush|sadd|srem|zadd|zrem|eval)\s*\(/i,
  /\bmemcached\.(get|set|del)\s*\(/i,
  // File system
  /\bfs\.(readFile|writeFile|appendFile|unlink|mkdir|rm|readdir|stat|access)\s*\(/i,
  /\bfs\.promises\.(readFile|writeFile|appendFile|unlink|mkdir|rm|readdir|stat|access)\s*\(/i,
  /\bfsPromises\.(readFile|writeFile|appendFile|unlink|mkdir|rm|readdir|stat|access)\s*\(/i,
  // Queue / message
  /\bkafka\.(produce|publish|send|consume|subscribe)\s*\(/i,
  /\bsqs\.(sendMessage|receiveMessage)\s*\(/i,
  /\bsns\.(publish)\s*\(/i,
  /\bnats\.(publish|subscribe|request)\s*\(/i,
  /\bamqp\.(publish|consume)\s*\(/i,
  // External RPC
  /\bgrpc\.(unary|client)\b/i,
  // Generic await of any identifier that *might* be I/O (heuristic).
  /\bawait\s+\w+/,
];

/**
 * Required fields on a valid {adsa_path, ...} log call.
 * Validated by the `log-schema` check.
 */
export const LOG_REQUIRED_FIELDS = ["adsa_path", "adsa_area"] as const;

/** Optional fields. Their presence is allowed; their absence is allowed. */
export const LOG_OPTIONAL_FIELDS = ["adsa_reason", "adsa_save_pct"] as const;

/** Valid values for adsa_path. Anything else is a schema violation. */
export const ADSA_PATH_VALUES: ReadonlyArray<"fast" | "slow"> = ["fast", "slow"];
