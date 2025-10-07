import BaseAgent, { type BaseAgentConfig } from '../base/BaseAgent';
import type { AgentMessage } from '@app-types/communication';
import { v4 as uuidv4 } from 'uuid';
import { LocatorCandidatesRepository } from '@database/repositories/LocatorCandidatesRepository';
import { ComponentAnalysisService, type ComponentAnalysis } from '../../services/ComponentAnalysisService';

export type LocatorSynthesisAgentConfig = BaseAgentConfig & {
  heuristics: {
    preferDataTestId: boolean;
    preferRoleSelectors: boolean;
    enableComponentAnalysis?: boolean;
  };
};

export interface LocatorCandidate {
  selector: string;
  score: number; // higher is better
  rationale: string[];
}

export class LocatorSynthesisAgent extends BaseAgent {
  private componentAnalysisService?: ComponentAnalysisService;

  constructor(private lsConfig: LocatorSynthesisAgentConfig) {
    super(lsConfig);
    
    // Initialize component analysis service if enabled
    if (this.lsConfig.heuristics.enableComponentAnalysis) {
      this.componentAnalysisService = new ComponentAnalysisService();
    }
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
    
    // Optional component analysis if enabled
    let componentInfo: ComponentAnalysis | undefined;
    if (this.lsConfig.heuristics.enableComponentAnalysis && payload.url) {
      try {
        // Parse GitHub URL to extract owner, repo, and path
        const urlMatch = payload.url.match(/github\.com\/([^\/]+)\/([^\/]+)\/blob\/[^\/]+\/(.+)/);
        if (urlMatch) {
          const [, owner, repo, path] = urlMatch;
          const result = await this.componentAnalysisService?.analyzeComponentFromGitHub(owner, repo, path);
          componentInfo = result || undefined; // Convert null to undefined
        }
      } catch (error) {
        this.log('warn', 'Component analysis failed', { error: (error as Error)?.message });
        // Continue without component analysis
      }
    }

    const context = { 
      ...(payload.context || {}),
      componentInfo 
    };
    
    const candidates = this.synthesize(payload.element || {}, context);

    // Persist candidates for auditability
    try {
      await this.database.initialize();
      const repo = new LocatorCandidatesRepository(this.database.getDatabase());
      await repo.create({
        id: uuidv4(),
        request_id: payload?.requestId || message.id,
        element_description: JSON.stringify(payload.element || {}),
        candidates,
        chosen: candidates[0] || null,
        created_at: new Date().toISOString(),
        created_by: this.agentId.type,
      });
    } catch (e) {
      this.log('warn', 'Failed to persist locator candidates', { error: (e as Error)?.message });
    }

    // Always publish event for observability
    const response = {
      requestId: (payload && payload.requestId) || message.id,
      top: candidates[0],
      candidates,
      componentAnalysis: componentInfo, // Include analysis data in response
      context
    };
    await this.publishEvent('locator.synthesis.completed', response);

    // If optimizationContext present, send direct message to optimizer
    const optCtx = context?.optimizationContext;
    if (optCtx) {
      try {
        await this.sendMessage({
          target: { type: 'TestOptimizer' },
          messageType: 'LOCATOR_CANDIDATES',
            payload: { candidates: candidates.map(c => c.selector), context }
        });
      } catch (e) {
        this.log('warn', 'Failed to send LOCATOR_CANDIDATES', { error: (e as Error)?.message });
      }
    }
  }

