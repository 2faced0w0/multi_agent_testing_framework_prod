import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';
import BaseAgent, { type BaseAgentConfig } from '../base/BaseAgent';
import type { AgentMessage } from '@app-types/communication';
import { ExecutionReportRepository } from '@database/repositories/ExecutionReportRepository';
import { TestExecutionRepository } from '@database/repositories/TestExecutionRepository';
import { metrics } from '@monitoring/Metrics';

export type TestExecutorAgentConfig = BaseAgentConfig & {
  execution: {
    mode: 'simulate' | 'playwright-cli';
    timeoutMs: number;
    reportDir: string; // relative to project root
    testsDir: string;  // relative to project root
    defaultBrowser: 'chromium' | 'firefox' | 'webkit';
  };
};

export class TestExecutorAgent extends BaseAgent {
  private cancellations = new Set<string>();
  constructor(private teConfig: TestExecutorAgentConfig) {
    super(teConfig);
  }

  protected async onInitialize(): Promise<void> {
    // no-op
  }

  protected async onShutdown(): Promise<void> {
    // no-op
  }

  protected getConfigSchema(): object {
    return { type: 'object', properties: { execution: { type: 'object' } } };
  }

  protected async processMessage(message: AgentMessage): Promise<void> {
    if (message.messageType === 'EXECUTION_CANCEL') {
      const execId = (message.payload as any)?.executionId;
      if (execId) {
        this.cancellations.add(execId);
        this.log('info', 'Cancellation requested', { executionId: execId });
        try {
          const repo = new ExecutionReportRepository(this.database.getDatabase());
          // Optional: persist a cancellation marker as a report entry
          await repo.create({
            id: uuidv4(),
            execution_id: execId,
            report_path: '',
            summary: 'Execution canceled by request',
            status: 'skipped',
            created_at: new Date().toISOString(),
            created_by: this.agentId.type,
          } as any);
          // Update status on test_executions if present
          try {
            const ter = new TestExecutionRepository(this.database.getDatabase());
            await ter.updateStatus(execId, 'canceled');
          } catch {}
        } catch {}
      }
      return;
    }
    if (message.messageType !== 'EXECUTION_REQUEST') return;

    const payload: any = message.payload || {};
    const execId = uuidv4();
    const startedAt = new Date();
    const apiExecId = payload?.data?.executionId as string | undefined;
    // Mark running if we have a corresponding API execution row
    if (apiExecId) {
      try {
        const ter = new TestExecutionRepository(this.database.getDatabase());
        await ter.updateStatus(apiExecId, 'running');
      } catch {}
    }

    const projectRoot = process.cwd();
    const reportRoot = path.resolve(projectRoot, 'project', this.teConfig.execution.reportDir);
    await fs.mkdir(reportRoot, { recursive: true });
    const reportPath = path.join(reportRoot, `${execId}.html`);

    let status: 'passed' | 'failed' | 'skipped' = 'passed';
    let summary = '';

    if (this.cancellations.has(apiExecId || '')) {
      status = 'skipped';
      summary = 'Execution canceled before start';
      if (apiExecId) {
        try { const ter = new TestExecutionRepository(this.database.getDatabase()); await ter.updateStatus(apiExecId, 'canceled'); } catch {}
      }
    } else if (this.teConfig.execution.mode === 'simulate') {
      // Write a trivial HTML report quickly
      const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>Execution ${execId}</title></head><body><h1>Simulated Report</h1><p>Started: ${startedAt.toISOString()}</p><p>Status: passed</p></body></html>`;
      await fs.writeFile(reportPath, html, 'utf8');
      summary = 'Simulated execution: 1 test, 1 passed';
    } else {
      // Playwright CLI mode
      const testsDir = path.resolve(projectRoot, 'project', this.teConfig.execution.testsDir);
      const grep = payload.grep || '';
      const timeoutMs = this.teConfig.execution.timeoutMs;
      const args = ['playwright', 'test', testsDir, '--reporter=html', `--reporter-html-output=${reportPath}`];
      if (grep) args.push(`--grep=${grep}`);

      await new Promise<void>((resolve, reject) => {
        const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
          cwd: projectRoot,
          stdio: 'inherit',
          env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '0', E2E_BASE_URL: process.env.E2E_BASE_URL || 'https://example.org' }
        });
        const to = setTimeout(() => {
          child.kill('SIGKILL');
          reject(new Error(`Playwright execution timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        const checkCancel = setInterval(() => {
          if (this.cancellations.has(apiExecId || '')) {
            try { child.kill('SIGKILL'); } catch {}
            clearInterval(checkCancel);
          }
        }, 500);
        child.on('exit', (code) => {
          clearTimeout(to);
          clearInterval(checkCancel);
          if (code === 0) resolve(); else reject(new Error(`Playwright exited with code ${code}`));
        });
        child.on('error', (err) => {
          clearTimeout(to);
          clearInterval(checkCancel);
          reject(err);
        });
      }).then(() => {
        status = 'passed';
        summary = 'Playwright execution passed';
      }).catch((err) => {
        if (this.cancellations.has(apiExecId || '')) {
          status = 'skipped';
          summary = 'Execution canceled';
        } else {
          status = 'failed';
          summary = `Playwright execution failed: ${(err as Error).message}`;
        }
      });
    }

    // Persist execution report row (best-effort)
    try {
      await this.database.initialize();
      const repo = new ExecutionReportRepository(this.database.getDatabase());
      await repo.create({
        id: execId,
        execution_id: execId,
        report_path: path.relative(path.resolve(projectRoot, 'project'), reportPath).replace(/\\/g, '/'),
        summary,
        status,
        created_at: new Date().toISOString(),
        created_by: this.agentId.type,
      });
    } catch (err) {
      this.log('warn', 'Failed to persist execution report', { error: (err as Error)?.message });
    }

    // Publish event
    await this.publishEvent('execution.completed', { id: execId, status, reportPath, summary });
    // Notify optimizer via MQ for further analysis
    try {
      await this.sendMessage({
        target: { type: 'TestOptimizer' },
        messageType: 'EXECUTION_RESULT',
        payload: { executionId: execId, status, summary }
      });
    } catch (e) {
      this.log('warn', 'Failed to notify optimizer', { error: (e as Error)?.message });
    }
    // Trigger report generation
    try {
      await this.sendMessage({
        target: { type: 'ReportGenerator' },
        messageType: 'GENERATE_REPORT',
        payload: { executionId: execId }
      });
    } catch (e) {
      this.log('warn', 'Failed to request report generation', { error: (e as Error)?.message });
    }

    // Metrics
    try {
      metrics.inc('tests_executed_total');
      if (status !== 'passed') metrics.inc('generation_failures_total');
    } catch {}

    // Cleanup cancellation flag
    if (apiExecId) this.cancellations.delete(apiExecId);

    // Update final status on test_executions
    if (apiExecId) {
      try {
        const ter = new TestExecutionRepository(this.database.getDatabase());
        await ter.updateStatus(apiExecId, status === 'skipped' ? 'canceled' : status);
      } catch {}
    }
  }
}

export default TestExecutorAgent;
