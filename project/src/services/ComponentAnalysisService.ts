// Octokit is ESM; avoid static import so Jest (CJS) environment doesn't choke.
// We only load it dynamically if a GitHub token is present.
import type { Octokit } from '@octokit/rest';

export interface ComponentAnalysis {
  componentName: string;
  componentType: 'functional' | 'class' | 'unknown';
  props: string[];
  hooks: string[];
  elements: ElementInfo[];
  dependencies: string[];
  testSelectors: TestSelector[];
}

export interface ElementInfo {
  tag: string;
  attributes: string[];
  content?: string;
  children?: ElementInfo[];
}

export interface TestSelector {
  type: 'data-testid' | 'role' | 'label' | 'text' | 'css';
  value: string;
  element: string;
  confidence: number;
}

export class ComponentAnalysisService {
  private octokit?: Octokit; // lazily initialized

  private async ensureOctokit(): Promise<Octokit | undefined> {
    if (this.octokit) return this.octokit;
    if (!process.env.GITHUB_TOKEN) return undefined;
    try {
      const mod = await import('@octokit/rest');
      const OctokitCtor: any = (mod as any).Octokit;
      if (OctokitCtor) {
        this.octokit = new OctokitCtor({ auth: process.env.GITHUB_TOKEN });
        return this.octokit;
      }
    } catch (e) {
      // Swallow; component analysis is best-effort.
      // eslint-disable-next-line no-console
      console.warn('Failed dynamic import of @octokit/rest', (e as Error)?.message);
    }
    return undefined;
  }

  /**
   * Analyze a component file from a GitHub repository
   */
  async analyzeComponentFromGitHub(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<ComponentAnalysis | null> {
    const octokit = await this.ensureOctokit();
    if (!octokit) return null;

    try {
  const response = await octokit.repos.getContent({
        owner,
        repo,
        path,
        ref
      });

      if ('content' in response.data && response.data.content) {
        const content = Buffer.from(response.data.content, 'base64').toString('utf8');
        return this.analyzeComponentContent(content, path);
      }
    } catch (error) {
      console.error('Error fetching component from GitHub:', error);
    }

    return null;
  }

  /**
   * Analyze component content
   */
  analyzeComponentContent(content: string, filePath: string): ComponentAnalysis {
    const fileName = filePath.split('/').pop() || filePath;
    const componentName = fileName.replace(/\.(jsx?|tsx?)$/, '');

    const analysis: ComponentAnalysis = {
      componentName,
      componentType: this.detectComponentType(content),
      props: this.extractProps(content),
      hooks: this.extractHooks(content),
      elements: this.extractElements(content),
      dependencies: this.extractDependencies(content),
      testSelectors: []
    };

    // Generate test selectors based on the analysis
    analysis.testSelectors = this.generateTestSelectors(analysis);

    return analysis;
  }

  /**
   * Detect if component is functional or class-based
   */
  private detectComponentType(content: string): 'functional' | 'class' | 'unknown' {
    if (content.includes('extends React.Component') || content.includes('extends Component')) {
      return 'class';
    }
    if (content.includes('const ') && content.includes('=> {') || content.includes('function ')) {
      return 'functional';
    }
    return 'unknown';
  }

  /**
   * Extract props from component
   */
  private extractProps(content: string): string[] {
    const props: string[] = [];
    
    // Look for TypeScript interface definitions
    const interfaceMatch = content.match(/interface\s+\w+Props\s*{([^}]+)}/);
    if (interfaceMatch) {
      const propsBody = interfaceMatch[1];
      const propMatches = propsBody.match(/(\w+)(?:\?)?:/g);
      if (propMatches) {
        props.push(...propMatches.map(p => p.replace(/[?:]/g, '')));
      }
    }

    // Look for destructuring in function parameters
    const destructuringMatch = content.match(/\(\s*{\s*([^}]+)\s*}\s*\)/);
    if (destructuringMatch) {
      const destructuredProps = destructuringMatch[1]
        .split(',')
        .map(p => p.trim().split(/[=:]/)[0].trim());
      props.push(...destructuredProps);
    }

