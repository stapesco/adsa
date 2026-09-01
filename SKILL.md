---
name: adsa
description: Apply ADSA (Adaptive Dual-System Architecture) fast/slow path splitting to TypeScript code. Use when designing or reviewing a function, module, or service that has a decision point which could be cheap (cache, regex, JWT verify) vs expensive (DB, network, FS), when adding observability for fast_path_rate, or when fixing a "this should be fast but it isn't" performance bug. Triggers on phrases like "ADSA", "fast path", "slow path", "fast/slow", "router between", "cache vs compute", "the slow path is too slow", "permission check", "auth lookup", "validation rule", "rate limit", "ingestion pipeline". Outputs the four-field log contract {adsa_path, adsa_area, adsa_reason?, adsa_save_pct?}. Pairs with `stapes-adsa` (the AST linter) for automated enforcement.
---

# ADSA — Adaptive Dual-System Architecture

ADSA is a thinking pattern. Every code path is either **fast** (cheap, deterministic, no I/O) or **slow** (full context, expensive). Routing between them is explicit. The path taken is logged.

This skill is the framework reference. The linter (`stapes-adsa` on npm) enforces it.

## The four-question self-assessment

Before writing a function, code path, or service, ask:

1. **Does this code make a decision based on input?**
2. **Is there a cheap way to make that decision?** (cache, JWT, regex, simple calc, type check)
3. **Is a minority of cases that need the expensive path?**
4. **Would logging the path taken help observability?**

If 2 or more are YES — apply ADSA. Structure the code as `FastPath → Router → SlowPath → UnifiedOutput + log(adsa_path)`.

## The four-field log contract

Every ADSA-coded path emits one structured log line at the moment routing happens:

```json
{
  "adsa_path": "fast" | "slow",
  "adsa_area": "<scope>",
  "adsa_reason": "<why this path>",          // optional
  "adsa_save_pct": 0..100                     // optional, percentage saved vs slow
}
```

Field rules:

| Field | Required | Values | Notes |
|---|---|---|---|
| `adsa_path` | yes | `"fast"` \| `"slow"` | Case-sensitive. Other values fail the linter. |
| `adsa_area` | yes | string | Scope. Use directory or module name. |
| `adsa_reason` | no | string | Human-readable why. No PII. |
| `adsa_save_pct` | no | number 0..100 | Saved fraction vs the slow path. |

Log schema violations are blocked by `stapes-adsa check log-schema`.

## Path markers (optional, for linter detection)

You can declare a path explicitly so the linter can verify it:

| Marker | Form | Effect |
|---|---|---|
| JSDoc tag | `/** @adsa:fast */` or `/** @adsa:slow */` | Function classified |
| Inline comment | `// adsa:fast` immediately preceding | Function classified |
| Name suffix | `verifyFast`, `resolveSlow`, `lookupCacheFast` | Function classified |

If no marker is present, the linter applies a heuristic (async + >5 body lines → candidate slow path).

## Worked examples

### 1. Auth — the most common ADSA case

```ts
import { withAdsaLogging } from "stapes-adsa/lib/instrument";

// FAST: verify JWT signature. Pure. No I/O.
function verifyTokenFast(token: string): UserClaims | null {
  try {
    return jwt.verify(token, PUBLIC_KEY) as UserClaims;
  } catch {
    return null;
  }
}

// SLOW: full session resolution. Hits DB.
async function resolveSessionSlow(claims: UserClaims): Promise<Session> {
  return db.sessions.findUnique({ where: { userId: claims.sub } });
}

// Router
export async function authenticate(token: string) {
  return withAdsaLogging({
    area: "auth",
    predicate: async () => verifyTokenFast(token),  // fast path
    slowPath: async () => {
      const claims = jwt.decode(token);              // decode only, still cheap
      if (!claims) throw new AuthError("invalid");
      return resolveSessionSlow(claims as UserClaims);
    },
  });
}
```

Why: `verifyTokenFast` needs no I/O. It runs in microseconds. The 99% of tokens that are valid JWTs never touch the DB. The slow path runs only on tokens that fail signature verification.

### 2. Cache — wrap a lookup

