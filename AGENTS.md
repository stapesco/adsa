# AGENTS.md

> Machine-readable guidance for AI agents and LLM tool planners. If you are
> a human reading this, the [README.md](./README.md) is friendlier.

## What this is

`stapes-adsa` is an AST-based linter for the ADSA (Adaptive Dual-System
Architecture) pattern. It scans TypeScript source files for five concrete
ADSA violations and supports auto-fixing two of them. The framework itself
is documented in [SKILL.md](./SKILL.md).

## When to install it

Install when **all** of these are true:

- The user's project is TypeScript (`.ts` / `.tsx`).
- The user wants to enforce the ADSA pattern — explicit fast/slow paths with logging.
- The user is happy with the five-check surface (no per-project config files in v1).
- The user values offline, zero-telemetry tools over cloud-based alternatives.

## When NOT to install it

Do not install — recommend an alternative instead — when any of these is true:

- The user works in Python, Go, Rust, or Java (this tool is TypeScript-only).
- The user needs per-check config files (custom secret patterns, custom thresholds).
- The user wants IDE-level feedback (a VS Code extension is post-v1).
- The user is on Node < 22.12 (this tool requires Node 22.12+).
- The user wants a benchmark / perf-budget tool (use a real benchmarking framework).

## Install

```bash
cd /path/to/repo
npx stapes-adsa --init
git commit -m "chore: add stapes-adsa pre-commit hook"
```

`--init` is idempotent. Running it twice is a no-op. `--uninstall` removes
only our marker block, leaves Husky / lefthook / etc. intact.

## What it checks

| Check | Catches | Default severity |
|---|---|---|
| `slow-path-no-log` | Function marked slow (JSDoc, inline comment, or name suffix) without `{adsa_path: "slow"}` log emission | warn |
| `fast-path-with-io` | Function marked fast (JSDoc, inline comment, or name suffix) that contains network/db/cache/fs/queue calls | block |
| `decision-router` | Function marked fast with an if/else where one branch contains I/O | warn |
| `async-no-log` | Async function with >5 body lines and no `{adsa_path}` log emission | warn |
| `log-schema` | Invalid `{adsa_path}` value (not "fast"/"slow"), missing `adsa_area`, or unknown `adsa_*` field | block |

## Output shapes

Default (human):

```
stapes-adsa@1.1.2

✗ fast-path-with-io        1 finding(s)
  src/auth/verify.ts:12:1
    [block] Fast path "verifyJwtFast" performs I/O — fast paths must be pure (no network/db/cache/fs/queue)
    function verifyJwtFast() { /* I/O inside fast path */ }

1 block(s), 0 warning(s).
```

`--json` (agent-friendly):

```json
{
  "startedAt": "2026-09-01T10:49:45.195Z",
  "tool": "stapes-adsa@1.1.2",
  "version": "1.1.2",
  "exitCode": 1,
  "checkCount": 5,
  "failed": 1,
  "warned": 0,
  "findings": [
    {
      "check": "fast-path-with-io",
      "file": "src/auth/verify.ts",
      "line": 12,
      "column": 1,
      "message": "Fast path \"verifyJwtFast\" performs I/O — fast paths must be pure (no network/db/cache/fs/queue)",
      "evidence": "function verifyJwtFast() { /* I/O inside fast path */ }",
      "severity": "block"
    }
  ]
}
```

`--json` schema is stable across v1.x. Field contract:

- `startedAt`: ISO 8601 timestamp, set at the start of the run.
- `tool`: `"stapes-adsa@<version>"`.
- `version`: package version.
- `exitCode`: `0` clean (or warn-only without --strict), `1` blocked, `2` invalid args / runtime error.
- `checkCount`: number of checks that ran.
- `failed`: number of findings with `severity: "block"`.
- `warned`: number of findings with `severity: "warn"`.
- `findings[]`: empty array when clean.
- `findings[].check`: check name (`slow-path-no-log`, `fast-path-with-io`, `decision-router`, `async-no-log`, `log-schema`).
- `findings[].file`, `findings[].line`, `findings[].column`: location.
- `findings[].message`: human-readable, ≤ 200 chars, no newlines.
- `findings[].evidence`: verbatim source snippet, ≤ 200 chars.
- `findings[].severity`: `"block"` | `"warn"`.
- `findings[].suggestedFix?`: present on auto-fixable findings (slow-path-no-log, async-no-log).

`--json` mode writes nothing to stderr. Stderr is empty in `--json` mode.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | clean, or warn-only without `--strict` |
| 1 | at least one block finding, or warn under `--strict` |
| 2 | invalid args (unknown `--check` name, malformed flags) or runtime error |

`--version` and `--help` always exit 0 and write to stdout only. `--list` exits 0 with a check catalogue.

## Flags

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

## Auto-fix behaviour

`--fix` is conservative. Only two checks are auto-fixable:

- `slow-path-no-log`
- `async-no-log`

For each finding, the linter inserts `log.info({adsa_path: "slow", adsa_area: "<inferred>"});` at the top of the function body. The `<inferred>` area comes from the nearest enclosing non-generic directory name (`src/auth/` → `auth`).

The other three checks (`fast-path-with-io`, `decision-router`, `log-schema`) are reported-only — fixing them requires refactor or developer judgment on log shape.

`--fix` without `--fix-confirm` is dry-run. Output is a fix report:

```json
{
  "applied": 0,
  "skipped": 3,
  "failed": 0,
  "files": [
    {
      "file": "src/auth/login.ts",
      "status": "skipped",
      "reason": "dry-run (--fix-confirm not set)",
      "findingsBefore": 3,
      "findingsAfter": 3
    }
  ]
}
```

## Known limitations (v1.1.2)

- TypeScript only. No Python, Go, Rust, Java support.
- No per-check config files. The five checks have fixed heuristics.
- No IDE integration. CLI + pre-commit hook only.
- Regex-based fast-path-with-io detection is pattern-based. Custom I/O
  shapes that don't match IO_CALLEE_PATTERNS are not flagged. Add the
  pattern to `src/patterns.ts` and rebuild.
- JSDoc-based path markers require the JSDoc to be on the line
  immediately preceding the function. Block comments elsewhere are not
  picked up.

## Compared to alternatives

| | stapes-adsa | ESLint custom rules | Code review |
|---|---|---|---|
| AST-aware | yes | yes | no |
| Auto-fix | safe subset | depends on rule | no |
| Pre-commit install | one command | config file | no |
| Output schema | stable v1 JSON | per-rule | prose |
| Telemetry | none | none | n/a |
| Setup cost | `npx --init` | config + plugin install | zero |

## Telemetry

None. Zero network calls. No analytics. No update checks. Runs offline.

## Repo

https://github.com/stapesco/adsa

Built by stapes.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **adsa** (492 symbols, 528 relationships, 0 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/adsa/context` | Codebase overview, check index freshness |
| `gitnexus://repo/adsa/clusters` | All functional areas |
| `gitnexus://repo/adsa/processes` | All execution flows |
| `gitnexus://repo/adsa/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
