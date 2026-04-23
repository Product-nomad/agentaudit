# Decisions

One paragraph per material decision, newest on top. Avoids re-litigating the same choice. Per §11 of `~/WAYS_OF_WORKING.md`.

## 2026-04-23 — Dropped environment gate from OIDC trusted publisher (temporary)

The `npm-publish` GitHub Environment reviewer-gate was removed from both the release workflow and the npm trusted-publisher record after v0.2.1 and v0.2.2 publish attempts failed at the npm PUT with 404. OIDC and Sigstore signing both succeeded; only the npm-side match failed. Inspection of the Sigstore attestation (logIndex 1365480013 and prior) showed the workflow section carrying `ref`, `repository`, and `path` but **no `environment` field**. This suggests npm's trusted-publisher matcher receives no environment claim to compare against, so a non-empty Environment on the npm side never matches. *Alternatives considered:* an automation token with bypass-2FA. *Why rejected:* we already had OIDC working for the signing half; dropping the environment keeps OIDC for auth and preserves provenance. *Reinstatement criteria:* once we can verify the environment claim does round-trip to npm's matcher (likely requires an npm support ticket or doc update on their side), reintroduce the reviewer gate.

## 2026-04-23 — OIDC trusted publishing for npm releases

Future releases go through a GitHub Actions workflow that uses OIDC to authenticate to npm — no long-lived tokens in GitHub secrets, no secrets on any developer machine, and every tarball ships with a signed provenance attestation linking it to a specific commit + workflow run. Users can verify with `npm audit signatures`. *Why:* this is a security tool; its own supply chain has to be defensible. *Trigger:* GitHub Release creation, not bare tag pushes, so publishing remains an intentional human act. *Tag-version guard:* the workflow refuses to publish if the git tag doesn't match `package.json` version — the class of mismatch that bit us between v0.2.0's first tag and its published artefact. *Alternatives considered:* npm automation token in a GitHub secret. *Why rejected:* same blast radius as a stolen laptop credential; OIDC removes the token entirely.

## 2026-04-23 — `report` reports tokens, not dollars
The first pass of `agentaudit report` aggregates token counts (input, cache read/write, output, turns) but not dollar costs. *Why:* published pricing changes, vendor pricing is per-model and shifts between API / Claude Code subscription / enterprise, and a hardcoded dollar multiplier becomes stale synthetic-data (§2 of Ways of Working). When we add costing, it will read a pricing file that names its source and date, and default to "unknown" rather than guess. *Trade:* reporting loses the "you spent $X this week" headline for now. Acceptable.

## 2026-04-23 — Adopt PMI CPMAI as the delivery framework
Adopted the PMI Cognitive Project Management for AI (CPMAI) methodology for project phasing and governance. Even though agentaudit is regex-based, not AI-based, the framework's gates (threat model before detection logic, evaluation before release, ongoing drift monitoring) map cleanly. README now declares current CPMAI phase. *Alternatives considered:* ad-hoc / "ship when tests pass". *Why rejected:* no gate for ethics, no drift story, no explicit value metrics.

## 2026-04-23 — Biome over ESLint + Prettier
Chose Biome 2.4 as the single lint+format tool. *Why:* one devDep, zero config, fast; §7 of Ways of Working requires a single tool rather than stacking. *Alternatives considered:* ESLint + Prettier, dprint, Rome (archived). *Why rejected:* multi-tool setups drift out of sync, and the author of Rome shipped Biome.

## 2026-04-23 — Node built-in test runner, no Jest/Vitest
Chose `node --test` with `--experimental-test-coverage`. *Why:* zero extra dependencies; coverage ships stable in Node 22; ergonomics are close enough to Jest for the scale of this project. *When to revisit:* if we need per-test snapshots, fixture injection, or parallel test isolation beyond what the runner provides, reconsider Vitest.

## 2026-04-23 — Streaming engine, not collect-then-scan
`scanSession` reads events one at a time through `streamEvents` and passes each to the rule set immediately, rather than collecting the full event array first. *Why:* memory bounded regardless of session size; a 500MB session would otherwise allocate 500MB in one shot. *Cost:* rule context's `sessionMeta` is incrementally populated — rules that need final meta (last timestamp, full event count) see partial data during the scan. Current rules don't need post-scan meta; if a future rule does, it gets a second pass.

## 2026-04-23 — Detection logic is regex + heuristics, not an LLM
Scanning uses hand-crafted regexes plus a handful of heuristics (e.g. interpreter-eval suppression). *Why:* deterministic, auditable, zero network, zero runtime cost, no model drift. *Tradeoff:* no semantic understanding — an obfuscated or novel threat evades us. We accept the gap; the threat model documents it. If we add an LLM layer later, it is opt-in and runs on top of the regex layer, never replacing it.

## 2026-04-23 — Local-only, no telemetry ever
No anonymous usage reporting, no crash uploads, no opt-in analytics. *Why:* the tool's value rests on trust; a scanner that phones home is a supply-chain risk. If we ever need aggregate data, we'll ship a separate `agentaudit-stats` command that emits to stdout and let the user pipe it wherever they want.
