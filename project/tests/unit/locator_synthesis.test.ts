import { LocatorSynthesisAgent, type LocatorSynthesisAgentConfig } from '../../src/agents/locator-synthesis/LocatorSynthesisAgent';

function makeAgent() {
  const cfg: LocatorSynthesisAgentConfig = {
    agentType: 'LocatorSynthesis',
    messageQueue: { redis: { host: 'localhost', port: 6379, db: 0 }, queues: { default: 'q:d', high: 'q:h', critical: 'q:c' }, deadLetterQueue: 'q:dead', maxRetries: 1, retryDelay: 1000 },
    eventBus: { redis: { host: 'localhost', port: 6379, db: 0 }, channels: { system: 'e:sys', agents: 'e:agt', executions: 'e:exec', health: 'e:hlth' } },
    sharedMemory: { redis: { host: 'localhost', port: 6379, db: 0 }, keyPrefix: 'sm', defaultTtl: 60 },
    database: { path: ':memory:', timeout: 1000, verbose: false, memory: true } as any,
    healthCheck: { intervalMs: 10000, timeoutMs: 3000, failureThreshold: 3, recoveryThreshold: 2 },
    lifecycle: { startupTimeoutMs: 1000, shutdownTimeoutMs: 1000, gracefulShutdownMs: 100 },
    logging: { level: 'error', enableMetrics: false, enableTracing: false },
    heuristics: { preferDataTestId: true, preferRoleSelectors: true },
  };
  return new LocatorSynthesisAgent(cfg);
}

describe('LocatorSynthesisAgent heuristics', () => {
  it('prefers data-testid over other selectors', () => {
    const agent = makeAgent();
    const candidates = agent.synthesize({ tag: 'button', id: 'save', text: 'Save', 'data-testid': 'save-btn' }, {});
    expect(candidates[0].selector).toContain('[data-testid="save-btn"]');
    expect(candidates[0].score).toBeGreaterThan(10);
  });

  it('falls back to role+name and id when no testid', () => {
    const agent = makeAgent();
    const candidates = agent.synthesize({ tag: 'button', id: 'save', role: 'button', name: 'Save' }, {});
    const top = candidates[0].selector;
    expect(top === 'role=button[name=Save]' || top === '#save').toBeTruthy();
  });
});
