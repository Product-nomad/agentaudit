import { strict as assert } from "node:assert";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { scanPaths, scanSession } from "./engine.js";
import type { Finding, Rule, RuleContext } from "./types.js";

let dir: string;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "agentaudit-engine-"));
});
after(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function makeSession(name: string, lines: unknown[]): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`);
  return path;
}

const nullRule: Rule = {
  id: "test.null",
  title: "n/a",
  severity: "info",
  description: "n/a",
  check: () => [],
};

const everyEventRule: Rule = {
  id: "test.every-event",
  title: "every event",
  severity: "info",
  description: "fires once per event",
  check(ctx: RuleContext): Finding[] {
    return [
      {
        ruleId: this.id,
        severity: this.severity,
        title: "tick",
        message: "tick",
        sessionPath: ctx.sessionPath,
        sessionId: ctx.sessionMeta.sessionId,
      },
    ];
  },
};

const throwingRule: Rule = {
  id: "test.throws",
  title: "x",
  severity: "info",
  description: "x",
  check(): Finding[] {
    throw new Error("boom");
  },
};

describe("scanSession", () => {
  it("streams events and counts them", async () => {
    const path = await makeSession("a.jsonl", [
      { type: "user", sessionId: "s", message: { role: "user", content: "hi" } },
      { type: "system", timestamp: "2026-04-23T10:00:00Z", sessionId: "s" },
    ]);
    const r = await scanSession(path, [nullRule]);
    assert.equal(r.eventCount, 2);
    assert.equal(r.findings.length, 0);
    assert.equal(r.sessionId, "s");
  });

  it("emits an engine finding when a rule throws, and keeps scanning", async () => {
    const path = await makeSession("b.jsonl", [
      { type: "user", message: { role: "user", content: "a" } },
      { type: "user", message: { role: "user", content: "b" } },
    ]);
    const r = await scanSession(path, [throwingRule]);
    assert.equal(r.findings.length, 2);
    assert.ok(r.findings.every((f) => f.ruleId.startsWith("engine.rule-error.")));
  });

  it("honors the maxFindings cap and flags truncation", async () => {
    const path = await makeSession("c.jsonl", [
      { type: "user", message: { role: "user", content: "x" } },
      { type: "user", message: { role: "user", content: "x" } },
      { type: "user", message: { role: "user", content: "x" } },
    ]);
    const r = await scanSession(path, [everyEventRule], 2);
    assert.equal(r.findings.length, 2);
    assert.equal(r.truncated, true);
  });

  it("reports a read error instead of crashing on missing file", async () => {
    const r = await scanSession(join(dir, "nope.jsonl"), [nullRule]);
    assert.equal(r.findings.length, 1);
    assert.equal(r.findings[0].ruleId, "engine.session-read-error");
  });
});

describe("scanPaths", () => {
  it("preserves per-session result order regardless of concurrency", async () => {
    const paths = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        makeSession(`ord-${i}.jsonl`, [
          { type: "user", sessionId: `s${i}`, message: { role: "user", content: "x" } },
        ]),
      ),
    );
    const r = await scanPaths(paths, { rules: [nullRule], concurrency: 3 });
    assert.equal(r.sessionsScanned, 6);
    for (let i = 0; i < paths.length; i++) {
      assert.equal(r.perSession[i].path, paths[i]);
    }
  });

  it("caps concurrency", async () => {
    const paths = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        makeSession(`cap-${i}.jsonl`, [{ type: "user", message: { role: "user", content: "x" } }]),
      ),
    );
    let inFlight = 0;
    let peak = 0;
    const observingRule: Rule = {
      id: "test.observe",
      title: "x",
      severity: "info",
      description: "x",
      check(): Finding[] {
        inFlight++;
        peak = Math.max(peak, inFlight);
        inFlight--;
        return [];
      },
    };
    await scanPaths(paths, { rules: [observingRule], concurrency: 3 });
    assert.ok(peak <= 3, `peak in-flight ${peak} exceeded concurrency 3`);
  });
});
