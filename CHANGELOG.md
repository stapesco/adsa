# Changelog

All notable changes to `stapes-adsa` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.2] - 2026-11-08

### Fixed

- **The documented import path now resolves.** The README tells users to
  `import { withAdsaLogging } from "stapes-adsa/lib/instrument"`. That
  import failed with `ERR_MODULE_NOT_FOUND` in every consumer install
  from v1.0.0 through v1.1.1. The package published `dist/` but declared
  no `exports` map, so the documented path resolved to nothing.
  The package now declares an `exports` map. `stapes-adsa/lib/instrument`
  and the package root `stapes-adsa` both resolve to the helper. The deep
  path `stapes-adsa/dist/lib/instrument.js` keeps working, so no upgrade
  breaks an existing import.

### Documentation

- The README and AGENTS.md sample output names the current version.

### Tests

- `test/package-exports.test.ts` packs the package, installs the tarball
  into a scratch project, and imports it through each published path.
  The defect that shipped through three releases is now a failing build.
- `test/doc-version.test.ts` fails the build when a version bump leaves
  the documentation behind.

## [1.1.1] - 2026-11-08

### Fixed

- The README and AGENTS.md sample output printed `stapes-adsa@1.0.0`
  after v1.1.0 shipped. The samples now print the current version.

### Documentation

- `SECURITY.md` now explains the transitive `minimatch` advisory that
  `npm audit` reports in a consumer's tree, why the linter cannot reach
  it, and why it cannot be cleared by upgrading `ts-morph`.

## [1.1.0] - 2026-11-08

### Changed

- **BREAKING:** The Node.js floor moved from 18 to 22.12. Node 18 reached
  end of life on 2025-04-30 and Node 20 on 2026-04-30, so the previous
  floor admitted two dead branches. The new floor is the lowest version
  that satisfies commander 15 and vitest 5.
- Runtime dependencies updated: `commander` 11 → 15, `ts-morph` 22 → 28.
  Both are still the only two runtime dependencies.
- Build and test tooling updated: `typescript` 5.9 → 7.0, `vitest` 1.6 →
  5.1, `@types/node` 20 → 26. TypeScript 7 needs `types: ["node"]` in
  `tsconfig.json` because it no longer auto-includes every package under
  `node_modules/@types`.
- Release workflow: `actions/checkout` v4 → v7, `actions/setup-node` v4 →
  v7, `softprops/action-gh-release` v2 → v3, and the CI runtime moved
  from Node 20 to Node 24.

### Security

- Cleared all 10 advisories in the dependency tree. The previous tree had
  2 critical, 3 high and 5 moderate findings, including a prototype
  pollution remote code execution in `tinypool` and a path traversal in
  `vite`. Most of these reached only the test runner, but the
  `brace-expansion` and `minimatch` denial-of-service advisories reached
  the shipped runtime through `ts-morph`.
- Added an `overrides` entry pinning the transitive `minimatch` to 11.0.5.
  The override applies to this repository. Consumers resolve their own
  transitive tree, and no published `ts-morph` release ships without
  `minimatch`.

### Notes

- The `--json` schema is unchanged. The linter produces byte-identical
  output before and after the upgrade.

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
