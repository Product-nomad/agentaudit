import { getToolUses } from "../extract.js";
import type { Finding, Rule, RuleContext, Severity } from "../types.js";

interface SensitivePath {
  id: string;
  label: string;
  severity: Severity;
  pattern: RegExp;
}

/**
 * File paths that should rarely be written by an AI agent without explicit
 * user direction. Match on the resolved path substring.
 */
const SENSITIVE: SensitivePath[] = [
  {
    id: "ssh-dir",
    label: "~/.ssh directory",
    severity: "critical",
    pattern: /(?:^|\/)\.ssh(?:\/|$)/,
  },
  {
    id: "gnupg",
    label: "~/.gnupg directory",
    severity: "critical",
    pattern: /(?:^|\/)\.gnupg(?:\/|$)/,
  },
  {
    id: "aws-creds",
    label: "~/.aws/credentials",
    severity: "critical",
    pattern: /(?:^|\/)\.aws\/credentials\b/,
  },
  { id: "aws-dir", label: "~/.aws directory", severity: "high", pattern: /(?:^|\/)\.aws(?:\/|$)/ },
  { id: "kube-config", label: "kubeconfig", severity: "high", pattern: /(?:^|\/)\.kube\/config\b/ },
  { id: "netrc", label: "~/.netrc", severity: "high", pattern: /(?:^|\/)\.netrc\b/ },
  { id: "pgpass", label: "~/.pgpass", severity: "high", pattern: /(?:^|\/)\.pgpass\b/ },
  {
    id: "docker-config",
    label: "~/.docker/config.json",
    severity: "medium",
    pattern: /(?:^|\/)\.docker\/config\.json\b/,
  },
  {
    id: "dotenv",
    label: ".env file",
    severity: "high",
    pattern: /(?:^|\/)\.env(?:\.[a-zA-Z0-9_-]+)?$/,
  },
  {
    id: "shell-rc",
    label: "shell rc file (.bashrc / .zshrc / .profile)",
    severity: "medium",
    pattern: /(?:^|\/)\.(?:bashrc|zshrc|profile|bash_profile|zprofile|zshenv)$/,
  },
  {
    id: "authorized-keys",
    label: "SSH authorized_keys",
    severity: "critical",
    pattern: /(?:^|\/)authorized_keys\b/,
  },
  {
    id: "sudoers",
    label: "/etc/sudoers",
    severity: "critical",
    pattern: /^\/etc\/sudoers(?:\.d\/|$)/,
  },
  { id: "shadow", label: "/etc/shadow", severity: "critical", pattern: /^\/etc\/shadow\b/ },
  { id: "systemd-unit", label: "systemd unit", severity: "medium", pattern: /^\/etc\/systemd\// },
  {
    id: "cron",
    label: "cron definition",
    severity: "medium",
    pattern: /^\/etc\/cron(?:\.d\/|tab\b)/,
  },
];

const WRITE_TOOLS = new Set(["Write", "Edit", "NotebookEdit"]);

function pathArg(_toolName: string, input: Record<string, unknown>): string | undefined {
  const candidates = ["file_path", "notebook_path", "path"];
  for (const k of candidates) {
    const v = input[k];
    if (typeof v === "string") return v;
  }
  return undefined;
}

export const sensitivePathEdit: Rule = {
  id: "fs.sensitive-path-write",
  title: "Write or edit on a sensitive host path",
  severity: "high",
  description:
    "Flags Write/Edit operations targeting credential stores, shell rc files, system configuration, and other paths whose modification has outsized impact.",
  check(ctx: RuleContext): Finding[] {
    const uses = getToolUses(ctx.event);
    if (!uses.length) return [];
    const out: Finding[] = [];
    for (const use of uses) {
      if (!WRITE_TOOLS.has(use.name)) continue;
      const path = pathArg(use.name, use.input ?? {});
      if (!path) continue;
      for (const sp of SENSITIVE) {
        if (sp.pattern.test(path)) {
          out.push({
            ruleId: `${this.id}.${sp.id}`,
            severity: sp.severity,
            title: `${use.name} on ${sp.label}`,
            message: `Agent used ${use.name} to modify ${path}. This target is a known sensitive path (${sp.label}) — confirm the change was intended and the file is not now leaking secrets or weakening access controls.`,
            sessionPath: ctx.sessionPath,
            sessionId: ctx.sessionMeta.sessionId,
            eventUuid: typeof ctx.event.uuid === "string" ? ctx.event.uuid : undefined,
            timestamp: ctx.event.timestamp,
            excerpt: path,
            evidence: { tool: use.name, path, sensitiveId: sp.id, toolUseId: use.id },
          });
          break;
        }
      }
    }
    return out;
  },
};
