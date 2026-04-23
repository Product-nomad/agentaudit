# Changelog

All notable changes to this project are recorded here. Per §11 of `~/WAYS_OF_WORKING.md`.

Format: [Keep a Changelog](https://keepachangelog.com/) · [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
- Governance artefacts: `THREAT_MODEL.md`, `SECURITY.md`, `DECISIONS.md`, CPMAI phase marker in README.

### Known gaps
- Golden red-team fixture set not yet built — Phase V value metric #2 unmeasured.
- Cursor / Windsurf session adapters not implemented.
- Dollar-cost estimation gated on a sourced pricing file (see `DECISIONS.md`).
- Drift monitoring documented but not yet operationalised.
