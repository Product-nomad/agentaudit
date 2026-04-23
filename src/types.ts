export type Severity = "info" | "low" | "medium" | "high" | "critical";

export interface ContentBlock {
  type: string;
  [key: string]: unknown;
}

export interface TextBlock extends ContentBlock {
  type: "text";
  text: string;
}

export interface ThinkingBlock extends ContentBlock {
  type: "thinking";
  thinking: string;
}

export interface ToolUseBlock extends ContentBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock extends ContentBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string | ContentBlock[];
  is_error?: boolean;
}

export interface Usage {
  input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  output_tokens?: number;
  server_tool_use?: Record<string, number>;
}

export interface RawEvent {
  type: string;
  uuid?: string;
  parentUuid?: string | null;
  timestamp?: string;
  sessionId?: string;
  isSidechain?: boolean;
  cwd?: string;
  gitBranch?: string;
  version?: string;
  subtype?: string;
  message?: {
    role?: "user" | "assistant";
    model?: string;
    content?: string | ContentBlock[];
    usage?: Usage;
  };
  [key: string]: unknown;
}

export interface SessionMeta {
  path: string;
  sessionId: string;
  cwd?: string;
  gitBranch?: string;
  version?: string;
  firstTimestamp?: string;
  lastTimestamp?: string;
  eventCount: number;
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  title: string;
  message: string;
  sessionPath: string;
  sessionId?: string;
  eventUuid?: string;
  timestamp?: string;
  excerpt?: string;
  evidence?: Record<string, unknown>;
}

export interface RuleContext {
  event: RawEvent;
  sessionPath: string;
  sessionMeta: SessionMeta;
}

export interface Rule {
  id: string;
  title: string;
  severity: Severity;
  description: string;
  check(ctx: RuleContext): Finding[];
}
