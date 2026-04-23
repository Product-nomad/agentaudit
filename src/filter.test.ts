import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { ScanResult } from "./engine.js";
import { filterScanResultBySince, filterUsageReportBySince } from "./filter.js";
import type { SessionUsage, UsageReport } from "./usage.js";

const cutoff = new Date("2026-04-20T00:00:00Z");

function sessionUsage(overrides: Partial<SessionUsage>): SessionUsage {
  return {
    path: "/x.jsonl",
    sessionId: "s",
    eventCount: 10,
    total: { input: 10, cacheCreation: 0, cacheRead: 0, output: 5, turns: 1 },
    byModel: {
      "claude-opus-4-7": { input: 10, cacheCreation: 0, cacheRead: 0, output: 5, turns: 1 },
    },
    ...overrides,
  };
}

describe("filterUsageReportBySince", () => {
  it("drops sessions older than the cutoff and recomputes totals", () => {
    const sessions = [
      sessionUsage({
        path: "/old.jsonl",
        firstTimestamp: "2026-04-10T00:00:00Z",
        lastTimestamp: "2026-04-10T00:05:00Z",
        cwd: "/work/alpha",
      }),
      sessionUsage({
        path: "/new.jsonl",
        firstTimestamp: "2026-04-22T00:00:00Z",
        lastTimestamp: "2026-04-22T00:05:00Z",
        cwd: "/work/alpha",
        total: { input: 7, cacheCreation: 0, cacheRead: 0, output: 3, turns: 1 },
        byModel: {
          "claude-opus-4-7": { input: 7, cacheCreation: 0, cacheRead: 0, output: 3, turns: 1 },
        },
      }),
    ];
    const report: UsageReport = {
      sessions,
      byProject: [
        {
          cwd: "/work/alpha",
          sessions,
          total: { input: 17, cacheCreation: 0, cacheRead: 0, output: 8, turns: 2 },
          byModel: {},
        },
      ],
      total: { input: 17, cacheCreation: 0, cacheRead: 0, output: 8, turns: 2 },
      byModel: {},
      sessionsScanned: 2,
      eventsScanned: 20,
    };

    const filtered = filterUsageReportBySince(report, cutoff);
    assert.equal(filtered.sessions.length, 1);
    assert.equal(filtered.sessions[0].path, "/new.jsonl");
    assert.equal(filtered.total.input, 7);
    assert.equal(filtered.total.output, 3);
    assert.equal(filtered.byProject[0].sessions.length, 1);
    assert.equal(filtered.byModel["claude-opus-4-7"].input, 7);
  });

  it("returns an empty report if nothing is in range", () => {
    const report: UsageReport = {
      sessions: [
        sessionUsage({
          firstTimestamp: "2026-04-10T00:00:00Z",
          lastTimestamp: "2026-04-10T00:05:00Z",
        }),
      ],
      byProject: [],
      total: { input: 10, cacheCreation: 0, cacheRead: 0, output: 5, turns: 1 },
      byModel: {},
      sessionsScanned: 1,
      eventsScanned: 10,
    };
    const filtered = filterUsageReportBySince(report, cutoff);
    assert.equal(filtered.sessions.length, 0);
    assert.equal(filtered.total.input, 0);
    assert.equal(filtered.sessionsScanned, 0);
  });
});

describe("filterScanResultBySince", () => {
  it("drops sessions whose findings are all older than cutoff", () => {
    const result: ScanResult = {
      sessionsScanned: 2,
      eventsScanned: 20,
      findings: [
        {
          ruleId: "r",
          severity: "high",
          title: "t",
          message: "m",
          sessionPath: "/old.jsonl",
          timestamp: "2026-04-10T00:00:00Z",
        },
        {
          ruleId: "r",
          severity: "high",
          title: "t",
          message: "m",
          sessionPath: "/new.jsonl",
          timestamp: "2026-04-22T00:00:00Z",
        },
      ],
      perSession: [
        {
          path: "/old.jsonl",
          sessionId: "s1",
          eventCount: 10,
          findings: [
            {
              ruleId: "r",
              severity: "high",
              title: "t",
              message: "m",
              sessionPath: "/old.jsonl",
              timestamp: "2026-04-10T00:00:00Z",
            },
          ],
        },
        {
          path: "/new.jsonl",
          sessionId: "s2",
          eventCount: 10,
          findings: [
            {
              ruleId: "r",
              severity: "high",
              title: "t",
              message: "m",
              sessionPath: "/new.jsonl",
              timestamp: "2026-04-22T00:00:00Z",
            },
          ],
        },
      ],
    };
    const filtered = filterScanResultBySince(result, cutoff);
    assert.equal(filtered.sessionsScanned, 1);
    assert.equal(filtered.perSession[0].path, "/new.jsonl");
    assert.equal(filtered.findings.length, 1);
  });
});
