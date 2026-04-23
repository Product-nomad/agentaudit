import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { csvEscape, renderUsageCsv } from "./report-csv.js";
import type { SessionUsage, UsageReport } from "./usage.js";

describe("csvEscape", () => {
  it("leaves benign strings alone", () => {
    assert.equal(csvEscape("hello"), "hello");
  });

  it("quotes strings containing a comma", () => {
    assert.equal(csvEscape("a,b"), '"a,b"');
  });

  it("quotes and doubles strings containing a quote", () => {
    assert.equal(csvEscape('he said "hi"'), '"he said ""hi"""');
  });

  it("quotes strings containing a newline", () => {
    assert.equal(csvEscape("a\nb"), '"a\nb"');
  });

  it("stringifies numbers without quoting", () => {
    assert.equal(csvEscape(42), "42");
  });

  it("emits empty string for undefined", () => {
    assert.equal(csvEscape(undefined), "");
  });
});

function session(overrides: Partial<SessionUsage>): SessionUsage {
  return {
    path: "/p.jsonl",
    sessionId: "s1",
    eventCount: 10,
    cwd: "/work/alpha",
    firstTimestamp: "2026-04-22T10:00:00Z",
    lastTimestamp: "2026-04-22T10:05:00Z",
    total: { input: 10, cacheCreation: 20, cacheRead: 30, output: 5, turns: 2 },
    byModel: {
      "claude-opus-4-7": { input: 10, cacheCreation: 20, cacheRead: 30, output: 5, turns: 2 },
    },
    ...overrides,
  };
}

describe("renderUsageCsv", () => {
  const report: UsageReport = {
    sessions: [
      session({
        path: "/a.jsonl",
        sessionId: "s-a",
        tag: "acme",
        byModel: {
          "claude-opus-4-7": {
            input: 10,
            cacheCreation: 20,
            cacheRead: 30,
            output: 5,
            turns: 2,
          },
          "claude-haiku-4-5": {
            input: 2,
            cacheCreation: 0,
            cacheRead: 0,
            output: 1,
            turns: 1,
          },
        },
      }),
      session({
        path: "/b.jsonl",
        sessionId: "s-b",
        cwd: "/work, comma",
        total: { input: 7, cacheCreation: 0, cacheRead: 0, output: 3, turns: 1 },
        byModel: {
          "claude-opus-4-7": { input: 7, cacheCreation: 0, cacheRead: 0, output: 3, turns: 1 },
        },
      }),
    ],
    byProject: [],
    byClient: [],
    total: { input: 19, cacheCreation: 20, cacheRead: 30, output: 9, turns: 4 },
    byModel: {},
    sessionsScanned: 2,
    eventsScanned: 20,
  };

  it("emits a header and one row per (session × model)", () => {
    const csv = renderUsageCsv(report);
    const rows = csv.trimEnd().split("\n");
    // 1 header + 2 rows for session A (two models) + 1 row for session B
    assert.equal(rows.length, 4);
    assert.ok(rows[0].startsWith("session_id,"));
    assert.ok(rows.some((r) => r.startsWith("s-a,") && r.includes("claude-opus-4-7")));
    assert.ok(rows.some((r) => r.startsWith("s-a,") && r.includes("claude-haiku-4-5")));
    assert.ok(rows.some((r) => r.startsWith("s-b,")));
  });

  it("escapes commas in cwd values", () => {
    const csv = renderUsageCsv(report);
    assert.ok(csv.includes('"/work, comma"'));
  });

  it("includes client tag column and leaves it empty when unset", () => {
    // Re-render with a report free of embedded commas so simple split works.
    const clean: UsageReport = {
      ...report,
      sessions: [
        session({ path: "/a.jsonl", sessionId: "s-a", tag: "acme" }),
        session({ path: "/b.jsonl", sessionId: "s-b" }),
      ],
    };
    const csv = renderUsageCsv(clean);
    const lines = csv.trimEnd().split("\n");
    const clientIdx = lines[0].split(",").indexOf("client");
    assert.ok(clientIdx >= 0, "header missing 'client' column");
    const aCols = lines.find((l) => l.startsWith("s-a,"))?.split(",");
    const bCols = lines.find((l) => l.startsWith("s-b,"))?.split(",");
    assert.equal(aCols?.[clientIdx], "acme");
    assert.equal(bCols?.[clientIdx], "");
  });
});
