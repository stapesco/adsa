# Security

If you've found a security vulnerability in `stapes-adsa`, please report
it privately before public disclosure.

## How to report

Email **github@stapes.co.za** with:

- A short description of the issue
- Reproduction steps (or a minimal PoC)
- The version affected (`stapes-adsa --version`)
- Your expected disclosure timeline

Please **do not** open a public GitHub issue for security bugs.

## What to expect

- Acknowledgement within **5 business days**
- A fix or a clear timeline for a fix within **30 days** of acknowledgement
- Public disclosure coordinated with you, after the fix ships

There is **no bug bounty programme** and **no reward** for disclosure.
We fix issues because they're bugs, not because we're buying silence.

## Out of scope

- Lack of a feature (open a discussion, not a security report)
- Performance issues
- Compatibility issues with specific TypeScript versions, Node versions, or shells
- Reports about the dependency supply chain that are about a transitive dep rather than `stapes-adsa` itself

If you're not sure whether something is a security issue, report it.
We'll triage and let you know.

## Known transitive advisory

`npm audit` in a project that installs `stapes-adsa` reports four
moderate findings. They are all one issue, not four.

The chain is `stapes-adsa` → `ts-morph` → `@ts-morph/common` → `minimatch`.
The advisory is [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249),
a denial of service through glob-part amplification, and it affects
`minimatch` 7.0.0 through 11.0.0.

`@ts-morph/common` declares `minimatch: ^10.0.1`. The 10.x line has no
fixed release, so the advisory cannot be cleared by upgrading
`ts-morph`. The fix landed in `minimatch` 11.0.1.

The advisory is not reachable through the linter. `stapes-adsa` walks the
file tree itself with `readdirSync` and calls `addSourceFileAtPath` with
one explicit path. It never calls `addSourceFilesAtPaths` and never
passes a glob pattern. The `minimatch` code in `@ts-morph/common` is
reachable only through `matchGlobs`, which the linter never enters. A
traced run of `addSourceFileAtPath` makes zero `minimatch` calls.

This repository pins `minimatch` to 11.0.5 through an `overrides` entry,
which keeps the repository's own tree clean. An `overrides` entry does
not apply to a consumer's install, so the advisory remains visible in
consumer `npm audit` output until `@ts-morph/common` widens its range.

## Why this tool touches sensitive data

`stapes-adsa` reads TypeScript source files and inspects their AST to
detect ADSA pattern violations. It also reads the contents of any
`{adsa_path}` log object literals to validate them against the
four-field contract. The tool itself does not phone home, does not log
file contents to disk, and does not retain them. But because it sees
source code, a malicious or compromised supply-chain dep could leak
content through the AST traversal. If you discover a way to exfiltrate
data through the linter or the pre-commit hook it installs, please
report through the channel above.
