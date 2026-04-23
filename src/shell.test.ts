import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { isInterpreterEval } from "./shell.js";

describe("isInterpreterEval", () => {
  for (const cmd of [
    "node -e 'const x = 1'",
    "python -c 'import os'",
    'python3 -c "print(1)"',
    "ruby -e 'puts 1'",
    "perl -e '1'",
    "deno -e '1'",
    "bun -e '1'",
    "DEBUG=1 node -e 'x'",
    "sudo node -e 'x'",
    "node --experimental-modules -e 'x'",
  ]) {
    it(`detects: ${cmd}`, () => {
      assert.equal(isInterpreterEval(cmd), true);
    });
  }

  for (const cmd of [
    "node script.js",
    "python main.py",
    "ls -la",
    "git commit --no-verify",
    "npm test",
    "echo -e 'x'",
  ]) {
    it(`does NOT flag: ${cmd}`, () => {
      assert.equal(isInterpreterEval(cmd), false);
    });
  }
});
