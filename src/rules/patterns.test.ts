import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { redact, scanForSecrets } from "./patterns.js";

describe("scanForSecrets", () => {
  it("detects a GitHub classic PAT", () => {
    const hits = scanForSecrets(`token=ghp_${"a".repeat(36)}`);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].patternId, "github-token");
  });

  it("detects AWS access key IDs", () => {
    const hits = scanForSecrets("AKIAIOSFODNN7EXAMPLE fell out");
    assert.equal(hits.length, 1);
    assert.equal(hits[0].patternId, "aws-access-key");
  });

  it("detects SSH/RSA private key headers", () => {
    const hits = scanForSecrets("-----BEGIN OPENSSH PRIVATE KEY-----\nblob");
    assert.ok(hits.some((h) => h.patternId === "ssh-private-key"));
  });

  it("returns empty for benign text", () => {
    assert.deepEqual(scanForSecrets("hello world, the sky is blue"), []);
  });

  it("ignores short password assignments below the value-length floor", () => {
    const hits = scanForSecrets('password="short12"');
    assert.equal(hits.filter((h) => h.patternId === "generic-password-assign").length, 0);
  });

  it("flags long password assignments", () => {
    const hits = scanForSecrets('password="aVeryLongSecret!!"');
    assert.equal(hits.filter((h) => h.patternId === "generic-password-assign").length, 1);
  });
});

describe("redact", () => {
  it("masks short values entirely", () => {
    assert.equal(redact("short"), "*****");
  });

  it("keeps prefix+suffix for longer values", () => {
    const out = redact(`ghp_${"a".repeat(36)}`);
    assert.ok(out.startsWith("ghp_"));
    assert.ok(out.endsWith("aaaa"));
    assert.ok(out.includes("…"));
  });
});
