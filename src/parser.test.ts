import { strict as assert } from "node:assert";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { discoverSessions, parseSession } from "./parser.js";

let dir: string;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "agentaudit-test-"));
});
after(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("parseSession", () => {
  it("collects events and infers meta from system event", async () => {
    const path = join(dir, "a.jsonl");
    await writeFile(
      path,
      `${[
        JSON.stringify({ type: "permission-mode", permissionMode: "auto", sessionId: "s-a" }),
        JSON.stringify({
          type: "system",
          cwd: "/work",
          gitBranch: "main",
          version: "2.1.0",
          timestamp: "2026-04-23T10:00:00.000Z",
          sessionId: "s-a",
        }),
        JSON.stringify({
          type: "user",
          timestamp: "2026-04-23T10:00:01.000Z",
          sessionId: "s-a",
          message: { role: "user", content: "hi" },
        }),
      ].join("\n")}\n`,
    );

    const parsed = await parseSession(path);
    assert.equal(parsed.meta.sessionId, "s-a");
    assert.equal(parsed.meta.cwd, "/work");
    assert.equal(parsed.meta.gitBranch, "main");
    assert.equal(parsed.meta.eventCount, 3);
    assert.equal(parsed.meta.firstTimestamp, "2026-04-23T10:00:00.000Z");
    assert.equal(parsed.meta.lastTimestamp, "2026-04-23T10:00:01.000Z");
  });

  it("skips malformed JSON lines without crashing", async () => {
    const path = join(dir, "b.jsonl");
    await writeFile(
      path,
      `${[
        JSON.stringify({ type: "user", message: { role: "user", content: "ok" } }),
        "{not valid json",
        JSON.stringify({ type: "user", message: { role: "user", content: "also ok" } }),
      ].join("\n")}\n`,
    );
    const parsed = await parseSession(path);
    assert.equal(parsed.events.length, 2);
  });

  it("returns empty meta for empty file", async () => {
    const path = join(dir, "empty.jsonl");
    await writeFile(path, "");
    const parsed = await parseSession(path);
    assert.equal(parsed.events.length, 0);
    assert.equal(parsed.meta.eventCount, 0);
    assert.equal(parsed.meta.sessionId, "empty"); // inferred from path
  });
});

describe("discoverSessions", () => {
  it("walks a directory and returns only .jsonl files, sorted", async () => {
    const root = join(dir, "projects");
    const sub = join(root, "p1");
    await writeFile(join(dir, "not-session.txt"), "x");
    await import("node:fs/promises").then((m) => m.mkdir(sub, { recursive: true }));
    await writeFile(join(sub, "z.jsonl"), "");
    await writeFile(join(sub, "a.jsonl"), "");
    await writeFile(join(sub, "readme.md"), "nope");
    const files = await discoverSessions(root);
    assert.equal(files.length, 2);
    assert.ok(files[0].endsWith("a.jsonl"));
    assert.ok(files[1].endsWith("z.jsonl"));
  });

  it("returns [] for nonexistent root", async () => {
    assert.deepEqual(await discoverSessions(join(dir, "does-not-exist")), []);
  });
});
