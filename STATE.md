# agentaudit — STATE

**Goal**: TBD — fill in based on README/code.
**Status**: active
**Last touched**: 2026-04-25

## What's done
- (to be filled in next time we work on this)

## What's next
- Re-read README at start of next session to refresh context.
- Decide whether to wire it into the host's systemd to monitor the VPC `claude-agent.service` itself (dogfooding mentioned in prior session).

## Open questions / blockers
- How will agentaudit surface alerts to the user? (Push notification, log scrape, Slack/email?)

## Key files
- `~/agentaudit-logs/` — daily JSON log files this tool produces (already running per Apr 24-25 entries).

## Notes from prior session
- Built/initialised on 2026-04-23/24.
- User likes the "dogfood it on the VPC itself" idea.
- Connected to security improvements thread.
