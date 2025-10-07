// @jest-environment node
import { describe, it, expect, jest } from '@jest/globals';
import { generatePlaywrightTest } from '../../../src/agents/test-writer/mistralGenerator';

// Mock the @mistralai/mistralai client module dynamically
jest.mock('@mistralai/mistralai', () => {
  return {
    MistralClient: class {
      apiKey: string;
      constructor(key: string) { this.apiKey = key; }
      async chat(_: any) {
        return {
          choices: [ { message: { content: "import { test, expect } from '@playwright/test';\n\ntest('AI generated', async ({ page }) => { await page.goto(process.env.E2E_BASE_URL || 'http://localhost:3000'); await expect(page).toHaveTitle(/.*/); });" }, finish_reason: 'stop' } ],
          usage: { prompt_tokens: 10, completion_tokens: 25 }
        };
      }
    }
  };
});

describe('mistralGenerator', () => {
  const baseCfg: any = {
  mistral: { apiKey: 'test-key', model: 'mistral-large-2411', maxTokens: 500, temperature: 0.2, topP: 0.9 },
    testGeneration: { maxRetries: 1, timeoutMs: 10000, enableOptimization: true, enableValidation: true, defaultBrowser: 'chromium', defaultViewport: { width: 1280, height: 720 } },
    templates: { defaultTemplate: 'playwright-pom', customTemplates: {} }
  };

  it('returns AI provider when API key + model present', async () => {
    const result = await generatePlaywrightTest({ repo: 'demo', branch: 'main' }, baseCfg);
    expect(result.provider).toBe('mistral');
    expect(result.content).toContain("import { test, expect } from '@playwright/test'");
  });

  it('falls back when API key missing', async () => {
    const cfg = { ...baseCfg, mistral: { ...baseCfg.mistral, apiKey: '' } };
    const result = await generatePlaywrightTest({ repo: 'demo' }, cfg);
    expect(result.provider).toBe('fallback');
    expect(result.content).toContain('Generated Playwright Test');
  });
});
