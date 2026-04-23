/**
 * Return the line containing the first regex match, trimmed and truncated.
 * Falls back to the first line if nothing matches (shouldn't happen in
 * normal use since callers only invoke this after a successful test()).
 */
export function matchingLine(text: string, re: RegExp, max = 240): string {
  const idx = text.search(re);
  if (idx < 0) {
    const first = text.split("\n")[0] ?? "";
    return truncate(first.trim(), max);
  }
  const start = text.lastIndexOf("\n", idx) + 1;
  const endNl = text.indexOf("\n", idx);
  const end = endNl === -1 ? text.length : endNl;
  return truncate(text.slice(start, end).trim(), max);
}

export function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}
