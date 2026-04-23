import type { ScanResult } from "./engine.js";
import type { Finding, Severity } from "./types.js";

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

const ANSI: Record<Severity, string> = {
  critical: "\x1b[1;41;97m",
  high: "\x1b[1;31m",
  medium: "\x1b[1;33m",
  low: "\x1b[1;34m",
  info: "\x1b[1;90m",
};
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";

export interface RenderOptions {
  color?: boolean;
  minSeverity?: Severity;
  groupBy?: "session" | "rule";
}

function severityAtLeast(s: Severity, min: Severity): boolean {
  return SEVERITY_ORDER.indexOf(s) <= SEVERITY_ORDER.indexOf(min);
}

function tag(severity: Severity, color: boolean): string {
  const label = severity.toUpperCase().padEnd(8);
  return color ? `${ANSI[severity]} ${label}${RESET}` : ` ${label}`;
}

function sessionHeader(path: string, color: boolean): string {
  return color ? `${DIM}${path}${RESET}` : path;
}

export function renderText(result: ScanResult, opts: RenderOptions = {}): string {
  const color = opts.color ?? process.stdout.isTTY ?? false;
  const min = opts.minSeverity ?? "info";
  const filtered = result.findings.filter((f) => severityAtLeast(f.severity, min));

  const lines: string[] = [];
  lines.push(
    `Scanned ${result.sessionsScanned} session${result.sessionsScanned === 1 ? "" : "s"} / ${result.eventsScanned} events — ${filtered.length} finding${filtered.length === 1 ? "" : "s"}${min !== "info" ? ` (severity ≥ ${min})` : ""}`,
  );

  const bySeverity = countBySeverity(filtered);
  const summary = SEVERITY_ORDER.filter((s) => bySeverity[s])
    .map((s) => `${s}: ${bySeverity[s]}`)
    .join("  ");
  if (summary) lines.push(summary);
  lines.push("");

  if (!filtered.length) {
    lines.push("No findings. Looks clean.");
    return lines.join("\n");
  }

  const groupBy = opts.groupBy ?? "session";
  if (groupBy === "session") {
    const bySession = new Map<string, Finding[]>();
    for (const f of filtered) {
      const arr = bySession.get(f.sessionPath) ?? [];
      arr.push(f);
      bySession.set(f.sessionPath, arr);
    }
    for (const [path, group] of bySession) {
      lines.push(sessionHeader(path, color));
      group.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
      for (const f of group) lines.push(renderFinding(f, color));
      lines.push("");
    }
  } else {
    const byRule = new Map<string, Finding[]>();
    for (const f of filtered) {
      const arr = byRule.get(f.ruleId) ?? [];
      arr.push(f);
      byRule.set(f.ruleId, arr);
    }
    for (const [rid, group] of byRule) {
      lines.push(`${rid} (${group.length})`);
      for (const f of group) lines.push(renderFinding(f, color));
      lines.push("");
    }
  }

  return lines.join("\n");
}

function renderFinding(f: Finding, color: boolean): string {
  const head = `  ${tag(f.severity, color)}  ${f.title}`;
  const where = f.timestamp ? `    ${DIMmaybe(color)}${f.timestamp}${RESETmaybe(color)}` : "";
  const excerpt = f.excerpt
    ? `    ${DIMmaybe(color)}→${RESETmaybe(color)} ${truncate(f.excerpt, 160)}`
    : "";
  const msg = `    ${f.message}`;
  return [head, where, msg, excerpt].filter(Boolean).join("\n");
}

function DIMmaybe(color: boolean): string {
  return color ? DIM : "";
}
function RESETmaybe(color: boolean): string {
  return color ? RESET : "";
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

function countBySeverity(findings: Finding[]): Record<Severity, number> {
  const r: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) r[f.severity]++;
  return r;
}

export function renderJson(result: ScanResult): string {
  return JSON.stringify(
    {
      sessionsScanned: result.sessionsScanned,
      eventsScanned: result.eventsScanned,
      findingsCount: result.findings.length,
      findings: result.findings,
    },
    null,
    2,
  );
}
