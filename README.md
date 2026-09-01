# stapes-adsa

> AI coding assistants default every code path to "slow by default". Every
> function does the work, every request hits the database, every check
> resolves the user from scratch. You pay for the worst case on every call.
>
> `stapes-adsa` is the linter that catches this pattern in TypeScript code.
> Five AST-based checks, one safe auto-fix, one pre-commit hook, zero
> telemetry, zero config. Runs offline.

Want to know more about ADSA? [adaptivedualsystem.com](https://adaptivedualsystem.com/)

## Why

Three failure modes repeat across every TypeScript service that lacks an
explicit fast/slow architecture:

1. **The "cache" that isn't.** A function is named `getUserCache` and the
   author believed it returned in microseconds. The profiler shows 47ms.
   Reading the body: the function calls `fetch("/api/users/" + id)`. The
   cache key is the function name, not the runtime behaviour.
2. **The auth check that hits the database on every request.** A
   `verifyToken` function runs the JWT signature check (fast, correct)
   and then "for completeness" calls `db.users.findUnique(...)` (slow,
   every request, no batching). 99% of requests have a valid JWT — they
   never needed the DB.
3. **The rate limiter with no observability.** A request comes in. The
   rate-limit path runs. Sometimes it hits Redis, sometimes it falls
   back to a memory counter. Nobody knows which path the last 10,000
   requests took because nobody logged the path.

`stapes-adsa` flags all three. The linter scans every `.ts`/`.tsx` file,
identifies functions marked fast or slow, and verifies they actually
behave that way — and emit the log line that proves it.

The framework is described in [SKILL.md](./SKILL.md). The linter is the
enforcement.

## How

```bash
cd /path/to/your/repo
npx stapes-adsa --init
git commit -m "chore: add ADSA linter"
```

`--init` writes a marker-block shell script to `.git/hooks/pre-commit`.
On every commit, the linter runs against staged files. Blocks stop the
commit. Warnings print and let the commit pass.

```text
$ npx stapes-adsa
stapes-adsa@1.0.0

✗ fast-path-with-io        1 finding(s)
  src/auth/verify.ts:12:1
    [block] Fast path "verifyJwtFast" performs I/O — fast paths must be pure
    function verifyJwtFast() { /* I/O inside fast path */ }

⚠ slow-path-no-log         1 finding(s)
  src/auth/load.ts:31:1
    [warn] Function "loadUserPermissions" marked slow has no {adsa_path: "slow"} log emission
    async function loadUserPermissions() { /* slow path, no log */ }

1 block(s), 1 warning(s).
```

For AI agents and CI scripts, `--json` gives a stable, parseable shape:

```bash
npx stapes-adsa --json | jq '.exitCode, .findings[].message'
```

```json
{
  "startedAt": "2026-09-01T10:49:45.195Z",
  "tool": "stapes-adsa@1.0.0",
  "version": "1.0.0",
  "exitCode": 1,
  "checkCount": 5,
  "failed": 1,
  "warned": 1,
  "findings": [
    {
      "check": "fast-path-with-io",
      "file": "src/auth/verify.ts",
      "line": 12,
      "column": 1,
      "message": "Fast path \"verifyJwtFast\" performs I/O — fast paths must be pure",
      "evidence": "function verifyJwtFast() { /* I/O inside fast path */ }",
      "severity": "block"
    },
    {
      "check": "slow-path-no-log",
      "file": "src/auth/load.ts",
      "line": 31,
      "column": 1,
      "message": "Function \"loadUserPermissions\" marked slow has no {adsa_path: \"slow\"} log emission",
      "evidence": "async function loadUserPermissions() { /* slow path, no log */ }",
      "severity": "warn",
      "suggestedFix": {
        "description": "Insert slow-path log emission at top of loadUserPermissions",
        "replacement": "log.info({ adsa_path: \"slow\", adsa_area: \"auth\" });\n",
        "line": 32,
        "column": 1
      }
    }
  ]
}
```

Stderr is always empty in `--json` mode. Exit codes are the contract:
`0` clean, `1` blocked, `2` invalid args. That's the whole protocol.

## What

The five checks:

| Check | What it catches | Default severity | Auto-fixable |
|---|---|---|---|
| `slow-path-no-log` | Function marked slow (JSDoc, inline comment, or name suffix) without `{adsa_path: "slow"}` log emission | warn | yes |
| `fast-path-with-io` | Function marked fast (JSDoc, inline comment, or name suffix) that contains network / db / cache / fs / queue calls | block | no |
| `decision-router` | Function marked fast with an if/else where one branch contains I/O | warn | no |
| `async-no-log` | Async function with >5 body lines and no `{adsa_path}` log emission | warn | yes |
| `log-schema` | Invalid `{adsa_path}` value (not `"fast"` / `"slow"`), missing `adsa_area`, or unknown `adsa_*` field | block | no |

Flags:

```text
  --root <path>          project root (default: cwd)
  --check <name>         run a single check by name (repeatable)
  --list                 list available checks
  --strict               treat warnings as blocks
  --json                 emit JSON on stdout (stable v1 schema)
  --no-color             disable ANSI colour in human output
  --fix                  dry-run: report auto-fixable findings
  --fix-confirm          apply safe auto-fixes
  --init                 install the pre-commit hook (idempotent)
  --uninstall            remove the pre-commit hook
  --version
  --help
```

Idempotent. `npx stapes-adsa --init` run twice is a no-op. `--uninstall`
removes only our marker block — Husky, lefthook, or other pre-commit
hooks continue to run.

### Path markers

You can declare a path explicitly so the linter can verify it:

| Form | Effect |
|---|---|
| `/** @adsa:fast */` or `/** @adsa:slow */` JSDoc | Function classified |
| `// adsa:fast` or `// adsa:slow` inline comment | Function classified |
| Name suffix `Fast` / `Slow` (e.g. `verifyJwtFast`, `resolveSlow`) | Function classified |

### Worked example — auth

```ts
import { withAdsaLogging } from "stapes-adsa/lib/instrument";

// @adsa:fast — pure, no I/O
function verifyTokenFast(token: string): UserClaims | null {
  try {
    return jwt.verify(token, PUBLIC_KEY) as UserClaims;
  } catch {
    return null;
  }
}

// @adsa:slow — DB lookup
async function resolveSessionSlow(claims: UserClaims): Promise<Session> {
  return db.sessions.findUnique({ where: { userId: claims.sub } });
}

// Router
export async function authenticate(token: string) {
  return withAdsaLogging({
    area: "auth",
    predicate: async () => verifyTokenFast(token),
    slowPath: async () => {
      const claims = jwt.decode(token);
      if (!claims) throw new AuthError("invalid");
      return resolveSessionSlow(claims as UserClaims);
    },
  });
}
```

The linter checks that `verifyTokenFast` does not contain `fetch`,
`db.*`, `redis.*`, `fs.*`, etc. — and flags it as a `fast-path-with-io`
violation if it does. It checks that `resolveSessionSlow` contains a
`log.*({adsa_path: "slow"...})` call — and flags it as
`slow-path-no-log` if it does not.

### Agent-native

This tool is designed for AI agent runtimes and CI scripts:

- **Zero telemetry.** No network calls. No analytics. No update checks.
- **Zero config.** No files to write (besides the pre-commit hook on `--init`). No env vars to set.
- **`--json`** emits parseable output with a stable schema (see `AGENTS.md` for the contract).
- **Exit codes are stable.** `0` clean, `1` blocked, `2` invalid args. No other codes from the normal flow.
- **Idempotent install.** `--init` is safe to re-run. `--uninstall` removes cleanly.
- **Runs offline.** No API keys. No service to log into. Source files never leave the machine.

### Verify it yourself (5 lines)

```bash
# 1. Zero network calls during a run
npx stapes-adsa --json >/dev/null && \
  lsof -p $$ -i 2>/dev/null | grep -E "node|npx" || \
  echo "no outgoing TCP from this shell"

# 2. Idempotent init
npx stapes-adsa --init && \
  npx stapes-adsa --init  # second is a no-op

# 3. Stable JSON shape across runs
npx stapes-adsa --json | jq '{tool, version, exitCode, checkCount}'
```

### Telemetry

None. Zero network calls. The only filesystem writes are
`.git/hooks/pre-commit` during `--init` and source files modified
during `--fix-confirm`.

## Compared to

| Tool | What you trade away by choosing it |
|---|---|
| **ESLint custom rules** | The ESLint ecosystem is rich but you maintain the config, the plugins, and the rule definitions. `stapes-adsa` is one fixed check set, one install, zero config. |
| **Code review** | Humans catch context. They also miss the third "fetch inside the cache function" because they're tired on Friday afternoon. The linter doesn't get tired. |
| **Custom framework documentation** | "Just write ADSA in your head and trust the reviewers" — this is the current state. It scales to one team of five. It does not scale past that. |
| **OpenTelemetry spans** | OTEL tracks the *time* a path took. It does not enforce that the path was *classified* as fast or slow. Different layer. |

## What we measured

On 2026-09-01 we ran `stapes-adsa@1.0.0` against two production TypeScript services
before announcing it. Both repos had not adopted ADSA yet.

| Repo | .ts files | LoC | Findings | Density |
|---|---|---|---|---|
| `strat_nav` | 45 | 8,244 | 32 async-no-log | 0.71 / file |
| `risk_automation` | 60 | 5,051 | 132 async-no-log | 2.20 / file |

Findings breakdown: **100% async-no-log, zero blocks**. Every flagged function is
observability-dark today — no `adsa_path` log line is emitted. Installing the
linter closes the observability gap immediately: every flagged function gets a
structured log emission that ops can grep on.

For latency, the structural estimate is **30–60% per-request reduction on hot
paths once refactored**. The model:

- ~30% of findings are fast/slow candidates (cache lookup, JWT verify,
  indexed search). On those paths, fast path 1–2ms vs slow path 30–100ms,
  hit rate 95–99%. Per-call latency reduction on those paths: **~95%**.
- ~50% are pure slow paths with no fast variant — observability only.
- ~20% are already-fast false positives — observability only.

Code cost: each ADSA point adds ~30–50 LoC (predicate + slowPath + router).
For 8 ADSA points on a 5–10 kLoC service: **3–6% code growth**.

Trade ratio: roughly 1 LoC added → 5–15% latency saved on the hot path.

These are **structural estimates, not benchmarks**. No traffic traces were
captured. The 30–60% range assumes typical ratios from industry
cache/JWT/search patterns. The only guaranteed, immediate outcome is the
100% observability closure — the latency claim is conditional on engineering
work per flagged function. See [SAVINGS-NOTE.md](./SAVINGS-NOTE.md) for the
full model and the scan artifacts.

## Source

Visible at https://github.com/stapesco/adsa. Built by stapes. Read the
code. Fork it. PRs are not accepted.

See [SKILL.md](./SKILL.md) for the ADSA framework reference.
See [AGENTS.md](./AGENTS.md) for the machine-readable install contract
and the stable `--json` schema.

## Issues

If `stapes-adsa` doesn't work for you, the most likely fix is in one
of the five files under `src/checks/`. Read them, fork, patch.

For security disclosures, see [SECURITY.md](./SECURITY.md).

## License

MIT
