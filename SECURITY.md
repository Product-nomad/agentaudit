# Security policy

`agentaudit` is a security tool — it is held to a higher bar for its own integrity than most projects. This document covers how to report a vulnerability and what to expect in response.

## Supported versions

Only the most recent minor version receives security fixes. Older versions are archived as tags; upgrade rather than patch in place.

| Version | Supported |
|---|---|
| 0.1.x   | ✅ |
| < 0.1   | ❌ |

## Reporting a vulnerability

**Preferred:** use GitHub's private vulnerability reporting — <https://github.com/Product-nomad/agentaudit/security/advisories/new>. This creates a private advisory that we can coordinate on before any public disclosure.

Do **not** open a public issue or pull request with an exploit payload. If GitHub's private reporting is unavailable to you, open a minimal public issue titled `security: request private contact` and we will arrange one.

Include, where possible:
- affected version (`agentaudit --version`)
- reproducer or minimal test case
- impact (what the bypass allows)
- your disclosure timeline preference

## What counts as a vulnerability

In scope:

- **A rule bypass on a real-world payload.** A command or pattern that the rule was clearly designed to catch, but misses. Include the payload and which rule you believe should have matched.
- **A credential leaked into `agentaudit`'s own output or logs beyond the documented redaction.** Redaction preserves at most 4 prefix + 4 suffix characters (`ghp_…abcd`); more leakage is a bug.
- **A crash on adversarial input** (malformed JSONL, hostile regex target) that takes out a scan batch instead of degrading to a skipped session.
- **Any network call.** There should be none. If you find a code path that reaches the network, that is a vulnerability regardless of intent.
- **ReDoS.** A pattern causing catastrophic backtracking on a realistic input.

Out of scope (documented limits, see [`THREAT_MODEL.md`](./THREAT_MODEL.md)):

- Obfuscated credentials (base64-wrapped, concatenated at runtime) evading regex — known limit.
- Semantic prompt-injection payloads — we are not a semantic analyser.
- Novel credential-provider shapes not yet in the rule set — open a PR adding the pattern.
- Access control on the host filesystem — that is the OS's job, not ours.

## Response timeline

- **Acknowledgement** within 3 working days.
- **Triage + severity classification** within 10 working days.
- **Fix** within 30 days for critical / 60 days for high / 90 days for others, or an explicit timeline extension communicated in the advisory.
- **Coordinated disclosure** once a fix is released. We credit reporters in the advisory unless asked not to.

## Reporter safe harbour

Good-faith security research against `agentaudit` itself is welcomed. We will not pursue legal action against researchers who:

- Make a reasonable effort to avoid privacy violations, data destruction, or service disruption.
- Report privately before disclosing publicly.
- Give us a reasonable window to remediate.

This safe harbour does not extend to anyone else's systems — probing *agentaudit users' machines* is out of scope and not consented to.
