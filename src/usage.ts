import { streamEvents } from "./parser.js";
import { noopTagger, type Tagger } from "./tagger.js";
import type { RawEvent, Usage } from "./types.js";

export interface TokenUsage {
  input: number;
  cacheCreation: number;
  cacheRead: number;
  output: number;
  turns: number;
}

export interface SessionUsage {
  path: string;
  sessionId: string;
  cwd?: string;
  firstTimestamp?: string;
  lastTimestamp?: string;
  eventCount: number;
  total: TokenUsage;
  byModel: Record<string, TokenUsage>;
  /** Client tag applied by the configured tagger, if any. */
  tag?: string;
  readError?: true;
}

export interface ProjectRollup {
  cwd: string;
  sessions: SessionUsage[];
  total: TokenUsage;
  byModel: Record<string, TokenUsage>;
}

export interface ClientRollup {
  tag: string;
  sessions: SessionUsage[];
  total: TokenUsage;
  byModel: Record<string, TokenUsage>;
}

export interface UsageReport {
  sessions: SessionUsage[];
  byProject: ProjectRollup[];
  byClient: ClientRollup[];
  total: TokenUsage;
  byModel: Record<string, TokenUsage>;
  sessionsScanned: number;
  eventsScanned: number;
}

export interface AnalyzeOptions {
  concurrency?: number;
  tagger?: Tagger;
}

const UNKNOWN_CWD = "(unknown)";
const DEFAULT_CONCURRENCY = 8;

function zeroUsage(): TokenUsage {
  return { input: 0, cacheCreation: 0, cacheRead: 0, output: 0, turns: 0 };
}

function addInto(target: TokenUsage, source: Usage | undefined): void {
  if (!source) return;
  target.input += source.input_tokens ?? 0;
  target.cacheCreation += source.cache_creation_input_tokens ?? 0;
  target.cacheRead += source.cache_read_input_tokens ?? 0;
  target.output += source.output_tokens ?? 0;
  target.turns += 1;
}

function addTokens(target: TokenUsage, source: TokenUsage): void {
  target.input += source.input;
  target.cacheCreation += source.cacheCreation;
  target.cacheRead += source.cacheRead;
  target.output += source.output;
  target.turns += source.turns;
}

function ensureModelBucket(map: Record<string, TokenUsage>, model: string): TokenUsage {
  const existing = map[model];
  if (existing) return existing;
  const bucket = zeroUsage();
  map[model] = bucket;
  return bucket;
}

function inferSessionIdFromPath(path: string): string {
  const base = path.split("/").pop() ?? "";
  return base.replace(/\.jsonl$/, "");
}

function enrichMeta(usage: SessionUsage, event: RawEvent): void {
  if (!usage.sessionId && typeof event.sessionId === "string") {
    usage.sessionId = event.sessionId;
  }
  if (!usage.cwd && typeof event.cwd === "string") usage.cwd = event.cwd;
  if (typeof event.timestamp === "string") {
    if (!usage.firstTimestamp) usage.firstTimestamp = event.timestamp;
    usage.lastTimestamp = event.timestamp;
  }
}

/**
 * Stream a session and produce its per-model / total token usage.
 * Memory footprint is independent of session size.
 */
export async function analyzeSession(
  path: string,
  tagger: Tagger = noopTagger,
): Promise<SessionUsage> {
  const usage: SessionUsage = {
    path,
    sessionId: "",
    eventCount: 0,
    total: zeroUsage(),
    byModel: {},
  };

  try {
    for await (const event of streamEvents(path)) {
      usage.eventCount += 1;
      enrichMeta(usage, event);

      if (event.type !== "assistant" || !event.message?.usage) continue;
      const model = typeof event.message.model === "string" ? event.message.model : "(unknown)";
      const bucket = ensureModelBucket(usage.byModel, model);
      addInto(bucket, event.message.usage);
      addInto(usage.total, event.message.usage);
    }
  } catch {
    usage.readError = true;
  }

  if (!usage.sessionId) usage.sessionId = inferSessionIdFromPath(path);
  const tag = tagger({ path: usage.path, cwd: usage.cwd });
  if (tag) usage.tag = tag;
  return usage;
}

/**
 * Group per-session results by cwd (project root). Sessions without a
 * recorded cwd land under the `(unknown)` bucket so they remain visible.
 */
export function rollupByProject(sessions: SessionUsage[]): ProjectRollup[] {
  const byCwd = new Map<string, ProjectRollup>();
  for (const s of sessions) {
    const key = s.cwd ?? UNKNOWN_CWD;
    let entry = byCwd.get(key);
    if (!entry) {
      entry = { cwd: key, sessions: [], total: zeroUsage(), byModel: {} };
      byCwd.set(key, entry);
    }
    entry.sessions.push(s);
    addTokens(entry.total, s.total);
    for (const [model, tokens] of Object.entries(s.byModel)) {
      addTokens(ensureModelBucket(entry.byModel, model), tokens);
    }
  }
  return [...byCwd.values()].sort((a, b) => b.total.output - a.total.output);
}

/**
 * Group sessions by their tag (applied by a Tagger). Sessions with no tag
 * are omitted from the rollup entirely — they remain in sessions/byProject.
 */
export function rollupByClient(sessions: SessionUsage[]): ClientRollup[] {
  const byTag = new Map<string, ClientRollup>();
  for (const s of sessions) {
    if (!s.tag) continue;
    let entry = byTag.get(s.tag);
    if (!entry) {
      entry = { tag: s.tag, sessions: [], total: zeroUsage(), byModel: {} };
      byTag.set(s.tag, entry);
    }
    entry.sessions.push(s);
    addTokens(entry.total, s.total);
    for (const [model, tokens] of Object.entries(s.byModel)) {
      addTokens(ensureModelBucket(entry.byModel, model), tokens);
    }
  }
  return [...byTag.values()].sort((a, b) => b.total.output - a.total.output);
}

export async function analyzePaths(
  paths: string[],
  opts: AnalyzeOptions = {},
): Promise<UsageReport> {
  const concurrency = Math.max(1, opts.concurrency ?? DEFAULT_CONCURRENCY);
  const tagger = opts.tagger ?? noopTagger;
  const sessions: SessionUsage[] = new Array(paths.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= paths.length) return;
      sessions[i] = await analyzeSession(paths[i], tagger);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, paths.length) }, worker));

  const total = zeroUsage();
  const byModel: Record<string, TokenUsage> = {};
  let eventsScanned = 0;
  for (const s of sessions) {
    eventsScanned += s.eventCount;
    addTokens(total, s.total);
    for (const [model, tokens] of Object.entries(s.byModel)) {
      addTokens(ensureModelBucket(byModel, model), tokens);
    }
  }

  return {
    sessions,
    byProject: rollupByProject(sessions),
    byClient: rollupByClient(sessions),
    total,
    byModel,
    sessionsScanned: paths.length,
    eventsScanned,
  };
}