```ts
async function getUserPermissions(userId: string): Promise<Permission[]> {
  return withAdsaLogging({
    area: "permission",
    predicate: async () => cache.get(`perms:${userId}`),     // fast: in-memory hit
    slowPath: async () => {
      const perms = await db.permissions.findMany({ where: { userId } });
      cache.set(`perms:${userId}`, perms, { ttl: 60 });
      return perms;
    },
  });
}
```

Why: when the cache hits, the function returns in single-digit microseconds and emits `adsa_path: "fast"`. When the cache misses, it computes, sets the cache, and emits `adsa_path: "slow"`. The fast-path-rate metric becomes the cache hit ratio.

### 3. Search — Meilisearch vs DB

```ts
async function searchProducts(query: string): Promise<Hit[]> {
  return withAdsaLogging({
    area: "search",
    predicate: async () => meili.index("products").search(query, { limit: 20 }),
    slowPath: async () => db.products.findMany({ where: { name: { contains: query } } }),
  });
}
```

Why: Meilisearch handles typo-tolerance, ranking, and facet aggregation in one shot. The DB fallback exists for index-stale or empty-index cases. The log line tells ops which path the request took.

### 4. Rate limit — Redis counter vs request rejection

```ts
async function checkRateLimit(userId: string): Promise<boolean> {
  return withAdsaLogging({
    area: "rate-limit",
    predicate: async () => {
      const count = await redis.incr(`rl:${userId}`);
      if (count === 1) await redis.expire(`rl:${userId}`, 60);
      return count <= 100;
    },
    // slow path: degrade to memory-only counter if Redis is down
    slowPath: async () => memCounter.incr(userId) <= 100,
  });
}
```

Why: Redis is fast but still I/O. The fast path is the normal operation. The slow path is a degraded mode that runs only when Redis is unavailable — and logs it so ops sees the degradation.

## Anti-patterns

- **Uniformly cheap code.** Don't apply ADSA to a pure function with no decision point. Over-engineering.
- **Uniformly expensive code.** If every call hits the DB, splitting fast/slow is the wrong split. Use caching or batching instead.
- **PII in `adsa_reason`.** The reason field is logged to your observability stack. Treat it as user-visible.
- **Logging on the wrong side.** Emit `adsa_path` once, at the routing point. Don't log inside the slow path's I/O calls.
- **Silent failures.** The router must surface the fast/slow distinction in both the response shape and the log. A failure mode that returns success without distinguishing fast/slow is a bug.

## Self-assessment output (fire at task start)

When this skill is loaded, the next user-visible line should be one of:

```
ADSA: YES — fast/slow split in [paths] | NO — monolithic OK
```

Followed by the framework's coverage summary across the four areas:

| Area | Fast Path | Slow Path |
|---|---|---|
| Auth | JWT verify, claim extract | DB session lookup |
| Cache | In-memory hit | DB/API call + cache set |
| Search | Meilisearch query | DB full-text scan |
| Permissions | Role bit, cached perm | RBAC/ACL gRPC |
| Validation | Regex, literal check | Rule engine, external policy |
| Data ingestion | Single write/read | Multi-step transform, enrichment |
| Rate limiting | In-memory counter | Distributed counter (Redis) |
| Config / flags | Local eval | Remote config service |

## Pairing with `stapes-adsa`

This skill is the framework reference. The linter is the enforcement:

```bash
npx stapes-adsa --root .          # scan, exit 1 on block
npx stapes-adsa --json            # agent-friendly output
npx stapes-adsa --init            # install pre-commit hook
npx stapes-adsa --fix             # dry-run safe auto-fixes
npx stapes-adsa --fix-confirm     # apply safe auto-fixes
```

The linter catches:

| Check | What it catches |
|---|---|
| `slow-path-no-log` | Function marked slow without `{adsa_path: "slow"}` log |
| `fast-path-with-io` | Function marked fast that contains network/db/cache/fs/queue calls |
| `decision-router` | Function marked fast with an if/else where one branch does I/O |
| `async-no-log` | Async function >5 lines without an `{adsa_path}` log line |
| `log-schema` | Invalid `{adsa_path}` value, missing `adsa_area`, unknown `adsa_*` field |

Use the linter in pre-commit + CI. Use this skill when designing the structure.