    return [...new Set(props)]; // Remove duplicates
  }

  /**
   * Extract React hooks usage
   */
  private extractHooks(content: string): string[] {
    const hooks: string[] = [];
    const hookPatterns = [
      /useState/g,
      /useEffect/g,
      /useContext/g,
      /useReducer/g,
      /useMemo/g,
      /useCallback/g,
      /useRef/g,
      /useLayoutEffect/g,
      /useImperativeHandle/g,
      /useDebugValue/g,
      /use\w+/g // Custom hooks
    ];

    hookPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        hooks.push(...matches);
      }
    });

    return [...new Set(hooks)];
  }

  /**
   * Extract JSX elements and their attributes
   */
  private extractElements(content: string): ElementInfo[] {
    const elements: ElementInfo[] = [];
    
    // Simple JSX element extraction (can be enhanced with proper AST parsing)
    const jsxPattern = /<(\w+)([^>]*?)(?:\/>|>.*?<\/\1>)/gs;
    let match;

    while ((match = jsxPattern.exec(content)) !== null) {
      const tag = match[1];
      const attributesString = match[2];
      const attributes = this.extractAttributes(attributesString);

      elements.push({
        tag,
        attributes,
        content: match[0]
      });
    }

    return elements;
  }

  /**
   * Extract attributes from JSX element
   */
  private extractAttributes(attributesString: string): string[] {
    const attributes: string[] = [];
    const attrPattern = /(\w+)(?:=(?:"[^"]*"|'[^']*'|{[^}]*}))?/g;
    let match;

    while ((match = attrPattern.exec(attributesString)) !== null) {
      attributes.push(match[1]);
    }

    return attributes;
  }

  /**
   * Extract import dependencies
   */
  private extractDependencies(content: string): string[] {
    const dependencies: string[] = [];
    const importPattern = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importPattern.exec(content)) !== null) {
      dependencies.push(match[1]);
    }

    return dependencies;
  }

  /**
   * Generate test selectors based on component analysis
   */
  private generateTestSelectors(analysis: ComponentAnalysis): TestSelector[] {
    const selectors: TestSelector[] = [];

    analysis.elements.forEach(element => {
      // Check for data-testid attributes
      if (element.attributes.some(attr => attr.includes('data-testid'))) {
        selectors.push({
          type: 'data-testid',
          value: `[data-testid="${analysis.componentName.toLowerCase()}-${element.tag}"]`,
          element: element.tag,
          confidence: 0.9
        });
      }

      // Generate role-based selectors for semantic elements
      const roleSelectors = this.generateRoleSelectors(element);
      selectors.push(...roleSelectors);

      // Generate text-based selectors for elements with text content
      if (element.content && element.content.includes('>') && element.content.includes('<')) {
        const textContent = element.content.match(/>([^<]+)</);
        if (textContent && textContent[1].trim()) {
          selectors.push({
            type: 'text',
            value: `text=${textContent[1].trim()}`,
            element: element.tag,
            confidence: 0.6
          });
        }
      }
    });

    // Add component-level selectors
    selectors.push({
      type: 'data-testid',
      value: `[data-testid="${analysis.componentName.toLowerCase()}"]`,
      element: 'component',
      confidence: 0.8
    });

    return selectors;
  }

  /**
   * Generate role-based selectors for semantic elements
   */
  private generateRoleSelectors(element: ElementInfo): TestSelector[] {
    const selectors: TestSelector[] = [];
    const roleMap: Record<string, string> = {
      'button': 'button',
      'a': 'link',
      'input': 'textbox',
      'textarea': 'textbox',
      'select': 'combobox',
      'h1': 'heading',
      'h2': 'heading',
      'h3': 'heading',
      'h4': 'heading',
      'h5': 'heading',
      'h6': 'heading',
      'nav': 'navigation',
      'main': 'main',
      'article': 'article',
      'section': 'region',
      'aside': 'complementary',
      'header': 'banner',
      'footer': 'contentinfo'
    };

    const role = roleMap[element.tag.toLowerCase()];
    if (role) {
      selectors.push({
        type: 'role',
        value: `getByRole('${role}')`,
        element: element.tag,
        confidence: 0.8
      });
    }

    return selectors;
  }

  /**
   * Parse repository URL to extract owner and repo
   */
  parseRepoUrl(repoUrl: string): { owner: string; repo: string } | null {
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, '').replace(/\/tree\/.*$/, '')
      };
    }
    return null;
  }

  /**
   * Analyze multiple components from changed files
   */
  async analyzeChangedComponents(
    repoUrl: string,
    changedFiles: string[],
    ref?: string
  ): Promise<ComponentAnalysis[]> {
    const repoInfo = this.parseRepoUrl(repoUrl);
    if (!repoInfo) {
      return [];
    }

    const analyses: ComponentAnalysis[] = [];
    
    for (const filePath of changedFiles) {
      if (filePath.match(/\.(jsx?|tsx?)$/)) {
        const analysis = await this.analyzeComponentFromGitHub(
          repoInfo.owner,
          repoInfo.repo,
          filePath,
          ref
        );
        if (analysis) {
          analyses.push(analysis);
        }
      }
    }

    return analyses;
  }
}

// Singleton instance
export const componentAnalysisService = new ComponentAnalysisService();