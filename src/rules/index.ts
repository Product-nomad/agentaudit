import type { Rule } from "../types.js";
import { hookBypass } from "./hook-bypass.js";
import { riskyBash } from "./risky-bash.js";
import { secretsInPrompt } from "./secrets-in-prompt.js";
import { secretsInToolResult } from "./secrets-in-tool-result.js";
import { sensitivePathEdit } from "./sensitive-path-edit.js";

export const DEFAULT_RULES: Rule[] = [
  secretsInPrompt,
  secretsInToolResult,
  riskyBash,
  sensitivePathEdit,
  hookBypass,
];

export { hookBypass, riskyBash, secretsInPrompt, secretsInToolResult, sensitivePathEdit };
