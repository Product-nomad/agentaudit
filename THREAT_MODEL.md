# agentaudit — threat model

This document states what `agentaudit` defends against, what it doesn't, and where the soft spots are. It is deliberately narrow: a scanner's value collapses if its author pretends it does more than it does.

## What agentaudit is

A local CLI that parses Claude Code session transcripts (`~/.claude/projects/**/*.jsonl`) and flags patterns that warrant human review — leaked credentials, destructive shell commands, edits to sensitive host paths, git-hook bypasses.

## Who is the intended user

A developer or team reviewing their own AI-agent sessions after the fact, on a machine they control. Small teams running it as a scheduled weekly sweep fit the same model.

## What we defend against

| Threat | How |
|---|---|
| Dev pastes a credential into a prompt and forgets | `secrets.in-user-prompt` rule, regex match on known token shapes |
| Agent accidentally captures a credential via `cat .env` or `aws configure` output | `secrets.in-tool-result` rule |
| Agent, frustrated by a broken hook, commits with `--no-verify` | `git.hook-bypass` rule |
| Agent runs `curl … | sh`, `rm -rf ~`, `git push --force`, or similar | `bash.risky-command` rule (13 patterns) |
| Agent writes to `~/.ssh/authorized_keys`, `~/.aws/credentials`, `.env`, or other sensitive paths | `fs.sensitive-path-write` rule (15 paths) |
| A buggy rule crashes and hides all other findings | Engine catches per-rule exceptions, emits an `engine.rule-error.*` finding, continues |
| A malformed / truncated session file aborts the whole batch | Engine catches per-session errors, emits `engine.session-read-error`, continues |
| A pathological input causes regex catastrophic backtracking (ReDoS) | All patterns bounded; a performance test asserts 10k adversarial input completes under 100ms |

## What we do NOT defend against

These are out of scope by design. If you need them, compose `agentaudit` with a tool that does.

- **Adversarial LLMs / prompt injection in session content.** If an attacker can cause text to appear in a session (via tool output, a poisoned file the agent reads), they can craft a message that looks benign to our regexes and is malicious to the LLM. We don't detect semantic attacks.
- **A malicious user running agentaudit against someone else's sessions.** The tool reads whatever paths it's pointed at. Access control is the user's OS's job.
- **Obfuscated credentials.** A token split across string concatenation (`"ghp_" + key1 + key2`) or base64-wrapped will not match regex. We catch the careless case.
- **Novel credential providers.** Only the patterns listed in `src/rules/patterns.ts` are detected. Rotate-key providers with unique shapes (niche B2B SaaS) are gaps.
- **Historical leak detection.** We scan what's currently on disk. If you rotate a session file out and lose it, we can't find what was in it.
- **Proof that a flagged event caused harm.** We flag *risky patterns*, not *exploited* ones. A finding is an invitation to review, not a verdict.
- **Network egress detection.** We don't correlate flagged events with observed network activity.
- **Cross-session correlation.** Each session is scanned independently. We don't detect slow exfiltration that staggers across many sessions.
- **Claude Code's own security.** If Anthropic's client itself were compromised, agentaudit couldn't help.

## Trust assumptions

- **Local FS integrity.** We trust that `~/.claude/projects/**/*.jsonl` reflects what the agent actually did. If those files have been tampered with post-hoc, we can't detect it.
- **JSONL schema stability.** The file format is Anthropic's private API as observed on 2026-04-23. Schema drift will degrade coverage silently until rules are adapted.
- **Regex correctness.** Our patterns are hand-crafted. False negatives are a known hazard — see §Limits below.

## Limits and known false-negative classes

- **Self-reference.** A command that is itself a script writing out a `curl | sh` command (e.g. `echo "curl x | sh" > install.sh`) is not matched, because the command being executed is `echo`, not `curl`. Intentional: we try to match invoked behaviour, not text content.
- **Interpreter-eval data.** We suppress matches inside `node -e`, `python -c`, etc., because the match is data, not invoked. This also hides real `--no-verify` buried deep in an interpreter-emitted shell string. Acceptable trade.
- **Sensitive paths are matched on raw path strings.** `../../etc/shadow` matches; an agent using `readlink` + indirect access would slip through.

## Privacy posture

- Local-only. No network calls.
- No telemetry. No "anonymous usage reporting" hook exists.
- Output may contain excerpts of prompts, command strings, or redacted secrets. The user is responsible for not posting `--json` output to public forums without review.

## Operational recommendations

- Run `agentaudit audit --min high` in a weekly cron or before any `git push` from a shared agent box.
- Treat a `critical` finding as a signal to rotate the relevant credential, not a proof of compromise.
- Contribute new rules and patterns via pull request. Every rule change should ship with a positive and negative test.

## Reporting a vulnerability

If you find a way to bypass a rule that would plausibly matter, open a security issue on the GitHub repository (or email the maintainer). Don't open a public PR with the exploit payload in plaintext.
