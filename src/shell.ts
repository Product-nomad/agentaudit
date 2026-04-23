/**
 * Heuristics for classifying shell command strings.
 *
 * We're not trying to be a full shell parser — we just want to cheaply
 * identify common cases where a matched pattern is *data inside an
 * interpreter invocation* rather than an executed shell command. That
 * distinction matters for rules that flag dangerous flags / commands:
 * `node -e 'const re = /--no-verify/'` contains the string but executes
 * nothing of the kind.
 */

/**
 * True if the command invokes an interpreter in -e / -c / --eval form,
 * where everything past the flag is the script body (data to us).
 */
export function isInterpreterEval(cmd: string): boolean {
  // Strip leading env assignments (FOO=bar BAZ=qux node -e ...).
  const stripped = cmd.replace(/^(?:\s*[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*/, "");
  return /^(?:sudo\s+(?:-[A-Za-z]+\s+)*)?(?:node|deno|bun|python3?|ruby|perl|php)\s+(?:[A-Za-z0-9._/-]+\s+)*-(?:e|c|C|-eval|-command)\b/.test(
    stripped,
  );
}
