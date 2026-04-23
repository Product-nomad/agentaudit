import { strict as assert } from "node:assert";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { compileTagger, loadTagConfig, noopTagger } from "./tagger.js";

let dir: string;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "agentaudit-tag-"));
});
after(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("compileTagger", () => {
  it("matches a literal prefix on cwd", () => {
    const tag = compileTagger({
      clients: [{ pattern: "/home/u/clients/acme", name: "acme" }],
    });
    assert.equal(tag({ cwd: "/home/u/clients/acme/web", path: "/x" }), "acme");
    assert.equal(tag({ cwd: "/home/u/other/thing", path: "/x" }), undefined);
  });

  it("matches a regex pattern when wrapped in slashes", () => {
    const tag = compileTagger({
      clients: [{ pattern: "/clients/([a-z]+)/", name: "$1" }],
    });
    assert.equal(tag({ cwd: "/work/clients/acme/web", path: "/x" }), "$1");
  });

  it("stops at the first match (rule order matters)", () => {
    const tag = compileTagger({
      clients: [
        { pattern: "/home/u/clients", name: "general" },
        { pattern: "/home/u/clients/acme", name: "acme" },
      ],
    });
    assert.equal(tag({ cwd: "/home/u/clients/acme/x", path: "/x" }), "general");
  });

  it("returns undefined when cwd is missing", () => {
    const tag = compileTagger({
      clients: [{ pattern: "/home", name: "x" }],
    });
    assert.equal(tag({ path: "/x" }), undefined);
  });

  it("rejects invalid regex with a useful error", () => {
    assert.throws(
      () => compileTagger({ clients: [{ pattern: "/[unclosed/", name: "x" }] }),
      /tagger|regex/i,
    );
  });
});

describe("noopTagger", () => {
  it("returns undefined for everything", () => {
    assert.equal(noopTagger({ cwd: "/anywhere", path: "/x" }), undefined);
  });
});

describe("loadTagConfig", () => {
  it("loads a valid JSON config from disk", async () => {
    const p = join(dir, "clients.json");
    await writeFile(
      p,
      JSON.stringify({
        clients: [{ pattern: "/work/alpha", name: "alpha" }],
      }),
    );
    const cfg = await loadTagConfig(p);
    assert.equal(cfg?.clients?.[0].name, "alpha");
  });

  it("returns undefined when the file does not exist", async () => {
    const cfg = await loadTagConfig(join(dir, "nope.json"));
    assert.equal(cfg, undefined);
  });

  it("throws with a useful message on invalid JSON", async () => {
    const p = join(dir, "broken.json");
    await writeFile(p, "{not json");
    await assert.rejects(loadTagConfig(p), /tag config|json|parse/i);
  });

  it("throws when the schema is wrong (clients not an array)", async () => {
    const p = join(dir, "wrongshape.json");
    await writeFile(p, JSON.stringify({ clients: "not-an-array" }));
    await assert.rejects(loadTagConfig(p), /clients/i);
  });
});
