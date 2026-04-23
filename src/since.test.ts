import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { parseSince, sessionInRange } from "./since.js";

describe("parseSince", () => {
  const now = new Date("2026-04-23T12:00:00Z");

  it("parses relative durations with h/d/w suffixes", () => {
    assert.equal(parseSince("24h", now).toISOString(), "2026-04-22T12:00:00.000Z");
    assert.equal(parseSince("7d", now).toISOString(), "2026-04-16T12:00:00.000Z");
    assert.equal(parseSince("2w", now).toISOString(), "2026-04-09T12:00:00.000Z");
    assert.equal(parseSince("30m", now).toISOString(), "2026-04-23T11:30:00.000Z");
  });

  it("parses absolute ISO dates", () => {
    assert.equal(parseSince("2026-04-01", now).toISOString(), "2026-04-01T00:00:00.000Z");
    assert.equal(parseSince("2026-04-01T06:30:00Z", now).toISOString(), "2026-04-01T06:30:00.000Z");
  });

  it("throws on garbage input", () => {
    assert.throws(() => parseSince("not-a-date", now), /since/i);
    assert.throws(() => parseSince("7z", now), /since/i);
    assert.throws(() => parseSince("", now), /since/i);
  });

  it("throws on zero or negative durations", () => {
    assert.throws(() => parseSince("0d", now), /positive/i);
    assert.throws(() => parseSince("-1d", now), /since/i);
  });
});

describe("sessionInRange", () => {
  const cutoff = new Date("2026-04-20T00:00:00Z");

  it("includes sessions whose lastTimestamp is on/after cutoff", () => {
    assert.equal(sessionInRange({ lastTimestamp: "2026-04-21T10:00:00Z" }, cutoff), true);
    assert.equal(sessionInRange({ lastTimestamp: "2026-04-20T00:00:00Z" }, cutoff), true);
  });

  it("excludes sessions whose lastTimestamp is before cutoff", () => {
    assert.equal(sessionInRange({ lastTimestamp: "2026-04-19T23:59:59Z" }, cutoff), false);
  });

  it("falls back to firstTimestamp when lastTimestamp is missing", () => {
    assert.equal(sessionInRange({ firstTimestamp: "2026-04-21T00:00:00Z" }, cutoff), true);
    assert.equal(sessionInRange({ firstTimestamp: "2026-04-19T00:00:00Z" }, cutoff), false);
  });

  it("excludes sessions with no timestamps at all (can't verify)", () => {
    assert.equal(sessionInRange({}, cutoff), false);
  });
});
