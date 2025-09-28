import { TestWriterAgentConfig } from './TestWriterAgent';
import { BaseAgentConfig } from '../base/BaseAgent';

/**
 * Create default configuration for TestWriterAgent
 */
export function createDefaultTestWriterConfig(
  mistralApiKey: string,
  overrides: Partial<TestWriterAgentConfig> = {}
): TestWriterAgentConfig {
  const baseConfig: BaseAgentConfig = {
    agentType: 'test_writer',
    instanceId: `test-writer-${Date.now()}`,
    nodeId: process.env.NODE_ID || 'localhost',
    
    messageQueue: {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
        db: parseInt(process.env.REDIS_DB || '0')
      },
      queues: {
        default: 'framework:queue:default',
        high: 'framework:queue:high',
        critical: 'framework:queue:critical'
      },
      deadLetterQueue: 'framework:queue:dlq',
      maxRetries: 3,
      retryDelay: 1000
    },
    
    eventBus: {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
        db: parseInt(process.env.REDIS_DB || '0')
      },
      channels: {
        system: 'framework:events:system',
        agents: 'framework:events:agents',
        executions: 'framework:events:executions',
        health: 'framework:events:health'
      }
    },
    
    sharedMemory: {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
        db: parseInt(process.env.REDIS_DB || '0')
      },
      keyPrefix: 'framework:shared',
      defaultTtl: 300
    },
    
    database: {
      path: process.env.DB_PATH || './data/framework.db',
      timeout: 5000,
      verbose: process.env.NODE_ENV === 'development',
      memory: false
    },
    
    healthCheck: {
      intervalMs: 30000,
      timeoutMs: 5000,
      failureThreshold: 3,
      recoveryThreshold: 2
    },
    
    lifecycle: {
      startupTimeoutMs: 60000,
      shutdownTimeoutMs: 30000,
      gracefulShutdownMs: 10000
    },
    
    logging: {
      level: (process.env.LOG_LEVEL as any) || 'info',
      enableMetrics: true,
      enableTracing: process.env.NODE_ENV === 'development'
    }
  };
  
  const defaultConfig: TestWriterAgentConfig = {
    ...baseConfig,
    
    mistral: {
      apiKey: mistralApiKey,
      model: 'mistral-large-latest',
      maxTokens: 4000,
      temperature: 0.3,
      topP: 0.95
    },
    
    testGeneration: {
      maxRetries: 3,
      timeoutMs: 120000, // 2 minutes for test generation
      enableOptimization: true,
      enableValidation: true,
      defaultBrowser: 'chromium',
      defaultViewport: { width: 1920, height: 1080 }
    },
    
    templates: {
      defaultTemplate: 'playwright-pom',
      customTemplates: {}
    }
  };
  
  return {
    ...defaultConfig,
    ...overrides,
    // Deep merge certain objects
    mistral: { ...defaultConfig.mistral, ...overrides.mistral },
    testGeneration: { ...defaultConfig.testGeneration, ...overrides.testGeneration },
    templates: { ...defaultConfig.templates, ...overrides.templates }
  };
}

/**
 * Validate TestWriterAgent configuration
 */
export function validateTestWriterConfig(config: TestWriterAgentConfig): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate Mistral configuration
  if (!config.mistral?.apiKey) {
    errors.push('Mistral API key is required');
  }
  
  if (!config.mistral?.model) {
    errors.push('Mistral model is required');
  }
  
  if (config.mistral?.maxTokens && (config.mistral.maxTokens < 100 || config.mistral.maxTokens > 32000)) {
    warnings.push('Mistral maxTokens should be between 100 and 32000');
  }
  
  if (config.mistral?.temperature !== undefined && (config.mistral.temperature < 0 || config.mistral.temperature > 1)) {
    errors.push('Mistral temperature must be between 0 and 1');
  }
  
  // Validate test generation configuration
  if (config.testGeneration?.maxRetries && config.testGeneration.maxRetries < 0) {
    errors.push('Test generation maxRetries must be non-negative');
  }
  
  if (config.testGeneration?.timeoutMs && config.testGeneration.timeoutMs < 1000) {
    warnings.push('Test generation timeout should be at least 1000ms');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}