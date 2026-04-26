# Changelog

All notable changes to this project are recorded here. Per §11 of `~/WAYS_OF_WORKING.md`.

Format: [Keep a Changelog](https://keepachangelog.com/) · [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.5] — 2026-04-23

### Fixed
- Added missing `repository`, `homepage`, and `bugs` fields to `package.json`. Their absence was the root cause of all five previous release-pipeline failures: npm's provenance validator requires `package.json` to declare the same repository URL that the OIDC-signed SLSA attestation vouches for. With the field missing, validation returned 422 (visible now), reported as 404 through the OIDC auth path (misleading earlier). This single fix likely also unblocks OIDC trusted publishing — we may revert to tokenless auth in a follow-up.

## [0.2.4] — 2026-04-23

Authentication for CI publishes moved from OIDC trusted publishing to a granular npm automation token with bypass-2FA, stored as the `NPM_TOKEN` GitHub Actions secret. Still ships with `--provenance`, so the SLSA attestation is still signed via OIDC and published to Sigstore — only the final PUT to the npm registry uses the token. OIDC trusted publishing failed repeatedly with a 404 on PUT even when Sigstore and provenance signing worked; root cause unclear, tracked for follow-up.

## [0.2.3] — 2026-04-23

Same functional content as 0.2.0–0.2.2. The `environment:` gate was removed from the release workflow, and the Environment field cleared from the npm trusted-publisher record, after an OIDC claim-propagation quirk blocked the v0.2.1 and v0.2.2 publish attempts despite the trusted publisher being correctly configured otherwise. Release still flows through GitHub Actions OIDC and ships with a signed provenance attestation — the reviewer-gate on the `npm-publish` environment is the only control that's gone. We'll reinstate it once we understand how to get the environment claim through reliably (see `DECISIONS.md`).

## [0.2.2] — 2026-04-23

Identical artefact to 0.2.1 but retried through the OIDC pipeline after the npm trusted-publisher config was actually saved (the first attempt failed mid-publish because the trusted-publisher form was still in an unsaved state). v0.2.1's version number is burned on the Sigstore transparency log so we can't reuse it; this one exists purely to occupy the next number. Recommend `@product-nomad/agentaudit@0.2.2` as the first provenance-attested release to install.

## [0.2.1] — 2026-04-23

First release cut through the OIDC trusted-publishing pipeline. No functional change from 0.2.0 for end users; this version ships with a verifiable provenance attestation.

### Added
- OIDC trusted-publishing workflow (`.github/workflows/release.yml`): on every GitHub Release, CI publishes to npm with `--provenance`, using GitHub's OIDC token rather than a long-lived npm token. Users can verify the artefact with `npm audit signatures`.
- `publishConfig.provenance: true` in `package.json` — makes provenance the default for any publish from now on (CI or manual).
- Tag / package.json version-mismatch guard in the release workflow. The class of error that forced two `v0.2.0` tag moves during initial publish can't recur silently.
- README "Verifying the release" section pointing users at `npm audit signatures` and the npm provenance page.

## [0.2.0] — 2026-04-23

The billing wedge. Closes the consultant/freelancer workflow: filter by time window, tag sessions by client, export invoice-ready CSV.

### Added
- `--since <duration|date>` filter on both `audit` and `report`. Accepts relative durations (`24h`, `7d`, `2w`, `30m`) and ISO-8601 dates. Sessions without timestamps are excluded (we can't verify their range).
- Per-client tagging for `report`: a small JSON config maps session cwd patterns to client tags. Default location `~/.config/agentaudit/clients.json`; override with `--tag-config <path>`. Patterns are literal substrings, or `/regex/` when wrapped. Tagged sessions roll up in a new "by client" section.
- CSV output for `report` via `--csv` or `--format csv`. One row per (session × model); columns suited for pivot-table analysis and invoice prep. RFC 4180 escaping.
- Unified `--format <text|json|csv>` option; `--json` and `--csv` retained as aliases.
- `prepare` npm script auto-installs the lefthook pre-commit hooks on clone.

### Changed
- Minimum Node bumped from 20 to 22. Node 20 reaches EOL on 2026-04-30, and its `--experimental-test-coverage` reporter crashes on our test output. CI matrix simplified to a single Node 22 job.
- Bumped GitHub Actions: `actions/checkout@v4 → v6`, `actions/setup-node@v4 → v6`.
- Pinned `@types/node` and `typescript` to minor/patch in Dependabot — these deserve considered migrations (TypeScript 6's stricter analysis caught a latent bug in `cli.ts` worth addressing on its own; tracked as issue [#4](https://github.com/Product-nomad/agentaudit/issues/4)).

### Stats
- 132 unit tests (up from 102 in 0.1.0), ≥99% line coverage.
- Tested against the maintainer's own Claude Code history: 17 sessions / 1,505 events, 2 true-positive audit findings, 0 false positives.

## [0.1.0] — 2026-04-23

Initial public release.

### Added — `audit` command
- Streaming parser for Claude Code session JSONL (`src/parser.ts`).
- Rule engine with per-rule and per-session error isolation (`src/engine.ts`), bounded-memory streaming, configurable concurrency, and a finding cap.
- Five rule families:
  - `secrets.in-user-prompt` (critical)
  - `secrets.in-tool-result` (high)
  - `bash.risky-command` — 13 patterns (critical–low)
  - `fs.sensitive-path-write` — 15 paths (critical–medium)
  - `git.hook-bypass` (medium)
- Interpreter-eval suppression (`src/shell.ts`) to cut false positives from `node -e` / `python -c` commands whose content contains flag strings.
- CLI `audit` subcommand with `--json`, `--min`, `--group-by`; severity-mapped exit codes (0/10/20/30).

### Added — `report` command
- Streaming usage aggregator (`src/usage.ts`): per-session, per-model, per-project (cwd) token totals.
- `report` subcommand with `--json` and `--top N` options.
- Token-count output only; dollar costing deferred (see `DECISIONS.md`).

### Added — tooling & governance
- 102 unit tests with native `node --test` + `--experimental-test-coverage`. Line coverage ≥ 99%.
- ReDoS performance test — 15k adversarial input completes under 100ms.
- Biome 2.4.13 as single lint+format tool.
- lefthook pre-commit hook running `typecheck`, `lint`, `test`.
- GitHub Actions CI across Node 20 + 22.
- Dependabot weekly updates for npm and actions.
- Governance artefacts: threat model, security policy, decision log, and a phase/status marker in README.

### Known gaps
- Golden red-team fixture set not yet built — Phase V value metric #2 unmeasured.
- Cursor / Windsurf session adapters not implemented.
- Dollar-cost estimation gated on a sourced pricing file (see `DECISIONS.md`).
- Drift monitoring documented but not yet operationalised.
