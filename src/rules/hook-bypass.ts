import { getToolUses, getUserPrompt } from "../extract.js";
import { isInterpreterEval } from "../shell.js";
import { matchingLine } from "../snippet.js";
import type { Finding, Rule, RuleContext } from "../types.js";

const BYPASS_FLAGS = /--no-verify\b|--no-gpg-sign\b|-c\s+commit\.gpgsign=false\b|SKIP=[^\s]+/;

export const hookBypass: Rule = {
  id: "git.hook-bypass",
  title: "Pre-commit hook or signature bypass",
  severity: "medium",
  description:
    "Git operations that skip pre-commit hooks or signature verification. Often a symptom of an agent 'making the obstacle go away' rather than fixing the underlying lint/test failure.",
  check(ctx: RuleContext): Finding[] {
    const out: Finding[] = [];

    const uses = getToolUses(ctx.event);
    for (const use of uses) {
      if (use.name !== "Bash") continue;
      const cmd = typeof use.input?.command === "string" ? (use.input.command as string) : "";
      if (!cmd) continue;
      if (isInterpreterEval(cmd)) continue;
      if (BYPASS_FLAGS.test(cmd)) {
        out.push({
          ruleId: this.id,
          severity: this.severity,
          title: "Agent bypassed a git hook or signature",
          message: `Agent ran a git command that disables pre-commit/pre-push hooks or commit signing. Check that the skipped check wasn't masking a real failure.`,
          sessionPath: ctx.sessionPath,
          sessionId: ctx.sessionMeta.sessionId,
          eventUuid: typeof ctx.event.uuid === "string" ? ctx.event.uuid : undefined,
          timestamp: ctx.event.timestamp,
          excerpt: matchingLine(cmd, BYPASS_FLAGS),
          evidence: { toolUseId: use.id },
        });
      }
    }

    // Also catch the user explicitly asking for it — that's a signal to log,
    // not block, but worth surfacing in the weekly report.
    const prompt = getUserPrompt(ctx.event);
    if (prompt && /--no-verify|skip (?:the )?(?:pre-?commit|hook|ci)/i.test(prompt)) {
      out.push({
        ruleId: `${this.id}.user-requested`,
        severity: "info",
        title: "User asked the agent to skip hooks",
        message: `The user prompt explicitly requested bypassing git hooks / CI. Recorded for audit trail.`,
        sessionPath: ctx.sessionPath,
        sessionId: ctx.sessionMeta.sessionId,
        eventUuid: typeof ctx.event.uuid === "string" ? ctx.event.uuid : undefined,
        timestamp: ctx.event.timestamp,
        excerpt: prompt.split("\n")[0]?.slice(0, 240),
      });
    }

    return out;
  },
};
