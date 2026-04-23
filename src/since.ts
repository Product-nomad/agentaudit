/**
 * `--since` parsing and session-level filtering.
 *
 * Accepts relative durations (`24h`, `7d`, `2w`, `30m`) and absolute
 * ISO-8601 dates (`2026-04-01`, `2026-04-01T06:30:00Z`).
 */

const DURATION_RE = /^(\d+)(m|h|d|w)$/;

const UNIT_MS: Record<string, number> = {
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

export function parseSince(input: string, now: Date = new Date()): Date {
  if (!input) throw new Error("--since requires a value");

  const m = DURATION_RE.exec(input);
  if (m) {
    const n = Number(m[1]);
    const unit = m[2];
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error("--since duration must be positive");
    }
    return new Date(now.getTime() - n * UNIT_MS[unit]);
  }

  // Absolute ISO-8601 date. Require YYYY-MM-DD prefix so Date.parse's
  // leniency (e.g. "7z" → epoch-adjacent timestamp) can't sneak through.
  if (!/^\d{4}-\d{2}-\d{2}/.test(input)) {
    throw new Error(
      `--since: "${input}" is not a duration (e.g. 7d) or ISO date (e.g. 2026-04-01)`,
    );
  }

  const ts = Date.parse(input);
  if (!Number.isFinite(ts)) {
    throw new Error(`--since: cannot parse "${input}"`);
  }
  return new Date(ts);
}

export interface HasTimestamps {
  firstTimestamp?: string;
  lastTimestamp?: string;
}

/**
 * True if the session had *any* activity on or after `cutoff`. Sessions
 * with no timestamps at all are excluded — we can't verify their range.
 */
export function sessionInRange(session: HasTimestamps, cutoff: Date): boolean {
  const ts = session.lastTimestamp ?? session.firstTimestamp;
  if (!ts) return false;
  const parsed = Date.parse(ts);
  if (!Number.isFinite(parsed)) return false;
  return parsed >= cutoff.getTime();
}
