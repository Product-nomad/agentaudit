import { streamEvents } from "./parser.js";
import type { Finding, RawEvent, Rule, RuleContext, SessionMeta } from "./types.js";

export interface ScanOptions {
  rules: Rule[];
  /** Maximum number of sessions scanned concurrently. */
  concurrency?: number;
  /**
   * Cap on findings per session, as a cheap guard against a
   * pathological session generating millions of findings.
   */
  maxFindingsPerSession?: number;
  onSession?: (result: SessionScanResult) => void;
}

export interface SessionScanResult {
  path: string;
  sessionId: string;
  eventCount: number;
  findings: Finding[];
  truncated?: boolean;
}

export interface ScanResult {
  sessionsScanned: number;
  eventsScanned: number;
  findings: Finding[];
  perSession: SessionScanResult[];
}

const DEFAULT_CONCURRENCY = 8;
const DEFAULT_FINDING_CAP = 10_000;

function inferSessionIdFromPath(path: string): string {
  const base = path.split("/").pop() ?? "";
  return base.replace(/\.jsonl$/, "");
}

/**
 * Stream a session's events through the rule set without ever holding
 * the full event array in memory. Each event is released immediately
 * after the rules have inspected it.
 */
export async function scanSession(
  path: string,
  rules: Rule[],
  maxFindings = DEFAULT_FINDING_CAP,
): Promise<SessionScanResult> {
  const meta: SessionMeta = {
    path,
    sessionId: "",
    eventCount: 0,
  };
  const findings: Finding[] = [];
  let eventCount = 0;
  let truncated = false;

  try {
    for await (const event of streamEvents(path)) {
      eventCount++;
      enrichMeta(meta, event);
      if (findings.length >= maxFindings) {
        truncated = true;
        continue;
      }
      const ctx: RuleContext = { event, sessionPath: path, sessionMeta: meta };
      for (const rule of rules) {
        try {
          const out = rule.check(ctx);
          if (out.length) {
            for (const f of out) {
              findings.push(f);
              if (findings.length >= maxFindings) {
                truncated = true;
                break;
              }
            }
          }
        } catch (err) {
          findings.push({
            ruleId: `engine.rule-error.${rule.id}`,
            severity: "info",
            title: `Rule ${rule.id} threw`,
            message: String(err instanceof Error ? err.message : err),
            sessionPath: path,
            sessionId: meta.sessionId,
            eventUuid: typeof event.uuid === "string" ? event.uuid : undefined,
            timestamp: event.timestamp,
          });
        }
      }
    }
  } catch (err) {
    findings.push({
      ruleId: "engine.session-read-error",
      severity: "info",
      title: "Could not read session",
      message: String(err instanceof Error ? err.message : err),
      sessionPath: path,
    });
  }

  if (!meta.sessionId) meta.sessionId = inferSessionIdFromPath(path);
  meta.eventCount = eventCount;
  return {
    path,
    sessionId: meta.sessionId,
    eventCount,
    findings,
    truncated: truncated || undefined,
  };
}

function enrichMeta(meta: SessionMeta, event: RawEvent): void {
  if (!meta.sessionId && typeof event.sessionId === "string") {
    meta.sessionId = event.sessionId;
  }
  if (!meta.cwd && typeof event.cwd === "string") meta.cwd = event.cwd;
  if (!meta.gitBranch && typeof event.gitBranch === "string") {
    meta.gitBranch = event.gitBranch;
  }
  if (!meta.version && typeof event.version === "string") {
    meta.version = event.version;
  }
  if (typeof event.timestamp === "string") {
    if (!meta.firstTimestamp) meta.firstTimestamp = event.timestamp;
    meta.lastTimestamp = event.timestamp;
  }
}

/**
 * Scan many session files with bounded concurrency. A failing session
 * yields an engine finding rather than aborting the whole batch.
 */
export async function scanPaths(paths: string[], opts: ScanOptions): Promise<ScanResult> {
  const concurrency = Math.max(1, opts.concurrency ?? DEFAULT_CONCURRENCY);
  const cap = opts.maxFindingsPerSession ?? DEFAULT_FINDING_CAP;
  const perSession: SessionScanResult[] = new Array(paths.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= paths.length) return;
      const result = await scanSession(paths[i], opts.rules, cap);
      perSession[i] = result;
      if (opts.onSession) opts.onSession(result);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, paths.length) }, worker));

  let eventsScanned = 0;
  const findings: Finding[] = [];
  for (const r of perSession) {
    eventsScanned += r.eventCount;
    findings.push(...r.findings);
  }

  return {
    sessionsScanned: paths.length,
    eventsScanned,
    findings,
    perSession,
  };
}
