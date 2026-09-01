# SPEC — stapes-adsa

## Invariants

The tool MUST satisfy these at all times. If a test cannot fail when an invariant breaks, the invariant is not real.

1. **AST-based detection.** Every check operates on a TypeScript AST produced by `ts-morph`. Regex-only detection is forbidden — it produces false positives that erode trust.
2. **Deterministic output.** Same input files → byte-identical `--json` output. No timestamps in findings. No process IDs. No filesystem-dependent ordering.
3. **Stable exit codes.** `0` clean, `1` blocked findings, `2` invalid args (unknown flag, parse error on a TS file). No other exit codes from the normal flow.
4. **Zero telemetry.** No network calls. No analytics. No update checks. The only filesystem write is the `.git/hooks/pre-commit` script during `--init` and source files modified during `--fix`.
5. **Stable `--json` schema.** The output object has fields `{startedAt, tool, version, exitCode, checkCount, failed, warned, findings[]}`. Schema is frozen for v1.x. Additive changes only in v2.
6. **Idempotent `--init`.** Running `--init` twice is a no-op. Running `--init` on a repo with a Husky or lefthook hook does not clobber it — marker block only.
7. **Conservative `--fix`.** `--fix` MUST NOT modify a file that contains a violation it cannot safely auto-correct. The conservative subset is: insert `log.info({adsa_path: "slow", adsa_area: "<inferred>"})` at the top of an unmarked async function. Everything else is reported, not fixed.
8. **Findings carry evidence.** Every finding has `file`, `line`, `column`, `message`, `severity`, `evidence`, `suggestedFix?`. `evidence` is the exact source snippet (one line, truncated to 200 chars).
9. **Path inference is deterministic.** When a function has no `adsa_area` hint, inference follows the rule: nearest enclosing directory name (`src/auth/` → `auth`) → fallback to the file's basename → fallback to `unscoped`. Same function → same area, every run.
10. **The four-field log contract.** `{adsa_path, adsa_area}` are required; `{adsa_reason, adsa_save_pct}` are optional. `adsa_path` MUST be `"fast"` or `"slow"`. Invalid shapes are flagged by the `adsa-log-schema` check.

## Goal

`stapes-adsa` is the open-source enforcement companion to the Adaptive Dual-System Architecture pattern. It ships in v1 as:

1. An AST-based linter that flags five concrete ADSA violations in any TypeScript codebase.
2. A `--fix` mode that auto-inserts the missing `log.info({adsa_path: "slow"...})` line for the two violation types where it is safe.
3. A pre-commit hook installer (`--init`) that runs the linter on staged TS files before every commit.
4. A `SKILL.md` that documents the framework for AI agents and humans — loadable by Claude Code, Cursor, OpenCode, and any MCP-capable agent runtime.
5. An npm-distributed CLI (`npx stapes-adsa`), MIT-licensed, that runs offline, emits agent-friendly `--json`, and matches the packaging contract established by `stapes-precommit` and `stapes-context-trim`.

Definition of done for v1:

- All five checks ship with passing tests, documented in README and AGENTS.md.
- `--fix` round-trips on at least three real-world fixtures without breaking syntax.
- `--init` installs on a clean repo and uninstalls cleanly.
- `SKILL.md` triggers the framework in Claude Code eval cases (≥4/5 correct application).
- README leads with `## Why` (Golden Circle) and includes 3-4 worked examples.
- `npm test` exits 0. `npm run build` exits 0. SkillSpector scan exits 0.
- Tagged v1.0.0, published to npm with provenance, GitHub release cut.

## Out of scope

These are explicit non-goals for v1. Documenting them prevents scope creep.

- **Languages other than TypeScript.** Python, Go, Rust, Java support deferred indefinitely. The linter refuses to scan non-`.ts`/`.tsx` files.
- **IDE plugins.** VS Code extension, JetBrains plugin. Not in v1.
- **Remote/team dashboard.** No central server, no team metrics. Path-rate observability is the user's responsibility via their existing log pipeline.
- **Custom rules via config.** v1 has fixed checks. Config-file-based rule addition is post-v1.
- **Refactoring fast-path-with-io.** Detected and reported. Auto-fixing requires human judgment (extracting the I/O call into a separate slow path), so it stays reported-only.
- **Performance budget enforcement.** "This function MUST be under 5ms" — that's a benchmark, not a linter rule.
- **Mutation of staged files outside `--fix`.** Normal `--run` is read-only.

## Acceptance

How we prove each invariant:

