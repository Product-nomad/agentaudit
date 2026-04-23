import type { ScanResult } from "./engine.js";
import { sessionInRange } from "./since.js";
import type { ProjectRollup, SessionUsage, TokenUsage, UsageReport } from "./usage.js";

function zeroUsage(): TokenUsage {
  return { input: 0, cacheCreation: 0, cacheRead: 0, output: 0, turns: 0 };
}

function addTokens(target: TokenUsage, source: TokenUsage): void {
  target.input += source.input;
  target.cacheCreation += source.cacheCreation;
  target.cacheRead += source.cacheRead;
  target.output += source.output;
  target.turns += source.turns;
}

function bucket(map: Record<string, TokenUsage>, key: string): TokenUsage {
  let b = map[key];
  if (!b) {
    b = zeroUsage();
    map[key] = b;
  }
  return b;
}

export function filterScanResultBySince(result: ScanResult, cutoff: Date): ScanResult {
  const keptSessions = result.perSession.filter((s) =>
    sessionInRange(sessionTimestamps(result, s), cutoff),
  );
  const keptPaths = new Set(keptSessions.map((s) => s.path));
  const findings = result.findings.filter((f) => keptPaths.has(f.sessionPath));
  const eventsScanned = keptSessions.reduce((n, s) => n + s.eventCount, 0);
  return {
    sessionsScanned: keptSessions.length,
    eventsScanned,
    findings,
    perSession: keptSessions,
  };
}

/**
 * SessionScanResult from the audit path doesn't carry timestamps — they
 * live inside the individual findings. Approximate by consulting the
 * first/last findings if any; otherwise keep the session (can't verify).
 */
function sessionTimestamps(_result: ScanResult, s: ScanResult["perSession"][number]) {
  if (!s.findings.length) return { firstTimestamp: undefined, lastTimestamp: undefined };
  let first: string | undefined;
  let last: string | undefined;
  for (const f of s.findings) {
    if (!f.timestamp) continue;
    if (!first || f.timestamp < first) first = f.timestamp;
    if (!last || f.timestamp > last) last = f.timestamp;
  }
  return { firstTimestamp: first, lastTimestamp: last };
}

export function filterUsageReportBySince(report: UsageReport, cutoff: Date): UsageReport {
  const keptSessions = report.sessions.filter((s) => sessionInRange(s, cutoff));
  return {
    sessions: keptSessions,
    byProject: rollupByProjectPreservingSort(keptSessions, report.byProject),
    byClient: rollupByClientFromSessions(keptSessions),
    total: aggregateTotal(keptSessions),
    byModel: aggregateByModel(keptSessions),
    sessionsScanned: keptSessions.length,
    eventsScanned: keptSessions.reduce((n, s) => n + s.eventCount, 0),
  };
}

function rollupByClientFromSessions(sessions: SessionUsage[]) {
  const byTag = new Map<
    string,
    {
      tag: string;
      sessions: SessionUsage[];
      total: TokenUsage;
      byModel: Record<string, TokenUsage>;
    }
  >();
  for (const s of sessions) {
    if (!s.tag) continue;
    let entry = byTag.get(s.tag);
    if (!entry) {
      entry = { tag: s.tag, sessions: [], total: zeroUsage(), byModel: {} };
      byTag.set(s.tag, entry);
    }
    entry.sessions.push(s);
    addTokens(entry.total, s.total);
    for (const [model, tokens] of Object.entries(s.byModel)) {
      addTokens(bucket(entry.byModel, model), tokens);
    }
  }
  return [...byTag.values()].sort((a, b) => b.total.output - a.total.output);
}

function rollupByProjectPreservingSort(
  sessions: SessionUsage[],
  original: ProjectRollup[],
): ProjectRollup[] {
  const byCwd = new Map<string, ProjectRollup>();
  for (const s of sessions) {
    const key = s.cwd ?? "(unknown)";
    let entry = byCwd.get(key);
    if (!entry) {
      entry = { cwd: key, sessions: [], total: zeroUsage(), byModel: {} };
      byCwd.set(key, entry);
    }
    entry.sessions.push(s);
    addTokens(entry.total, s.total);
    for (const [model, tokens] of Object.entries(s.byModel)) {
      addTokens(bucket(entry.byModel, model), tokens);
    }
  }
  // Preserve original sort order of projects when possible; unknown at tail.
  const originalOrder = original.map((p) => p.cwd);
  return [...byCwd.values()].sort((a, b) => {
    const ai = originalOrder.indexOf(a.cwd);
    const bi = originalOrder.indexOf(b.cwd);
    if (ai < 0 && bi < 0) return b.total.output - a.total.output;
    if (ai < 0) return 1;
    if (bi < 0) return -1;
    return ai - bi;
  });
}

function aggregateTotal(sessions: SessionUsage[]): TokenUsage {
  const total = zeroUsage();
  for (const s of sessions) addTokens(total, s.total);
  return total;
}

function aggregateByModel(sessions: SessionUsage[]): Record<string, TokenUsage> {
  const out: Record<string, TokenUsage> = {};
  for (const s of sessions) {
    for (const [model, tokens] of Object.entries(s.byModel)) {
      addTokens(bucket(out, model), tokens);
    }
  }
  return out;
}
