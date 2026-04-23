import type { Dirent } from "node:fs";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type { RawEvent, SessionMeta } from "./types.js";

export interface ParsedSession {
  meta: SessionMeta;
  events: RawEvent[];
}

export async function* streamEvents(path: string): AsyncGenerator<RawEvent> {
  const rl = createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      yield JSON.parse(line) as RawEvent;
    } catch {
      // skip malformed lines rather than abort the whole session
    }
  }
}

export async function parseSession(path: string): Promise<ParsedSession> {
  const events: RawEvent[] = [];
  let sessionId = "";
  let cwd: string | undefined;
  let gitBranch: string | undefined;
  let version: string | undefined;
  let firstTimestamp: string | undefined;
  let lastTimestamp: string | undefined;

  for await (const ev of streamEvents(path)) {
    events.push(ev);
    if (!sessionId && typeof ev.sessionId === "string") sessionId = ev.sessionId;
    if (!cwd && typeof ev.cwd === "string") cwd = ev.cwd;
    if (!gitBranch && typeof ev.gitBranch === "string") gitBranch = ev.gitBranch;
    if (!version && typeof ev.version === "string") version = ev.version;
    if (typeof ev.timestamp === "string") {
      if (!firstTimestamp) firstTimestamp = ev.timestamp;
      lastTimestamp = ev.timestamp;
    }
  }

  return {
    meta: {
      path,
      sessionId: sessionId || inferSessionIdFromPath(path),
      cwd,
      gitBranch,
      version,
      firstTimestamp,
      lastTimestamp,
      eventCount: events.length,
    },
    events,
  };
}

function inferSessionIdFromPath(path: string): string {
  const base = path.split("/").pop() ?? "";
  return base.replace(/\.jsonl$/, "");
}

export function defaultClaudeProjectsDir(): string {
  return join(homedir(), ".claude", "projects");
}

export async function discoverSessions(root = defaultClaudeProjectsDir()): Promise<string[]> {
  const found: string[] = [];
  async function walk(dir: string) {
    let entries: Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        found.push(full);
      }
    }
  }
  try {
    await stat(root);
  } catch {
    return [];
  }
  await walk(root);
  return found.sort();
}
