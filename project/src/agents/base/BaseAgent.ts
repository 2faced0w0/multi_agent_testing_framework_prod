import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AgentIdentifier, AgentMessage, SystemEvent } from '@app-types/communication';
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'offline';
import { MessageQueue } from '@communication/MessageQueue';
import { EventBus } from '@communication/EventBus';
import { SharedMemory } from '@communication/SharedMemory';
import { DatabaseManager } from '@database/DatabaseManager';
import { acquireGlobalDatabase, releaseGlobalDatabase } from '@database/GlobalDatabase';

/**
 * Configuration interface for BaseAgent
 */
export interface BaseAgentConfig {
  // Agent Identity
  agentType: AgentIdentifier['type'];
  instanceId?: string;
  nodeId?: string;
  
  // Communication
  messageQueue: {
    redis: {
      host: string;
      port: number;
      password?: string;
      db: number;
    };
    queues: {
      default: string;
      high: string;
      critical: string;
    };
    deadLetterQueue: string;
    maxRetries: number;
    retryDelay: number;
  };
  
  eventBus: {
    redis: {
      host: string;
      port: number;
      password?: string;
      db: number;
    };
    channels: {
      system: string;
      agents: string;
      executions: string;
      health: string;
    };
  };
  
  sharedMemory: {
    redis: {
      host: string;
      port: number;
      password?: string;
      db: number;
    };
    keyPrefix: string;
    defaultTtl: number;
  };
  
  // Database
  database: {
    path: string;
    timeout: number;
    verbose: boolean;
    memory: boolean;
  };
  
  // Health Monitoring
  healthCheck: {
    intervalMs: number;
    timeoutMs: number;
    failureThreshold: number;
    recoveryThreshold: number;
  };
  
  // Lifecycle
  lifecycle: {
    startupTimeoutMs: number;
    shutdownTimeoutMs: number;
    gracefulShutdownMs: number;
  };
  
  // Logging
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableMetrics: boolean;
    enableTracing: boolean;
  };
}

/**
 * Health check result interface
 */
export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: Date;
  checks: {
    database: { status: HealthStatus; latency: number; error?: string };
    messageQueue: { status: HealthStatus; latency: number; error?: string };
    eventBus: { status: HealthStatus; latency: number; error?: string };
    sharedMemory: { status: HealthStatus; latency: number; error?: string };
  };
  metrics: {
    messagesProcessed: number;
    errorsCount: number;
    averageProcessingTime: number;
    memoryUsage: NodeJS.MemoryUsage;
  };
}

/**
 * Agent metrics interface
 */
export interface AgentMetrics {
  startTime: Date;
  messagesProcessed: number;
  messagesAcknowledged: number;
  messagesFailed: number;
  errorsCount: number;
  lastError?: Error;
  averageProcessingTime: number;
  currentStatus: HealthStatus;
  lifecycleEvents: string[];
}

/**
 * Abstract base class for all agents in the Multi-Agent Testing Framework
 * 
 * Provides common functionality:
 * - Message processing and communication
 * - Health monitoring and metrics
 * - Lifecycle management
 * - Error handling and recovery
 * - Logging and tracing
 */
export abstract class BaseAgent extends EventEmitter {
  // Agent Identity
  protected readonly agentId: AgentIdentifier;
  protected readonly config: BaseAgentConfig;
  
  // Communication Components
  protected messageQueue: MessageQueue;
  protected eventBus: EventBus;
  protected sharedMemory: SharedMemory;
  
  // Data Layer
  protected database: DatabaseManager;
  
  // Health and Metrics
  protected healthStatus: HealthStatus = 'healthy';
  protected metrics: AgentMetrics;
  private healthCheckInterval: NodeJS.Timeout | undefined;
  private healthFailureCount = 0;
  private healthSuccessCount = 0;
  
  // Lifecycle Management
  private isInitialized = false;
  private isShuttingDown = false;
  private startupPromise?: Promise<void>;
  private shutdownPromise?: Promise<void>;
  
