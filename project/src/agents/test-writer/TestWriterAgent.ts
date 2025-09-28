import type { BaseAgentConfig } from '../base/BaseAgent';

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

// Optional stub class to retain structure; not used in builds
export class TestWriterAgent {}