  public synthesize(element: any, context: any): LocatorCandidate[] {
    const results: LocatorCandidate[] = [];
    const rationales: string[] = [];

    // Enhanced analysis using component analysis if available
    if (this.lsConfig.heuristics.enableComponentAnalysis && context.componentInfo) {
      const componentSelectors = this.generateComponentAwareSelectors(element, context.componentInfo);
      results.push(...componentSelectors);
    }

    // 1. data-testid (highest priority)
    const dtid = element['data-testid'] || element['data-test-id'] || element['data-test'] || undefined;
    if (dtid) {
      rationales.push('has data-testid');
      results.push({ 
        selector: `[data-testid="${escapeQuotes(String(dtid))}"]`, 
        score: 10, 
        rationale: [...rationales] 
      });
    }

    // 2. role + name (semantic selectors)
    if (element.role && element.name) {
      results.push({ 
        selector: `role=${escapeQuotes(String(element.role))}[name=${escapeQuotes(String(element.name))}]`, 
        score: 8, 
        rationale: ['has role and name'] 
      });
    }

    // 3. role only
    if (element.role) {
      results.push({ 
        selector: `role=${escapeQuotes(String(element.role))}`, 
        score: 7, 
        rationale: ['has role'] 
      });
    }

    // 4. aria-label
    if (element['aria-label']) {
      results.push({ 
        selector: `[aria-label="${escapeQuotes(String(element['aria-label']))}"]`, 
        score: 7, 
        rationale: ['has aria-label'] 
      });
    }

    // 5. id
    if (element.id) {
      results.push({ 
        selector: `#${cssEscape(String(element.id))}`, 
        score: 6, 
        rationale: ['has id'] 
      });
    }

    // 6. name attribute (for form elements)
    if (element.name) {
      results.push({ 
        selector: `[name="${escapeQuotes(String(element.name))}"]`, 
        score: 6, 
        rationale: ['has name attribute'] 
      });
    }

    // 7. text content
    if (element.text && String(element.text).trim().length > 0) {
      const text = String(element.text).trim();
      if (text.length <= 50) { // Only use text for short content
        results.push({ 
          selector: `text=${escapeQuotes(text)}`, 
          score: 5, 
          rationale: ['has text content'] 
        });
      }
    }

    // 8. placeholder (for input elements)
    if (element.placeholder) {
      results.push({ 
        selector: `[placeholder="${escapeQuotes(String(element.placeholder))}"]`, 
        score: 4, 
        rationale: ['has placeholder'] 
      });
    }

    // 9. tag + class combination
    if (element.tag && element.class) {
      const classes = String(element.class).split(/\s+/).filter(Boolean);
      if (classes.length > 0) {
        const primaryClass = classes[0];
        results.push({ 
          selector: `${element.tag}.${cssEscape(primaryClass)}`, 
          score: 3, 
          rationale: ['tag and primary class'] 
        });
        
        // Multiple classes for more specificity
        if (classes.length > 1) {
          const multiClassSelector = `${element.tag}.${classes.map(c => cssEscape(c)).join('.')}`;
          results.push({ 
            selector: multiClassSelector, 
            score: 4, 
            rationale: ['tag and multiple classes'] 
          });
        }
      }
    } else if (element.tag) {
      results.push({ 
        selector: `${element.tag}`, 
        score: 1, 
        rationale: ['tag only (least specific)'] 
      });
    }

    // Apply heuristic preferences
    if (this.lsConfig.heuristics.preferDataTestId) {
      results.forEach((r) => { 
        if (r.selector.includes('[data-testid') || r.selector.includes('[data-test')) {
          r.score += 5;
          r.rationale.push('preferred: data-testid');
        }
      });
    }
    
    if (this.lsConfig.heuristics.preferRoleSelectors) {
      results.forEach((r) => { 
        if (r.selector.startsWith('role=') || r.selector.includes('[role=')) {
          r.score += 2;
          r.rationale.push('preferred: role selector');
        }
      });
    }

    // Deduplicate by selector with max score
    const map = new Map<string, LocatorCandidate>();
    for (const c of results) {
      const prev = map.get(c.selector);
      if (!prev || prev.score < c.score) {
        map.set(c.selector, c);
      }
    }

    return Array.from(map.values()).sort((a, b) => b.score - a.score);
  }

  /**
   * Generate component-aware selectors using analysis data
   */
  private generateComponentAwareSelectors(element: any, componentInfo: ComponentAnalysis): LocatorCandidate[] {
    const selectors: LocatorCandidate[] = [];

    // Use high-confidence selectors from component analysis
    const highConfidenceSelectors = componentInfo.testSelectors.filter(s => s.confidence > 0.7);
    
    for (const selector of highConfidenceSelectors) {
      let score = Math.floor(selector.confidence * 10);
      const rationale = [`component analysis: ${selector.type}`, `confidence: ${selector.confidence}`];
      
      // Boost score for data-testid selectors
      if (selector.type === 'data-testid') {
        score += 3;
        rationale.push('component-specific data-testid');
      }
      
      // Boost score for role selectors
      if (selector.type === 'role') {
        score += 2;
        rationale.push('semantic role selector');
      }

      selectors.push({
        selector: selector.value,
        score,
        rationale
      });
    }

    // Generate component-specific selectors based on component type
    if (componentInfo.componentName) {
      const componentName = componentInfo.componentName.toLowerCase();
      
      // Add component-scoped selectors
      if (element.tag) {
        selectors.push({
          selector: `[data-component="${componentName}"] ${element.tag}`,
          score: 6,
          rationale: ['component-scoped selector']
        });
      }
      
      // Add component-specific test IDs if not already present
      if (!element['data-testid']) {
        const suggestedTestId = `${componentName}-${element.tag || 'element'}`;
        selectors.push({
          selector: `[data-testid="${suggestedTestId}"]`,
          score: 9,
          rationale: ['suggested component test ID']
        });
      }
    }

    return selectors;
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
