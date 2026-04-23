import { strict as assert } from "node:assert";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { analyzePaths, analyzeSession, rollupByProject } from "./usage.js";

let dir: string;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "agentaudit-usage-"));
});
after(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function writeSession(name: string, lines: unknown[]): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`);
  return path;
}

function assistantTurn(model: string, usage: Record<string, number>, ts?: string): unknown {
  return {
    type: "assistant",
    timestamp: ts,
    message: {
      role: "assistant",
      model,
      content: [{ type: "text", text: "ok" }],
      usage,
    },
  };
}

describe("analyzeSession", () => {
  it("sums token fields across assistant turns", async () => {
    const p = await writeSession("a.jsonl", [
      { type: "system", sessionId: "s", cwd: "/work", timestamp: "2026-04-23T10:00:00Z" },
      assistantTurn(
        "claude-opus-4-7",
        {
          input_tokens: 10,
          cache_creation_input_tokens: 100,
          cache_read_input_tokens: 200,
          output_tokens: 50,
        },
        "2026-04-23T10:00:01Z",
      ),
      assistantTurn(
        "claude-opus-4-7",
        {
          input_tokens: 5,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 300,
          output_tokens: 20,
        },
        "2026-04-23T10:00:02Z",
      ),
    ]);

    const u = await analyzeSession(p);
    assert.equal(u.total.input, 15);
    assert.equal(u.total.cacheCreation, 100);
    assert.equal(u.total.cacheRead, 500);
    assert.equal(u.total.output, 70);
    assert.equal(u.total.turns, 2);
    assert.equal(u.sessionId, "s");
    assert.equal(u.cwd, "/work");
  });

  it("splits usage by model", async () => {
    const p = await writeSession("b.jsonl", [
      assistantTurn("claude-opus-4-7", { input_tokens: 1, output_tokens: 1 }),
      assistantTurn("claude-haiku-4-5", { input_tokens: 2, output_tokens: 2 }),
      assistantTurn("claude-opus-4-7", { input_tokens: 3, output_tokens: 3 }),
    ]);

    const u = await analyzeSession(p);
    assert.equal(Object.keys(u.byModel).length, 2);
    assert.equal(u.byModel["claude-opus-4-7"].input, 4);
    assert.equal(u.byModel["claude-opus-4-7"].output, 4);
    assert.equal(u.byModel["claude-opus-4-7"].turns, 2);
    assert.equal(u.byModel["claude-haiku-4-5"].input, 2);
    assert.equal(u.byModel["claude-haiku-4-5"].turns, 1);
  });

  it("ignores assistant events without usage blocks", async () => {
    const p = await writeSession("c.jsonl", [
      {
        type: "assistant",
        message: { role: "assistant", model: "m", content: [{ type: "text", text: "x" }] },
      },
      assistantTurn("claude-opus-4-7", { input_tokens: 10, output_tokens: 5 }),
    ]);
    const u = await analyzeSession(p);
    assert.equal(u.total.turns, 1);
    assert.equal(u.total.input, 10);
  });

  it("yields zero-usage result for an empty session", async () => {
    const p = await writeSession("d.jsonl", []);
    const u = await analyzeSession(p);
    assert.equal(u.total.turns, 0);
    assert.equal(u.total.input, 0);
    assert.equal(u.eventCount, 0);
    assert.equal(Object.keys(u.byModel).length, 0);
  });

  it("reports a read error gracefully for a missing file", async () => {
    const u = await analyzeSession(join(dir, "nope.jsonl"));
    assert.equal(u.readError, true);
    assert.equal(u.total.turns, 0);
  });
});

describe("rollupByProject", () => {
  it("groups sessions by cwd and aggregates totals", async () => {
    const a = await writeSession("p1-a.jsonl", [
      { type: "system", sessionId: "s1", cwd: "/work/alpha" },
      assistantTurn("claude-opus-4-7", { input_tokens: 10, output_tokens: 5 }),
    ]);
    const b = await writeSession("p1-b.jsonl", [
      { type: "system", sessionId: "s2", cwd: "/work/alpha" },
      assistantTurn("claude-opus-4-7", { input_tokens: 3, output_tokens: 4 }),
    ]);
    const c = await writeSession("p2.jsonl", [
      { type: "system", sessionId: "s3", cwd: "/work/beta" },
      assistantTurn("claude-haiku-4-5", { input_tokens: 1, output_tokens: 1 }),
    ]);

    const sessions = await Promise.all([a, b, c].map((p) => analyzeSession(p)));
    const projects = rollupByProject(sessions);

    assert.equal(projects.length, 2);
    const alpha = projects.find((p) => p.cwd === "/work/alpha");
    const beta = projects.find((p) => p.cwd === "/work/beta");
    assert.ok(alpha && beta);
    assert.equal(alpha.sessions.length, 2);
    assert.equal(alpha.total.input, 13);
    assert.equal(alpha.total.output, 9);
    assert.equal(beta.sessions.length, 1);
    assert.equal(beta.total.input, 1);
  });

  it("parks sessions without a cwd under an unknown sentinel", async () => {
    const p = await writeSession("nocwd.jsonl", [
      assistantTurn("claude-opus-4-7", { input_tokens: 1, output_tokens: 1 }),
    ]);
    const sessions = [await analyzeSession(p)];
    const projects = rollupByProject(sessions);
    assert.equal(projects.length, 1);
    assert.equal(projects[0].cwd, "(unknown)");
  });
});

describe("analyzePaths", () => {
  it("scans many sessions under a concurrency cap", async () => {
    const paths = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        writeSession(`m-${i}.jsonl`, [
          { type: "system", sessionId: `s${i}`, cwd: "/work" },
          assistantTurn("claude-opus-4-7", { input_tokens: 10, output_tokens: 5 }),
        ]),
      ),
    );
    const report = await analyzePaths(paths, { concurrency: 3 });
    assert.equal(report.sessions.length, 6);
    assert.equal(report.total.input, 60);
    assert.equal(report.total.output, 30);
    assert.equal(report.total.turns, 6);
    assert.equal(report.byProject.length, 1);
  });
});
