# agentaudit

[![CI](https://github.com/Product-nomad/agentaudit/actions/workflows/ci.yml/badge.svg)](https://github.com/Product-nomad/agentaudit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node: ≥20](https://img.shields.io/badge/node-%E2%89%A520-green.svg)](./package.json)

**Local governance for AI coding agent sessions.** Scans Claude Code session transcripts for leaked secrets, risky shell commands, unsafe file edits, and hook bypasses — and reports per-project / per-model token usage. All locally, nothing uploaded.

> v0.1 — initial public release. Claude Code support today; Cursor / Windsurf adapters next.
> **CPMAI phase V → VI.** Detection logic and usage aggregation implemented; tests + real-session validation complete; transitioning to operationalisation (release + drift monitoring). See [Governance](#governance) below.

## Why

AI coding agents happily run `curl | sudo bash`, write to `~/.ssh/authorized_keys`, or commit with `--no-verify` when things get in their way. The transcripts that record this live on your disk — and often contain `.env` contents, API keys fed to the model, or tool outputs that captured credentials. Nobody reads them after the fact.

`agentaudit` is a grep with manners for those transcripts. Run it weekly (or in a hook) and get a punch list of things worth a second look.

## Install

```sh
# From source (until published)
git clone <repo>
cd agentaudit
npm install
npm run build
npm link            # optional: puts `agentaudit` on PATH
```

Requires Node 20+.

## Usage

```sh
agentaudit audit                          # scan ~/.claude/projects/**/*.jsonl
agentaudit audit path/to/session.jsonl    # scan specific files
agentaudit audit --min high               # only show high/critical
agentaudit audit --json                   # machine-readable output
agentaudit audit --group-by rule          # group by rule instead of session

agentaudit report                         # per-project / per-model token rollup
agentaudit report --top 5                 # top N sessions by output tokens
agentaudit report --json                  # full UsageReport as JSON

agentaudit rules                          # list all audit checks
```

Exit code mirrors the highest severity found: `30` (critical), `20` (high), `10` (medium), `0` otherwise. Useful in a shell hook or cron:

```sh
agentaudit audit --min high || notify-send "Claude Code session findings"
```

## What it checks (v0.1)

| Rule | Severity | What it catches |
|------|----------|-----------------|
| `secrets.in-user-prompt` | critical | API keys, tokens, private keys pasted by the human into a prompt |
| `secrets.in-tool-result` | high | Same patterns appearing in tool output fed back to the model |
| `bash.risky-command` | critical–low | `rm -rf /`, `curl \| sh`, `dd of=/dev/sdX`, world-writable chmod, firewall flush, `git push --force`, etc. |
| `fs.sensitive-path-write` | critical–medium | `Write`/`Edit` targeting `~/.ssh`, `~/.aws`, `~/.gnupg`, `.env`, `/etc/sudoers`, shell rc files, systemd units… |
| `git.hook-bypass` | medium | `git commit --no-verify`, `-c commit.gpgsign=false`, `SKIP=…`; also flags user prompts explicitly asking for the bypass |

Patterns are deliberately conservative. False positives erode trust; a false *negative* is a known limit we'd rather improve with a pull request than paper over.

## Privacy

Everything runs locally. `agentaudit` reads files under `~/.claude/projects/`, processes them in memory, and prints to stdout. No network, no telemetry, no config to opt out of.

Findings may contain excerpts of prompts or command strings — don't paste `--json` output anywhere public without reviewing it first.

## Limitations (read these before trusting it)

- **Pattern-based, not semantic.** It flags `curl | sh`, not "any command that downloads and executes remote code." Your adversary is distracted engineers, not a determined attacker.
- **Single-session scope.** It doesn't correlate across sessions or detect slow exfiltration.
- **Self-matching.** Rules that look for flag strings will match commands whose *data* contains those strings (e.g. `node -e 'const re = /--no-verify/'`). We suppress the common interpreter-eval case; the long tail is a known gap.
- **Transcript fidelity.** We parse Anthropic's Claude Code JSONL format as observed in late April 2026. The schema is private API and can change.

## Roadmap

- Billing/project-rollup companion command (`report` → tag sessions by project, export per-client token/$ summaries).
- Cursor / Windsurf session format adapters.
- `--since <duration>` filter for weekly/daily audits.
- Custom rules via a small plugin interface (rules are plain objects — already pluggable internally).
- HTML report output for weekly review.

## Governance

This project follows the working principles at [`~/WAYS_OF_WORKING.md`](../../WAYS_OF_WORKING.md) and the PMI CPMAI methodology. Below is the current governance posture.

### CPMAI phase: V (Evaluation)

| Phase | Status | Artefact |
|---|---|---|
| I. Business Understanding | ✅ complete | [`THREAT_MODEL.md`](./THREAT_MODEL.md) |
| II. Data Understanding | ✅ complete | Session JSONL schema reverse-engineered; documented in `src/types.ts` |
| III. Data Preparation | ✅ complete | Streaming parser (`src/parser.ts`), tolerant of malformed lines |
| IV. Model Development | ✅ complete | 5 rule families, 13 bash patterns, 15 sensitive paths, 15 secret patterns |
| V. Model Evaluation | 🟡 in progress | 91 unit tests, real-session validation against 17 local sessions / 925 events |
| VI. Model Operationalization | ⏳ not started | No release, no monitoring, no CI |

### Value metrics (Phase III contract)

Set before advancing past Phase III; reviewed at each subsequent gate.

1. **Precision on real sessions.** At minimum 95% true-positive rate in the `medium+` bucket on the developer's own session history. Current: 2/2 (100%, n=2).
2. **Coverage of planted-secret golden set.** Detects ≥ 80% of a planned red-team fixture set of realistic leak scenarios. Current: **not yet measured** (golden set to be built in Phase V).
3. **Scan performance.** Scans 1,000 events under 1 second on a modern laptop. Current: ~800 events in ~350ms wall-clock (release build).

### Ethical posture

- **Privacy by default.** Local-only. No network. No telemetry. Reads only under `~/.claude/projects/` by default.
- **Transparency.** OSS (MIT). Known gaps listed in `THREAT_MODEL.md`.
- **Data minimisation.** Output redacts secret values (`ghp_…abcd`) and shows only the matching line for long commands.
- **Non-harm.** We refuse to add: telemetry, content phone-home, surveillance of other users' sessions, or anything that would enable covert monitoring.

### Drift monitoring (planned for Phase VI)

- **Rule coverage drift** — matches per 1k events, tracked weekly against the scanned session corpus.
- **False-positive rate** — tracked against a labelled sample; alert if it exceeds 5%.
- **Schema drift** — alerted if new `type` values appear in session JSONL that we don't recognise (Anthropic's private schema can evolve).
- **Scan-time drift** — alerted if wall-clock-per-event regresses > 2×.

### Governance log

Material decisions are recorded in [`DECISIONS.md`](./DECISIONS.md) (one paragraph per decision, dated). Change history is in [`CHANGELOG.md`](./CHANGELOG.md) once we cut the first tagged release.

## License

MIT.
