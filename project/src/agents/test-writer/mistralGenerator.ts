import type { TestWriterAgentConfig } from './TestWriterAgent';
import { aiPromptTokensTotal, aiCompletionTokensTotal, aiRequestsTotal } from '@monitoring/promMetrics';

export interface GeneratedTestResult {
  title: string;
  content: string;
  model?: string;
  finishReason?: string;
  usage?: Record<string, unknown>;
  provider: 'mistral' | 'fallback';
  error?: string;
}

/**
 * High-level abstraction to produce a Playwright test using Mistral.
 * Falls back to deterministic placeholder content when:
 *  - No API key is provided
 *  - Model missing
 *  - Any request/SDK error occurs
 */
export async function generatePlaywrightTest(
  metadata: { repo?: string; branch?: string; headCommit?: string; compareUrl?: string; changedFiles?: string[] },
  cfg: TestWriterAgentConfig
): Promise<GeneratedTestResult> {
  const baseTitle = `Auto smoke: ${metadata.repo || 'repo'} ${metadata.branch || ''}`.trim();
  const apiKey = cfg.mistral?.apiKey;
  const model = cfg.mistral?.model;

  if (!apiKey || !model) {
    try { aiRequestsTotal.inc({ provider: 'fallback', model: model || 'unset', status: 'missing-config' }); } catch {}
    return { ...buildFallback(baseTitle, metadata), provider: 'fallback', error: 'missing_api_key_or_model' };
  }

  // Dynamic import so tests can mock and environments without the package still work.
  let MistralClient: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    MistralClient = require('@mistralai/mistralai').MistralClient;
  } catch (e) {
    try { aiRequestsTotal.inc({ provider: 'fallback', model, status: 'sdk-missing' }); } catch {}
    return { ...buildFallback(baseTitle, metadata), provider: 'fallback', error: 'sdk_not_available' };
  }

  const systemPrompt = `You are an assistant that generates concise, robust Playwright tests. 
Return ONLY the TypeScript test code. Use test.describe when appropriate, avoid extraneous commentary.`;

  const userPrompt = buildUserPrompt(baseTitle, metadata);

  try {
    const client = new MistralClient(apiKey);
    // The exact SDK API may differ; we attempt a generic chat completion shape.
    const response = await client.chat({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: cfg.mistral?.temperature ?? 0.3,
      top_p: cfg.mistral?.topP ?? 0.95,
      max_tokens: cfg.mistral?.maxTokens ?? 1500
    });

    const raw = extractContent(response);
    const usage = response?.usage || {};
    try {
      const prompt = Number((usage.prompt_tokens as any) || usage.promptTokens || usage.input_tokens || 0);
      const completion = Number((usage.completion_tokens as any) || usage.completionTokens || usage.output_tokens || 0);
      if (prompt) aiPromptTokensTotal.inc({ provider: 'mistral', model }, prompt);
      if (completion) aiCompletionTokensTotal.inc({ provider: 'mistral', model }, completion);
    } catch {}
    if (!raw) {
      try { aiRequestsTotal.inc({ provider: 'mistral', model, status: 'empty' }); } catch {}
      return { ...buildFallback(baseTitle, metadata), provider: 'fallback', error: 'empty_model_response' };
    }

    const wrapped = ensureTestWrapper(raw, baseTitle, metadata);
    try { aiRequestsTotal.inc({ provider: 'mistral', model, status: 'ok' }); } catch {}
    return {
      title: baseTitle,
      content: wrapped,
      model,
      finishReason: response?.choices?.[0]?.finish_reason,
      usage: usage,
      provider: 'mistral'
    };
  } catch (err: any) {
    try { aiRequestsTotal.inc({ provider: 'mistral', model, status: 'error' }); } catch {}
    return { ...buildFallback(baseTitle, metadata), provider: 'fallback', error: err?.message || 'generation_error' };
  }
}

function buildUserPrompt(title: string, meta: Record<string, any>): string {
  const changed = (meta.changedFiles || []).slice(0, 10).join('\n');
  return `Generate a Playwright test for the application under test.
Title: ${title}
Repo: ${meta.repo || ''}
Branch: ${meta.branch || ''}
HeadCommit: ${meta.headCommit || ''}
CompareUrl: ${meta.compareUrl || ''}
ChangedFiles (top):\n${changed}
Requirements:
 - Use TypeScript.
 - Use @playwright/test.
 - Include at least one assertion that is resilient (e.g., locator expectations).
 - Avoid hard-coding environment-specific host; read base URL from process.env.E2E_BASE_URL or fall back to 'http://localhost:3000'.
 - Keep under 120 lines.
 - No additional explanation, only code.`;
}

function extractContent(resp: any): string | undefined {
  // Try common shapes
  if (!resp) return undefined;
  if (Array.isArray(resp.choices)) {
    const c = resp.choices[0];
    if (c?.message?.content) return c.message.content as string;
    if (c?.content) return c.content as string;
  }
  return undefined;
}

function ensureTestWrapper(raw: string, title: string, meta: Record<string, any>): string {
  // If the model already returned an import statement & test() call, keep it.
  const hasImport = /from\s+'@playwright\/test'/.test(raw) || /@playwright\/test"/.test(raw);
  const hasTest = /\btest\(/.test(raw);
  if (hasImport && hasTest) {
    return addHeader(raw, title, meta, 'mistral');
  }
  const body = raw.replace(/^```[a-zA-Z]*|```$/g, '');
  return addHeader(`import { test, expect } from '@playwright/test';\n\n${body}\n`, title, meta, 'mistral');
}

function buildFallback(title: string, payload: any): Omit<GeneratedTestResult, 'provider'> {
  const meta = {
    repo: payload.repo || '',
    branch: payload.branch || '',
    headCommit: payload.headCommit || '',
    generatedAt: new Date().toISOString()
  };
  const content = addHeader(`import { test, expect } from '@playwright/test';\n\n` +
    `test('${escapeQuotes(title)}', async ({ page }) => {\n` +
    `  const base = process.env.E2E_BASE_URL || 'http://localhost:3000';\n` +
    `  await page.goto(base);\n` +
    `  await expect(page).toHaveTitle(/.*/);\n` +
    `});\n`, title, meta, 'fallback');
  return { title, content };
}

function escapeQuotes(s: string): string { return s.replace(/'/g, "\\'"); }

function addHeader(code: string, title: string, meta: Record<string, any>, source: string): string {
  return `/**\n * Generated Playwright Test (${source})\n * Title: ${title}\n * Metadata: ${JSON.stringify(meta, null, 2)}\n */\n${code}`;
}

export default generatePlaywrightTest;
