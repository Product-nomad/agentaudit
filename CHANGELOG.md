# Changelog

All notable changes to this project are recorded here. Per §11 of `~/WAYS_OF_WORKING.md`.

Format: [Keep a Changelog](https://keepachangelog.com/) · [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] — 2026-04-23

### Added
- Streaming parser for Claude Code session JSONL (`src/parser.ts`).
- Rule engine with per-rule and per-session error isolation (`src/engine.ts`), bounded-memory streaming, configurable concurrency, and a finding cap.
- Five rule families:
  - `secrets.in-user-prompt` (critical)
  - `secrets.in-tool-result` (high)
  - `bash.risky-command` — 13 patterns (critical–low)
  - `fs.sensitive-path-write` — 15 paths (critical–medium)
  - `git.hook-bypass` (medium)
- Interpreter-eval suppression (`src/shell.ts`) to cut false positives from `node -e` / `python -c` commands whose content contains flag strings.
- CLI (`src/cli.ts`) with `audit` and `rules` subcommands, `--json`, `--min`, `--group-by` options, and severity-mapped exit codes.
- 91 unit tests with native `node --test` + `--experimental-test-coverage`. Line coverage 99.2%.
- ReDoS performance test — 15k adversarial input completes under 100ms.
- Biome 2.4.13 as single lint+format tool; `typecheck`, `lint`, `format`, `check` scripts.
- Governance artefacts: `THREAT_MODEL.md`, `DECISIONS.md`, README section with CPMAI phase marker.

### Known gaps
- No release or operationalisation yet (Phase VI pending).
- Golden red-team fixture set not yet built — Phase V value metric #2 unmeasured.
- Cursor / Windsurf session adapters not implemented.
- No drift monitoring (planned for Phase VI).
