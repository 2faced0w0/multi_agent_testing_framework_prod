/**
 * Utility helpers for TestWriterAgent
 */

/**
 * Strip leading/trailing markdown code fences (``` or ```lang) from AI generated content.
 * Handles common variants: ```typescript, ```ts, plain ``` and trailing matching fence.
 */
export function stripCodeFences(input: string): string {
  if (!input) return input;
  let out = input.trimStart();
  // Leading fence with optional language
  out = out.replace(/^```(?:[a-zA-Z0-9_-]+)?\s+/i, '');
  // Trailing fence: ensure newline or start boundary precedes it
  out = out.replace(/\n```\s*$/i, '\n');
  // If model wrapped everything inside fences but left extra newline at end
  return out.trimEnd() + '\n';
}

/** Quick detection if a string appears fenced */
export function hasCodeFences(input: string): boolean {
  return /```/.test(input);
}
