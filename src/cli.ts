#!/usr/bin/env node
import { scanPaths } from "./engine.js";
import { discoverSessions } from "./parser.js";
import { renderJson, renderText } from "./report.js";
import { DEFAULT_RULES } from "./rules/index.js";
import type { Severity } from "./types.js";

interface ParsedArgs {
  command: string;
  paths: string[];
  json: boolean;
  noColor: boolean;
  minSeverity: Severity;
  groupBy: "session" | "rule";
  help: boolean;
  version: boolean;
}

const USAGE = `agentaudit — security audit for local AI coding agent sessions

Usage:
  agentaudit audit [paths...]   scan session transcripts for findings
  agentaudit rules              list available rules
  agentaudit --help             show this help

Options (for audit):
  --json                        emit machine-readable JSON
  --no-color                    disable ANSI colour in text output
  --min <severity>              info|low|medium|high|critical (default: info)
  --group-by <session|rule>     grouping for text output (default: session)

If no paths are given, scans ~/.claude/projects/**/*.jsonl.
`;

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {
    command: "",
    paths: [],
    json: false,
    noColor: false,
    minSeverity: "info",
    groupBy: "session",
    help: false,
    version: false,
  };

  const rest = argv.slice(2);
  if (!rest.length) {
    out.help = true;
    return out;
  }

  const first = rest[0];
  if (first.startsWith("-")) {
    // Allow `agentaudit --help` with no command.
    out.command = "audit";
  } else {
    out.command = first;
    rest.shift();
  }

  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    switch (a) {
      case "--help":
      case "-h":
        out.help = true;
        break;
      case "--version":
      case "-v":
        out.version = true;
        break;
      case "--json":
        out.json = true;
        break;
      case "--no-color":
        out.noColor = true;
        break;
      case "--min": {
        const v = rest[++i];
        if (!v) throw new Error("--min requires a value");
        if (!["info", "low", "medium", "high", "critical"].includes(v)) {
          throw new Error(`invalid --min: ${v}`);
        }
        out.minSeverity = v as Severity;
        break;
      }
      case "--group-by": {
        const v = rest[++i];
        if (v !== "session" && v !== "rule") {
          throw new Error("--group-by must be 'session' or 'rule'");
        }
        out.groupBy = v;
        break;
      }
      default:
        if (a.startsWith("-")) throw new Error(`unknown option: ${a}`);
        out.paths.push(a);
    }
  }

  return out;
}

async function runAudit(args: ParsedArgs): Promise<number> {
  const paths = args.paths.length ? args.paths : await discoverSessions();

  if (!paths.length) {
    process.stderr.write(
      "No session files found. Pass paths explicitly or ensure ~/.claude/projects exists.\n",
    );
    return 2;
  }

  const result = await scanPaths(paths, { rules: DEFAULT_RULES });

  if (args.json) {
    process.stdout.write(`${renderJson(result)}\n`);
  } else {
    process.stdout.write(
      `${renderText(result, {
        color: !args.noColor && (process.stdout.isTTY ?? false),
        minSeverity: args.minSeverity,
        groupBy: args.groupBy,
      })}\n`,
    );
  }

  // Exit code mirrors highest severity found — useful for CI / hooks.
  const severities = new Set(result.findings.map((f) => f.severity));
  if (severities.has("critical")) return 30;
  if (severities.has("high")) return 20;
  if (severities.has("medium")) return 10;
  return 0;
}

function listRules(): number {
  const w = process.stdout;
  for (const r of DEFAULT_RULES) {
    w.write(`${r.id}  [${r.severity}]\n  ${r.title}\n  ${r.description}\n\n`);
  }
  return 0;
}

async function main(): Promise<void> {
  let args: ParsedArgs;
  try {
    args = parseArgs(process.argv);
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n\n${USAGE}`);
    process.exit(64);
  }

  if (args.help) {
    process.stdout.write(USAGE);
    process.exit(0);
  }
  if (args.version) {
    // Kept simple — avoids needing to read package.json at runtime.
    process.stdout.write("agentaudit 0.1.0\n");
    process.exit(0);
  }

  let code = 0;
  switch (args.command) {
    case "audit":
      code = await runAudit(args);
      break;
    case "rules":
      code = listRules();
      break;
    default:
      process.stderr.write(`unknown command: ${args.command}\n\n${USAGE}`);
      code = 64;
  }
  process.exit(code);
}

main().catch((err) => {
  process.stderr.write(
    `agentaudit: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
  );
  process.exit(1);
});
