# STACK_DECISION — stapes-adsa

## Hard constraints

TypeScript only in v1, with no Python, Go, Rust, or Java support (see SPEC.md Out of scope). Node.js 22.12 or newer is required, with ES2022 target and ESM module system, and no transpile step. The tool must run fully offline with zero telemetry, no network calls, no analytics, no update checks. License is MIT, open source under stapesco, with no copyleft. The v1.x JSON output schema is frozen for the lifetime of v1, with additive changes only in v2.

## Workload profile

The system class is a single-process CLI tool. The dominant workload is AST traversal plus regex pattern matching, which is CPU-bound with no I/O. The interaction model is invoked once per commit through a pre-commit hook, or once per CI run. The throughput target is to scan 1000 TypeScript files in under five seconds. The interface surface is stdin/stdout plus argv flags plus a JSON mode on stdout for AI agents.

## Stack decision

The chosen language is TypeScript, required by hard constraint. The runtime is Node.js 22.12 or newer, matching sibling repos with MIT licence and active LTS. Node 18 and Node 20 both reached end of life, so neither remains an acceptable floor. The build tool is tsc, with no transpile step and strict mode enabled. CLI argument parsing uses commander, MIT, matching stapes-precommit and stapes-context-trim.

For AST access, ts-morph is chosen as a wrapper over the raw typescript package, ergonomic with MIT licence. The rejected alternative @typescript-eslint/parser pulls ESLint as a dependency, which is too heavy. The other rejected alternative, the raw typescript compiler API, is verbose with poor ergonomics.

Tests run on vitest, matching sibling repos. Coverage tooling is omitted from v1 by explicit decision; run npx vitest with the coverage flag ad-hoc when needed.

The dependency set is pinned to the latest stable of each package at the time of the v1.1.0 upgrade: commander 15, ts-morph 28, typescript 7, vitest 5, @types/node 26. A `minimatch` override pins the transitive glob matcher to 11.0.5, which clears the brace-expansion and globparts denial-of-service advisories. The override applies to this repository only. Consumers resolve their own transitive tree.

## Default + override log

A strong preference held: Node.js runtime over Bun or Deno, matching stapes-precommit and stapes-context-trim. Reversible only via major version. Another strong preference held: ESM module system over CommonJS, matching siblings. A third strong preference held: zero runtime dependencies beyond commander and ts-morph, with no lodash, moment, or rxjs.

A strong preference overridden on 2026-11-08: the Node.js floor. Node 18 and Node 20 both reached end of life, so the previous floor of 18 admitted two dead branches. The floor moved to 22.12, which is the lowest version that satisfies the engines constraint of commander 15 and vitest 5. This is a breaking change for consumers on Node 18 or 20 and is the reason the release is a major version.

A soft preference NOT held: TypeScript strict mode is enabled. Override would require breaking all five checks. A second soft preference NOT held: chalk for colour. Plain ANSI codes are used directly to keep the dependency surface tight.

## Revisit triggers

On 2027-01-01, run an EOL check on Node.js 22. Node 22 reaches end of life on 2027-04-30. If a newer LTS is current by then, bump the engines.node field. If the typescript package goes two or more majors behind, refactor the ts-morph import surface and consider the official typescript compiler API directly.

If ts-morph loses active maintenance, swap to the raw typescript AST. Migration cost is approximately three days of work, touching src/ast.ts only. If the slow path exceeds five seconds on a 1000-file repository, profile and add worker_threads parallelism, which respects the single-machine constraint.

If a CVE is announced in commander or ts-morph, patch via npm overrides and cut a patch release. The `minimatch` override is the current mitigation for the glob denial-of-service advisories in the ts-morph dependency chain.
