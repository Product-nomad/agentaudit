import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { RawEvent, SessionMeta } from "../types.js";
import { secretsInToolResult } from "./secrets-in-tool-result.js";

const meta: SessionMeta = { path: "/tmp/x.jsonl", sessionId: "s1", eventCount: 0 };

function toolResult(content: string): RawEvent {
  return {
    type: "user",
    uuid: "u1",
    timestamp: "2026-04-23T10:00:00.000Z",
    message: {
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "t1", content }],
    },
  };
}

describe("secretsInToolResult", () => {
  it("flags credential in tool output", () => {
    const findings = secretsInToolResult.check({
      event: toolResult("export AKIAIOSFODNN7EXAMPLE"),
      sessionPath: meta.path,
      sessionMeta: meta,
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "high");
  });

  it("returns [] for empty output", () => {
    assert.deepEqual(
      secretsInToolResult.check({
        event: toolResult(""),
        sessionPath: meta.path,
        sessionMeta: meta,
      }),
      [],
    );
  });

  it("returns [] for assistant events", () => {
    const ev: RawEvent = { type: "assistant", message: { role: "assistant", content: [] } };
    assert.deepEqual(
      secretsInToolResult.check({ event: ev, sessionPath: meta.path, sessionMeta: meta }),
      [],
    );
  });
});
