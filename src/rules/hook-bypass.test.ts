import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { RawEvent, SessionMeta } from "../types.js";
import { hookBypass } from "./hook-bypass.js";

const meta: SessionMeta = { path: "/tmp/x.jsonl", sessionId: "s1", eventCount: 0 };

function bash(cmd: string): RawEvent {
  return {
    type: "assistant",
    uuid: "u1",
    timestamp: "2026-04-23T10:00:00.000Z",
    message: {
      role: "assistant",
      content: [{ type: "tool_use", id: "t1", name: "Bash", input: { command: cmd } }],
    },
  };
}

function userPrompt(text: string): RawEvent {
  return {
    type: "user",
    uuid: "u1",
    timestamp: "2026-04-23T10:00:00.000Z",
    message: { role: "user", content: text },
  };
}

describe("hookBypass", () => {
  it("flags --no-verify", () => {
    const f = hookBypass.check({
      event: bash("git commit --no-verify -m x"),
      sessionPath: meta.path,
      sessionMeta: meta,
    });
    assert.equal(f.length, 1);
    assert.equal(f[0].severity, "medium");
  });

  it("flags -c commit.gpgsign=false", () => {
    const f = hookBypass.check({
      event: bash("git -c commit.gpgsign=false commit -m x"),
      sessionPath: meta.path,
      sessionMeta: meta,
    });
    assert.equal(f.length, 1);
  });

  it("flags SKIP=lint", () => {
    const f = hookBypass.check({
      event: bash("SKIP=lint git commit -m x"),
      sessionPath: meta.path,
      sessionMeta: meta,
    });
    assert.equal(f.length, 1);
  });

  it("returns [] for clean commit", () => {
    assert.deepEqual(
      hookBypass.check({
        event: bash("git commit -m 'feat: x'"),
        sessionPath: meta.path,
        sessionMeta: meta,
      }),
      [],
    );
  });

  it("flags user prompt explicitly asking to skip hooks", () => {
    const f = hookBypass.check({
      event: userPrompt("just commit with --no-verify to save time"),
      sessionPath: meta.path,
      sessionMeta: meta,
    });
    assert.equal(f.length, 1);
    assert.equal(f[0].severity, "info");
  });

  it("suppresses matches inside interpreter eval", () => {
    assert.deepEqual(
      hookBypass.check({
        event: bash(`node -e "const x = '--no-verify'"`),
        sessionPath: meta.path,
        sessionMeta: meta,
      }),
      [],
    );
  });
});
