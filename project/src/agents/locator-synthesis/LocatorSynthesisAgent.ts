import BaseAgent, { type BaseAgentConfig } from '../base/BaseAgent';
import type { AgentMessage } from '@app-types/communication';

export type LocatorSynthesisAgentConfig = BaseAgentConfig & {
  heuristics: {
    preferDataTestId: boolean;
    preferRoleSelectors: boolean;
  };
};

export interface LocatorCandidate {
  selector: string;
  score: number; // higher is better
  rationale: string[];
}

export class LocatorSynthesisAgent extends BaseAgent {
  constructor(private lsConfig: LocatorSynthesisAgentConfig) {
    super(lsConfig);
  }

  protected async onInitialize(): Promise<void> {
    // no-op
  }

  protected async onShutdown(): Promise<void> {
    // no-op
  }

  protected getConfigSchema(): object {
    return { type: 'object', properties: { heuristics: { type: 'object' } } };
  }

  protected async processMessage(message: AgentMessage): Promise<void> {
    if (message.messageType !== 'LOCATOR_SYNTHESIS_REQUEST') return;

    const payload: any = message.payload || {};
    const candidates = this.synthesize(payload.element || {}, payload.context || {});

    // Respond by publishing an event (MVP). In the future we could reply via MQ.
    await this.publishEvent('locator.synthesis.completed', {
      requestId: (payload && payload.requestId) || message.id,
      top: candidates[0],
      candidates,
    });
  }

  public synthesize(element: any, context: any): LocatorCandidate[] {
    const results: LocatorCandidate[] = [];
    const rationales: string[] = [];

    // 1. data-testid
    const dtid = element['data-testid'] || element['data-test-id'] || element['data-test'] || undefined;
    if (dtid) {
      rationales.push('has data-testid');
      results.push({ selector: `[data-testid="${escapeQuotes(String(dtid))}"]`, score: 10, rationale: [...rationales] });
    }

    // 2. role + name
    if (element.role && element.name) {
      results.push({ selector: `role=${escapeQuotes(String(element.role))}[name=${escapeQuotes(String(element.name))}]`, score: 8, rationale: ['has role and name'] });
    }

    // 3. id
    if (element.id) {
      results.push({ selector: `#${cssEscape(String(element.id))}`, score: 7, rationale: ['has id'] });
    }

    // 4. text
    if (element.text && String(element.text).trim().length > 0) {
      const text = String(element.text).trim();
      results.push({ selector: `text=${escapeQuotes(text)}`, score: 5, rationale: ['has text'] });
    }

    // 5. tag + class
    if (element.tag && element.class) {
      const cls = String(element.class).split(/\s+/).filter(Boolean)[0];
      if (cls) results.push({ selector: `${element.tag}.${cssEscape(cls)}`, score: 3, rationale: ['tag and first class'] });
    } else if (element.tag) {
      results.push({ selector: `${element.tag}`, score: 1, rationale: ['tag only'] });
    }

    // Prefer knobs
    if (this.lsConfig.heuristics.preferDataTestId) {
      results.forEach((r) => { if (r.selector.startsWith('[data-testid')) r.score += 5; });
    }
    if (this.lsConfig.heuristics.preferRoleSelectors) {
      results.forEach((r) => { if (r.selector.startsWith('role=')) r.score += 2; });
    }

    // Deduplicate by selector with max score
    const map = new Map<string, LocatorCandidate>();
    for (const c of results) {
      const prev = map.get(c.selector);
      if (!prev || prev.score < c.score) map.set(c.selector, c);
    }

    return Array.from(map.values()).sort((a, b) => b.score - a.score);
  }
}

function escapeQuotes(s: string): string {
  return s.replace(/"/g, '\\"');
}

// Minimal CSS escape for ids/classes
function cssEscape(s: string): string {
  return s.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
}

export default LocatorSynthesisAgent;
