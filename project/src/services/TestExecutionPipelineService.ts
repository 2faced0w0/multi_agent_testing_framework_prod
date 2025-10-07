import { spawn, ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface TestExecutionConfig {
  testFilePath: string;
  browsers?: string[];
  headless?: boolean;
  timeout?: number;
  retries?: number;
  workers?: number;
  outputDir?: string;
  baseUrl?: string;
}

export interface TestExecutionResult {
  id: string;
  status: 'running' | 'passed' | 'failed' | 'timeout' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  browsers: string[];
  testResults: TestFileResult[];
  summary: TestSummary;
  artifacts: TestArtifact[];
  error?: string;
}

export interface TestFileResult {
  file: string;
  status: 'passed' | 'failed' | 'skipped';
  tests: TestCaseResult[];
  duration: number;
}

export interface TestCaseResult {
  title: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  steps: TestStepResult[];
}

export interface TestStepResult {
  title: string;
  status: 'passed' | 'failed';
  duration: number;
  error?: string;
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

export interface TestArtifact {
  type: 'screenshot' | 'video' | 'trace' | 'report';
  path: string;
  description: string;
}

export class TestExecutionPipelineService {
  private runningExecutions = new Map<string, ChildProcess>();
  private executionResults = new Map<string, TestExecutionResult>();

  /**
   * Execute a generated test file
   */
  async executeTest(config: TestExecutionConfig): Promise<string> {
    const executionId = uuidv4();
    const startTime = new Date();

    // Initialize execution result
    const result: TestExecutionResult = {
      id: executionId,
      status: 'running',
      startTime,
      browsers: config.browsers || ['chromium'],
      testResults: [],
      summary: { total: 0, passed: 0, failed: 0, skipped: 0, duration: 0 },
      artifacts: []
    };

    this.executionResults.set(executionId, result);

    try {
      // Validate test file exists
      await this.validateTestFile(config.testFilePath);

      // Create output directory
      const outputDir = config.outputDir || path.join(process.cwd(), 'test_execution_reports');
      await fs.mkdir(outputDir, { recursive: true });

      // Execute the test
      await this.runPlaywrightTest(executionId, config, outputDir);

    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - result.startTime.getTime();
    }

    return executionId;
  }

  /**
   * Get execution status and results
   */
  getExecutionResult(executionId: string): TestExecutionResult | null {
    return this.executionResults.get(executionId) || null;
  }

  /**
   * Cancel a running execution
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const process = this.runningExecutions.get(executionId);
    const result = this.executionResults.get(executionId);

    if (process && result) {
      process.kill('SIGTERM');
      result.status = 'cancelled';
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - result.startTime.getTime();
      this.runningExecutions.delete(executionId);
      return true;
    }

    return false;
  }

  /**
   * List all executions
   */
  listExecutions(): TestExecutionResult[] {
    return Array.from(this.executionResults.values());
  }

  /**
   * Validate that the test file exists and is valid
   */
  private async validateTestFile(testFilePath: string): Promise<void> {
    try {
      const stats = await fs.stat(testFilePath);
      if (!stats.isFile()) {
        throw new Error(`Test file ${testFilePath} is not a file`);
      }

      const content = await fs.readFile(testFilePath, 'utf8');
      if (!content.includes('@playwright/test')) {
        throw new Error('Test file does not appear to be a Playwright test');
      }

      // Basic syntax validation (check for common issues)
      const syntaxIssues = this.validateTestSyntax(content);
      if (syntaxIssues.length > 0) {
        throw new Error(`Test syntax issues: ${syntaxIssues.join(', ')}`);
      }

    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Cannot access test file: ${testFilePath}`);
    }
  }

  /**
   * Basic syntax validation for test files
   */
  private validateTestSyntax(content: string): string[] {
    const issues: string[] = [];

    // Check for required imports
    if (!content.includes("import") || !content.includes("@playwright/test")) {
      issues.push("Missing Playwright test imports");
    }

    // Check for test definitions
    if (!content.includes("test(") && !content.includes("test.describe(")) {
      issues.push("No test definitions found");
    }

    // Check for common syntax issues
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      issues.push("Mismatched braces");
    }

    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      issues.push("Mismatched parentheses");
    }

    return issues;
  }

  /**
   * Run Playwright test and capture results
   */
  private async runPlaywrightTest(
    executionId: string,
    config: TestExecutionConfig,
    outputDir: string
  ): Promise<void> {
    const result = this.executionResults.get(executionId)!;

    return new Promise((resolve, reject) => {
      const playwrightArgs = [
        'test',
        config.testFilePath,
        '--reporter=json',
        `--output-dir=${path.join(outputDir, executionId)}`,
        '--reporter-open=never'
      ];

      // Add configuration options
      if (config.headless !== undefined) {
        playwrightArgs.push(`--headed=${!config.headless}`);
      }
      if (config.timeout) {
        playwrightArgs.push(`--timeout=${config.timeout}`);
      }
      if (config.retries) {
        playwrightArgs.push(`--retries=${config.retries}`);
      }
      if (config.workers) {
        playwrightArgs.push(`--workers=${config.workers}`);
      }

      // Set environment variables
      const env = { ...process.env };
      if (config.baseUrl) {
        env.E2E_BASE_URL = config.baseUrl;
      }

      const playwrightProcess = spawn('npx', ['playwright', ...playwrightArgs], {
        cwd: process.cwd(),
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.runningExecutions.set(executionId, playwrightProcess);

      let stdout = '';
      let stderr = '';

      playwrightProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      playwrightProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      playwrightProcess.on('close', async (code) => {
        this.runningExecutions.delete(executionId);
        result.endTime = new Date();
        result.duration = result.endTime.getTime() - result.startTime.getTime();

        try {
          // Parse test results
          await this.parseTestResults(executionId, outputDir, stdout, stderr);

          // Generate artifacts
          await this.generateArtifacts(executionId, outputDir);

          result.status = code === 0 ? 'passed' : 'failed';
          if (code !== 0 && !result.error) {
            result.error = `Test execution failed with exit code ${code}`;
          }

          resolve();
        } catch (error) {
          result.status = 'failed';
          result.error = error instanceof Error ? error.message : 'Failed to parse results';
          reject(error);
        }
      });

      playwrightProcess.on('error', (error) => {
        this.runningExecutions.delete(executionId);
        result.status = 'failed';
        result.error = error.message;
        result.endTime = new Date();
        result.duration = result.endTime.getTime() - result.startTime.getTime();
        reject(error);
      });

      // Set timeout
      const timeoutMs = config.timeout || 300000; // 5 minutes default
      setTimeout(() => {
        if (this.runningExecutions.has(executionId)) {
          playwrightProcess.kill('SIGTERM');
          result.status = 'timeout';
          result.error = `Execution timed out after ${timeoutMs}ms`;
          reject(new Error('Execution timeout'));
        }
      }, timeoutMs);
    });
  }

  /**
   * Parse Playwright test results from JSON output
   */
  private async parseTestResults(
    executionId: string,
    outputDir: string,
    stdout: string,
    stderr: string
  ): Promise<void> {
    const result = this.executionResults.get(executionId)!;

    try {
      // Look for JSON report in output directory
      const reportPath = path.join(outputDir, executionId, 'results.json');
      let reportData: any;

      try {
        const reportContent = await fs.readFile(reportPath, 'utf8');
        reportData = JSON.parse(reportContent);
      } catch {
        // If no JSON report, try to parse from stdout
        const jsonMatch = stdout.match(/{.*}/s);
        if (jsonMatch) {
          reportData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not find test results');
        }
      }

      // Parse test results
      result.testResults = this.parsePlaywrightResults(reportData);
      result.summary = this.generateSummary(result.testResults);

    } catch (error) {
      // Fallback: parse basic info from stdout/stderr
      result.summary = this.parseBasicResults(stdout, stderr);
    }
  }

  /**
   * Parse Playwright JSON results
   */
  private parsePlaywrightResults(reportData: any): TestFileResult[] {
    const results: TestFileResult[] = [];

    if (reportData.suites && Array.isArray(reportData.suites)) {
      for (const suite of reportData.suites) {
        const fileResult: TestFileResult = {
          file: suite.title || 'unknown',
          status: 'passed',
          tests: [],
          duration: 0
        };

        if (suite.specs && Array.isArray(suite.specs)) {
          for (const spec of suite.specs) {
            const testResult: TestCaseResult = {
              title: spec.title || 'unknown test',
              status: spec.ok ? 'passed' : 'failed',
              duration: spec.tests?.[0]?.results?.[0]?.duration || 0,
              steps: []
            };

            if (!spec.ok && spec.tests?.[0]?.results?.[0]?.error) {
              testResult.error = spec.tests[0].results[0].error.message;
            }

            fileResult.tests.push(testResult);
            fileResult.duration += testResult.duration;
          }
        }

        // Determine file status
        if (fileResult.tests.some(t => t.status === 'failed')) {
          fileResult.status = 'failed';
        } else if (fileResult.tests.every(t => t.status === 'skipped')) {
          fileResult.status = 'skipped';
        }

        results.push(fileResult);
      }
    }

    return results;
  }

  /**
   * Generate summary from test results
   */
  private generateSummary(testResults: TestFileResult[]): TestSummary {
    const summary: TestSummary = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0
    };

    for (const fileResult of testResults) {
      for (const test of fileResult.tests) {
        summary.total++;
        summary.duration += test.duration;

        switch (test.status) {
          case 'passed':
            summary.passed++;
            break;
          case 'failed':
            summary.failed++;
            break;
          case 'skipped':
            summary.skipped++;
            break;
        }
      }
    }

    return summary;
  }

  /**
   * Parse basic results from stdout/stderr when JSON parsing fails
   */
  private parseBasicResults(stdout: string, stderr: string): TestSummary {
    const summary: TestSummary = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0
    };

    // Try to extract basic counts from output
    const output = stdout + stderr;
    
    const passedMatch = output.match(/(\d+) passed/);
    if (passedMatch) summary.passed = parseInt(passedMatch[1]);

    const failedMatch = output.match(/(\d+) failed/);
    if (failedMatch) summary.failed = parseInt(failedMatch[1]);

    const skippedMatch = output.match(/(\d+) skipped/);
    if (skippedMatch) summary.skipped = parseInt(skippedMatch[1]);

    summary.total = summary.passed + summary.failed + summary.skipped;

    return summary;
  }

  /**
   * Generate test artifacts (reports, screenshots, etc.)
   */
  private async generateArtifacts(executionId: string, outputDir: string): Promise<void> {
    const result = this.executionResults.get(executionId)!;
    const execOutputDir = path.join(outputDir, executionId);

    try {
      // Look for common artifact files
      const files = await fs.readdir(execOutputDir, { recursive: true });
      
      for (const file of files) {
        const filePath = path.join(execOutputDir, file as string);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
          const ext = path.extname(file as string).toLowerCase();
          let artifactType: TestArtifact['type'] = 'report';
          
          if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
            artifactType = 'screenshot';
          } else if (ext === '.webm' || ext === '.mp4') {
            artifactType = 'video';
          } else if (file === 'trace.zip') {
            artifactType = 'trace';
          }

          result.artifacts.push({
            type: artifactType,
            path: filePath,
            description: `${artifactType} generated during test execution`
          });
        }
      }
    } catch (error) {
      console.warn('Failed to collect artifacts:', error);
    }
  }

  /**
   * Clean up old execution results and artifacts
   */
  async cleanup(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    const now = new Date().getTime();
    const toDelete: string[] = [];

    for (const [id, result] of this.executionResults.entries()) {
      const age = now - result.startTime.getTime();
      if (age > maxAge) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.executionResults.delete(id);
      
      // Clean up artifacts
      const result = this.executionResults.get(id);
      if (result) {
        for (const artifact of result.artifacts) {
          try {
            await fs.unlink(artifact.path);
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    }
  }
}

// Singleton instance
export const testExecutionPipeline = new TestExecutionPipelineService();