import 'module-alias/register';
import 'tsconfig-paths/register';
import 'dotenv/config';
import { generatePlaywrightTest } from '../src/agents/test-writer/mistralGenerator';
import { TestWriterAgentConfig } from '../src/agents/test-writer/TestWriterAgent';
import { stripCodeFences } from '../src/agents/test-writer/utils';

// IMPORTANT: Do NOT hardcode real secrets here. Ensure they are loaded via environment variables.
// The user supplied API keys in chat; those MUST be rotated. This script only reads from process.env.

async function main() {
  // Validate env
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    console.error('Missing MISTRAL_API_KEY in environment');
    process.exit(1);
  }

  const metadata = {
    repo: process.env.SAMPLE_REPO || 'https://github.com/2faced0w0/repair_ninja',
    branch: process.env.SAMPLE_BRANCH || 'main',
    headCommit: process.env.SAMPLE_HEAD_COMMIT || 'updated files',
    changedFiles: (process.env.SAMPLE_CHANGED_FILES || 'client/src/components/ui/AdminHeader.jsx').split(/[,;\n]/).map(s => s.trim()).filter(Boolean),
    compareUrl: process.env.SAMPLE_COMPARE_URL || 'https://electronic-repair.vercel.app/'
  };

  // Minimal viable config mirroring createDefaultTestWriterConfig defaults
  const config: TestWriterAgentConfig = {
    agentType: 'test_writer',
    instanceId: 'test-writer-inline',
    nodeId: 'local-inline',
    messageQueue: {
      redis: { host: 'localhost', port: 6379, db: 0 },
      queues: { default: 'framework:queue:default', high: 'framework:queue:high', critical: 'framework:queue:critical' },
      deadLetterQueue: 'framework:queue:dlq',
      maxRetries: 0,
      retryDelay: 1000
    },
    eventBus: {
      redis: { host: 'localhost', port: 6379, db: 0 },
      channels: { system: 'framework:events:system', agents: 'framework:events:agents', executions: 'framework:events:executions', health: 'framework:events:health' }
    },
    sharedMemory: {
      redis: { host: 'localhost', port: 6379, db: 0 },
      keyPrefix: 'framework:shared',
      defaultTtl: 300
    },
    database: { path: './data/framework.db', timeout: 5000, verbose: false, memory: false },
    healthCheck: { intervalMs: 30000, timeoutMs: 5000, failureThreshold: 3, recoveryThreshold: 2 },
    lifecycle: { startupTimeoutMs: 60000, shutdownTimeoutMs: 30000, gracefulShutdownMs: 10000 },
    logging: { level: 'info', enableMetrics: false, enableTracing: false },

    mistral: {
      apiKey,
  model: process.env.MISTRAL_MODEL || 'mistral-large-2411',
      maxTokens: 1800,
      temperature: 0.3,
      topP: 0.95
    },
    testGeneration: {
      maxRetries: 1,
      timeoutMs: 60000,
      enableOptimization: false,
      enableValidation: true,
      defaultBrowser: 'chromium',
      defaultViewport: { width: 1280, height: 720 }
    },
    templates: { defaultTemplate: 'default', customTemplates: {} }
  };

  console.log('Invoking Mistral test generation...');
  console.log('Metadata:', metadata);

  try {
    const result = await generatePlaywrightTest(metadata, config);
    console.log('\n=== Result Summary ===');
    console.log({ title: result.title, provider: result.provider, model: result.model, finishReason: result.finishReason, error: result.error });

    const snippet = result.content.split(/\r?\n/).slice(0, 40).join('\n');
    console.log('\n=== Preview (first 40 lines) ===');
    console.log(snippet);

    const fs = await import('fs/promises');
    await fs.mkdir('generated_tests', { recursive: true });
    const outFile = 'generated_tests/manual-sample.spec.ts';
  // Normalize by removing any accidental markdown code fences emitted by the model
  const normalized = stripCodeFences(result.content);
  await fs.writeFile(outFile, normalized, 'utf8');
    console.log(`\nSaved full test to ${outFile}`);
  } catch (e: any) {
    console.error('Generation failed:', e?.message || e);
    process.exit(2);
  }
}

main();
