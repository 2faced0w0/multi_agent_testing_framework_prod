import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';
import BaseAgent, { type BaseAgentConfig } from '../base/BaseAgent';
import type { AgentMessage } from '@app-types/communication';
import { ExecutionReportRepository } from '@database/repositories/ExecutionReportRepository';
import { TestExecutionRepository } from '@database/repositories/TestExecutionRepository';
import { metrics } from '@monitoring/Metrics';
import { executionStartsTotal, executionCompletionsTotal, testsExecutedTotal, executionDuration, queueWaitDuration } from '@monitoring/promMetrics';
import { testExecutionPipeline, type TestExecutionConfig } from '../../services/TestExecutionPipelineService';
import { sanitizeGeneratedTest, hasCodeFences } from '../test-writer/utils';

export type TestExecutorAgentConfig = BaseAgentConfig & {
  execution: {
    mode: 'simulate' | 'playwright-cli' | 'pipeline';
    timeoutMs: number;
    reportDir: string; // relative to project root
    testsDir: string;  // relative to project root
    defaultBrowser: 'chromium' | 'firefox' | 'webkit';
    pipeline?: {
      browsers?: string[];
      headless?: boolean;
      retries?: number;
      workers?: number;
    };
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

  /**
   * Resolve test file path from payload or use a default generated test
   */
  private resolveTestFile(payload: any, folderName: string): string {
    const projectRoot = process.cwd();
    
    // Check if a specific test file is requested
    if (payload.testFilePath) {
      return path.resolve(projectRoot, payload.testFilePath);
    }
    
    // Check if test case ID points to a generated test
    if (payload.testCaseId || payload.data?.testCaseId) {
      const testId = payload.testCaseId || payload.data.testCaseId;
      const testsDir = path.resolve(projectRoot, this.teConfig.execution.testsDir);
      const testFile = path.join(testsDir, `${testId}.spec.ts`);
      return testFile;
    }
    
    // Default: look for the most recent test file in generated_tests
    const testsDir = path.resolve(projectRoot, this.teConfig.execution.testsDir);
    // For now, return a placeholder that will be resolved by the pipeline service
    return path.join(testsDir, `${folderName}.spec.ts`);
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
  // Internal unique id for this run context (used only when we don't have an API execution id)
  const internalRunId = uuidv4();
  const startedAt = new Date();
  try { executionStartsTotal.inc(); } catch {}
  const apiExecId = (payload?.data?.executionId as string | undefined) || (payload?.executionId as string | undefined);
    // Mark running if we have a corresponding API execution row
    if (apiExecId) {
      try {
        const ter = new TestExecutionRepository(this.database.getDatabase());
        await ter.updateStatus(apiExecId, 'running');
        try { await ter.updateProgress(apiExecId, 0.1); } catch {}
      } catch {}
    }

  const projectRoot = process.cwd();
  const reportRoot = path.resolve(projectRoot, this.teConfig.execution.reportDir);
  await fs.mkdir(reportRoot, { recursive: true });
  // In Playwright mode, HTML reporter creates a folder; we'll place each execution under its own folder
  // Prefer linking the folder name to the API execution id when available for consistent UI mapping
  const folderName = apiExecId || internalRunId;
  const reportFolder = path.join(reportRoot, folderName);
  const singleHtmlPath = path.join(reportRoot, `${folderName}.html`); // used for simulate mode only

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
  const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>Execution ${folderName}</title></head><body><h1>Simulated Report</h1><p>Started: ${startedAt.toISOString()}</p><p>Status: passed</p></body></html>`;
  await fs.writeFile(singleHtmlPath, html, 'utf8');
      summary = 'Simulated execution: 1 test, 1 passed';
      if (apiExecId) { try { const ter = new TestExecutionRepository(this.database.getDatabase()); await ter.updateProgress(apiExecId, 1.0); } catch {} }
    } else if (this.teConfig.execution.mode === 'pipeline') {
      // Use the enhanced test execution pipeline
      try {
        const testFilePath = this.resolveTestFile(payload, folderName);
        
        // Ensure test file exists before execution
        const exists = await fs.stat(testFilePath).then(()=>true).catch(()=>false);
        if (!exists) {
          throw new Error(`Test file not found: ${testFilePath}`);
        }
        
        // Always check and sanitize file contents before execution
        let sanitizationAttempts = 0;
        const maxSanitizationAttempts = 3;
        let compileSuccess = false;
        
        while (!compileSuccess && sanitizationAttempts < maxSanitizationAttempts) {
          const raw = await fs.readFile(testFilePath, 'utf8');
          
          // Check for code fences and sanitize if found
          if (hasCodeFences(raw)) {
            const cleaned = sanitizeGeneratedTest(raw);
            if (cleaned !== raw) {
              await fs.writeFile(testFilePath, cleaned, 'utf8');
              sanitizationAttempts++;
              this.log('info', 'Sanitized fenced test before pipeline execution', { 
                testFilePath, 
                attempt: sanitizationAttempts 
              });
              
              // Verify compilation after sanitization
              try {
                const ts = require('typescript') as typeof import('typescript');
                const srcCode = await fs.readFile(testFilePath, 'utf8');
                const transpile = ts.transpileModule(srcCode, { 
                  compilerOptions: { 
                    module: ts.ModuleKind.CommonJS, 
                    target: ts.ScriptTarget.ES2020 
                  } 
                });
                
                if (transpile.diagnostics && transpile.diagnostics.length) {
                  const errs = transpile.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error);
                  if (errs.length > 0) {
                    this.log('warn', 'Compilation errors after sanitization', { 
                      errors: errs.map(e => e.messageText),
                      attempt: sanitizationAttempts 
                    });
                    // If still has fences, continue loop; otherwise compilation failed for other reasons
                    if (!hasCodeFences(srcCode)) {
                      compileSuccess = false;
                      break;
                    }
                  } else {
                    compileSuccess = true;
                  }
                } else {
                  compileSuccess = true;
                }
              } catch (tsErr) {
                this.log('warn', 'TypeScript validation unavailable', { 
                  error: (tsErr as Error)?.message 
                });
                compileSuccess = true; // Assume OK if can't validate
              }
            } else {
              // Sanitizer made no changes despite fences detected
              this.log('warn', 'Code fences detected but sanitizer made no changes', { 
                testFilePath,
                preview: raw.substring(0, 100)
              });
              compileSuccess = true; // Proceed anyway
              break;
            }
          } else {
            // No code fences found
            compileSuccess = true;
          }
        }
        
        if (!compileSuccess && sanitizationAttempts >= maxSanitizationAttempts) {
          throw new Error(`Failed to sanitize test file after ${maxSanitizationAttempts} attempts`);
        }
        const pipelineConfig: TestExecutionConfig = {
          testFilePath,
          browsers: this.teConfig.execution.pipeline?.browsers || [this.teConfig.execution.defaultBrowser],
          headless: this.teConfig.execution.pipeline?.headless ?? true,
          timeout: this.teConfig.execution.timeoutMs,
          retries: this.teConfig.execution.pipeline?.retries || 0,
          workers: this.teConfig.execution.pipeline?.workers || 1,
          outputDir: reportRoot,
          baseUrl: process.env.E2E_BASE_URL || payload.baseUrl || 'https://example.org'
        };

        if (apiExecId) {
          try { const ter = new TestExecutionRepository(this.database.getDatabase()); await ter.updateProgress(apiExecId, 0.3); } catch {}
        }

        const executionId = await testExecutionPipeline.executeTest(pipelineConfig);
        
        // Monitor execution progress
        let result = testExecutionPipeline.getExecutionResult(executionId);
        const startTime = Date.now();
        while (result && result.status === 'running') {
          if (this.cancellations.has(apiExecId || '')) {
            await testExecutionPipeline.cancelExecution(executionId);
            break;
          }
          
          // Timeout check
          if (Date.now() - startTime > this.teConfig.execution.timeoutMs) {
            await testExecutionPipeline.cancelExecution(executionId);
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          result = testExecutionPipeline.getExecutionResult(executionId);
          
          if (apiExecId && result) {
            const progress = result.status === 'running' ? 0.6 : 0.9;
            try { const ter = new TestExecutionRepository(this.database.getDatabase()); await ter.updateProgress(apiExecId, progress); } catch {}
          }
        }

        if (result) {
          switch (result.status) {
            case 'passed':
              status = 'passed';
              summary = `Pipeline execution: ${result.summary.passed}/${result.summary.total} tests passed`;
              break;
            case 'failed':
              status = 'failed';
              summary = `Pipeline execution failed: ${result.summary.failed}/${result.summary.total} tests failed. ${result.error || ''}`;
              break;
            case 'cancelled':
            case 'timeout':
              status = 'skipped';
              summary = 'Pipeline execution canceled or timed out';
              break;
            default:
              status = 'failed';
              summary = `Pipeline execution completed with status: ${result.status}`;
          }
        } else {
          status = 'failed';
          summary = 'Pipeline execution failed to complete';
        }

        if (apiExecId) { try { const ter = new TestExecutionRepository(this.database.getDatabase()); await ter.updateProgress(apiExecId, 1.0); } catch {} }
      } catch (error) {
        status = 'failed';
        summary = `Pipeline execution error: ${(error as Error).message}`;
      }
    } else {
      // Playwright CLI mode
      const testsDir = path.resolve(projectRoot, this.teConfig.execution.testsDir);
      
      // Ensure tests directory exists
      try {
        await fs.access(testsDir);
      } catch {
        throw new Error(`Tests directory not found: ${testsDir}`);
      }
      
      // Sanitize every .spec.ts file in target tests directory before execution
      const entries = await fs.readdir(testsDir);
      const testFiles = entries.filter(f => f.endsWith('.spec.ts'));
      
      if (testFiles.length === 0) {
        throw new Error(`No test files found in ${testsDir}`);
      }
      
      // Check and sanitize each test file with retry logic
      for (const f of testFiles) {
        const full = path.join(testsDir, f);
        let sanitizationAttempts = 0;
        const maxSanitizationAttempts = 3;
        let compileSuccess = false;
        
        while (!compileSuccess && sanitizationAttempts < maxSanitizationAttempts) {
          try {
            const txt = await fs.readFile(full, 'utf8');
            
            if (hasCodeFences(txt)) {
              const cleaned = sanitizeGeneratedTest(txt);
              if (cleaned !== txt) {
                await fs.writeFile(full, cleaned, 'utf8');
                sanitizationAttempts++;
                this.log('info', 'Sanitized fenced test before CLI execution', { 
                  file: full,
                  attempt: sanitizationAttempts 
                });
                
                // Verify compilation after sanitization
                try {
                  const ts = require('typescript') as typeof import('typescript');
                  const srcCode = await fs.readFile(full, 'utf8');
                  const transpile = ts.transpileModule(srcCode, { 
                    compilerOptions: { 
                      module: ts.ModuleKind.CommonJS, 
                      target: ts.ScriptTarget.ES2020 
                    } 
                  });
                  
                  if (transpile.diagnostics && transpile.diagnostics.length) {
                    const errs = transpile.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error);
                    if (errs.length > 0) {
                      this.log('warn', 'Compilation errors after sanitization', { 
                        file: full,
                        errors: errs.map(e => e.messageText),
                        attempt: sanitizationAttempts 
                      });
                      // If still has fences, continue loop
                      if (!hasCodeFences(srcCode)) {
                        compileSuccess = false;
                        break;
                      }
                    } else {
                      compileSuccess = true;
                    }
                  } else {
                    compileSuccess = true;
                  }
                } catch (tsErr) {
                  this.log('warn', 'TypeScript validation unavailable for CLI mode', { 
                    error: (tsErr as Error)?.message 
                  });
                  compileSuccess = true; // Assume OK if can't validate
                }
              } else {
                // Sanitizer made no changes
                this.log('warn', 'Code fences detected but sanitizer made no changes', { 
                  file: full,
                  preview: txt.substring(0, 100)
                });
                compileSuccess = true; // Proceed anyway
                break;
              }
            } else {
              // No code fences found
              compileSuccess = true;
            }
          } catch (fileErr) {
            this.log('error', 'Failed to process test file', { 
              file: full, 
              error: (fileErr as Error)?.message 
            });
            break;
          }
        }
        
        if (!compileSuccess && sanitizationAttempts >= maxSanitizationAttempts) {
          this.log('error', `Failed to sanitize test file after ${maxSanitizationAttempts} attempts`, { 
            file: full 
          });
        }
      }
      const grep = payload.grep || '';
      const timeoutMs = this.teConfig.execution.timeoutMs;
      
      // Ensure report folder exists before execution
      await fs.mkdir(reportFolder, { recursive: true });
      
      const args = ['playwright', 'test', testsDir, '--reporter=html'];
      if (grep) args.push(`--grep=${grep}`);

      const failedTests: any[] = [];
      const stdoutLines: string[] = [];
      const stderrLines: string[] = [];
      const testFilePath = path.resolve(projectRoot, this.teConfig.execution.testsDir);
      const runPromise = new Promise<void>((resolve, reject) => {
        const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
          cwd: projectRoot,
          env: {
            ...process.env,
            PLAYWRIGHT_HTML_REPORT: reportFolder,
            E2E_BASE_URL: process.env.E2E_BASE_URL || 'https://example.org'
          },
          stdio: ['ignore', 'pipe', 'pipe']
        });
        const to = setTimeout(() => {
          child.kill('SIGKILL');
          reject(new Error(`Playwright execution timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        if (apiExecId) { try { const ter = new TestExecutionRepository(this.database.getDatabase()); ter.updateProgress(apiExecId, 0.5).catch(()=>{}); } catch {} }
        const checkCancel = setInterval(() => {
          if (this.cancellations.has(apiExecId || '')) {
            try { child.kill('SIGKILL'); } catch {}
            clearInterval(checkCancel);
          }
        }, 500);
        child.stdout?.on('data', d => {
          const text = d.toString();
          text.split(/\r?\n/).forEach((l: string) => { if (l.trim()) stdoutLines.push(l); });
        });
        child.stderr?.on('data', d => {
          const text = d.toString();
          text.split(/\r?\n/).forEach((l: string) => { if (l.trim()) stderrLines.push(l); });
        });
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
      });

      await runPromise.then(async () => {
        status = 'passed';
        
        // Check if Playwright generated the HTML report
        const expectedIndexPath = path.join(reportFolder, 'index.html');
        const indexExists = await fs.stat(expectedIndexPath).then(() => true).catch(() => false);
        
        if (indexExists) {
          summary = 'Playwright execution passed - HTML report generated';
        } else {
          summary = 'Playwright execution passed - report may be incomplete';
          // Generate a fallback summary HTML if Playwright didn't create index.html
          const fallbackHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Playwright Execution ${folderName}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #2d8659; }
    .info { background: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .stdout, .stderr { background: #1e1e1e; color: #d4d4d4; padding: 15px; border-radius: 4px; margin: 10px 0; overflow-x: auto; }
    .stdout pre, .stderr pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; }
    .stderr { border-left: 4px solid #ff6b6b; }
  </style>
</head>
<body>
  <h1>Playwright Test Execution</h1>
  <div class="info">
    <p><strong>Execution ID:</strong> ${folderName}</p>
    <p><strong>Started:</strong> ${startedAt.toISOString()}</p>
    <p><strong>Status:</strong> <span style="color: #2d8659;">Passed</span></p>
    <p><strong>Tests Directory:</strong> ${testsDir}</p>
  </div>
  ${stdoutLines.length > 0 ? `
  <h2>Output</h2>
  <div class="stdout">
    <pre>${stdoutLines.join('\n')}</pre>
  </div>
  ` : ''}
  ${stderrLines.length > 0 ? `
  <h2>Errors/Warnings</h2>
  <div class="stderr">
    <pre>${stderrLines.join('\n')}</pre>
  </div>
  ` : ''}
</body>
</html>`;
          await fs.writeFile(expectedIndexPath, fallbackHtml, 'utf8');
        }
      }).catch(async (err) => {
        if (this.cancellations.has(apiExecId || '')) {
          status = 'skipped';
          summary = 'Execution canceled';
        } else {
          status = 'failed';
          summary = `Playwright execution failed: ${(err as Error).message}`;
          // crude parse: capture first block containing getByTestId or locator failure
          const combined = [...stdoutLines, ...stderrLines].slice(-200); // last 200 lines
          const failureBlock = combined.join('\n');
          const selectorMatch = failureBlock.match(/getByTestId\('([^']+)'\)/) || failureBlock.match(/getByRole\(([^)]+)\)/) || failureBlock.match(/locator\(['"]([^'"]+)['"]/);
          failedTests.push({
            file: payload.testFilePath || testFilePath,
            errorSnippet: failureBlock.split('\n').slice(-30).join('\n'),
            selectorGuess: selectorMatch ? selectorMatch[0] : undefined
          });
          (message as any).__failedTests = failedTests; // internal carry if needed
        }
        
        // Generate failure HTML report
        const expectedIndexPath = path.join(reportFolder, 'index.html');
        const failureHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Playwright Execution Failed - ${folderName}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #d32f2f; }
    .info { background: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d32f2f; }
    .error { background: #1e1e1e; color: #ff6b6b; padding: 15px; border-radius: 4px; margin: 10px 0; overflow-x: auto; }
    .error pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; }
    .stdout, .stderr { background: #1e1e1e; color: #d4d4d4; padding: 15px; border-radius: 4px; margin: 10px 0; overflow-x: auto; }
    .stdout pre, .stderr pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; }
  </style>
</head>
<body>
  <h1>Playwright Test Execution Failed</h1>
  <div class="info">
    <p><strong>Execution ID:</strong> ${folderName}</p>
    <p><strong>Started:</strong> ${startedAt.toISOString()}</p>
    <p><strong>Status:</strong> <span style="color: #d32f2f;">Failed</span></p>
    <p><strong>Error:</strong> ${(err as Error).message}</p>
    <p><strong>Tests Directory:</strong> ${testsDir}</p>
  </div>
  ${failedTests.length > 0 ? `
  <h2>Failed Tests</h2>
  ${failedTests.map(ft => `
    <div class="error">
      <p><strong>File:</strong> ${ft.file}</p>
      ${ft.selectorGuess ? `<p><strong>Selector:</strong> <code>${ft.selectorGuess}</code></p>` : ''}
      <pre>${ft.errorSnippet}</pre>
    </div>
  `).join('')}
  ` : ''}
  ${stdoutLines.length > 0 ? `
  <h2>Output</h2>
  <div class="stdout">
    <pre>${stdoutLines.join('\n')}</pre>
  </div>
  ` : ''}
  ${stderrLines.length > 0 ? `
  <h2>Error Log</h2>
  <div class="stderr">
    <pre>${stderrLines.join('\n')}</pre>
  </div>
  ` : ''}
</body>
</html>`;
        await fs.writeFile(expectedIndexPath, failureHtml, 'utf8');
      });
      if (apiExecId) { try { const ter = new TestExecutionRepository(this.database.getDatabase()); await ter.updateProgress(apiExecId, 1.0); } catch {} }
      // attach failedTests to summary messaging later
      (payload as any)._failedTests = (payload as any)._failedTests || (message as any).__failedTests;
    }

    // Determine final report path (for UI static serving)
  const finalReportPath = this.teConfig.execution.mode === 'simulate' ? singleHtmlPath : path.join(reportFolder, 'index.html');

    // Persist execution report row (best-effort)
    try {
      await this.database.initialize();
      const repo = new ExecutionReportRepository(this.database.getDatabase());
      // Use API execution id for linkage when available; otherwise fall back to internal run id
      const linkedExecId = apiExecId || internalRunId;
      await repo.create({
        id: uuidv4(),
        execution_id: linkedExecId,
        report_path: path.relative(projectRoot, finalReportPath).replace(/\\/g, '/'),
        summary,
        status,
        created_at: new Date().toISOString(),
        created_by: this.agentId.type,
      });
    } catch (err) {
      this.log('warn', 'Failed to persist execution report', { error: (err as Error)?.message });
    }

    // Publish event and follow-ups only if not shutting down
    if (!this.isStopping) {
  await this.publishEvent('execution.completed', { id: apiExecId || internalRunId, status, reportPath: finalReportPath, summary, failedTests: (payload as any)._failedTests });
      // Notify ContextManager on failures to capture context for optimization
  if (String(status) === 'failed' && apiExecId) {
        try {
          await this.sendMessage({
            target: { type: 'ContextManager' },
            messageType: 'EXECUTION_FAILURE',
            payload: { executionId: apiExecId, summary }
          });
        } catch {}
      }
      // Notify optimizer via MQ for further analysis
      try {
        await this.sendMessage({
          target: { type: 'TestOptimizer' },
          messageType: 'EXECUTION_RESULT',
          payload: { executionId: apiExecId || internalRunId, status, summary, failedTests: (payload as any)._failedTests }
        });
      } catch (e) {
        this.log('warn', 'Failed to notify optimizer', { error: (e as Error)?.message });
      }
      // Trigger report generation
      try {
        await this.sendMessage({
          target: { type: 'ReportGenerator' },
          messageType: 'GENERATE_REPORT',
          payload: { executionId: apiExecId || internalRunId }
        });
      } catch (e) {
        this.log('warn', 'Failed to request report generation', { error: (e as Error)?.message });
      }
    }

    // Metrics
    try {
      metrics.inc('tests_executed_total');
      if (status !== 'passed') metrics.inc('generation_failures_total');
    } catch {}
    // Prom-client metrics
    try {
      testsExecutedTotal.inc({ status });
      executionCompletionsTotal.inc({ status });
      const durSec = (Date.now() - startedAt.getTime())/1000;
      executionDuration.observe({ status }, durSec);
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
