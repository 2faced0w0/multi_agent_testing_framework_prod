export interface FallbackContext {
  originalSelector?: string;
  element?: Record<string, any>;
}

// Simple ordered fallback strategies; could expand with scoring later
export function generateFallbackSelectors(ctx: FallbackContext): string[] {
  const out: string[] = [];
  const el = ctx.element || {};
  if (el['data-testid']) out.push(`page.getByTestId('${el['data-testid']}')`);
  if (el.role) out.push(`page.getByRole('${el.role}')`);
  if (el.tag) out.push(`page.locator('${el.tag}')`);
  // Generic structural landmarks
  out.push(`page.getByRole('banner')`);
  out.push(`page.getByRole('navigation')`);
  out.push(`page.locator('header')`);
  // Remove duplicates & any identical to original
  const unique = Array.from(new Set(out));
  return unique.filter(s => s !== ctx.originalSelector);
}
