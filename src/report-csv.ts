import type { UsageReport } from "./usage.js";

/**
 * Escape a single cell for RFC 4180 CSV. Wraps in double quotes and
 * doubles internal quotes only when the value contains `,`, `"`, `\r`,
 * or `\n`. Numbers render without quoting. Undefined → empty string.
 */
export function csvEscape(value: string | number | undefined): string {
  if (value === undefined) return "";
  if (typeof value === "number") return String(value);
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const HEADER = [
  "session_id",
  "path",
  "first_timestamp",
  "last_timestamp",
  "cwd",
  "client",
  "model",
  "input_tokens",
  "cache_creation_tokens",
  "cache_read_tokens",
  "output_tokens",
  "turns",
];

/**
 * Render a usage report as CSV: one row per (session × model) pair.
 * Suited for pivot-table analysis and invoice preparation.
 */
export function renderUsageCsv(report: UsageReport): string {
  const lines: string[] = [HEADER.join(",")];
  for (const session of report.sessions) {
    for (const [model, tokens] of Object.entries(session.byModel)) {
      lines.push(
        [
          csvEscape(session.sessionId),
          csvEscape(session.path),
          csvEscape(session.firstTimestamp),
          csvEscape(session.lastTimestamp),
          csvEscape(session.cwd),
          csvEscape(session.tag),
          csvEscape(model),
          csvEscape(tokens.input),
          csvEscape(tokens.cacheCreation),
          csvEscape(tokens.cacheRead),
          csvEscape(tokens.output),
          csvEscape(tokens.turns),
        ].join(","),
      );
    }
  }
  return `${lines.join("\n")}\n`;
}
