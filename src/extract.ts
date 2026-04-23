import type {
  ContentBlock,
  RawEvent,
  TextBlock,
  ThinkingBlock,
  ToolResultBlock,
  ToolUseBlock,
} from "./types.js";

function contentArray(content: unknown): ContentBlock[] {
  return Array.isArray(content) ? (content as ContentBlock[]) : [];
}

export function getToolUses(event: RawEvent): ToolUseBlock[] {
  if (event.type !== "assistant" || !event.message) return [];
  return contentArray(event.message.content).filter(
    (b): b is ToolUseBlock => b.type === "tool_use",
  );
}

export function getToolResults(event: RawEvent): ToolResultBlock[] {
  if (event.type !== "user" || !event.message) return [];
  return contentArray(event.message.content).filter(
    (b): b is ToolResultBlock => b.type === "tool_result",
  );
}

export function getAssistantText(event: RawEvent): string {
  if (event.type !== "assistant" || !event.message) return "";
  return contentArray(event.message.content)
    .filter((b): b is TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

export function getAssistantThinking(event: RawEvent): string {
  if (event.type !== "assistant" || !event.message) return "";
  return contentArray(event.message.content)
    .filter((b): b is ThinkingBlock => b.type === "thinking")
    .map((b) => b.thinking)
    .join("\n");
}

/**
 * Plain user prompt text. Returns "" for tool_result-bearing user events
 * (those are agent-produced, not human-produced input).
 */
export function getUserPrompt(event: RawEvent): string {
  if (event.type !== "user" || !event.message) return "";
  const content = event.message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const hasToolResult = content.some((b) => b?.type === "tool_result");
    if (hasToolResult) return "";
    return content
      .filter((b): b is TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  }
  return "";
}

export function toolResultText(block: ToolResultBlock): string {
  if (typeof block.content === "string") return block.content;
  if (Array.isArray(block.content)) {
    return block.content
      .map((b) => {
        if (b.type === "text" && typeof (b as TextBlock).text === "string") {
          return (b as TextBlock).text;
        }
        return "";
      })
      .join("\n");
  }
  return "";
}
