import type { TestWriterAgentConfig } from './TestWriterAgent';
import { aiPromptTokensTotal, aiCompletionTokensTotal, aiRequestsTotal } from '@monitoring/promMetrics';
import { componentAnalysisService } from '../../services/ComponentAnalysisService';

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
  const mod = require('@mistralai/mistralai');
  MistralClient = mod.MistralClient || mod.default || mod;
  } catch (e) {
    try { aiRequestsTotal.inc({ provider: 'fallback', model, status: 'sdk-missing' }); } catch {}
    return { ...buildFallback(baseTitle, metadata), provider: 'fallback', error: 'sdk_not_available' };
  }

  const systemPrompt = `You are an expert test automation engineer specializing in creating comprehensive, maintainable Playwright tests. 

Key principles:
- Generate tests that focus on user behavior and component functionality
- Use semantic selectors (getByRole, getByLabel, getByTestId) over brittle CSS selectors
- Create tests that are resilient to UI changes but catch real regressions
- Include proper setup, cleanup, and error handling
- Test both happy paths and edge cases
- Consider accessibility, responsive design, and performance
- Write self-documenting test names and descriptions
- Use Page Object Model patterns when beneficial
- Include proper wait strategies and assertions

Return ONLY the TypeScript test code using @playwright/test. No explanations or comments outside the code.`;

  const userPrompt = await buildUserPrompt(baseTitle, metadata);

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

async function buildUserPrompt(title: string, meta: Record<string, any>): Promise<string> {
  const changed = (meta.changedFiles || []).slice(0, 10).join('\n');
  const baseUrl = meta.compareUrl || process.env.E2E_BASE_URL || 'http://localhost:3000';
  
  // Get component analysis if repository URL is available
  let componentAnalysis = 'No specific component analysis available.';
  let selectorRecommendations = '';
  
  if (meta.repo && meta.changedFiles && meta.changedFiles.length > 0) {
    try {
      const analyses = await componentAnalysisService.analyzeChangedComponents(
        meta.repo,
        meta.changedFiles,
        meta.branch
      );
      
      if (analyses.length > 0) {
        componentAnalysis = analyses.map(analysis => `
• ${analysis.componentName} (${analysis.componentType} component):
  - Props: ${analysis.props.length > 0 ? analysis.props.join(', ') : 'none detected'}
  - Hooks: ${analysis.hooks.length > 0 ? analysis.hooks.join(', ') : 'none detected'}
  - Elements: ${analysis.elements.map(e => e.tag).join(', ')}
  - Test Selectors Available: ${analysis.testSelectors.length} selectors generated`).join('\n');

        // Generate selector recommendations
        const allSelectors = analyses.flatMap(a => a.testSelectors);
        const highConfidenceSelectors = allSelectors.filter(s => s.confidence > 0.7);
        
        if (highConfidenceSelectors.length > 0) {
          selectorRecommendations = `
Recommended Test Selectors (high confidence):
${highConfidenceSelectors.map(s => `- page.locator('${s.value}') // ${s.element} (${s.type})`).join('\n')}`;
        }
      }
    } catch (error) {
      console.warn('Component analysis failed:', error);
      componentAnalysis = analyzeComponentFilesBasic(meta.changedFiles || []);
    }
  } else {
    componentAnalysis = analyzeComponentFilesBasic(meta.changedFiles || []);
  }
  
  return `Generate a comprehensive Playwright test for the application under test.

Project Context:
- Title: ${title}
- Repository: ${meta.repo || ''}
- Branch: ${meta.branch || ''}
- Commit: ${meta.headCommit || ''}
- Target URL: ${baseUrl}

Changed Files:
${changed}

Component Analysis:
${componentAnalysis}
${selectorRecommendations}

Requirements:
- Use TypeScript with @playwright/test framework
- Test the application at: ${baseUrl}
- Create specific tests for the changed components
- Use test.describe blocks for organization
- Include responsive design testing if UI components changed
- Use robust selectors (prefer data-testid, then role-based, then CSS)
- Include meaningful assertions that verify functionality
- Test both positive and negative scenarios where applicable
- Keep total test under 150 lines but be comprehensive
- Include setup/teardown as needed
- Add accessibility checks if UI components changed
- Return ONLY the TypeScript test code, no explanations

Example selectors to prefer:
- page.getByTestId('component-name')
- page.getByRole('button', { name: 'Click me' })
- page.locator('[data-testid="specific-element"]')
- page.getByLabel('Form field')

Focus on testing the actual functionality and user interactions for the changed components.`;
}

function analyzeComponentFilesBasic(changedFiles: string[]): string {
  if (!changedFiles || changedFiles.length === 0) {
    return 'No specific component files identified for analysis.';
  }
  
  const analysis: string[] = [];
  
  changedFiles.forEach(file => {
    const fileName = file.split('/').pop() || file;
    const fileExt = fileName.split('.').pop()?.toLowerCase();
    
    if (fileExt === 'jsx' || fileExt === 'tsx') {
      // React component analysis
      if (fileName.toLowerCase().includes('header')) {
        analysis.push(`• ${fileName}: Likely a header component - test navigation, branding, user menu, responsive behavior`);
      } else if (fileName.toLowerCase().includes('button')) {
        analysis.push(`• ${fileName}: Button component - test click events, disabled states, loading states`);
      } else if (fileName.toLowerCase().includes('form')) {
        analysis.push(`• ${fileName}: Form component - test input validation, submission, error handling`);
      } else if (fileName.toLowerCase().includes('modal')) {
        analysis.push(`• ${fileName}: Modal component - test open/close, backdrop clicks, escape key, focus management`);
      } else if (fileName.toLowerCase().includes('table') || fileName.toLowerCase().includes('list')) {
        analysis.push(`• ${fileName}: Data display component - test sorting, filtering, pagination, row selection`);
      } else if (fileName.toLowerCase().includes('admin')) {
        analysis.push(`• ${fileName}: Admin component - test admin-specific functionality, permissions, management features`);
      } else {
        analysis.push(`• ${fileName}: React component - test rendering, props handling, user interactions`);
      }
    } else if (fileExt === 'vue') {
      analysis.push(`• ${fileName}: Vue component - test component lifecycle, data binding, events`);
    } else if (fileExt === 'css' || fileExt === 'scss' || fileExt === 'less') {
      analysis.push(`• ${fileName}: Styling changes - verify visual appearance, responsive design, animations`);
    } else if (fileExt === 'js' || fileExt === 'ts') {
      analysis.push(`• ${fileName}: Logic/utility file - test functionality through UI interactions that depend on this logic`);
    } else {
      analysis.push(`• ${fileName}: General file change - test related functionality`);
    }
  });
  
  return analysis.length > 0 ? analysis.join('\n') : 'Standard component testing recommended.';
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
