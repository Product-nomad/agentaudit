import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { scanForSecrets } from "./patterns.js";

/**
 * ReDoS guard. If one of the credential patterns regresses to
 * catastrophic backtracking, a 10k-char adversarial string will hang.
 * We require the scan to complete under a conservative wall-clock
 * budget on a loaded box.
 */
describe("secret pattern performance", () => {
  it("scans a 10k adversarial string under 100ms", () => {
    const hostile =
      // Prefixes that partially match several patterns, repeated.
      "AKIA" +
      "X".repeat(15) + // almost an AWS key, off by one
      " ".repeat(100) +
      "ghp_" +
      "0".repeat(35) + // almost a PAT, off by one
      " ".repeat(100) +
      "password=" +
      '"' +
      "a".repeat(4) +
      '"' + // below minMatchLen
      " ".repeat(100) +
      "-----BEGIN PRIVATE KEY-";
    const payload = hostile.repeat(50); // ~15k chars

    const start = performance.now();
    scanForSecrets(payload);
    const elapsed = performance.now() - start;
    assert.ok(elapsed < 100, `scan took ${elapsed.toFixed(1)}ms`);
  });
});
