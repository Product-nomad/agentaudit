import { getToolResults, toolResultText } from "../extract.js";
import type { Finding, Rule, RuleContext } from "../types.js";
import { scanForSecrets } from "./patterns.js";

export const secretsInToolResult: Rule = {
  id: "secrets.in-tool-result",
  title: "Secret-like value in tool output returned to model",
  severity: "high",
  description:
    "Tool results (file reads, shell output, HTTP responses) are fed back into the model's context. Credentials in this stream are exposed to the provider and persisted in transcripts.",
  check(ctx: RuleContext): Finding[] {
    const results = getToolResults(ctx.event);
    if (!results.length) return [];
    const out: Finding[] = [];
    for (const block of results) {
      const text = toolResultText(block);
      if (!text) continue;
      const hits = scanForSecrets(text);
      for (const hit of hits) {
        out.push({
          ruleId: `${this.id}.${hit.patternId}`,
          severity: this.severity,
          title: `Possible ${hit.label} in tool output`,
          message: `Tool result ${block.tool_use_id} contains a string matching ${hit.label}. Consider rotating and scrubbing the source file (likely a .env, config, or keychain export).`,
          sessionPath: ctx.sessionPath,
          sessionId: ctx.sessionMeta.sessionId,
          eventUuid: typeof ctx.event.uuid === "string" ? ctx.event.uuid : undefined,
          timestamp: ctx.event.timestamp,
          excerpt: hit.preview,
          evidence: {
            patternId: hit.patternId,
            toolUseId: block.tool_use_id,
            index: hit.index,
          },
        });
      }
    }
    return out;
  },
};