| # | Invariant | Test |
|---|---|---|
| 1 | AST-based | Unit test: a violation that is invisible to regex (e.g. multi-line comment that says "// slow path" but no log call) is still flagged. |
| 2 | Deterministic | Test runs the same fixture twice, diffs the `--json` output, asserts byte-identical except `startedAt`. |
| 3 | Stable exit codes | Tests cover clean (0), blocked (1), invalid args (2). Asserts no other codes. |
| 4 | Zero telemetry | `lsof` assertion during test run. Manual verification in README "Verify it yourself" section. |
| 5 | Stable JSON schema | JSON-schema fixture validates the v1 shape. CI runs schema validation. |
| 6 | Idempotent init | Test: run `--init` twice, assert hook file content unchanged. Run with Husky present, assert Husky hook not clobbered. |
| 7 | Conservative fix | Test: file with `fast-path-with-io` is NOT auto-fixed. File with `slow-path-no-log` IS. Diff matches expected output. |
| 8 | Evidence in findings | Test: every finding has all six required fields; `evidence` matches the source line. |
| 9 | Deterministic path inference | Test: same function across two runs yields identical `adsa_area`. |
| 10 | Log schema validation | Test: `{adsa_path: "FAST"}` (wrong case) flagged. `{adsa_path: "medium"}` (invalid enum) flagged. Missing `adsa_area` flagged. |

CI gate: `npm test` + `npm run build` + `node dist/cli.js --json test/fixtures/clean.ts` must all exit 0.

## System shape (CALM-thinking)

The tool itself is a small CLI. The artifact it operates on is user code.

```
Nodes:
  - CLI (stapes-adsa, entry: dist/cli.js)
  - Runner (orchestrates checks against a SourceFile set)
  - 5 Checks (slow-path-no-log, fast-path-with-io, decision-router, async-no-log, log-schema)
  - Fixer (conservative insertion of log lines)
  - Hook Installer (.git/hooks/pre-commit marker block)
  - Runtime Helper (withAdsaLogging, importable from dist/lib/instrument.js)

Interfaces:
  - CLI flags: --root, --check, --list, --strict, --json, --no-color, --fix, --fix-confirm, --init, --uninstall, --version, --help
  - JSON output schema (frozen for v1.x): {startedAt, tool, version, exitCode, checkCount, failed, warned, findings[]}
  - Exit codes: 0 clean, 1 blocked, 2 invalid args
  - Hook block markers: `# >>> stapes-adsa hook >>>` ... `# <<< stapes-adsa hook <<<`

Relationships:
  - CLI → Runner
  - Runner → Checks (registry: CHECKS)
  - Runner → Fixer (only when --fix or --fix-confirm)
  - CLI → Hook Installer (only when --init or --uninstall)
  - Checks → AST helpers (iterFunctions, getAdsaPathMarker, hasAdsaLogCall, containsIoCall)
  - AST helpers → ts-morph SourceFile / Node

Controls:
  - No telemetry: zero network calls; verified by `lsof` in --json mode (SPEC invariant #4)
  - Idempotent --init: marker block in .git/hooks/pre-commit (SPEC invariant #6)
  - Conservative --fix: only slow-path-no-log + async-no-log are auto-fixable (SPEC invariant #7)
  - Stable JSON schema: frozen for v1.x (SPEC invariant #5)
  - Pre-commit hook coexists with Husky/lefthook: marker block, not whole-file replacement
```

## Context

Sibling repos this one mirrors in packaging:

- `stapes-precommit` (TypeScript ESM, MIT, `--json` schema, AGENTS.md, Golden Circle README, vitest, commander, `>=18`)
- `stapes-context-trim` (same packaging)

Framework origin: `~/.claude/CLAUDE.md` — the ADSA section. The public version is a clean fork that drops every reference to `craft-*`, `leon-claude-setup`, and `adsa-considerator`. The framework itself (fast/slow paths, log schema, four-question self-assessment) is generic and ships standalone.

External dependencies chosen for v1:

- `commander` — CLI argument parsing (matches siblings, stable, MIT).
- `ts-morph` — TypeScript AST wrapper. Chosen over raw `typescript` for ergonomics; over `@typescript-eslint/parser` to avoid the eslint runtime. Single dep, MIT.
- `vitest` — test runner (matches siblings).
- `typescript` (dev) — compile target.

Rejected:

- `eslint` + `@typescript-eslint` — too heavy, runtime overhead, harder to invoke from a pre-commit hook.
- Raw `typescript` compiler API — verbose; `ts-morph` wraps it cleanly.
- `acorn` — JS-only; would not handle TSX, decorators, or type annotations.
