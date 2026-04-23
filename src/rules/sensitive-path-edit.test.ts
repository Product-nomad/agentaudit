import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { RawEvent, SessionMeta } from "../types.js";
import { sensitivePathEdit } from "./sensitive-path-edit.js";

const meta: SessionMeta = { path: "/tmp/x.jsonl", sessionId: "s1", eventCount: 0 };

function writeEvent(tool: string, path: string): RawEvent {
  return {
    type: "assistant",
    uuid: "u1",
    timestamp: "2026-04-23T10:00:00.000Z",
    message: {
      role: "assistant",
      content: [{ type: "tool_use", id: "t1", name: tool, input: { file_path: path } }],
    },
  };
}

const cases: Array<[string, string, string]> = [
  ["Write", "/home/u/.ssh/authorized_keys", "ssh-dir"],
  ["Edit", "/home/u/.aws/credentials", "aws-creds"],
  ["Write", "/home/u/.env", "dotenv"],
  ["Edit", "/home/u/.bashrc", "shell-rc"],
  ["Write", "/etc/sudoers.d/99-custom", "sudoers"],
  ["Write", "/etc/systemd/system/x.service", "systemd-unit"],
];

describe("sensitivePathEdit", () => {
  for (const [tool, path, id] of cases) {
    it(`flags ${tool} on ${path} → ${id}`, () => {
      const f = sensitivePathEdit.check({
        event: writeEvent(tool, path),
        sessionPath: meta.path,
        sessionMeta: meta,
      });
      assert.ok(
        f.some((x) => x.ruleId.endsWith(id)),
        `expected rule id ending in "${id}", got: ${f.map((x) => x.ruleId).join(", ") || "(none)"}`,
      );
    });
  }

  it("does not flag ordinary source files", () => {
    assert.deepEqual(
      sensitivePathEdit.check({
        event: writeEvent("Write", "/home/u/work/src/main.ts"),
        sessionPath: meta.path,
        sessionMeta: meta,
      }),
      [],
    );
  });

  it("does not flag non-write tools", () => {
    const ev: RawEvent = {
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          { type: "tool_use", id: "t1", name: "Read", input: { file_path: "/home/u/.ssh/id_rsa" } },
        ],
      },
    };
    assert.deepEqual(
      sensitivePathEdit.check({ event: ev, sessionPath: meta.path, sessionMeta: meta }),
      [],
    );
  });
});
