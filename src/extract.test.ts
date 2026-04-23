import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  getAssistantText,
  getAssistantThinking,
  getToolResults,
  getToolUses,
  getUserPrompt,
  toolResultText,
} from "./extract.js";
import type { RawEvent } from "./types.js";

function user(content: unknown): RawEvent {
  return { type: "user", message: { role: "user", content: content as never } };
}
function assistant(content: unknown): RawEvent {
  return {
    type: "assistant",
    message: { role: "assistant", content: content as never },
  };
}

describe("getUserPrompt", () => {
  it("returns string content from plain user message", () => {
    assert.equal(getUserPrompt(user("hello")), "hello");
  });

  it("concatenates text blocks", () => {
    assert.equal(
      getUserPrompt(
        user([
          { type: "text", text: "a" },
          { type: "text", text: "b" },
        ]),
      ),
      "a\nb",
    );
  });

  it("returns empty for tool_result-bearing user events (agent-produced)", () => {
    assert.equal(
      getUserPrompt(user([{ type: "tool_result", tool_use_id: "t1", content: "stdout" }])),
      "",
    );
  });

  it("returns empty for non-user events", () => {
    assert.equal(getUserPrompt(assistant([{ type: "text", text: "x" }])), "");
  });
});

describe("getToolUses / getToolResults", () => {
  it("extracts tool_use blocks from assistant message", () => {
    const ev = assistant([
      { type: "text", text: "thinking out loud" },
      { type: "tool_use", id: "t1", name: "Bash", input: { command: "ls" } },
    ]);
    const uses = getToolUses(ev);
    assert.equal(uses.length, 1);
    assert.equal(uses[0].name, "Bash");
  });

  it("returns [] for user events passed to getToolUses", () => {
    assert.deepEqual(getToolUses(user("x")), []);
  });

  it("extracts tool_result from user events", () => {
    const ev = user([{ type: "tool_result", tool_use_id: "t1", content: "stdout" }]);
    const res = getToolResults(ev);
    assert.equal(res.length, 1);
    assert.equal(res[0].tool_use_id, "t1");
  });
});

describe("text/thinking extraction", () => {
  it("getAssistantText joins only text blocks", () => {
    const ev = assistant([
      { type: "thinking", thinking: "hmm" },
      { type: "text", text: "reply" },
    ]);
    assert.equal(getAssistantText(ev), "reply");
  });

  it("getAssistantThinking joins thinking blocks", () => {
    const ev = assistant([{ type: "thinking", thinking: "deep thought" }]);
    assert.equal(getAssistantThinking(ev), "deep thought");
  });
});

describe("toolResultText", () => {
  it("returns string content as-is", () => {
    assert.equal(
      toolResultText({
        type: "tool_result",
        tool_use_id: "t1",
        content: "out",
      }),
      "out",
    );
  });

  it("joins text blocks in array content", () => {
    assert.equal(
      toolResultText({
        type: "tool_result",
        tool_use_id: "t1",
        content: [
          { type: "text", text: "line1" },
          { type: "text", text: "line2" },
        ],
      }),
      "line1\nline2",
    );
  });
});