  // Error Handling
  private circuitBreakerOpen = false;
  private lastCircuitBreakerReset = new Date();
  private onUncaughtException: ((error: unknown) => void) | undefined;
  private onUnhandledRejection: ((reason: unknown) => void) | undefined;
  
  constructor(config: BaseAgentConfig) {
    super();
    
    this.config = config;
    this.agentId = {
      type: config.agentType,
      instanceId: config.instanceId || uuidv4(),
      nodeId: config.nodeId || process.env.NODE_ID || 'localhost'
    };
    
    // Initialize metrics
    this.metrics = {
      startTime: new Date(),
      messagesProcessed: 0,
      messagesAcknowledged: 0,
      messagesFailed: 0,
      errorsCount: 0,
      averageProcessingTime: 0,
      currentStatus: 'healthy',
      lifecycleEvents: []
    };
    
    // Initialize communication components
    this.messageQueue = new MessageQueue(config.messageQueue);
    this.eventBus = new EventBus(config.eventBus);
    this.sharedMemory = new SharedMemory(config.sharedMemory);
  // Reuse a global DB manager to ensure all components share the same DB connection during a process
  this.database = acquireGlobalDatabase(config.database);
    
    // Setup error handlers
    this.setupErrorHandlers();
    
    this.log('info', 'BaseAgent instance created', { agentId: this.agentId });
  }

