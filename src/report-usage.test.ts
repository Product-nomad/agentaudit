import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { renderUsageJson, renderUsageText } from "./report-usage.js";
import type { SessionUsage, UsageReport } from "./usage.js";

function session(overrides: Partial<SessionUsage>): SessionUsage {
  return {
    path: "/tmp/x.jsonl",
    sessionId: "s",
    eventCount: 10,
    total: { input: 100, cacheCreation: 200, cacheRead: 300, output: 50, turns: 4 },
    byModel: {
      "claude-opus-4-7": { input: 100, cacheCreation: 200, cacheRead: 300, output: 50, turns: 4 },
    },
    firstTimestamp: "2026-04-23T10:00:00Z",
    lastTimestamp: "2026-04-23T10:05:00Z",
    cwd: "/work/alpha",
    ...overrides,
  };
}

describe("renderUsageText", () => {
  it("includes session count, total line, and project breakdown", () => {
    const report: UsageReport = {
      sessions: [session({ path: "/a.jsonl" }), session({ path: "/b.jsonl", cwd: "/work/beta" })],
      byProject: [
        {
          cwd: "/work/alpha",
          sessions: [session({ path: "/a.jsonl" })],
          total: { input: 100, cacheCreation: 200, cacheRead: 300, output: 50, turns: 4 },
          byModel: {},
        },
        {
          cwd: "/work/beta",
          sessions: [session({ path: "/b.jsonl" })],
          total: { input: 100, cacheCreation: 200, cacheRead: 300, output: 50, turns: 4 },
          byModel: {},
        },
      ],
      total: { input: 200, cacheCreation: 400, cacheRead: 600, output: 100, turns: 8 },
      byModel: {
        "claude-opus-4-7": {
          input: 200,
          cacheCreation: 400,
          cacheRead: 600,
          output: 100,
          turns: 8,
        },
      },
      byClient: [],
      sessionsScanned: 2,
      eventsScanned: 20,
    };

    const out = renderUsageText(report);
    assert.match(out, /2 sessions \/ 20 events/);
    assert.match(out, /\/work\/alpha/);
    assert.match(out, /\/work\/beta/);
    assert.match(out, /claude-opus-4-7/);
    assert.match(out, /top 2 sessions/);
  });

  it("pluralisation degrades gracefully for single items", () => {
    const report: UsageReport = {
      sessions: [session({})],
      byProject: [],
      byClient: [],
      total: { input: 1, cacheCreation: 0, cacheRead: 0, output: 1, turns: 1 },
      byModel: {},
      sessionsScanned: 1,
      eventsScanned: 5,
    };
    const out = renderUsageText(report);
    assert.match(out, /1 session \/ 5 events/);
    assert.match(out, /top 1 session /); // trailing space so "sessions" would fail
  });
});

describe("renderUsageJson", () => {
  it("returns parseable JSON that round-trips the totals", () => {
    const report: UsageReport = {
      sessions: [],
      byProject: [],
      byClient: [],
      total: { input: 10, cacheCreation: 0, cacheRead: 0, output: 5, turns: 2 },
      byModel: {},
      sessionsScanned: 0,
      eventsScanned: 0,
    };
    const parsed = JSON.parse(renderUsageJson(report));
    assert.equal(parsed.total.input, 10);
    assert.equal(parsed.total.output, 5);
  });
});
