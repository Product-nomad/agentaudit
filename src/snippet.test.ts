import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { matchingLine, truncate } from "./snippet.js";

describe("matchingLine", () => {
  it("returns the line containing the match, trimmed", () => {
    const cmd = "echo start\n  git commit --no-verify\necho end";
    assert.equal(matchingLine(cmd, /--no-verify/), "git commit --no-verify");
  });

  it("returns first line if no match (graceful)", () => {
    assert.equal(matchingLine("foo\nbar", /notthere/), "foo");
  });

  it("truncates long lines with an ellipsis", () => {
    const long = "x".repeat(500);
    const out = matchingLine(`${long}`, /x/, 50);
    assert.equal(out.length, 50);
    assert.ok(out.endsWith("…"));
  });
});

describe("truncate", () => {
  it("passes through when under limit", () => {
    assert.equal(truncate("hi", 10), "hi");
  });

  it("truncates with ellipsis at exact limit", () => {
    assert.equal(truncate("abcdef", 4), "abc…");
  });
});
