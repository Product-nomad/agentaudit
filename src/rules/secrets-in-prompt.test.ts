import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { RawEvent, SessionMeta } from "../types.js";
import { secretsInPrompt } from "./secrets-in-prompt.js";

const meta: SessionMeta = { path: "/tmp/x.jsonl", sessionId: "s1", eventCount: 0 };

function userPrompt(text: string): RawEvent {
  return {
    type: "user",
    uuid: "u1",
    timestamp: "2026-04-23T10:00:00.000Z",
    message: { role: "user", content: text },
  };
}

describe("secretsInPrompt", () => {
  it("flags a GitHub PAT pasted into a prompt", () => {
    const findings = secretsInPrompt.check({
      event: userPrompt(`use this token: ghp_${"x".repeat(36)}`),
      sessionPath: meta.path,
      sessionMeta: meta,
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "critical");
    assert.ok(findings[0].excerpt?.startsWith("ghp_"));
  });

  it("returns [] for benign prompt", () => {
    assert.deepEqual(
      secretsInPrompt.check({
        event: userPrompt("write a haiku about yaks"),
        sessionPath: meta.path,
        sessionMeta: meta,
      }),
      [],
    );
  });

  it("ignores tool_result-bearing user events", () => {
    const ev: RawEvent = {
      type: "user",
      message: {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "t1", content: `ghp_${"x".repeat(36)}` }],
      },
    };
    assert.deepEqual(
      secretsInPrompt.check({ event: ev, sessionPath: meta.path, sessionMeta: meta }),
      [],
    );
  });
});
