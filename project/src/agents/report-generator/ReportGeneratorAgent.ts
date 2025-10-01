import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import BaseAgent, { type BaseAgentConfig } from '../base/BaseAgent';
import type { AgentMessage } from '@app-types/communication';
import { acquireGlobalDatabase } from '@database/GlobalDatabase';
import { ExecutionReportRepository } from '@database/repositories/ExecutionReportRepository';
import { TestReportsRepository } from '@database/repositories/TestReportsRepository';

export type ReportGeneratorAgentConfig = BaseAgentConfig & {
  outputDir?: string; // relative to project root
};

export class ReportGeneratorAgent extends BaseAgent {
  private execRepo!: ExecutionReportRepository;
  private reportsRepo!: TestReportsRepository;
  private outputDir: string;

  constructor(cfg: ReportGeneratorAgentConfig) {
    super({ ...cfg, agentType: 'ReportGenerator' });
    this.outputDir = cfg.outputDir || 'test_execution_reports';
  }

  protected async onInitialize(): Promise<void> {
    const db = acquireGlobalDatabase(this['config'].database).getDatabase();
    this.execRepo = new ExecutionReportRepository(db);
    this.reportsRepo = new TestReportsRepository(db);
  }

  protected async onShutdown(): Promise<void> { /* no-op */ }

  protected getConfigSchema(): object { return {}; }

  protected async processMessage(message: AgentMessage): Promise<void> {
    if (message.messageType !== 'GENERATE_REPORT') return;
    const p: any = message.payload || {};
    const executionId = p.executionId as string;
    if (!executionId) return;
    await this.generateJsonSummary(executionId);
  }

  private async generateJsonSummary(executionId: string) {
    // Gather data
    const reports = await this.execRepo.listByExecution(executionId);
    const summary = {
      executionId,
      reports: reports.map(r => ({ id: r.id, status: r.status, summary: r.summary, report_path: r.report_path })),
      generatedAt: new Date().toISOString(),
    };

  // Write JSON file under <projectRoot>/test_execution_reports
  const projectRoot = process.cwd();
  const outDir = path.resolve(projectRoot, this.outputDir);
    await fs.mkdir(outDir, { recursive: true });
    const fileName = `${executionId}.summary.json`;
    const fullPath = path.join(outDir, fileName);
    await fs.writeFile(fullPath, JSON.stringify(summary, null, 2), 'utf8');

    // Persist row in test_reports
    const id = uuidv4();
  // Persist paths relative to project root so server static mount `/reports-static` resolves correctly
  const relPath = path.relative(projectRoot, fullPath).replace(/\\/g, '/');
    await this.reportsRepo.create({
      id,
      execution_id: executionId,
      type: 'json',
      path: relPath,
      summary: `Auto-generated summary for ${executionId}`,
      created_at: new Date().toISOString(),
      created_by: this['agentId'].type,
    });

    await this.publishEvent('report.generated', { id, executionId, path: relPath, type: 'json' });
  }
}

export default ReportGeneratorAgent;