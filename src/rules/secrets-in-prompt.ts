import { getUserPrompt } from "../extract.js";
import type { Finding, Rule, RuleContext } from "../types.js";
import { scanForSecrets } from "./patterns.js";

export const secretsInPrompt: Rule = {
  id: "secrets.in-user-prompt",
  title: "Secret-like value pasted in user prompt",
  severity: "critical",
  description:
    "Human-typed prompts shouldn't contain credentials. Anything entered here is sent to the model provider and stored on disk in session transcripts.",
  check(ctx: RuleContext): Finding[] {
    const text = getUserPrompt(ctx.event);
    if (!text) return [];
    const hits = scanForSecrets(text);
    if (!hits.length) return [];
    return hits.map((hit) => ({
      ruleId: `${this.id}.${hit.patternId}`,
      severity: this.severity,
      title: `Possible ${hit.label} in user prompt`,
      message: `The prompt at ${ctx.event.timestamp ?? "unknown time"} contains a string that matches ${hit.label}. If real, rotate it: it was sent to the model provider and is stored locally in plaintext.`,
      sessionPath: ctx.sessionPath,
      sessionId: ctx.sessionMeta.sessionId,
      eventUuid: typeof ctx.event.uuid === "string" ? ctx.event.uuid : undefined,
      timestamp: ctx.event.timestamp,
      excerpt: hit.preview,
      evidence: { patternId: hit.patternId, index: hit.index },
    }));
  },
};
