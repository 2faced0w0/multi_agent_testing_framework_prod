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
  // Leading fence with optional language (allow immediate newline or end)
  out = out.replace(/^```(?:[a-zA-Z0-9_-]+)?\n?/, '');
  // Trailing fence (even if not preceded by newline once content trimmed)
  out = out.replace(/\n?```\s*$/i, '\n');
  // If model wrapped everything inside fences but left extra newline at end
  return out.trimEnd() + '\n';
}

/** Quick detection if a string appears fenced */
export function hasCodeFences(input: string): boolean {
  return /```/.test(input);
}

/** Strip common HTML comment wrappers that sometimes contain leftover markdown scaffolding */
export function stripHtmlCommentScaffolding(input: string): string {
  if (!input) return input;
  // Remove any HTML comment blocks that appear on lines by themselves (common model scaffolding)
  return input.replace(/(^|\n)<!--+[\s\S]*?--+>(?=\n|$)/g, (m, p1) => p1 === '\n' ? '\n' : '');
}

/** Comprehensive sanitizer for generated test content */
export function sanitizeGeneratedTest(raw: string): string {
  const debug = process.env.TEST_SANITIZE_LOG === 'true';
  const original = raw;
  let out = stripHtmlCommentScaffolding(raw);
  out = stripCodeFences(out);
  // Collapse any duplicate blank lines introduced by stripping
  out = out.replace(/\n{3,}/g, '\n\n');
  out = out.trimStart();
  if (debug && original !== out) {
    try {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ level: 'DEBUG', stage: 'sanitizeGeneratedTest', changed: true, beforeFirst80: original.slice(0,80), afterFirst80: out.slice(0,80) }));
    } catch {}
  }
  return out;
}
