# agentaudit — STATE

**Goal**: A local, zero-upload auditor for AI coding agent session transcripts. Surfaces leaked secrets, risky shell commands, sensitive-path writes, and hook bypasses; reports per-project / per-model token usage. Built so individual developers and consultants can sanity-check what their agent did, without sending session contents off-machine.
**CPMAI phase**: V (Evaluation) → VI (Operationalisation). Detection + usage aggregation shipped; golden-set validation and drift monitoring still to wire.
**Status**: active, published as `@product-nomad/agentaudit` v0.2.5 on npm.
**Last touched**: 2026-04-26.

## What's done
- Public release: `@product-nomad/agentaudit` on npm (currently v0.2.5).
- OIDC trusted publishing from GitHub Actions with signed provenance attestations linking each tarball to a specific commit + workflow run.
- Five rule families: secrets in user prompts, secrets in tool results, risky bash, sensitive-path writes, git hook bypasses.
- Streaming JSONL parser, tolerant of malformed lines.
- 91 unit tests passing; CI on every push.
- Real-session validation against the user's own session corpus (17 sessions / 925 events as of 2026-04-25).
- Per-project / per-model token usage reports with `--csv` for invoice prep.
- Governance artefacts in tree per `~/WAYS_OF_WORKING.md` §11: `THREAT_MODEL.md`, `DECISIONS.md`, `CHANGELOG.md`, `SECURITY.md`, sunset criteria in README.

## What's next
1. **Public launch.** Tweet drafted (in main session); social-preview image uploaded; repo metadata polished. Awaiting the user to actually post.
2. **Golden red-team fixture set** (value metric #2). Realistic planted-secret and risky-command scenarios with known-true labels, scored at ≥80% recall before claiming Phase V complete.
3. **Drift monitoring (Phase VI proper).** Weekly scheduled run against a frozen corpus + alert on rule-coverage / FP-rate / scan-time regression. Likely a `systemd` user timer on this VPC dogfooding the tool against `~/.claude/projects/`.
4. **Cursor adapter.** Reverse-engineer the Cursor session-log format; implement a parser; route through the existing rule engine.
5. **Windsurf adapter.** Same shape; lower priority unless user demand surfaces.
6. **Pricing-file support.** Convert token counts to dollar estimates via a dated, sourced `pricing.json` (next minor release).

## Open questions / blockers
- **Schema drift detection.** Anthropic's Claude Code JSONL schema is private. We need a mechanism to alert on unrecognised `type` values rather than silently dropping events. Sketched in the Governance section but not yet implemented.
- **Surfacing alerts.** Currently `agentaudit` runs on demand or via `cron`/timer. How does the user actually get notified when something is found? (Push, log scrape, Slack, email?) Decision deferred.
- **Where the golden set lives.** A repo of synthetic-but-realistic adversarial fixtures has supply-chain risk if mishandled — every example is a potential pattern that could be ingested. Probably a sibling private repo that the public one references.

## Key files
- `src/cli.ts`, `src/engine.ts`, `src/parser.ts` — core pipeline.
- `src/extract.ts` — secret pattern matchers.
- `src/shell.ts` — bash risk patterns.
- `src/tagger.ts`, `src/report.ts`, `src/report-csv.ts` — token usage rollups.
- `THREAT_MODEL.md`, `DECISIONS.md`, `CHANGELOG.md`, `SECURITY.md` — governance.
- `~/agentaudit-logs/*.json` — daily output dumps the tool already produces against the user's own sessions (dogfood corpus).