  /**
   * Initialize the agent and all its components
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Agent is already initialized');
    }
    
    if (this.startupPromise) {
      return this.startupPromise;
    }
    
    this.startupPromise = this.performInitialization();
    return this.startupPromise;
  }
  
  private async performInitialization(): Promise<void> {
    const startTime = Date.now();
    this.addLifecycleEvent('initialization_started');
    
    try {
      // Initialize in specific order to handle dependencies
      this.log('info', 'Initializing agent components...');
      
      // 1. Database first (needed for configuration and state)
      await this.database.initialize();
      this.log('debug', 'Database initialized');
      
      // 2. Communication layer
      await Promise.all([
        this.messageQueue.initialize(),
        this.eventBus.initialize(),
        this.sharedMemory.initialize()
      ]);
      this.log('debug', 'Communication layer initialized');
      
      // 3. Setup message processing
      await this.setupMessageProcessing();
      this.log('debug', 'Message processing setup complete');
      
      // 4. Agent-specific initialization
      await this.onInitialize();
      this.log('debug', 'Agent-specific initialization complete');
      
      // 5. Start health monitoring
      this.startHealthMonitoring();
      
      // 6. Publish startup event
      await this.publishLifecycleEvent('agent_started');
      
      this.isInitialized = true;
      this.healthStatus = 'healthy';
      this.addLifecycleEvent('initialization_completed');
      
      const initTime = Date.now() - startTime;
      this.log('info', 'Agent initialization completed', { 
        agentId: this.agentId,
        initializationTime: initTime
      });
      
    } catch (error) {
      this.addLifecycleEvent('initialization_failed');
      this.healthStatus = 'unhealthy';
      this.handleError('Agent initialization failed', error as Error);
      throw error;
    }
  }

  /**
   * Gracefully shutdown the agent
   */
  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return this.shutdownPromise || Promise.resolve();
    }
    
    this.isShuttingDown = true;
    this.shutdownPromise = this.performShutdown();
    return this.shutdownPromise;
  }
  
  private async performShutdown(): Promise<void> {
    const startTime = Date.now();
    this.addLifecycleEvent('shutdown_started');
    
    try {
      this.log('info', 'Starting agent shutdown...');
      
      // 1. Stop accepting new messages
      this.healthStatus = 'offline';
      
      // 2. Stop health monitoring
      this.stopHealthMonitoring();

      // 2.5. Remove process-level error handlers added by this instance
      this.removeErrorHandlers();
      
      // 3. Publish shutdown event
      await this.publishLifecycleEvent('agent_stopping');
      
      // 4. Agent-specific cleanup
      await this.onShutdown();
      
      // 5. Close communication components
      await Promise.all([
        this.messageQueue.close(),
        this.eventBus.close(),
        this.sharedMemory.close()
      ]);
      
      // 6. Close database connection
  await releaseGlobalDatabase();
      
      this.addLifecycleEvent('shutdown_completed');
      const shutdownTime = Date.now() - startTime;
      
      this.log('info', 'Agent shutdown completed', { 
        agentId: this.agentId,
        shutdownTime 
      });
      
    } catch (error) {
      this.addLifecycleEvent('shutdown_failed');
      this.handleError('Agent shutdown failed', error as Error);
      throw error;
    }
  }

  /**
   * Get current health status
   */
  public async getHealth(): Promise<HealthCheckResult> {
    try {
      // Perform health checks on all components
      const [dbHealth, mqHealth, ebHealth, smHealth] = await Promise.all([
        this.checkDatabaseHealth(),
        this.checkMessageQueueHealth(),
        this.checkEventBusHealth(),
        this.checkSharedMemoryHealth()
      ]);
      
      // Determine overall status
      const allChecks = [dbHealth, mqHealth, ebHealth, smHealth];
      const overallStatus = this.determineOverallHealth(allChecks.map(c => c.status));
      
      const result: HealthCheckResult = {
        status: overallStatus,
        timestamp: new Date(),
        checks: {
          database: dbHealth,
          messageQueue: mqHealth,
          eventBus: ebHealth,
          sharedMemory: smHealth
        },
        metrics: {
          messagesProcessed: this.metrics.messagesProcessed,
          errorsCount: this.metrics.errorsCount,
          averageProcessingTime: this.metrics.averageProcessingTime,
          memoryUsage: process.memoryUsage()
        }
      };
      
      return result;
      
    } catch (error) {
      this.handleError('Health check failed', error as Error);
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        checks: {
          database: { status: 'unhealthy', latency: 0, error: 'Health check failed' },
          messageQueue: { status: 'unhealthy', latency: 0, error: 'Health check failed' },
          eventBus: { status: 'unhealthy', latency: 0, error: 'Health check failed' },
          sharedMemory: { status: 'unhealthy', latency: 0, error: 'Health check failed' }
        },
        metrics: {
          messagesProcessed: this.metrics.messagesProcessed,
          errorsCount: this.metrics.errorsCount,
          averageProcessingTime: this.metrics.averageProcessingTime,
          memoryUsage: process.memoryUsage()
        }
      };
    }
  }

  /**
   * Get current agent metrics
   */
  public getMetrics(): AgentMetrics {
    return { ...this.metrics };
  }

  /**
   * Send a message to another agent
   */
  protected async sendMessage(message: Omit<AgentMessage, 'id' | 'source' | 'timestamp'>): Promise<string> {
    try {
      const fullMessage: AgentMessage = {
        id: uuidv4(),
        source: this.agentId,
        timestamp: new Date(),
        ...message
      };
      
      await this.messageQueue.sendMessage(fullMessage);
      this.log('debug', 'Message sent', { messageId: fullMessage.id, target: message.target });
      
      return fullMessage.id;
      
    } catch (error) {
      this.handleError('Failed to send message', error as Error);
      throw error;
    }
  }

  /**
   * Publish a system event
   */
  protected async publishEvent(eventType: string, data: any, category: 'system' | 'business' | 'security' | 'performance' = 'system'): Promise<void> {
    try {
      const event: SystemEvent = {
        eventId: uuidv4(),
        eventType,
        version: '1.0.0',
        source: {
          service: 'multi-agent-framework',
          component: this.agentId.type,
          instance: this.agentId.instanceId,
          version: '1.0.0'
        },
        timestamp: new Date(),
        data,
        tags: [this.agentId.type],
        severity: 'info',
        category
      };
      
      await this.eventBus.publishEvent(event);
      this.log('debug', 'Event published', { eventType, category });
      
    } catch (error) {
      this.handleError('Failed to publish event', error as Error);
      throw error;
    }
  }

  // Abstract methods that must be implemented by concrete agent classes
  
  /**
   * Process an incoming message
   */
  protected abstract processMessage(message: AgentMessage): Promise<void>;
  
  /**
   * Agent-specific initialization logic
   */
  protected abstract onInitialize(): Promise<void>;
  
  /**
   * Agent-specific shutdown logic
   */
  protected abstract onShutdown(): Promise<void>;
  
  /**
   * Get agent-specific configuration schema
   */
  protected abstract getConfigSchema(): object;

  // Private helper methods
  
  private async setupMessageProcessing(): Promise<void> {
    // Message processing will be handled by external message consumer
    // that calls handleIncomingMessage when messages arrive
    this.log('debug', 'Message processing setup complete - awaiting external message consumer');
  }
  
  /**
   * Handle incoming message (called by external message consumer)
   */
  public async handleIncomingMessage(message: AgentMessage): Promise<void> {
    if (this.circuitBreakerOpen) {
      this.log('warn', 'Circuit breaker open, rejecting message', { messageId: message.id });
      return;
    }
    
    const startTime = Date.now();
    
    try {
      this.log('debug', 'Processing message', { messageId: message.id, messageType: message.messageType });
      
      // Process the message
      await this.processMessage(message);
      
      // Acknowledge successful processing
      await this.messageQueue.acknowledgeMessage(message.id);
      
      // Update metrics
      const processingTime = Date.now() - startTime;
      this.updateMetrics(true, processingTime);
      
      this.log('debug', 'Message processed successfully', { 
        messageId: message.id, 
        processingTime 
      });
      
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      this.handleError('Message processing failed', error as Error, { messageId: message.id });
      
      // Consider opening circuit breaker if too many failures
      this.evaluateCircuitBreaker();
      
      // Mark message as failed so MQ can retry or route to DLQ
      try {
        await this.messageQueue.failMessage(message.id, message);
      } catch (failErr) {
        this.log('error', 'Failed to mark message as failed in MQ', { messageId: message.id, error: (failErr as Error)?.message });
      }
    }
  }
  
  private setupErrorHandlers(): void {
    // Handle uncaught exceptions
    this.onUncaughtException = (error: unknown) => {
      this.handleError('Uncaught exception', error as Error);
    };
    process.on('uncaughtException', this.onUncaughtException);
    
    // Handle unhandled promise rejections
    this.onUnhandledRejection = (reason: unknown) => {
      this.handleError('Unhandled promise rejection', new Error(String(reason)));
    };
    process.on('unhandledRejection', this.onUnhandledRejection as any);
    
    // Component error handling will be managed internally by each component
    this.log('debug', 'Error handlers setup complete');
  }

  private removeErrorHandlers(): void {
    if (this.onUncaughtException) {
      process.removeListener('uncaughtException', this.onUncaughtException);
      this.onUncaughtException = undefined;
    }
    if (this.onUnhandledRejection) {
      process.removeListener('unhandledRejection', this.onUnhandledRejection as any);
      this.onUnhandledRejection = undefined;
    }
  }
  
  private handleError(context: string, error: Error, metadata?: any): void {
    this.metrics.errorsCount++;
    this.metrics.lastError = error;
    
    this.log('error', context, { error: error.message, stack: error.stack, metadata });
    
    // Emit error event for external handling
    this.emit('error', { context, error, metadata, agentId: this.agentId });
    
    // Update health status if too many errors
    if (this.metrics.errorsCount > 10) {
      this.healthStatus = 'degraded';
    }
  }
  
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(
      () => this.performHealthCheck(),
      this.config.healthCheck.intervalMs
    );
  }
  
  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }
  
  private async performHealthCheck(): Promise<void> {
    try {
      const health = await this.getHealth();
      
      if (health.status === 'healthy') {
        this.healthSuccessCount++;
        this.healthFailureCount = 0;
        
        if (this.healthStatus !== 'healthy' && this.healthSuccessCount >= this.config.healthCheck.recoveryThreshold) {
          this.healthStatus = 'healthy';
          await this.publishEvent('agent.health.recovered', { agentId: this.agentId });
        }
      } else {
        this.healthFailureCount++;
        this.healthSuccessCount = 0;
        
        if (this.healthFailureCount >= this.config.healthCheck.failureThreshold) {
          this.healthStatus = health.status;
          await this.publishEvent('agent.health.degraded', { 
            agentId: this.agentId, 
            status: health.status,
            failures: this.healthFailureCount
          });
        }
      }
      
      this.metrics.currentStatus = this.healthStatus;
      
    } catch (error) {
      this.handleError('Health check failed', error as Error);
    }
  }
  
  private async checkDatabaseHealth(): Promise<{ status: HealthStatus; latency: number; error?: string }> {
    const start = Date.now();
    try {
      const healthy = await this.database.healthCheck();
      return {
        status: healthy ? 'healthy' : 'unhealthy',
        latency: Date.now() - start
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  private async checkMessageQueueHealth(): Promise<{ status: HealthStatus; latency: number; error?: string }> {
    const start = Date.now();
    try {
      const stats = await this.messageQueue.getQueueStats();
      return {
        status: stats ? 'healthy' : 'unhealthy',
        latency: Date.now() - start
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  private async checkEventBusHealth(): Promise<{ status: HealthStatus; latency: number; error?: string }> {
    const start = Date.now();
    try {
      const stats = await this.eventBus.getSubscriptionStats();
      return {
        status: stats ? 'healthy' : 'unhealthy',
        latency: Date.now() - start
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  private async checkSharedMemoryHealth(): Promise<{ status: HealthStatus; latency: number; error?: string }> {
    const start = Date.now();
    try {
      const stats = await this.sharedMemory.getConnectionStats();
      return {
        status: stats ? 'healthy' : 'unhealthy',
        latency: Date.now() - start
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  private determineOverallHealth(statuses: HealthStatus[]): HealthStatus {
    if (statuses.some(s => s === 'offline')) return 'offline';
    if (statuses.some(s => s === 'unhealthy')) return 'unhealthy';
    if (statuses.some(s => s === 'degraded')) return 'degraded';
    return 'healthy';
  }
  
  private updateMetrics(success: boolean, processingTime: number): void {
    this.metrics.messagesProcessed++;
    
    if (success) {
      this.metrics.messagesAcknowledged++;
    } else {
      this.metrics.messagesFailed++;
    }
    
    // Update average processing time
    const total = this.metrics.averageProcessingTime * (this.metrics.messagesProcessed - 1);
    this.metrics.averageProcessingTime = (total + processingTime) / this.metrics.messagesProcessed;
  }
  
  private evaluateCircuitBreaker(): void {
    const failureRate = this.metrics.messagesFailed / Math.max(this.metrics.messagesProcessed, 1);
    const timeSinceLastReset = Date.now() - this.lastCircuitBreakerReset.getTime();
    
    // Open circuit breaker if failure rate is too high
    if (failureRate > 0.5 && this.metrics.messagesProcessed > 10) {
      this.circuitBreakerOpen = true;
      this.log('warn', 'Circuit breaker opened', { failureRate, messagesProcessed: this.metrics.messagesProcessed });
    }
    
    // Reset circuit breaker after timeout
    if (this.circuitBreakerOpen && timeSinceLastReset > 60000) { // 1 minute
      this.circuitBreakerOpen = false;
      this.lastCircuitBreakerReset = new Date();
      this.log('info', 'Circuit breaker reset');
    }
  }
  
  private addLifecycleEvent(event: string): void {
    this.metrics.lifecycleEvents.push(`${new Date().toISOString()}: ${event}`);
    
    // Keep only last 50 events
    if (this.metrics.lifecycleEvents.length > 50) {
      this.metrics.lifecycleEvents = this.metrics.lifecycleEvents.slice(-50);
    }
  }
  
  private async publishLifecycleEvent(eventType: string): Promise<void> {
    await this.publishEvent(`agent.lifecycle.${eventType}`, {
      agentId: this.agentId,
      timestamp: new Date(),
      metrics: this.getMetrics()
    });
  }
  
  protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string, metadata?: any): void {
    if (this.shouldLog(level)) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        level: level.toUpperCase(),
        agent: this.agentId,
        message,
        ...metadata
      };
      
      console[level === 'debug' ? 'log' : level](JSON.stringify(logEntry));
    }
  }
  
  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.logging.level);
    const requestedLevelIndex = levels.indexOf(level);
    
    return requestedLevelIndex >= currentLevelIndex;
  }
}

export default BaseAgent;