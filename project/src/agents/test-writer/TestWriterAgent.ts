import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { testsGeneratedTotal } from '@monitoring/promMetrics';
import { generatePlaywrightTest } from './mistralGenerator';
import BaseAgent, { type BaseAgentConfig } from '../base/BaseAgent';
import type { AgentMessage } from '@app-types/communication';
import { GeneratedTestRepository } from '@database/repositories/GeneratedTestRepository';
import { metrics } from '@monitoring/Metrics';

export type TestWriterAgentConfig = BaseAgentConfig & {
  mistral: {
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature?: number;
    topP?: number;
  };
  testGeneration: {
    maxRetries: number;
    timeoutMs: number;
    enableOptimization: boolean;
    enableValidation: boolean;
    defaultBrowser: 'chromium' | 'firefox' | 'webkit';
    defaultViewport: { width: number; height: number };
  };
  templates: {
    defaultTemplate: string;
    customTemplates: Record<string, unknown>;
  };
};

export class TestWriterAgent extends BaseAgent {
  constructor(private twConfig: TestWriterAgentConfig) {
    super(twConfig);
  }

  protected async onInitialize(): Promise<void> {
    // No-op: DB will be initialized lazily in processMessage if needed
  }

  protected async onShutdown(): Promise<void> {
    // No-op for MVP
  }

  protected getConfigSchema(): object {
    return {
      type: 'object',
      properties: {
        mistral: { type: 'object' },
        testGeneration: { type: 'object' },
        templates: { type: 'object' },
      },
    };
  }

  protected async processMessage(message: AgentMessage): Promise<void> {
    if (message.messageType !== 'TEST_GENERATION_REQUEST') return;

    const payload: any = message.payload || {};
    const id = uuidv4();
    // Call AI generator (with fallback safety inside the module)
    const gen = await generatePlaywrightTest(payload, this.twConfig);
    const title = gen.title;
    const content = gen.content;

    // Ensure target directory exists
  const outDir = path.resolve(process.cwd(), 'generated_tests');
    await fs.mkdir(outDir, { recursive: true });
    const filename = `${id}.spec.ts`;
    const filePath = path.join(outDir, filename);
    await fs.writeFile(filePath, content, 'utf8');

    // Persist metadata (lazy DB init if needed)
    try {
      await this.database.initialize();
      const repo = new GeneratedTestRepository(this.database.getDatabase());
      await repo.create({
        id,
        repo: payload.repo || '',
        branch: payload.branch || '',
        commit: payload.headCommit || '',
        path: `generated_tests/${filename}`,
        title,
        created_at: new Date().toISOString(),
        created_by: this.agentId.type,
        metadata: { compareUrl: payload.compareUrl || '', changedFiles: payload.changedFiles || [] },
      });
    } catch (err) {
      // Log and continue; DB persistence is best-effort in MVP
      this.log('warn', 'Failed to persist generated test metadata', { error: (err as Error)?.message });
    }

    // Publish a generation event (best-effort)
    try {
      await this.publishEvent('test.generated', { id, path: `generated_tests/${filename}`, title });
    } catch (err) {
      this.log('debug', 'Skipping publishEvent; EventBus not initialized', { error: (err as Error)?.message });
    }

    // Metrics (include provider label via legacy metrics if supported later)
    try { metrics.inc('tests_generated_total'); } catch {}
    try { testsGeneratedTotal.inc(); } catch {}

    // Automatically trigger execution
    try {
      await this.sendMessage({
        target: { type: 'TestExecutor' },
        messageType: 'EXECUTION_REQUEST',
        payload: {
          // For CLI mode, executor runs all tests under testsDir; grep optional.
          // We pass minimal payload for broad compatibility.
        }
      });
    } catch (err) {
      this.log('warn', 'Failed to enqueue execution request', { error: (err as Error)?.message });
    }
  }

  // buildGeneratedTest no longer needed (replaced by Mistral integration); kept out to minimize diff churn.
}

export default TestWriterAgent;
