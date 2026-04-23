# Decisions

One paragraph per material decision, newest on top. Avoids re-litigating the same choice. Per §11 of `~/WAYS_OF_WORKING.md`.

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
