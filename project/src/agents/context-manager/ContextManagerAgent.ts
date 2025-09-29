import BaseAgent, { type BaseAgentConfig } from '../base/BaseAgent';
import type { AgentMessage } from '@app-types/communication';

export type ContextManagerAgentConfig = BaseAgentConfig & {
  namespace?: string; // prefix in shared memory
};

export class ContextManagerAgent extends BaseAgent {
  private ns: string;
  constructor(cfg: ContextManagerAgentConfig) {
    super({ ...cfg, agentType: 'ContextManager' });
    this.ns = cfg.namespace || 'ctx';
  }

  protected async onInitialize(): Promise<void> { /* no-op */ }
  protected async onShutdown(): Promise<void> { /* no-op */ }
  protected getConfigSchema(): object { return {}; }

  protected async processMessage(message: AgentMessage): Promise<void> {
    const p: any = message.payload || {};
    switch (message.messageType) {
      case 'GET_CONTEXT':
        await this.handleGet(p);
        break;
      case 'UPDATE_CONTEXT':
        await this.handleUpdate(p);
        break;
      default:
        this['log']('debug', 'Ignoring message', { messageType: message.messageType });
    }
  }

  private async handleGet(p: any) {
    const key = this.key(p.key || 'default');
    const val = await this.sharedMemory.get(key);
    await this.publishEvent('context.get.completed', { key, found: val !== null });
  }

  private async handleUpdate(p: any) {
    const key = this.key(p.key || 'default');
    const ttl = typeof p.ttl === 'number' ? p.ttl : undefined;
    await this.sharedMemory.set(key, p.value, ttl);
    await this.publishEvent('context.update.completed', { key });
  }

  private key(k: string) { return `${this.ns}:${k}`; }
}

export default ContextManagerAgent;
