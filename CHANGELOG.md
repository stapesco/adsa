# Changelog

All notable changes to `stapes-adsa` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-01

### Added

- Five AST-based ADSA checks:
  - `slow-path-no-log` (warn, auto-fixable)
  - `fast-path-with-io` (block)
  - `decision-router` (warn)
  - `async-no-log` (warn, auto-fixable)
  - `log-schema` (block)
- `npx stapes-adsa --init` — idempotent pre-commit hook install. `--uninstall`
  removes cleanly without clobbering Husky / lefthook / etc.
- Stable `--json` output mode for AI agents and CI. Schema:
  `{startedAt, tool, version, exitCode, checkCount, failed, warned, findings[]}`.
  See `AGENTS.md` for the contract.
- `--fix` (dry-run) and `--fix-confirm` (apply) modes for safe auto-fixes.
  Conservative subset: insert `log.info({adsa_path: "slow", adsa_area: ...})`
  at the top of a function body. Other checks are reported-only.
- `--check <name>` for running a single check.
- `--strict` to promote warnings to blocks.
- `--list` to enumerate available checks.
- `--root <path>` for project root (default: cwd).
- `withAdsaLogging` runtime helper at `stapes-adsa/lib/instrument`.
  Pairs the framework's four-field log contract with a typed router.
- `SKILL.md` at the repo root — the ADSA framework reference, agent-loadable.
- `AGENTS.md` — machine-readable install instructions, when-to-use /
  when-NOT-to-use, and the `--json` schema contract.
- Path markers: `@adsa:fast` / `@adsa:slow` JSDoc tags, `// adsa:fast` /
  `// adsa:slow` inline comments, and `Fast` / `Slow` name suffixes.
- Strict TypeScript, ESM, Node 18+. Two runtime dependencies:
  `commander` and `ts-morph`.
- ~40 unit tests covering all five checks, the JSON schema, the auto-fix
  round-trip, the log-schema validation, and the install / uninstall flow.
- `SECURITY.md` with a private disclosure channel (email). No bug
  bounty; no SLA. 5-business-day acknowledgement; 30-day fix target.
- `.techwatch-manifest.json` recording the stack decision (TypeScript +
  ts-morph + commander + vitest, all MIT or Apache-2.0).

### Notes

- Source-available under MIT. Issues disabled. Branch protection with
  `require_last_push_approval`. PRs are not accepted.
- TypeScript-only for v1. Python, Go, Rust, Java are explicitly
  out of scope (see `SPEC.md`).
- `--json` schema is frozen for v1.x. Additive changes only in v2.
