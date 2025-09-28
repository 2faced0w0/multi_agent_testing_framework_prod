# Multi-Agent Testing Framework - Technical Specifications

## Table of Contents
1. [Data Models](#data-models)
2. [Database Schemas](#database-schemas)
3. [API Specifications](#api-specifications)
4. [Message Formats](#message-formats)
5. [File Structures](#file-structures)
6. [Integration Specifications](#integration-specifications)
7. [Configuration Management](#configuration-management)
8. [Environment Setup](#environment-setup)
9. [Error Handling Protocols](#error-handling-protocols)
10. [Security Specifications](#security-specifications)
11. [Performance Requirements](#performance-requirements)
12. [Deployment Specifications](#deployment-specifications)

---

## Data Models

### Core Entity Models

#### 1. Test Case Model

```typescript
interface TestCase {
  id: string;                          // UUID v4
  name: string;                        // Human-readable test name
  description: string;                 // Detailed test description
  type: TestType;                      // 'functional' | 'accessibility' | 'performance' | 'visual'
  priority: Priority;                  // 'low' | 'medium' | 'high' | 'critical'
  status: TestStatus;                  // 'draft' | 'active' | 'deprecated' | 'archived'
  
  // Test Definition
  targetUrl: string;                   // URL to test
  browserTargets: BrowserTarget[];     // Browsers to test against
  deviceTargets: DeviceTarget[];       // Devices/viewports to test
  
  // Test Code
  playwrightCode: string;              // Generated Playwright test code
  pageObjects: PageObject[];           // Associated page objects
  testData: TestData[];                // Test data fixtures
  
  // Metadata
  tags: string[];                      // Categorization tags
  requirements: string[];              // Business requirements mapped
  estimatedDuration: number;           // Expected execution time (ms)
  
  // Lifecycle
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;                   // Agent or user identifier
  version: number;                     // Version for change tracking
  
  // Relationships
  suiteId?: string;                    // Parent test suite
  dependencies: string[];              // Dependent test case IDs
  
  // Configuration
  retryPolicy: RetryPolicy;
  timeoutConfig: TimeoutConfig;
  environmentConfig: EnvironmentConfig;
}

interface BrowserTarget {
  browser: 'chromium' | 'firefox' | 'webkit';
  version?: string;
  headless: boolean;
  deviceScaleFactor?: number;
}

interface DeviceTarget {
  name: string;
  viewport: {
    width: number;
    height: number;
  };
  userAgent?: string;
  isMobile: boolean;
}

interface PageObject {
  id: string;
  name: string;
  url: string;
  selectors: Record<string, string>;
  methods: PageObjectMethod[];
}

interface PageObjectMethod {
  name: string;
  parameters: Parameter[];
  returnType: string;
  implementation: string;
}

interface TestData {
  id: string;
  name: string;
  type: 'static' | 'dynamic' | 'generated';
  format: 'json' | 'csv' | 'yaml';
  data: any;
  generator?: DataGenerator;
}

interface DataGenerator {
  type: 'faker' | 'custom' | 'api';
  config: Record<string, any>;
}
```

#### 2. Test Execution Model

```typescript
interface TestExecution {
  id: string;                          // UUID v4
  testCaseId: string;                  // Reference to test case
  executionId: string;                 // Batch execution identifier
  
  // Execution Context
  environment: ExecutionEnvironment;
  browser: BrowserContext;
  device: DeviceContext;
  
  // Status and Timing
  status: ExecutionStatus;             // 'queued' | 'running' | 'passed' | 'failed' | 'skipped' | 'timeout'
  startTime: Date;
  endTime?: Date;
  duration?: number;                   // Execution time in milliseconds
  
  // Results
  result: TestResult;
  artifacts: TestArtifact[];
  logs: LogEntry[];
  metrics: PerformanceMetrics;
  
  // Error Information
  error?: ExecutionError;
  stackTrace?: string;
  
  // Retry Information
  attemptNumber: number;
  maxAttempts: number;
  retryReason?: string;
  
  // Agent Information
  executedBy: string;                  // Test Executor Agent ID
  nodeId?: string;                     // Execution node identifier
}

interface ExecutionEnvironment {
  name: string;                        // 'development' | 'staging' | 'production'
  baseUrl: string;
  variables: Record<string, string>;
  secrets: Record<string, string>;
}

interface BrowserContext {
  browser: string;
  version: string;
  viewport: Viewport;
  userAgent: string;
  locale: string;
  timezone: string;
}

interface TestResult {
  passed: boolean;
  assertions: AssertionResult[];
  coverage?: CoverageData;
  accessibility?: AccessibilityResult;
  performance?: PerformanceResult;
  visual?: VisualResult;
}

interface AssertionResult {
  description: string;
  passed: boolean;
  expected: any;
  actual: any;
  message?: string;
}

interface TestArtifact {
  id: string;
  type: ArtifactType;                  // 'screenshot' | 'video' | 'trace' | 'har' | 'log'
  path: string;                        // File system path
  url?: string;                        // Public URL if available
  size: number;                        // File size in bytes
  mimeType: string;
  metadata: Record<string, any>;
}
```

#### 3. Test Report Model

```typescript
interface TestReport {
  id: string;                          // UUID v4
  name: string;
  type: ReportType;                    // 'execution' | 'trend' | 'coverage' | 'performance' | 'accessibility'
  format: ReportFormat;                // 'html' | 'pdf' | 'json' | 'xml' | 'csv'
  
  // Report Scope
  executionIds: string[];              // Test executions included
  dateRange: DateRange;
  filters: ReportFilter[];
  
  // Report Content
  summary: ReportSummary;
  sections: ReportSection[];
  charts: ChartData[];
  tables: TableData[];
  
  // Generation Info
  generatedAt: Date;
  generatedBy: string;                 // Report Generator Agent ID
  template: string;                    // Template used
  
  // Distribution
  recipients: Recipient[];
  deliveryStatus: DeliveryStatus[];
  
  // File Information
  filePath: string;
  fileSize: number;
  downloadUrl?: string;
  expiresAt?: Date;
}

interface ReportSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  passRate: number;
  totalDuration: number;
  avgDuration: number;
  
  // Trend Data
  previousPassRate?: number;
  passRateTrend: 'up' | 'down' | 'stable';
  
  // Key Metrics
  criticalIssues: number;
  performanceScore?: number;
  accessibilityScore?: number;
  coveragePercentage?: number;
}

interface ReportSection {
  id: string;
  title: string;
  type: SectionType;                   // 'summary' | 'details' | 'trends' | 'recommendations'
  content: any;                        // Section-specific content
  order: number;
}

interface ChartData {
  id: string;
  type: ChartType;                     // 'line' | 'bar' | 'pie' | 'scatter' | 'heatmap'
  title: string;
  data: any;
  config: ChartConfig;
}
```

#### 4. Agent Communication Model

```typescript
interface AgentMessage {
  // Message Identity
  id: string;                          // UUID v4
  correlationId?: string;              // For request-response correlation
  conversationId?: string;             // For multi-message conversations
  
  // Routing
  source: AgentIdentifier;
  target: AgentIdentifier | 'BROADCAST';
  messageType: MessageType;
  
  // Content
  payload: MessagePayload;
  schema: string;                      // JSON schema version
  
  // Metadata
  timestamp: Date;
  priority: MessagePriority;           // 'low' | 'normal' | 'high' | 'critical'
  ttl?: number;                        // Time to live in seconds
  
  // Delivery
  deliveryMode: DeliveryMode;          // 'fire_and_forget' | 'at_least_once' | 'exactly_once'
  retryPolicy: MessageRetryPolicy;
  retryCount: number;
  
  // Security
  signature?: string;                  // Message signature for integrity
  encrypted: boolean;
}

interface AgentIdentifier {
  type: AgentType;                     // 'test_writer' | 'test_executor' | etc.
  instanceId: string;                  // Unique instance identifier
  nodeId?: string;                     // Physical/virtual node identifier
}

interface MessagePayload {
  action: string;                      // Action to perform
  data: any;                          // Action-specific data
  metadata: Record<string, any>;      // Additional metadata
}

interface SystemEvent {
  // Event Identity
  eventId: string;                     // UUID v4
  eventType: string;                   // Hierarchical event type (e.g., 'agent.lifecycle.started')
  version: string;                     // Event schema version
  
  // Source
  source: EventSource;
  timestamp: Date;
  
  // Content
  data: EventData;
  
  // Context
  correlationId?: string;
  causationId?: string;                // Event that caused this event
  
  // Metadata
  tags: string[];
  severity: EventSeverity;             // 'debug' | 'info' | 'warning' | 'error' | 'critical'
  category: EventCategory;             // 'system' | 'business' | 'security' | 'performance'
}

interface EventSource {
  service: string;
  component: string;
  instance: string;
  version: string;
}

interface EventData {
  [key: string]: any;
}
```

### Specialized Models

#### 5. Performance Metrics Model

```typescript
interface PerformanceMetrics {
  executionId: string;
  timestamp: Date;
  
  // Core Web Vitals
  coreWebVitals: CoreWebVitals;
  
  // Navigation Timing
  navigationTiming: NavigationTiming;
  
  // Resource Timing
  resourceTiming: ResourceTiming[];
  
  // Custom Metrics
  customMetrics: CustomMetric[];
  
  // Browser Metrics
  browserMetrics: BrowserMetrics;
  
  // Network Metrics
  networkMetrics: NetworkMetrics;
}

interface CoreWebVitals {
  lcp: number;                         // Largest Contentful Paint (ms)
  fid: number;                         // First Input Delay (ms)
  cls: number;                         // Cumulative Layout Shift
  fcp: number;                         // First Contentful Paint (ms)
  ttfb: number;                        // Time to First Byte (ms)
}

interface NavigationTiming {
  domContentLoaded: number;
  loadComplete: number;
  firstPaint: number;
  firstContentfulPaint: number;
  domInteractive: number;
}

interface ResourceTiming {
  name: string;
  type: ResourceType;                  // 'document' | 'stylesheet' | 'script' | 'image' | 'font' | 'xhr'
  startTime: number;
  duration: number;
  size: number;
  transferSize: number;
  cached: boolean;
}

interface BrowserMetrics {
  memoryUsage: MemoryUsage;
  cpuUsage: number;                    // Percentage
  networkRequests: number;
  jsErrors: number;
  consoleErrors: string[];
}

interface MemoryUsage {
  usedJSHeapSize: number;              // Bytes
  totalJSHeapSize: number;             // Bytes
  jsHeapSizeLimit: number;             // Bytes
}
```

#### 6. Accessibility Model

```typescript
interface AccessibilityResult {
  executionId: string;
  timestamp: Date;
  
  // Overall Score
  score: number;                       // 0-100
  level: WCAGLevel;                    // 'A' | 'AA' | 'AAA'
  
  // Violations
  violations: AccessibilityViolation[];
  
  // Passes
  passes: AccessibilityPass[];
  
  // Incomplete Tests
  incomplete: AccessibilityIncomplete[];
  
  // Summary
  summary: AccessibilitySummary;
  
  // Recommendations
  recommendations: AccessibilityRecommendation[];
}

interface AccessibilityViolation {
  id: string;                          // Rule ID
  impact: ImpactLevel;                 // 'minor' | 'moderate' | 'serious' | 'critical'
  tags: string[];                      // WCAG tags
  description: string;
  help: string;
  helpUrl: string;
  nodes: ViolationNode[];
}

interface ViolationNode {
  html: string;
  target: string[];                    // CSS selectors
  failureSummary: string;
  element: string;
}

interface AccessibilitySummary {
  totalRules: number;
  passedRules: number;
  violatedRules: number;
  incompleteRules: number;
  elementsChecked: number;
  elementsWithViolations: number;
}
```

---

## Database Schemas

### SQLite Schema Design

#### 1. Test Management Tables

```sql
-- Test Cases Table
CREATE TABLE test_cases (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('functional', 'accessibility', 'performance', 'visual')),
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'deprecated', 'archived')),
    
    target_url TEXT NOT NULL,
    browser_targets TEXT NOT NULL,  -- JSON array
    device_targets TEXT NOT NULL,   -- JSON array
    
    playwright_code TEXT NOT NULL,
    page_objects TEXT,              -- JSON array
    test_data TEXT,                 -- JSON array
    
    tags TEXT,                      -- JSON array
    requirements TEXT,              -- JSON array
    estimated_duration INTEGER,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    
    suite_id TEXT,
    dependencies TEXT,              -- JSON array
    
    retry_policy TEXT NOT NULL,     -- JSON object
    timeout_config TEXT NOT NULL,  -- JSON object
    environment_config TEXT NOT NULL, -- JSON object
    
    FOREIGN KEY (suite_id) REFERENCES test_suites(id)
);

-- Test Suites Table
CREATE TABLE test_suites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    tags TEXT,                      -- JSON array
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL
);

-- Test Executions Table
CREATE TABLE test_executions (
    id TEXT PRIMARY KEY,
    test_case_id TEXT NOT NULL,
    execution_id TEXT NOT NULL,     -- Batch execution ID
    
    environment TEXT NOT NULL,      -- JSON object
    browser_context TEXT NOT NULL, -- JSON object
    device_context TEXT,           -- JSON object
    
    status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'passed', 'failed', 'skipped', 'timeout')),
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    duration INTEGER,
    
    result TEXT,                    -- JSON object
    error_info TEXT,               -- JSON object
    stack_trace TEXT,
    
    attempt_number INTEGER DEFAULT 1,
    max_attempts INTEGER DEFAULT 1,
    retry_reason TEXT,
    
    executed_by TEXT NOT NULL,
    node_id TEXT,
    
    FOREIGN KEY (test_case_id) REFERENCES test_cases(id)
);

-- Test Artifacts Table
CREATE TABLE test_artifacts (
    id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('screenshot', 'video', 'trace', 'har', 'log')),
    path TEXT NOT NULL,
    url TEXT,
    size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    metadata TEXT,                  -- JSON object
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (execution_id) REFERENCES test_executions(id)
);

-- Performance Metrics Table
CREATE TABLE performance_metrics (
    id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    
    -- Core Web Vitals
    lcp REAL,
    fid REAL,
    cls REAL,
    fcp REAL,
    ttfb REAL,
    
    -- Navigation Timing
    dom_content_loaded INTEGER,
    load_complete INTEGER,
    first_paint INTEGER,
    first_contentful_paint INTEGER,
    dom_interactive INTEGER,
    
    -- Browser Metrics
    memory_usage TEXT,              -- JSON object
    cpu_usage REAL,
    network_requests INTEGER,
    js_errors INTEGER,
    console_errors TEXT,            -- JSON array
    
    -- Custom Metrics
    custom_metrics TEXT,            -- JSON object
    
    FOREIGN KEY (execution_id) REFERENCES test_executions(id)
);

-- Accessibility Results Table
CREATE TABLE accessibility_results (
    id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    
    score INTEGER NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('A', 'AA', 'AAA')),
    
    violations TEXT NOT NULL,       -- JSON array
    passes TEXT NOT NULL,          -- JSON array
    incomplete TEXT NOT NULL,      -- JSON array
    
    summary TEXT NOT NULL,         -- JSON object
    recommendations TEXT,          -- JSON array
    
    FOREIGN KEY (execution_id) REFERENCES test_executions(id)
);
```

#### 2. Reporting Tables

```sql
-- Test Reports Table
CREATE TABLE test_reports (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('execution', 'trend', 'coverage', 'performance', 'accessibility')),
    format TEXT NOT NULL CHECK (format IN ('html', 'pdf', 'json', 'xml', 'csv')),
    
    execution_ids TEXT NOT NULL,    -- JSON array
    date_range TEXT NOT NULL,      -- JSON object
    filters TEXT,                  -- JSON array
    
    summary TEXT NOT NULL,         -- JSON object
    sections TEXT NOT NULL,        -- JSON array
    charts TEXT,                   -- JSON array
    tables TEXT,                   -- JSON array
    
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    generated_by TEXT NOT NULL,
    template TEXT NOT NULL,
    
    recipients TEXT,               -- JSON array
    delivery_status TEXT,          -- JSON array
    
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    download_url TEXT,
    expires_at DATETIME
);
```

#### 3. Agent Communication Tables

```sql
-- Agent Messages Table
CREATE TABLE agent_messages (
    id TEXT PRIMARY KEY,
    correlation_id TEXT,
    conversation_id TEXT,
    
    source_type TEXT NOT NULL,
    source_instance TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_instance TEXT,
    
    message_type TEXT NOT NULL,
    payload TEXT NOT NULL,         -- JSON object
    schema_version TEXT NOT NULL,
    
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    ttl INTEGER,
    
    delivery_mode TEXT NOT NULL CHECK (delivery_mode IN ('fire_and_forget', 'at_least_once', 'exactly_once')),
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    processed BOOLEAN DEFAULT FALSE,
    processed_at DATETIME,
    error_message TEXT
);

-- System Events Table
CREATE TABLE system_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    version TEXT NOT NULL,
    
    source_service TEXT NOT NULL,
    source_component TEXT NOT NULL,
    source_instance TEXT NOT NULL,
    source_version TEXT NOT NULL,
    
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    data TEXT NOT NULL,            -- JSON object
    
    correlation_id TEXT,
    causation_id TEXT,
    
    tags TEXT,                     -- JSON array
    severity TEXT NOT NULL CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
    category TEXT NOT NULL CHECK (category IN ('system', 'business', 'security', 'performance'))
);

-- Agent Health Table
CREATE TABLE agent_health (
    agent_type TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    node_id TEXT,
    
    status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'offline')),
    last_heartbeat DATETIME NOT NULL,
    
    cpu_usage REAL,
    memory_usage REAL,
    active_tasks INTEGER,
    queue_size INTEGER,
    
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    last_error_at DATETIME,
    
    metadata TEXT,                 -- JSON object
    
    PRIMARY KEY (agent_type, instance_id)
);
```

#### 4. Configuration Tables

```sql
-- System Configuration Table
CREATE TABLE system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    category TEXT NOT NULL,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT NOT NULL,
    
    encrypted BOOLEAN DEFAULT FALSE,
    sensitive BOOLEAN DEFAULT FALSE
);

-- Environment Variables Table
CREATE TABLE environment_variables (
    environment TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    encrypted BOOLEAN DEFAULT FALSE,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (environment, key)
);
```

### Indexes for Performance

```sql
-- Test Cases Indexes
CREATE INDEX idx_test_cases_type ON test_cases(type);
CREATE INDEX idx_test_cases_status ON test_cases(status);
CREATE INDEX idx_test_cases_priority ON test_cases(priority);
CREATE INDEX idx_test_cases_suite_id ON test_cases(suite_id);
CREATE INDEX idx_test_cases_created_at ON test_cases(created_at);

-- Test Executions Indexes
CREATE INDEX idx_test_executions_test_case_id ON test_executions(test_case_id);
CREATE INDEX idx_test_executions_execution_id ON test_executions(execution_id);
CREATE INDEX idx_test_executions_status ON test_executions(status);
CREATE INDEX idx_test_executions_start_time ON test_executions(start_time);

-- Agent Messages Indexes
CREATE INDEX idx_agent_messages_target ON agent_messages(target_type, target_instance);
CREATE INDEX idx_agent_messages_timestamp ON agent_messages(timestamp);
CREATE INDEX idx_agent_messages_processed ON agent_messages(processed);
CREATE INDEX idx_agent_messages_correlation ON agent_messages(correlation_id);

-- System Events Indexes
CREATE INDEX idx_system_events_type ON system_events(event_type);
CREATE INDEX idx_system_events_timestamp ON system_events(timestamp);
CREATE INDEX idx_system_events_severity ON system_events(severity);
CREATE INDEX idx_system_events_source ON system_events(source_service, source_component);
```

---

## API Specifications

### REST API Endpoints

#### 1. Test Management API

```typescript
// Base URL: /api/v1

/**
 * Test Cases API
 */

// Create a new test case
POST /tests/cases
Content-Type: application/json
Authorization: Bearer <token>

Request Body:
{
  "name": "Login functionality test",
  "description": "Test user login with valid credentials",
  "type": "functional",
  "priority": "high",
  "targetUrl": "https://example.com/login",
  "browserTargets": [
    {
      "browser": "chromium",
      "headless": false
    }
  ],
  "requirements": ["REQ-001", "REQ-002"],
  "tags": ["authentication", "critical-path"]
}

Response: 201 Created
{
  "id": "test-case-uuid",
  "status": "draft",
  "createdAt": "2025-08-19T10:00:00Z",
  "version": 1
}

// Get test case by ID
GET /tests/cases/{id}
Authorization: Bearer <token>

Response: 200 OK
{
  "id": "test-case-uuid",
  "name": "Login functionality test",
  "description": "Test user login with valid credentials",
  "type": "functional",
  "priority": "high",
  "status": "active",
  "targetUrl": "https://example.com/login",
  "playwrightCode": "// Generated test code...",
  "createdAt": "2025-08-19T10:00:00Z",
  "updatedAt": "2025-08-19T10:30:00Z",
  "version": 2
}

// List test cases with filtering and pagination
GET /tests/cases?type=functional&status=active&page=1&limit=20&sort=createdAt:desc
Authorization: Bearer <token>

Response: 200 OK
{
  "data": [
    {
      "id": "test-case-uuid-1",
      "name": "Login functionality test",
      "type": "functional",
      "priority": "high",
      "status": "active",
      "createdAt": "2025-08-19T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}

// Update test case
PUT /tests/cases/{id}
Content-Type: application/json
Authorization: Bearer <token>

Request Body:
{
  "name": "Updated test name",
  "description": "Updated description",
  "priority": "critical"
}

Response: 200 OK
{
  "id": "test-case-uuid",
  "version": 3,
  "updatedAt": "2025-08-19T11:00:00Z"
}

// Delete test case
DELETE /tests/cases/{id}
Authorization: Bearer <token>

Response: 204 No Content

/**
 * Test Execution API
 */

// Execute a test case
POST /tests/cases/{id}/execute
Content-Type: application/json
Authorization: Bearer <token>

Request Body:
{
  "environment": "staging",
  "browsers": ["chromium", "firefox"],
  "devices": ["desktop", "mobile"],
  "parallel": true,
  "retryOnFailure": true
}

Response: 202 Accepted
{
  "executionId": "execution-batch-uuid",
  "status": "queued",
  "estimatedDuration": 120000,
  "queuePosition": 3
}

// Get execution status
GET /tests/executions/{executionId}
Authorization: Bearer <token>

Response: 200 OK
{
  "executionId": "execution-batch-uuid",
  "status": "running",
  "startTime": "2025-08-19T12:00:00Z",
  "progress": {
    "total": 4,
    "completed": 2,
    "passed": 1,
    "failed": 1,
    "running": 2
  },
  "executions": [
    {
      "id": "individual-execution-uuid-1",
      "testCaseId": "test-case-uuid",
      "browser": "chromium",
      "device": "desktop",
      "status": "passed",
      "duration": 15000
    }
  ]
}

// Get execution results
GET /tests/executions/{executionId}/results
Authorization: Bearer <token>

Response: 200 OK
{
  "executionId": "execution-batch-uuid",
  "summary": {
    "total": 4,
    "passed": 3,
    "failed": 1,
    "passRate": 75,
    "totalDuration": 45000
  },
  "results": [
    {
      "id": "individual-execution-uuid-1",
      "testCaseId": "test-case-uuid",
      "status": "passed",
      "assertions": [
        {
          "description": "Login button should be visible",
          "passed": true
        }
      ],
      "artifacts": [
        {
          "type": "screenshot",
          "url": "/api/v1/artifacts/screenshot-uuid.png"
        }
      ]
    }
  ]
}

// Cancel execution
POST /tests/executions/{executionId}/cancel
Authorization: Bearer <token>

Response: 200 OK
{
  "executionId": "execution-batch-uuid",
  "status": "cancelled",
  "cancelledAt": "2025-08-19T12:05:00Z"
}
```

#### 2. Reporting API

```typescript
/**
 * Reports API
 */

// Generate a report
POST /reports/generate
Content-Type: application/json
Authorization: Bearer <token>

Request Body:
{
  "name": "Weekly Test Report",
  "type": "execution",
  "format": "html",
  "executionIds": ["exec-1", "exec-2"],
  "dateRange": {
    "start": "2025-08-12T00:00:00Z",
    "end": "2025-08-19T23:59:59Z"
  },
  "filters": [
    {
      "field": "status",
      "operator": "in",
      "values": ["passed", "failed"]
    }
  ],
  "template": "standard",
  "recipients": [
    {
      "email": "team@example.com",
      "type": "email"
    }
  ]
}

Response: 202 Accepted
{
  "reportId": "report-uuid",
  "status": "generating",
  "estimatedCompletion": "2025-08-19T12:10:00Z"
}

// Get report status
GET /reports/{reportId}/status
Authorization: Bearer <token>

Response: 200 OK
{
  "reportId": "report-uuid",
  "status": "completed",
  "generatedAt": "2025-08-19T12:08:00Z",
  "fileSize": 2048576,
  "downloadUrl": "/api/v1/reports/report-uuid/download"
}

// Download report
GET /reports/{reportId}/download
Authorization: Bearer <token>

Response: 200 OK
Content-Type: text/html
Content-Disposition: attachment; filename="test-report.html"

[Report content]

// List reports
GET /reports?type=execution&format=html&page=1&limit=10
Authorization: Bearer <token>

Response: 200 OK
{
  "data": [
    {
      "id": "report-uuid",
      "name": "Weekly Test Report",
      "type": "execution",
      "format": "html",
      "generatedAt": "2025-08-19T12:08:00Z",
      "fileSize": 2048576
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

#### 3. System Management API

```typescript
/**
 * System Health API
 */

// Get system health
GET /system/health
Authorization: Bearer <token>

Response: 200 OK
{
  "status": "healthy",
  "timestamp": "2025-08-19T12:00:00Z",
  "version": "1.0.0",
  "uptime": 86400,
  "agents": [
    {
      "type": "test_writer",
      "instanceId": "tw-001",
      "status": "healthy",
      "lastHeartbeat": "2025-08-19T11:59:30Z",
      "activeTasks": 2,
      "queueSize": 5
    }
  ],
  "services": [
    {
      "name": "redis",
      "status": "healthy",
      "responseTime": 2
    },
    {
      "name": "database",
      "status": "healthy",
      "responseTime": 15
    }
  ]
}

// Get system metrics
GET /system/metrics?period=1h&interval=5m
Authorization: Bearer <token>

Response: 200 OK
{
  "period": "1h",
  "interval": "5m",
  "metrics": [
    {
      "timestamp": "2025-08-19T11:00:00Z",
      "cpu": 45.2,
      "memory": 67.8,
      "testsExecuted": 15,
      "avgExecutionTime": 12000
    }
  ]
}

// Restart agent
POST /system/agents/{agentType}/{instanceId}/restart
Authorization: Bearer <token>

Response: 202 Accepted
{
  "agentType": "test_writer",
  "instanceId": "tw-001",
  "status": "restarting",
  "requestedAt": "2025-08-19T12:00:00Z"
}

// Get agent logs
GET /system/agents/{agentType}/{instanceId}/logs?lines=100&level=error
Authorization: Bearer <token>

Response: 200 OK
{
  "agentType": "test_writer",
  "instanceId": "tw-001",
  "logs": [
    {
      "timestamp": "2025-08-19T11:58:00Z",
      "level": "error",
      "message": "Failed to generate test case",
      "context": {
        "testCaseId": "test-case-uuid",
        "error": "Invalid selector"
      }
    }
  ]
}
```

#### 4. Configuration API

```typescript
/**
 * Configuration API
 */

// Get configuration
GET /config?category=agents&environment=production
Authorization: Bearer <token>

Response: 200 OK
{
  "config": {
    "agents.test_writer.max_concurrent_tasks": 5,
    "agents.test_executor.timeout": 300000,
    "integrations.playwright.headless": true,
    "integrations.openai.model": "gpt-4"
  }
}

// Update configuration
PUT /config
Content-Type: application/json
Authorization: Bearer <token>

Request Body:
{
  "config": {
    "agents.test_writer.max_concurrent_tasks": 10,
    "agents.test_executor.timeout": 600000
  }
}

Response: 200 OK
{
  "updated": [
    "agents.test_writer.max_concurrent_tasks",
    "agents.test_executor.timeout"
  ],
  "updatedAt": "2025-08-19T12:00:00Z"
}
```

### WebSocket API

#### Real-time Event Streaming

```typescript
// WebSocket connection
ws://localhost:3000/api/v1/ws
Authorization: Bearer <token>

// Subscribe to events
{
  "type": "subscribe",
  "channels": [
    "test.execution.*",
    "agent.health.*",
    "system.alerts.*"
  ]
}

// Event message format
{
  "type": "event",
  "channel": "test.execution.started",
  "timestamp": "2025-08-19T12:00:00Z",
  "data": {
    "executionId": "execution-uuid",
    "testCaseId": "test-case-uuid",
    "browser": "chromium",
    "status": "running"
  }
}

// Heartbeat
{
  "type": "ping"
}

// Response
{
  "type": "pong",
  "timestamp": "2025-08-19T12:00:00Z"
}
```

### GraphQL API (Optional)

```graphql
type Query {
  testCase(id: ID!): TestCase
  testCases(
    filter: TestCaseFilter
    sort: TestCaseSort
    pagination: Pagination
  ): TestCaseConnection
  
  execution(id: ID!): TestExecution
  executions(
    filter: ExecutionFilter
    sort: ExecutionSort
    pagination: Pagination
  ): ExecutionConnection
  
  report(id: ID!): TestReport
  reports(
    filter: ReportFilter
    sort: ReportSort
    pagination: Pagination
  ): ReportConnection
  
  systemHealth: SystemHealth
  agentHealth(type: AgentType, instanceId: String): [AgentHealth]
}

type Mutation {
  createTestCase(input: CreateTestCaseInput!): TestCase
  updateTestCase(id: ID!, input: UpdateTestCaseInput!): TestCase
  deleteTestCase(id: ID!): Boolean
  
  executeTest(id: ID!, input: ExecuteTestInput!): TestExecution
  cancelExecution(id: ID!): TestExecution
  
  generateReport(input: GenerateReportInput!): TestReport
  
  restartAgent(type: AgentType!, instanceId: String!): AgentHealth
  updateConfig(input: ConfigUpdateInput!): ConfigUpdateResult
}

type Subscription {
  testExecutionUpdates(executionId: ID!): TestExecution
  systemEvents(filter: EventFilter): SystemEvent
  agentHealthUpdates(type: AgentType): AgentHealth
}
```

---

## Message Formats

### Agent Communication Messages

#### 1. Test Writer Agent Messages

```typescript
// Test Generation Request
interface TestGenerationRequest {
  messageType: 'TEST_GENERATION_REQUEST';
  payload: {
    requirements: {
      url: string;
      description: string;
      userStories: string[];
      acceptanceCriteria: string[];
      testType: TestType;
      priority: Priority;
    };
    context: {
      existingTests: string[];
      pageObjects: PageObject[];
      environment: string;
    };
    preferences: {
      framework: 'playwright';
      language: 'typescript';
      patterns: string[];
    };
  };
}

// Test Generation Response
interface TestGenerationResponse {
  messageType: 'TEST_GENERATION_RESPONSE';
  payload: {
    testCase: TestCase;
    generatedCode: string;
    pageObjects: PageObject[];
    testData: TestData[];
    recommendations: string[];
    confidence: number; // 0-1
  };
}

// Test Optimization Request
interface TestOptimizationRequest {
  messageType: 'TEST_OPTIMIZATION_REQUEST';
  payload: {
    testCaseId: string;
    issues: OptimizationIssue[];
    executionHistory: ExecutionSummary[];
    constraints: OptimizationConstraints;
  };
}
```

#### 2. Test Executor Agent Messages

```typescript
// Execution Request
interface ExecutionRequest {
  messageType: 'EXECUTION_REQUEST';
  payload: {
    testCaseId: string;
    executionConfig: {
      environment: string;
      browsers: BrowserTarget[];
      devices: DeviceTarget[];
      parallel: boolean;
      retryPolicy: RetryPolicy;
    };
    priority: MessagePriority;
    scheduledAt?: Date;
  };
}

// Execution Status Update
interface ExecutionStatusUpdate {
  messageType: 'EXECUTION_STATUS_UPDATE';
  payload: {
    executionId: string;
    status: ExecutionStatus;
    progress: {
      current: number;
      total: number;
      percentage: number;
    };
    currentStep: string;
    estimatedCompletion?: Date;
  };
}

// Execution Result
interface ExecutionResult {
  messageType: 'EXECUTION_RESULT';
  payload: {
    executionId: string;
    testCaseId: string;
    result: TestResult;
    artifacts: TestArtifact[];
    metrics: PerformanceMetrics;
    logs: LogEntry[];
    duration: number;
  };
}
```

#### 3. Report Generator Agent Messages

```typescript
// Report Generation Request
interface ReportGenerationRequest {
  messageType: 'REPORT_GENERATION_REQUEST';
  payload: {
    reportConfig: {
      name: string;
      type: ReportType;
      format: ReportFormat;
      template: string;
    };
    dataSource: {
      executionIds: string[];
      dateRange: DateRange;
      filters: ReportFilter[];
    };
    distribution: {
      recipients: Recipient[];
      schedule?: ReportSchedule;
    };
  };
}

// Report Generation Status
interface ReportGenerationStatus {
  messageType: 'REPORT_GENERATION_STATUS';
  payload: {
    reportId: string;
    status: 'generating' | 'completed' | 'failed';
    progress: number; // 0-100
    currentSection: string;
    estimatedCompletion?: Date;
    error?: string;
  };
}
```

#### 4. Context Manager Agent Messages

```typescript
// Context Update Request
interface ContextUpdateRequest {
  messageType: 'CONTEXT_UPDATE_REQUEST';
  payload: {
    contextType: 'environment' | 'authentication' | 'configuration' | 'state';
    updates: Record<string, any>;
    scope: 'global' | 'agent' | 'execution';
    targetId?: string;
  };
}

// Context Query Request
interface ContextQueryRequest {
  messageType: 'CONTEXT_QUERY_REQUEST';
  payload: {
    query: {
      contextType: string;
      filters: Record<string, any>;
      fields: string[];
    };
    requesterId: string;
  };
}

// Context Response
interface ContextResponse {
  messageType: 'CONTEXT_RESPONSE';
  payload: {
    data: Record<string, any>;
    timestamp: Date;
    version: string;
    ttl?: number;
  };
}
```

### System Events

#### 1. Agent Lifecycle Events

```typescript
// Agent Started Event
interface AgentStartedEvent {
  eventType: 'agent.lifecycle.started';
  data: {
    agentType: AgentType;
    instanceId: string;
    nodeId: string;
    version: string;
    configuration: Record<string, any>;
    capabilities: string[];
  };
}

// Agent Stopped Event
interface AgentStoppedEvent {
  eventType: 'agent.lifecycle.stopped';
  data: {
    agentType: AgentType;
    instanceId: string;
    reason: 'shutdown' | 'error' | 'restart';
    uptime: number;
    finalStats: AgentStats;
  };
}

// Agent Health Changed Event
interface AgentHealthChangedEvent {
  eventType: 'agent.health.changed';
  data: {
    agentType: AgentType;
    instanceId: string;
    previousStatus: HealthStatus;
    currentStatus: HealthStatus;
    metrics: HealthMetrics;
    issues: HealthIssue[];
  };
}
```

#### 2. Test Execution Events

```typescript
// Test Started Event
interface TestStartedEvent {
  eventType: 'test.execution.started';
  data: {
    executionId: string;
    testCaseId: string;
    environment: string;
    browser: string;
    device: string;
    startTime: Date;
  };
}

// Test Completed Event
interface TestCompletedEvent {
  eventType: 'test.execution.completed';
  data: {
    executionId: string;
    testCaseId: string;
    status: ExecutionStatus;
    duration: number;
    result: TestResult;
    artifactCount: number;
  };
}

// Test Failed Event
interface TestFailedEvent {
  eventType: 'test.execution.failed';
  data: {
    executionId: string;
    testCaseId: string;
    error: ExecutionError;
    stackTrace: string;
    screenshot?: string;
    retryAttempt: number;
  };
}
```

#### 3. System Performance Events

```typescript
// Performance Alert Event
interface PerformanceAlertEvent {
  eventType: 'system.performance.alert';
  data: {
    alertType: 'high_cpu' | 'high_memory' | 'slow_response' | 'queue_backlog';
    severity: AlertSeverity;
    metric: string;
    currentValue: number;
    threshold: number;
    duration: number;
    affectedComponents: string[];
  };
}

// Resource Exhaustion Event
interface ResourceExhaustionEvent {
  eventType: 'system.performance.resource_exhaustion';
  data: {
    resourceType: 'cpu' | 'memory' | 'disk' | 'network';
    utilization: number;
    availableCapacity: number;
    projectedExhaustion: Date;
    mitigationActions: string[];
  };
}
```

### Error Messages

#### 1. Validation Errors

```typescript
interface ValidationError {
  messageType: 'VALIDATION_ERROR';
  payload: {
    field: string;
    value: any;
    constraint: string;
    message: string;
    code: string;
  };
}

interface ValidationErrorResponse {
  messageType: 'VALIDATION_ERROR_RESPONSE';
  payload: {
    errors: ValidationError[];
    requestId: string;
    timestamp: Date;
  };
}
```

#### 2. System Errors

```typescript
interface SystemError {
  messageType: 'SYSTEM_ERROR';
  payload: {
    errorType: 'timeout' | 'connection' | 'resource' | 'configuration';
    component: string;
    message: string;
    details: Record<string, any>;
    stackTrace?: string;
    recoverable: boolean;
    suggestedActions: string[];
  };
}
```

---

## File Structures

### Project Directory Structure

```
/home/ubuntu/multi_agent_testing_framework/
├── README.md
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── docker-compose.yml
├── Dockerfile
│
├── src/                              # Source code
│   ├── agents/                       # Agent implementations
│   │   ├── base/
│   │   │   ├── BaseAgent.ts
│   │   │   ├── AgentInterface.ts
│   │   │   └── AgentLifecycle.ts
│   │   ├── test-writer/
│   │   │   ├── TestWriterAgent.ts
│   │   │   ├── TestGenerator.ts
│   │   │   ├── PageObjectBuilder.ts
│   │   │   └── CodeOptimizer.ts
│   │   ├── test-executor/
│   │   │   ├── TestExecutorAgent.ts
│   │   │   ├── ExecutionEngine.ts
│   │   │   ├── BrowserManager.ts
│   │   │   └── ResultCollector.ts
│   │   ├── report-generator/
│   │   │   ├── ReportGeneratorAgent.ts
│   │   │   ├── ReportBuilder.ts
│   │   │   ├── TemplateEngine.ts
│   │   │   └── ChartGenerator.ts
│   │   ├── test-optimizer/
│   │   │   ├── TestOptimizerAgent.ts
│   │   │   ├── FlakyTestDetector.ts
│   │   │   ├── PerformanceAnalyzer.ts
│   │   │   └── CoverageAnalyzer.ts
│   │   ├── context-manager/
│   │   │   ├── ContextManagerAgent.ts
│   │   │   ├── StateManager.ts
│   │   │   ├── ConfigManager.ts
│   │   │   └── AuthManager.ts
│   │   └── logger/
│   │       ├── LoggerAgent.ts
│   │       ├── LogAggregator.ts
│   │       ├── MetricsCollector.ts
│   │       └── AlertManager.ts
│   │
│   ├── communication/                # Communication layer
│   │   ├── MessageQueue.ts
│   │   ├── EventBus.ts
│   │   ├── SharedMemory.ts
│   │   └── protocols/
│   │       ├── MessageProtocol.ts
│   │       ├── EventProtocol.ts
│   │       └── ErrorProtocol.ts
│   │
│   ├── integrations/                 # External integrations
│   │   ├── playwright/
│   │   │   ├── PlaywrightMCP.ts
│   │   │   ├── BrowserController.ts
│   │   │   └── TestRunner.ts
│   │   ├── openai/
│   │   │   ├── GPT4Client.ts
│   │   │   ├── PromptTemplates.ts
│   │   │   └── ResponseParser.ts
│   │   ├── monitoring/
│   │   │   ├── PrometheusExporter.ts
│   │   │   ├── ElasticsearchShipper.ts
│   │   │   └── GrafanaDashboard.ts
│   │   └── storage/
│   │       ├── DatabaseManager.ts
│   │       ├── FileManager.ts
│   │       └── CacheManager.ts
│   │
│   ├── models/                       # Data models
│   │   ├── TestCase.ts
│   │   ├── TestExecution.ts
│   │   ├── TestReport.ts
│   │   ├── AgentMessage.ts
│   │   ├── SystemEvent.ts
│   │   └── PerformanceMetrics.ts
│   │
│   ├── api/                          # API layer
│   │   ├── rest/
│   │   │   ├── server.ts
│   │   │   ├── routes/
│   │   │   │   ├── tests.ts
│   │   │   │   ├── executions.ts
│   │   │   │   ├── reports.ts
│   │   │   │   └── system.ts
│   │   │   └── middleware/
│   │   │       ├── auth.ts
│   │   │       ├── validation.ts
│   │   │       └── errorHandler.ts
│   │   ├── websocket/
│   │   │   ├── server.ts
│   │   │   ├── handlers/
│   │   │   └── events.ts
│   │   └── graphql/
│   │       ├── schema.ts
│   │       ├── resolvers/
│   │       └── subscriptions.ts
│   │
│   ├── utils/                        # Utility functions
│   │   ├── logger.ts
│   │   ├── crypto.ts
│   │   ├── validation.ts
│   │   ├── dateUtils.ts
│   │   └── fileUtils.ts
│   │
│   └── types/                        # TypeScript type definitions
│       ├── agents.ts
│       ├── communication.ts
│       ├── integrations.ts
│       └── api.ts
│
├── config/                           # Configuration files
│   ├── default.json
│   ├── development.json
│   ├── staging.json
│   ├── production.json
│   ├── agents/
│   │   ├── test-writer.json
│   │   ├── test-executor.json
│   │   ├── report-generator.json
│   │   ├── test-optimizer.json
│   │   ├── context-manager.json
│   │   └── logger.json
│   └── integrations/
│       ├── playwright.json
│       ├── openai.json
│       ├── monitoring.json
│       └── storage.json
│
├── data/                             # Data storage
│   ├── sqlite/
│   │   ├── tests.db
│   │   ├── results.db
│   │   └── analytics.db
│   ├── artifacts/
│   │   ├── test-scripts/
│   │   │   └── generated/
│   │   ├── screenshots/
│   │   │   └── YYYY-MM-DD/
│   │   ├── videos/
│   │   │   └── YYYY-MM-DD/
│   │   ├── traces/
│   │   │   └── YYYY-MM-DD/
│   │   └── reports/
│   │       ├── html/
│   │       ├── pdf/
│   │       └── json/
│   ├── cache/
│   │   ├── redis-data/
│   │   └── temp/
│   ├── logs/
│   │   ├── agents/
│   │   │   ├── test-writer/
│   │   │   ├── test-executor/
│   │   │   ├── report-generator/
│   │   │   ├── test-optimizer/
│   │   │   ├── context-manager/
│   │   │   └── logger/
│   │   ├── system/
│   │   └── api/
│   └── metrics/
│       └── influxdb-data/
│
├── tests/                            # Framework tests
│   ├── unit/
│   │   ├── agents/
│   │   ├── communication/
│   │   ├── integrations/
│   │   └── utils/
│   ├── integration/
│   │   ├── agent-communication/
│   │   ├── end-to-end/
│   │   └── performance/
│   └── fixtures/
│       ├── test-cases/
│       ├── mock-data/
│       └── sample-reports/
│
├── scripts/                          # Utility scripts
│   ├── setup.sh
│   ├── start-services.sh
│   ├── stop-services.sh
│   ├── backup-data.sh
│   ├── restore-data.sh
│   ├── migrate-db.sh
│   └── health-check.sh
│
├── docs/                             # Documentation
│   ├── architecture.md
│   ├── technical-specifications.md
│   ├── api-documentation.md
│   ├── deployment-guide.md
│   ├── user-guide.md
│   └── troubleshooting.md
│
├── monitoring/                       # Monitoring configuration
│   ├── prometheus/
│   │   ├── prometheus.yml
│   │   └── rules/
│   ├── grafana/
│   │   ├── dashboards/
│   │   └── datasources/
│   └── elasticsearch/
│       ├── mappings/
│       └── templates/
│
└── deployment/                       # Deployment files
    ├── kubernetes/
    │   ├── namespace.yaml
    │   ├── configmap.yaml
    │   ├── secret.yaml
    │   ├── deployment.yaml
    │   ├── service.yaml
    │   └── ingress.yaml
    ├── docker/
    │   ├── Dockerfile.agent
    │   ├── Dockerfile.api
    │   └── docker-compose.prod.yml
    └── terraform/
        ├── main.tf
        ├── variables.tf
        └── outputs.tf
```

### Configuration File Formats

#### 1. Main Configuration (config/default.json)

```json
{
  "system": {
    "name": "Multi-Agent Testing Framework",
    "version": "1.0.0",
    "environment": "development",
    "logLevel": "info",
    "dataDirectory": "/home/ubuntu/multi_agent_testing_framework/data"
  },
  "agents": {
    "testWriter": {
      "enabled": true,
      "instances": 2,
      "maxConcurrentTasks": 5,
      "timeout": 300000,
      "retryPolicy": {
        "maxRetries": 3,
        "backoffMultiplier": 2,
        "initialDelay": 1000
      }
    },
    "testExecutor": {
      "enabled": true,
      "instances": 4,
      "maxConcurrentExecutions": 10,
      "timeout": 600000,
      "browserPool": {
        "maxBrowsers": 20,
        "idleTimeout": 300000,
        "recycleAfter": 100
      }
    },
    "reportGenerator": {
      "enabled": true,
      "instances": 1,
      "maxConcurrentReports": 3,
      "timeout": 180000,
      "templateDirectory": "./templates"
    },
    "testOptimizer": {
      "enabled": true,
      "instances": 1,
      "analysisInterval": 3600000,
      "minExecutionsForAnalysis": 10
    },
    "contextManager": {
      "enabled": true,
      "instances": 1,
      "stateBackup": {
        "enabled": true,
        "interval": 300000,
        "retentionDays": 30
      }
    },
    "logger": {
      "enabled": true,
      "instances": 1,
      "logRetentionDays": 90,
      "metricsRetentionDays": 365
    }
  },
  "communication": {
    "messageQueue": {
      "type": "redis",
      "host": "localhost",
      "port": 6379,
      "database": 0,
      "maxRetries": 5,
      "retryDelay": 1000
    },
    "eventBus": {
      "type": "redis",
      "host": "localhost",
      "port": 6379,
      "database": 1,
      "maxListeners": 100
    },
    "sharedMemory": {
      "type": "redis",
      "host": "localhost",
      "port": 6379,
      "database": 2,
      "ttl": 86400
    }
  },
  "integrations": {
    "playwright": {
      "headless": true,
      "slowMo": 0,
      "timeout": 30000,
      "browsers": ["chromium", "firefox", "webkit"],
      "devices": ["Desktop Chrome", "iPhone 12", "iPad Pro"]
    },
    "openai": {
      "model": "gpt-4",
      "maxTokens": 4000,
      "temperature": 0.1,
      "timeout": 60000,
      "rateLimiting": {
        "requestsPerMinute": 60,
        "tokensPerMinute": 150000
      }
    },
    "monitoring": {
      "prometheus": {
        "enabled": true,
        "port": 9090,
        "metricsPath": "/metrics"
      },
      "grafana": {
        "enabled": true,
        "port": 3001,
        "dashboardsPath": "./monitoring/grafana/dashboards"
      },
      "elasticsearch": {
        "enabled": true,
        "host": "localhost",
        "port": 9200,
        "index": "testing-framework-logs"
      }
    }
  },
  "storage": {
    "database": {
      "type": "sqlite",
      "path": "./data/sqlite/main.db",
      "backup": {
        "enabled": true,
        "interval": 3600000,
        "retentionCount": 24
      }
    },
    "artifacts": {
      "path": "./data/artifacts",
      "maxSize": "10GB",
      "cleanup": {
        "enabled": true,
        "retentionDays": 30
      }
    },
    "cache": {
      "type": "redis",
      "host": "localhost",
      "port": 6379,
      "database": 3,
      "ttl": 3600
    }
  },
  "api": {
    "rest": {
      "enabled": true,
      "port": 3000,
      "cors": {
        "enabled": true,
        "origins": ["http://localhost:3001"]
      },
      "rateLimit": {
        "windowMs": 900000,
        "max": 1000
      }
    },
    "websocket": {
      "enabled": true,
      "port": 8080,
      "heartbeatInterval": 30000
    },
    "graphql": {
      "enabled": false,
      "port": 4000,
      "playground": true
    }
  },
  "security": {
    "authentication": {
      "type": "jwt",
      "secret": "${JWT_SECRET}",
      "expiresIn": "24h"
    },
    "encryption": {
      "algorithm": "aes-256-gcm",
      "keyDerivation": "pbkdf2"
    },
    "rateLimiting": {
      "enabled": true,
      "windowMs": 900000,
      "max": 1000
    }
  }
}
```

#### 2. Agent-Specific Configuration (config/agents/test-writer.json)

```json
{
  "agent": {
    "type": "test_writer",
    "name": "Test Writer Agent",
    "version": "1.0.0"
  },
  "capabilities": {
    "testGeneration": {
      "enabled": true,
      "supportedTypes": ["functional", "accessibility", "performance", "visual"],
      "frameworks": ["playwright"],
      "languages": ["typescript", "javascript"]
    },
    "codeOptimization": {
      "enabled": true,
      "patterns": ["page-object-model", "data-driven", "keyword-driven"],
      "linting": true,
      "formatting": true
    },
    "pageObjectGeneration": {
      "enabled": true,
      "autoDetection": true,
      "selectorStrategies": ["data-testid", "aria-label", "css", "xpath"]
    }
  },
  "ai": {
    "provider": "openai",
    "model": "gpt-4",
    "prompts": {
      "testGeneration": "./prompts/test-generation.txt",
      "codeOptimization": "./prompts/code-optimization.txt",
      "pageObjectGeneration": "./prompts/page-object-generation.txt"
    },
    "parameters": {
      "temperature": 0.1,
      "maxTokens": 4000,
      "topP": 0.9
    }
  },
  "output": {
    "codeStyle": {
      "indentation": "2spaces",
      "quotes": "single",
      "semicolons": true,
      "trailingComma": true
    },
    "testStructure": {
      "beforeEach": true,
      "afterEach": true,
      "describe": true,
      "it": true
    },
    "documentation": {
      "comments": true,
      "jsdoc": true,
      "readme": true
    }
  },
  "validation": {
    "syntaxCheck": true,
    "linting": true,
    "typeChecking": true,
    "testExecution": false
  },
  "performance": {
    "maxConcurrentTasks": 5,
    "timeout": 300000,
    "cacheResults": true,
    "cacheTtl": 3600000
  }
}
```

### Test Artifact File Formats

#### 1. Generated Test Script Format

```typescript
// File: data/artifacts/test-scripts/generated/login-test-{timestamp}.spec.ts

import { test, expect, Page } from '@playwright/test';
import { LoginPage } from '../page-objects/LoginPage';
import { DashboardPage } from '../page-objects/DashboardPage';
import { testData } from '../fixtures/login-data.json';

/**
 * Login Functionality Tests
 * 
 * Test Suite: Authentication
 * Priority: High
 * Generated: 2025-08-19T12:00:00Z
 * Agent: test-writer-001
 */

test.describe('Login Functionality', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    await loginPage.navigate();
  });

  test('should login with valid credentials', async ({ page }) => {
    // Test ID: TC-001
    // Requirement: REQ-AUTH-001
    
    await loginPage.enterUsername(testData.validUser.username);
    await loginPage.enterPassword(testData.validUser.password);
    await loginPage.clickLoginButton();
    
    await expect(dashboardPage.welcomeMessage).toBeVisible();
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Test ID: TC-002
    // Requirement: REQ-AUTH-002
    
    await loginPage.enterUsername(testData.invalidUser.username);
    await loginPage.enterPassword(testData.invalidUser.password);
    await loginPage.clickLoginButton();
    
    await expect(loginPage.errorMessage).toBeVisible();
    await expect(loginPage.errorMessage).toHaveText('Invalid username or password');
  });

  test.afterEach(async ({ page }) => {
    await page.close();
  });
});
```

#### 2. Page Object File Format

```typescript
// File: data/artifacts/test-scripts/page-objects/LoginPage.ts

import { Page, Locator } from '@playwright/test';

/**
 * Login Page Object
 * 
 * URL: /login
 * Generated: 2025-08-19T12:00:00Z
 * Agent: test-writer-001
 */

export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;
  readonly forgotPasswordLink: Locator;
  readonly rememberMeCheckbox: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.locator('[data-testid="username-input"]');
    this.passwordInput = page.locator('[data-testid="password-input"]');
    this.loginButton = page.locator('[data-testid="login-button"]');
    this.errorMessage = page.locator('[data-testid="error-message"]');
    this.forgotPasswordLink = page.locator('[data-testid="forgot-password-link"]');
    this.rememberMeCheckbox = page.locator('[data-testid="remember-me-checkbox"]');
  }

  async navigate(): Promise<void> {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
  }

  async enterUsername(username: string): Promise<void> {
    await this.usernameInput.fill(username);
  }

  async enterPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  async clickLoginButton(): Promise<void> {
    await this.loginButton.click();
  }

  async clickForgotPassword(): Promise<void> {
    await this.forgotPasswordLink.click();
  }

  async toggleRememberMe(): Promise<void> {
    await this.rememberMeCheckbox.click();
  }

  async login(username: string, password: string): Promise<void> {
    await this.enterUsername(username);
    await this.enterPassword(password);
    await this.clickLoginButton();
  }

  async isErrorVisible(): Promise<boolean> {
    return await this.errorMessage.isVisible();
  }

  async getErrorText(): Promise<string> {
    return await this.errorMessage.textContent() || '';
  }
}
```

#### 3. Test Data File Format

```json
// File: data/artifacts/test-scripts/fixtures/login-data.json

{
  "metadata": {
    "generated": "2025-08-19T12:00:00Z",
    "agent": "test-writer-001",
    "version": "1.0.0",
    "description": "Test data for login functionality tests"
  },
  "validUser": {
    "username": "testuser@example.com",
    "password": "SecurePassword123!",
    "firstName": "Test",
    "lastName": "User",
    "role": "user"
  },
  "invalidUser": {
    "username": "invalid@example.com",
    "password": "wrongpassword"
  },
  "adminUser": {
    "username": "admin@example.com",
    "password": "AdminPassword123!",
    "firstName": "Admin",
    "lastName": "User",
    "role": "admin"
  },
  "testScenarios": [
    {
      "name": "Valid Login",
      "username": "testuser@example.com",
      "password": "SecurePassword123!",
      "expectedResult": "success"
    },
    {
      "name": "Invalid Username",
      "username": "nonexistent@example.com",
      "password": "SecurePassword123!",
      "expectedResult": "error",
      "expectedMessage": "Invalid username or password"
    },
    {
      "name": "Invalid Password",
      "username": "testuser@example.com",
      "password": "wrongpassword",
      "expectedResult": "error",
      "expectedMessage": "Invalid username or password"
    },
    {
      "name": "Empty Username",
      "username": "",
      "password": "SecurePassword123!",
      "expectedResult": "validation_error",
      "expectedMessage": "Username is required"
    },
    {
      "name": "Empty Password",
      "username": "testuser@example.com",
      "password": "",
      "expectedResult": "validation_error",
      "expectedMessage": "Password is required"
    }
  ]
}
```

---

## Integration Specifications

### 1. Playwright MCP Integration

#### Connection Configuration

```typescript
interface PlaywrightMCPConfig {
  server: {
    host: string;
    port: number;
    protocol: 'http' | 'https';
    timeout: number;
  };
  authentication: {
    type: 'none' | 'api_key' | 'oauth';
    credentials?: {
      apiKey?: string;
      clientId?: string;
      clientSecret?: string;
    };
  };
  capabilities: {
    browsers: BrowserCapability[];
    devices: DeviceCapability[];
    features: FeatureCapability[];
  };
  limits: {
    maxConcurrentSessions: number;
    sessionTimeout: number;
    maxScreenshotSize: number;
    maxVideoLength: number;
  };
}

interface BrowserCapability {
  name: 'chromium' | 'firefox' | 'webkit';
  version: string;
  headless: boolean;
  extensions: string[];
}

interface DeviceCapability {
  name: string;
  viewport: { width: number; height: number };
  userAgent: string;
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
}
```

#### MCP Tool Specifications

```typescript
// Browser Control Tools
interface BrowserControlTools {
  // Navigation
  navigate: {
    input: { url: string; waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' };
    output: { success: boolean; finalUrl: string; loadTime: number };
  };
  
  // Element Interaction
  click: {
    input: { selector: string; options?: ClickOptions };
    output: { success: boolean; elementFound: boolean };
  };
  
  fill: {
    input: { selector: string; value: string; options?: FillOptions };
    output: { success: boolean; elementFound: boolean };
  };
  
  // Assertions
  expectVisible: {
    input: { selector: string; timeout?: number };
    output: { success: boolean; visible: boolean; error?: string };
  };
  
  expectText: {
    input: { selector: string; text: string; exact?: boolean };
    output: { success: boolean; actualText: string; matches: boolean };
  };
  
  // Screenshots
  screenshot: {
    input: { fullPage?: boolean; clip?: ScreenshotClip };
    output: { success: boolean; path: string; size: number };
  };
  
  // Performance
  getMetrics: {
    input: { includeResources?: boolean };
    output: { 
      success: boolean; 
      metrics: PerformanceMetrics;
      resources?: ResourceTiming[];
    };
  };
  
  // Accessibility
  getAccessibilityTree: {
    input: { selector?: string };
    output: { 
      success: boolean; 
      tree: AccessibilityNode[];
      violations: AccessibilityViolation[];
    };
  };
}

// Network Monitoring Tools
interface NetworkMonitoringTools {
  startNetworkMonitoring: {
    input: { captureBody?: boolean; captureHeaders?: boolean };
    output: { success: boolean; sessionId: string };
  };
  
  stopNetworkMonitoring: {
    input: { sessionId: string };
    output: { 
      success: boolean; 
      requests: NetworkRequest[];
      summary: NetworkSummary;
    };
  };
  
  mockResponse: {
    input: { 
      url: string | RegExp; 
      response: MockResponse;
      once?: boolean;
    };
    output: { success: boolean; mockId: string };
  };
}
```

#### Error Handling

```typescript
interface PlaywrightMCPError {
  type: 'connection' | 'timeout' | 'element_not_found' | 'navigation' | 'assertion';
  message: string;
  details: {
    selector?: string;
    url?: string;
    timeout?: number;
    stackTrace?: string;
  };
  recoverable: boolean;
  suggestedActions: string[];
}

class PlaywrightMCPClient {
  async handleError(error: PlaywrightMCPError): Promise<void> {
    switch (error.type) {
      case 'element_not_found':
        await this.retryWithAlternativeSelectors(error.details.selector);
        break;
      case 'timeout':
        await this.increaseTimeoutAndRetry(error.details.timeout);
        break;
      case 'navigation':
        await this.waitForNetworkIdleAndRetry();
        break;
      default:
        throw error;
    }
  }
}
```

### 2. OpenAI GPT-4 Integration

#### API Configuration

```typescript
interface OpenAIConfig {
  apiKey: string;
  organization?: string;
  baseURL?: string;
  model: 'gpt-4' | 'gpt-4-turbo' | 'gpt-4-32k';
  parameters: {
    temperature: number;
    maxTokens: number;
    topP: number;
    frequencyPenalty: number;
    presencePenalty: number;
  };
  rateLimiting: {
    requestsPerMinute: number;
    tokensPerMinute: number;
    retryPolicy: RetryPolicy;
  };
  safety: {
    contentFiltering: boolean;
    moderationCheck: boolean;
    maxInputLength: number;
  };
}
```

#### Prompt Templates

```typescript
interface PromptTemplate {
  name: string;
  version: string;
  description: string;
  template: string;
  variables: PromptVariable[];
  examples: PromptExample[];
  validation: PromptValidation;
}

interface PromptVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  defaultValue?: any;
  validation?: ValidationRule[];
}

// Test Generation Prompt Template
const TEST_GENERATION_PROMPT: PromptTemplate = {
  name: 'test_generation',
  version: '1.0.0',
  description: 'Generate Playwright test code from requirements',
  template: `
You are an expert test automation engineer. Generate a comprehensive Playwright test script based on the following requirements:

**Website URL**: {{url}}
**Test Type**: {{testType}}
**Description**: {{description}}

**Requirements**:
{{#each requirements}}
- {{this}}
{{/each}}

**Acceptance Criteria**:
{{#each acceptanceCriteria}}
- {{this}}
{{/each}}

**Existing Page Objects**:
{{#each pageObjects}}
- {{this.name}}: {{this.description}}
{{/each}}

Generate a complete test script that includes:
1. Proper imports and setup
2. Test structure with describe/it blocks
3. Page object usage (create new ones if needed)
4. Comprehensive assertions
5. Error handling
6. Comments explaining the test logic

The test should be robust, maintainable, and follow best practices.
`,
  variables: [
    {
      name: 'url',
      type: 'string',
      required: true,
      description: 'Target website URL'
    },
    {
      name: 'testType',
      type: 'string',
      required: true,
      description: 'Type of test (functional, accessibility, performance)'
    },
    {
      name: 'description',
      type: 'string',
      required: true,
      description: 'Test description'
    },
    {
      name: 'requirements',
      type: 'array',
      required: true,
      description: 'List of requirements'
    },
    {
      name: 'acceptanceCriteria',
      type: 'array',
      required: true,
      description: 'List of acceptance criteria'
    },
    {
      name: 'pageObjects',
      type: 'array',
      required: false,
      description: 'Existing page objects'
    }
  ],
  examples: [],
  validation: {
    maxTokens: 4000,
    requiredSections: ['imports', 'test', 'assertions']
  }
};
```

#### Response Processing

```typescript
interface GPT4Response {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: GPT4Choice[];
  usage: TokenUsage;
}

interface GPT4Choice {
  index: number;
  message: {
    role: 'assistant';
    content: string;
  };
  finishReason: 'stop' | 'length' | 'content_filter';
}

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

class GPT4ResponseProcessor {
  async processTestGenerationResponse(response: GPT4Response): Promise<GeneratedTest> {
    const content = response.choices[0].message.content;
    
    // Extract code blocks
    const codeBlocks = this.extractCodeBlocks(content);
    
    // Parse test structure
    const testStructure = this.parseTestStructure(codeBlocks.test);
    
    // Extract page objects
    const pageObjects = this.extractPageObjects(codeBlocks.pageObjects);
    
    // Validate generated code
    const validation = await this.validateGeneratedCode(codeBlocks.test);
    
    return {
      testCode: codeBlocks.test,
      pageObjects,
      testStructure,
      validation,
      metadata: {
        model: response.model,
        tokensUsed: response.usage.totalTokens,
        generatedAt: new Date(),
        confidence: this.calculateConfidence(content)
      }
    };
  }
  
  private extractCodeBlocks(content: string): { [key: string]: string } {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const blocks: { [key: string]: string } = {};
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1] || 'unknown';
      const code = match[2].trim();
      blocks[language] = code;
    }
    
    return blocks;
  }
}
```

### 3. GitHub Actions Integration

#### Workflow Configuration

```yaml
# .github/workflows/multi-agent-testing.yml
name: Multi-Agent Testing Framework

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:
    inputs:
      test_suite:
        description: 'Test suite to run'
        required: false
        default: 'all'
        type: choice
        options:
          - all
          - functional
          - accessibility
          - performance
      environment:
        description: 'Target environment'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production

env:
  NODE_VERSION: '18'
  FRAMEWORK_VERSION: '1.0.0'

jobs:
  setup:
    runs-on: ubuntu-latest
    outputs:
      test-matrix: ${{ steps.generate-matrix.outputs.matrix }}
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Generate test matrix
        id: generate-matrix
        run: |
          matrix=$(node scripts/generate-test-matrix.js \
            --suite="${{ github.event.inputs.test_suite || 'all' }}" \
            --environment="${{ github.event.inputs.environment || 'staging' }}")
          echo "matrix=$matrix" >> $GITHUB_OUTPUT

  test-execution:
    needs: setup
    runs-on: ubuntu-latest
    strategy:
      matrix: ${{ fromJson(needs.setup.outputs.test-matrix) }}
      fail-fast: false
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Setup testing environment
        uses: ./.github/actions/setup-testing-env
        with:
          node-version: ${{ env.NODE_VERSION }}
          browser: ${{ matrix.browser }}
          device: ${{ matrix.device }}
          
      - name: Start framework services
        run: |
          docker-compose -f docker-compose.ci.yml up -d
          npm run wait-for-services
          
      - name: Execute tests
        id: test-execution
        run: |
          npm run test:execute -- \
            --suite="${{ matrix.suite }}" \
            --browser="${{ matrix.browser }}" \
            --device="${{ matrix.device }}" \
            --environment="${{ matrix.environment }}" \
            --parallel=true \
            --output-format=json
            
      - name: Upload test artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-artifacts-${{ matrix.suite }}-${{ matrix.browser }}-${{ matrix.device }}
          path: |
            data/artifacts/screenshots/
            data/artifacts/videos/
            data/artifacts/traces/
            data/artifacts/reports/
          retention-days: 30
          
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-${{ matrix.suite }}-${{ matrix.browser }}-${{ matrix.device }}
          path: |
            test-results.json
            coverage-report.json
          retention-days: 90

  report-generation:
    needs: test-execution
    if: always()
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Download all test results
        uses: actions/download-artifact@v4
        with:
          pattern: test-results-*
          path: ./test-results
          
      - name: Download all test artifacts
        uses: actions/download-artifact@v4
        with:
          pattern: test-artifacts-*
          path: ./test-artifacts
          
      - name: Generate comprehensive report
        run: |
          npm run report:generate -- \
            --input-dir=./test-results \
            --artifacts-dir=./test-artifacts \
            --format=html,pdf,json \
            --template=ci-cd \
            --output-dir=./reports
            
      - name: Upload reports
        uses: actions/upload-artifact@v4
        with:
          name: test-reports
          path: ./reports/
          retention-days: 90
          
      - name: Publish to GitHub Pages
        if: github.ref == 'refs/heads/main'
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./reports/html
          destination_dir: test-reports/${{ github.run_number }}

  notification:
    needs: [test-execution, report-generation]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - name: Calculate test results
        id: results
        run: |
          # Logic to calculate overall test results
          echo "status=success" >> $GITHUB_OUTPUT
          echo "pass_rate=95" >> $GITHUB_OUTPUT
          echo "total_tests=150" >> $GITHUB_OUTPUT
          
      - name: Notify Slack
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ steps.results.outputs.status }}
          channel: '#testing'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
          fields: repo,message,commit,author,action,eventName,ref,workflow
          custom_payload: |
            {
              "attachments": [{
                "color": "${{ steps.results.outputs.status == 'success' && 'good' || 'danger' }}",
                "title": "Multi-Agent Testing Results",
                "fields": [
                  {
                    "title": "Pass Rate",
                    "value": "${{ steps.results.outputs.pass_rate }}%",
                    "short": true
                  },
                  {
                    "title": "Total Tests",
                    "value": "${{ steps.results.outputs.total_tests }}",
                    "short": true
                  }
                ]
              }]
            }
```

#### Custom GitHub Actions

```yaml
# .github/actions/setup-testing-env/action.yml
name: 'Setup Testing Environment'
description: 'Setup the multi-agent testing framework environment'

inputs:
  node-version:
    description: 'Node.js version'
    required: true
    default: '18'
  browser:
    description: 'Browser to setup'
    required: true
  device:
    description: 'Device configuration'
    required: false
    default: 'desktop'

runs:
  using: 'composite'
  steps:
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
        cache: 'npm'
        
    - name: Install dependencies
      shell: bash
      run: npm ci
      
    - name: Install Playwright browsers
      shell: bash
      run: |
        npx playwright install ${{ inputs.browser }}
        npx playwright install-deps ${{ inputs.browser }}
        
    - name: Setup device configuration
      shell: bash
      run: |
        echo "Setting up device: ${{ inputs.device }}"
        node scripts/setup-device-config.js --device="${{ inputs.device }}"
        
    - name: Verify setup
      shell: bash
      run: |
        npm run verify:setup
        npx playwright --version
```

### 4. Elasticsearch/Kibana Integration

#### Elasticsearch Configuration

```typescript
interface ElasticsearchConfig {
  cluster: {
    name: string;
    nodes: ElasticsearchNode[];
  };
  indices: {
    logs: IndexConfig;
    metrics: IndexConfig;
    events: IndexConfig;
    testResults: IndexConfig;
  };
  security: {
    enabled: boolean;
    username?: string;
    password?: string;
    apiKey?: string;
    ssl?: SSLConfig;
  };
  performance: {
    bulkSize: number;
    flushInterval: number;
    maxRetries: number;
  };
}

interface IndexConfig {
  name: string;
  pattern: string;
  mappings: IndexMapping;
  settings: IndexSettings;
  lifecycle: LifecyclePolicy;
}

// Log Index Mapping
const LOG_INDEX_MAPPING: IndexMapping = {
  properties: {
    '@timestamp': { type: 'date' },
    level: { 
      type: 'keyword',
      fields: {
        text: { type: 'text' }
      }
    },
    message: { 
      type: 'text',
      analyzer: 'standard'
    },
    agent: {
      properties: {
        type: { type: 'keyword' },
        instanceId: { type: 'keyword' },
        nodeId: { type: 'keyword' }
      }
    },
    execution: {
      properties: {
        id: { type: 'keyword' },
        testCaseId: { type: 'keyword' },
        status: { type: 'keyword' }
      }
    },
    error: {
      properties: {
        type: { type: 'keyword' },
        message: { type: 'text' },
        stackTrace: { type: 'text' }
      }
    },
    performance: {
      properties: {
        duration: { type: 'long' },
        memoryUsage: { type: 'long' },
        cpuUsage: { type: 'float' }
      }
    },
    tags: { type: 'keyword' },
    metadata: { type: 'object', enabled: false }
  }
};

// Test Results Index Mapping
const TEST_RESULTS_INDEX_MAPPING: IndexMapping = {
  properties: {
    '@timestamp': { type: 'date' },
    executionId: { type: 'keyword' },
    testCaseId: { type: 'keyword' },
    testSuite: { type: 'keyword' },
    testName: { type: 'text' },
    status: { type: 'keyword' },
    duration: { type: 'long' },
    browser: { type: 'keyword' },
    device: { type: 'keyword' },
    environment: { type: 'keyword' },
    assertions: {
      type: 'nested',
      properties: {
        description: { type: 'text' },
        passed: { type: 'boolean' },
        expected: { type: 'text' },
        actual: { type: 'text' }
      }
    },
    performance: {
      properties: {
        lcp: { type: 'float' },
        fid: { type: 'float' },
        cls: { type: 'float' },
        fcp: { type: 'float' },
        ttfb: { type: 'float' }
      }
    },
    accessibility: {
      properties: {
        score: { type: 'integer' },
        level: { type: 'keyword' },
        violations: { type: 'integer' },
        passes: { type: 'integer' }
      }
    },
    artifacts: {
      type: 'nested',
      properties: {
        type: { type: 'keyword' },
        path: { type: 'keyword' },
        size: { type: 'long' }
      }
    },
    tags: { type: 'keyword' }
  }
};
```

#### Kibana Dashboard Configuration

```json
{
  "version": "8.0.0",
  "objects": [
    {
      "id": "test-execution-overview",
      "type": "dashboard",
      "attributes": {
        "title": "Test Execution Overview",
        "description": "Overview of test execution metrics and trends",
        "panelsJSON": "[{\"version\":\"8.0.0\",\"gridData\":{\"x\":0,\"y\":0,\"w\":24,\"h\":15,\"i\":\"1\"},\"panelIndex\":\"1\",\"embeddableConfig\":{},\"panelRefName\":\"panel_1\"}]",
        "timeRestore": true,
        "timeTo": "now",
        "timeFrom": "now-7d",
        "refreshInterval": {
          "pause": false,
          "value": 300000
        }
      },
      "references": [
        {
          "name": "panel_1",
          "type": "visualization",
          "id": "test-pass-rate-trend"
        }
      ]
    },
    {
      "id": "test-pass-rate-trend",
      "type": "visualization",
      "attributes": {
        "title": "Test Pass Rate Trend",
        "visState": "{\"title\":\"Test Pass Rate Trend\",\"type\":\"line\",\"params\":{\"grid\":{\"categoryLines\":false,\"style\":{\"color\":\"#eee\"}},\"categoryAxes\":[{\"id\":\"CategoryAxis-1\",\"type\":\"category\",\"position\":\"bottom\",\"show\":true,\"style\":{},\"scale\":{\"type\":\"linear\"},\"labels\":{\"show\":true,\"truncate\":100},\"title\":{}}],\"valueAxes\":[{\"id\":\"ValueAxis-1\",\"name\":\"LeftAxis-1\",\"type\":\"value\",\"position\":\"left\",\"show\":true,\"style\":{},\"scale\":{\"type\":\"linear\",\"mode\":\"normal\"},\"labels\":{\"show\":true,\"rotate\":0,\"filter\":false,\"truncate\":100},\"title\":{\"text\":\"Pass Rate (%)\"}}],\"seriesParams\":[{\"show\":true,\"type\":\"line\",\"mode\":\"normal\",\"data\":{\"label\":\"Pass Rate\",\"id\":\"1\"},\"valueAxis\":\"ValueAxis-1\",\"drawLinesBetweenPoints\":true,\"showCircles\":true}],\"addTooltip\":true,\"addLegend\":true,\"legendPosition\":\"right\",\"times\":[],\"addTimeMarker\":false},\"aggs\":[{\"id\":\"1\",\"enabled\":true,\"type\":\"avg\",\"schema\":\"metric\",\"params\":{\"field\":\"passRate\"}},{\"id\":\"2\",\"enabled\":true,\"type\":\"date_histogram\",\"schema\":\"segment\",\"params\":{\"field\":\"@timestamp\",\"interval\":\"auto\",\"customInterval\":\"2h\",\"min_doc_count\":1,\"extended_bounds\":{}}}]}",
        "uiStateJSON": "{}",
        "kibanaSavedObjectMeta": {
          "searchSourceJSON": "{\"index\":\"test-results-*\",\"query\":{\"match_all\":{}},\"filter\":[]}"
        }
      }
    }
  ]
}
```

#### Data Shipping Configuration

```typescript
class ElasticsearchShipper {
  private client: ElasticsearchClient;
  private bulkProcessor: BulkProcessor;
  
  constructor(config: ElasticsearchConfig) {
    this.client = new ElasticsearchClient(config);
    this.bulkProcessor = new BulkProcessor({
      client: this.client,
      bulkSize: config.performance.bulkSize,
      flushInterval: config.performance.flushInterval,
      maxRetries: config.performance.maxRetries
    });
  }
  
  async shipLogs(logs: LogEntry[]): Promise<void> {
    const documents = logs.map(log => ({
      index: {
        _index: this.getLogIndex(log.timestamp),
        _type: '_doc'
      },
      doc: {
        '@timestamp': log.timestamp,
        level: log.level,
        message: log.message,
        agent: log.agent,
        execution: log.execution,
        error: log.error,
        performance: log.performance,
        tags: log.tags,
        metadata: log.metadata
      }
    }));
    
    await this.bulkProcessor.add(documents);
  }
  
  async shipTestResults(results: TestResult[]): Promise<void> {
    const documents = results.map(result => ({
      index: {
        _index: this.getTestResultsIndex(result.timestamp),
        _type: '_doc'
      },
      doc: {
        '@timestamp': result.timestamp,
        executionId: result.executionId,
        testCaseId: result.testCaseId,
        testSuite: result.testSuite,
        testName: result.testName,
        status: result.status,
        duration: result.duration,
        browser: result.browser,
        device: result.device,
        environment: result.environment,
        assertions: result.assertions,
        performance: result.performance,
        accessibility: result.accessibility,
        artifacts: result.artifacts,
        tags: result.tags
      }
    }));
    
    await this.bulkProcessor.add(documents);
  }
  
  private getLogIndex(timestamp: Date): string {
    const date = timestamp.toISOString().split('T')[0];
    return `logs-${date}`;
  }
  
  private getTestResultsIndex(timestamp: Date): string {
    const date = timestamp.toISOString().split('T')[0];
    return `test-results-${date}`;
  }
}
```

---

## Configuration Management

### 1. Configuration Schema

```typescript
interface SystemConfiguration {
  // System Information
  system: {
    name: string;
    version: string;
    environment: Environment;
    instanceId: string;
    nodeId: string;
    dataDirectory: string;
    tempDirectory: string;
    logLevel: LogLevel;
    timezone: string;
  };
  
  // Agent Configuration
  agents: {
    [K in AgentType]: AgentConfiguration;
  };
  
  // Communication Configuration
  communication: {
    messageQueue: MessageQueueConfig;
    eventBus: EventBusConfig;
    sharedMemory: SharedMemoryConfig;
    protocols: ProtocolConfig;
  };
  
  // Integration Configuration
  integrations: {
    playwright: PlaywrightConfig;
    openai: OpenAIConfig;
    monitoring: MonitoringConfig;
    storage: StorageConfig;
    cicd: CICDConfig;
  };
  
  // Security Configuration
  security: {
    authentication: AuthenticationConfig;
    authorization: AuthorizationConfig;
    encryption: EncryptionConfig;
    rateLimiting: RateLimitingConfig;
    audit: AuditConfig;
  };
  
  // Performance Configuration
  performance: {
    execution: ExecutionConfig;
    resource: ResourceConfig;
    optimization: OptimizationConfig;
    monitoring: PerformanceMonitoringConfig;
  };
  
  // Feature Flags
  features: {
    [featureName: string]: FeatureFlag;
  };
}

interface AgentConfiguration {
  enabled: boolean;
  instances: number;
  resources: {
    cpu: ResourceLimit;
    memory: ResourceLimit;
    storage: ResourceLimit;
  };
  concurrency: {
    maxConcurrentTasks: number;
    queueSize: number;
    timeout: number;
  };
  retry: RetryPolicy;
  health: HealthCheckConfig;
  logging: LoggingConfig;
  metrics: MetricsConfig;
  specific: Record<string, any>; // Agent-specific configuration
}

interface FeatureFlag {
  enabled: boolean;
  rolloutPercentage: number;
  conditions: FeatureCondition[];
  metadata: {
    description: string;
    owner: string;
    createdAt: Date;
    expiresAt?: Date;
  };
}
```

### 2. Configuration Loading and Validation

```typescript
class ConfigurationManager {
  private config: SystemConfiguration;
  private watchers: Map<string, ConfigWatcher> = new Map();
  private validators: Map<string, ConfigValidator> = new Map();
  
  constructor() {
    this.registerValidators();
  }
  
  async loadConfiguration(): Promise<SystemConfiguration> {
    // Load base configuration
    const baseConfig = await this.loadBaseConfig();
    
    // Load environment-specific overrides
    const envConfig = await this.loadEnvironmentConfig();
    
    // Load local overrides
    const localConfig = await this.loadLocalConfig();
    
    // Merge configurations
    this.config = this.mergeConfigurations([baseConfig, envConfig, localConfig]);
    
    // Validate configuration
    await this.validateConfiguration(this.config);
    
    // Process environment variables
    this.config = this.processEnvironmentVariables(this.config);
    
    // Decrypt sensitive values
    this.config = await this.decryptSensitiveValues(this.config);
    
    return this.config;
  }
  
  async validateConfiguration(config: SystemConfiguration): Promise<void> {
    const errors: ConfigurationError[] = [];
    
    // Validate each section
    for (const [section, validator] of this.validators) {
      try {
        await validator.validate(config[section]);
      } catch (error) {
        errors.push(new ConfigurationError(section, error.message));
      }
    }
    
    // Check cross-section dependencies
    errors.push(...this.validateDependencies(config));
    
    if (errors.length > 0) {
      throw new ConfigurationValidationError(errors);
    }
  }
  
  private registerValidators(): void {
    this.validators.set('system', new SystemConfigValidator());
    this.validators.set('agents', new AgentsConfigValidator());
    this.validators.set('communication', new CommunicationConfigValidator());
    this.validators.set('integrations', new IntegrationsConfigValidator());
    this.validators.set('security', new SecurityConfigValidator());
    this.validators.set('performance', new PerformanceConfigValidator());
  }
  
  private validateDependencies(config: SystemConfiguration): ConfigurationError[] {
    const errors: ConfigurationError[] = [];
    
    // Validate agent dependencies
    if (config.agents.testExecutor.enabled && !config.integrations.playwright.enabled) {
      errors.push(new ConfigurationError(
        'agents.testExecutor',
        'Test Executor requires Playwright integration to be enabled'
      ));
    }
    
    if (config.agents.testWriter.enabled && !config.integrations.openai.enabled) {
      errors.push(new ConfigurationError(
        'agents.testWriter',
        'Test Writer requires OpenAI integration to be enabled'
      ));
    }
    
    // Validate resource constraints
    const totalCpuLimit = Object.values(config.agents)
      .filter(agent => agent.enabled)
      .reduce((sum, agent) => sum + agent.resources.cpu.limit, 0);
      
    if (totalCpuLimit > config.performance.resource.totalCpuLimit) {
      errors.push(new ConfigurationError(
        'performance.resource',
        `Total agent CPU limit (${totalCpuLimit}) exceeds system limit (${config.performance.resource.totalCpuLimit})`
      ));
    }
    
    return errors;
  }
  
  watchConfiguration(path: string, callback: ConfigChangeCallback): void {
    const watcher = new ConfigWatcher(path, callback);
    this.watchers.set(path, watcher);
    watcher.start();
  }
  
  async updateConfiguration(path: string, value: any): Promise<void> {
    // Validate the update
    await this.validateConfigurationUpdate(path, value);
    
    // Apply the update
    this.setConfigValue(this.config, path, value);
    
    // Persist the change
    await this.persistConfiguration();
    
    // Notify watchers
    this.notifyWatchers(path, value);
  }
}
```

### 3. Environment-Specific Configuration

```typescript
// config/environments/development.json
{
  "system": {
    "logLevel": "debug",
    "environment": "development"
  },
  "agents": {
    "testWriter": {
      "instances": 1,
      "concurrency": {
        "maxConcurrentTasks": 2
      }
    },
    "testExecutor": {
      "instances": 2,
      "concurrency": {
        "maxConcurrentExecutions": 5
      }
    }
  },
  "integrations": {
    "playwright": {
      "headless": false,
      "slowMo": 100
    },
    "openai": {
      "rateLimiting": {
        "requestsPerMinute": 20
      }
    }
  },
  "features": {
    "advancedReporting": {
      "enabled": true,
      "rolloutPercentage": 100
    },
    "aiOptimization": {
      "enabled": false,
      "rolloutPercentage": 0
    }
  }
}

// config/environments/production.json
{
  "system": {
    "logLevel": "info",
    "environment": "production"
  },
  "agents": {
    "testWriter": {
      "instances": 3,
      "concurrency": {
        "maxConcurrentTasks": 10
      }
    },
    "testExecutor": {
      "instances": 8,
      "concurrency": {
        "maxConcurrentExecutions": 50
      }
    }
  },
  "integrations": {
    "playwright": {
      "headless": true,
      "slowMo": 0
    },
    "openai": {
      "rateLimiting": {
        "requestsPerMinute": 100
      }
    }
  },
  "security": {
    "rateLimiting": {
      "enabled": true,
      "windowMs": 900000,
      "max": 10000
    }
  },
  "features": {
    "advancedReporting": {
      "enabled": true,
      "rolloutPercentage": 100
    },
    "aiOptimization": {
      "enabled": true,
      "rolloutPercentage": 50
    }
  }
}
```

### 4. Configuration Hot Reloading

```typescript
class ConfigurationHotReloader {
  private configManager: ConfigurationManager;
  private fileWatchers: Map<string, FileWatcher> = new Map();
  private reloadCallbacks: Map<string, ReloadCallback[]> = new Map();
  
  constructor(configManager: ConfigurationManager) {
    this.configManager = configManager;
  }
  
  startWatching(): void {
    const configFiles = [
      'config/default.json',
      `config/environments/${process.env.NODE_ENV}.json`,
      'config/local.json'
    ];
    
    configFiles.forEach(file => {
      if (fs.existsSync(file)) {
        const watcher = new FileWatcher(file, this.handleConfigChange.bind(this));
        this.fileWatchers.set(file, watcher);
        watcher.start();
      }
    });
  }
  
  private async handleConfigChange(filePath: string): Promise<void> {
    try {
      console.log(`Configuration file changed: ${filePath}`);
      
      // Reload configuration
      const newConfig = await this.configManager.loadConfiguration();
      
      // Validate new configuration
      await this.configManager.validateConfiguration(newConfig);
      
      // Apply configuration changes
      await this.applyConfigurationChanges(newConfig);
      
      // Notify callbacks
      this.notifyReloadCallbacks(filePath, newConfig);
      
      console.log('Configuration reloaded successfully');
    } catch (error) {
      console.error('Failed to reload configuration:', error);
      // Optionally revert to previous configuration
    }
  }
  
  private async applyConfigurationChanges(newConfig: SystemConfiguration): Promise<void> {
    // Restart agents if their configuration changed
    for (const [agentType, agentConfig] of Object.entries(newConfig.agents)) {
      if (this.hasAgentConfigChanged(agentType, agentConfig)) {
        await this.restartAgent(agentType as AgentType);
      }
    }
    
    // Update integration configurations
    if (this.hasIntegrationConfigChanged(newConfig.integrations)) {
      await this.updateIntegrations(newConfig.integrations);
    }
    
    // Update security settings
    if (this.hasSecurityConfigChanged(newConfig.security)) {
      await this.updateSecuritySettings(newConfig.security);
    }
  }
  
  onConfigurationReload(section: string, callback: ReloadCallback): void {
    if (!this.reloadCallbacks.has(section)) {
      this.reloadCallbacks.set(section, []);
    }
    this.reloadCallbacks.get(section)!.push(callback);
  }
}
```

---

## Environment Setup

### 1. System Requirements

#### Hardware Requirements

```yaml
minimum:
  cpu: 4 cores
  memory: 8 GB RAM
  storage: 50 GB SSD
  network: 100 Mbps

recommended:
  cpu: 8 cores
  memory: 16 GB RAM
  storage: 200 GB SSD
  network: 1 Gbps

production:
  cpu: 16+ cores
  memory: 32+ GB RAM
  storage: 500+ GB SSD
  network: 10 Gbps
```

#### Software Requirements

```yaml
operating_system:
  - Ubuntu 20.04+ LTS
  - CentOS 8+
  - macOS 12+
  - Windows 10+ (with WSL2)

runtime:
  - Node.js 18.0+
  - Python 3.9+ (for monitoring scripts)
  - Docker 20.10+
  - Docker Compose 2.0+

databases:
  - Redis 6.0+
  - SQLite 3.35+
  - InfluxDB 2.0+ (optional)

browsers:
  - Chromium 90+
  - Firefox 88+
  - WebKit (Safari) 14+

monitoring:
  - Prometheus 2.30+
  - Grafana 8.0+
  - Elasticsearch 8.0+ (optional)
  - Kibana 8.0+ (optional)
```

### 2. Installation Scripts

#### Main Setup Script

```bash
#!/bin/bash
# scripts/setup.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NODE_VERSION="18"
FRAMEWORK_DIR="/home/ubuntu/multi_agent_testing_framework"
DATA_DIR="$FRAMEWORK_DIR/data"
CONFIG_DIR="$FRAMEWORK_DIR/config"

echo -e "${GREEN}Multi-Agent Testing Framework Setup${NC}"
echo "======================================"

# Check system requirements
check_system_requirements() {
    echo -e "${YELLOW}Checking system requirements...${NC}"
    
    # Check OS
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "✓ Linux detected"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "✓ macOS detected"
    else
        echo -e "${RED}✗ Unsupported operating system${NC}"
        exit 1
    fi
    
    # Check memory
    MEMORY_GB=$(free -g | awk '/^Mem:/{print $2}')
    if [ "$MEMORY_GB" -lt 8 ]; then
        echo -e "${RED}✗ Insufficient memory: ${MEMORY_GB}GB (minimum 8GB required)${NC}"
        exit 1
    fi
    echo "✓ Memory: ${MEMORY_GB}GB"
    
    # Check disk space
    DISK_GB=$(df -BG "$HOME" | awk 'NR==2{print $4}' | sed 's/G//')
    if [ "$DISK_GB" -lt 50 ]; then
        echo -e "${RED}✗ Insufficient disk space: ${DISK_GB}GB (minimum 50GB required)${NC}"
        exit 1
    fi
    echo "✓ Disk space: ${DISK_GB}GB available"
}

# Install Node.js
install_nodejs() {
    echo -e "${YELLOW}Installing Node.js ${NODE_VERSION}...${NC}"
    
    if command -v node &> /dev/null; then
        NODE_CURRENT=$(node --version | sed 's/v//' | cut -d. -f1)
        if [ "$NODE_CURRENT" -ge "$NODE_VERSION" ]; then
            echo "✓ Node.js $NODE_CURRENT already installed"
            return
        fi
    fi
    
    # Install Node.js using NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    echo "✓ Node.js $(node --version) installed"
}

# Install system dependencies
install_system_dependencies() {
    echo -e "${YELLOW}Installing system dependencies...${NC}"
    
    sudo apt-get update
    sudo apt-get install -y \
        curl \
        wget \
        git \
        build-essential \
        python3 \
        python3-pip \
        sqlite3 \
        redis-server \
        nginx \
        certbot \
        jq \
        htop \
        unzip
    
    echo "✓ System dependencies installed"
}

# Install Docker
install_docker() {
    echo -e "${YELLOW}Installing Docker...${NC}"
    
    if command -v docker &> /dev/null; then
        echo "✓ Docker already installed"
        return
    fi
    
    # Install Docker
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    
    # Install Docker Compose
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    
    echo "✓ Docker and Docker Compose installed"
    echo -e "${YELLOW}Note: You may need to log out and back in for Docker permissions to take effect${NC}"
}

# Setup project structure
setup_project_structure() {
    echo -e "${YELLOW}Setting up project structure...${NC}"
    
    # Create main directories
    mkdir -p "$DATA_DIR"/{sqlite,artifacts,cache,logs,metrics}
    mkdir -p "$DATA_DIR/artifacts"/{test-scripts,screenshots,videos,traces,reports}
    mkdir -p "$DATA_DIR/logs"/{agents,system,api}
    mkdir -p "$DATA_DIR/logs/agents"/{test-writer,test-executor,report-generator,test-optimizer,context-manager,logger}
    
    # Set permissions
    chmod -R 755 "$DATA_DIR"
    
    echo "✓ Project structure created"
}

# Install Node.js dependencies
install_node_dependencies() {
    echo -e "${YELLOW}Installing Node.js dependencies...${NC}"
    
    cd "$FRAMEWORK_DIR"
    
    if [ ! -f "package.json" ]; then
        echo -e "${RED}✗ package.json not found${NC}"
        exit 1
    fi
    
    npm install
    
    echo "✓ Node.js dependencies installed"
}

# Install Playwright browsers
install_playwright_browsers() {
    echo -e "${YELLOW}Installing Playwright browsers...${NC}"
    
    cd "$FRAMEWORK_DIR"
    npx playwright install
    npx playwright install-deps
    
    echo "✓ Playwright browsers installed"
}

# Setup configuration
setup_configuration() {
    echo -e "${YELLOW}Setting up configuration...${NC}"
    
    # Copy example configuration if it doesn't exist
    if [ ! -f "$CONFIG_DIR/local.json" ]; then
        if [ -f "$CONFIG_DIR/local.example.json" ]; then
            cp "$CONFIG_DIR/local.example.json" "$CONFIG_DIR/local.json"
            echo "✓ Local configuration created from example"
        fi
    fi
    
    # Generate JWT secret if not exists
    if ! grep -q "JWT_SECRET" "$FRAMEWORK_DIR/.env" 2>/dev/null; then
        JWT_SECRET=$(openssl rand -base64 32)
        echo "JWT_SECRET=$JWT_SECRET" >> "$FRAMEWORK_DIR/.env"
        echo "✓ JWT secret generated"
    fi
    
    echo "✓ Configuration setup complete"
}

# Setup services
setup_services() {
    echo -e "${YELLOW}Setting up services...${NC}"
    
    # Start Redis
    sudo systemctl enable redis-server
    sudo systemctl start redis-server
    
    # Configure Redis for the framework
    sudo tee /etc/redis/redis-framework.conf > /dev/null <<EOF
port 6379
bind 127.0.0.1
maxmemory 1gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
EOF
    
    echo "✓ Services configured"
}

# Setup monitoring (optional)
setup_monitoring() {
    echo -e "${YELLOW}Setting up monitoring (optional)...${NC}"
    
    read -p "Do you want to install monitoring tools (Prometheus, Grafana)? [y/N]: " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Install Prometheus
        PROMETHEUS_VERSION="2.40.0"
        wget "https://github.com/prometheus/prometheus/releases/download/v${PROMETHEUS_VERSION}/prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz"
        tar xvfz "prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz"
        sudo mv "prometheus-${PROMETHEUS_VERSION}.linux-amd64/prometheus" /usr/local/bin/
        sudo mv "prometheus-${PROMETHEUS_VERSION}.linux-amd64/promtool" /usr/local/bin/
        rm -rf "prometheus-${PROMETHEUS_VERSION}.linux-amd64"*
        
        # Install Grafana
        sudo apt-get install -y software-properties-common
        sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
        wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
        sudo apt-get update
        sudo apt-get install -y grafana
        
        sudo systemctl enable grafana-server
        sudo systemctl start grafana-server
        
        echo "✓ Monitoring tools installed"
        echo "  - Prometheus: http://localhost:9090"
        echo "  - Grafana: http://localhost:3000 (admin/admin)"
    else
        echo "✓ Monitoring setup skipped"
    fi
}

# Verify installation
verify_installation() {
    echo -e "${YELLOW}Verifying installation...${NC}"
    
    cd "$FRAMEWORK_DIR"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}✗ Node.js not found${NC}"
        exit 1
    fi
    
    # Check npm dependencies
    if ! npm list --depth=0 &> /dev/null; then
        echo -e "${RED}✗ npm dependencies not properly installed${NC}"
        exit 1
    fi
    
    # Check Playwright
    if ! npx playwright --version &> /dev/null; then
        echo -e "${RED}✗ Playwright not properly installed${NC}"
        exit 1
    fi
    
    # Check Redis
    if ! redis-cli ping &> /dev/null; then
        echo -e "${RED}✗ Redis not running${NC}"
        exit 1
    fi
    
    # Check configuration
    if [ ! -f "$CONFIG_DIR/default.json" ]; then
        echo -e "${RED}✗ Default configuration not found${NC}"
        exit 1
    fi
    
    echo "✓ Installation verified successfully"
}

# Main installation flow
main() {
    check_system_requirements
    install_system_dependencies
    install_nodejs
    install_docker
    setup_project_structure
    install_node_dependencies
    install_playwright_browsers
    setup_configuration
    setup_services
    setup_monitoring
    verify_installation
    
    echo
    echo -e "${GREEN}Setup completed successfully!${NC}"
    echo
    echo "Next steps:"
    echo "1. Review and customize configuration in $CONFIG_DIR/"
    echo "2. Start the framework: npm run start"
    echo "3. Access the API at: http://localhost:3000"
    echo "4. View logs in: $DATA_DIR/logs/"
    echo
    echo "For more information, see the documentation in docs/"
}

# Run main function
main "$@"
```

#### Service Management Scripts

```bash
#!/bin/bash
# scripts/start-services.sh

set -e

FRAMEWORK_DIR="/home/ubuntu/multi_agent_testing_framework"
SERVICES=("redis" "prometheus" "grafana")

echo "Starting Multi-Agent Testing Framework services..."

# Start Redis
echo "Starting Redis..."
sudo systemctl start redis-server
if systemctl is-active --quiet redis-server; then
    echo "✓ Redis started"
else
    echo "✗ Failed to start Redis"
    exit 1
fi

# Start Prometheus (if installed)
if command -v prometheus &> /dev/null; then
    echo "Starting Prometheus..."
    nohup prometheus --config.file="$FRAMEWORK_DIR/monitoring/prometheus/prometheus.yml" \
                    --storage.tsdb.path="$FRAMEWORK_DIR/data/metrics/prometheus" \
                    --web.console.templates="$FRAMEWORK_DIR/monitoring/prometheus/consoles" \
                    --web.console.libraries="$FRAMEWORK_DIR/monitoring/prometheus/console_libraries" \
                    --web.listen-address=":9090" > "$FRAMEWORK_DIR/data/logs/prometheus.log" 2>&1 &
    echo $! > "$FRAMEWORK_DIR/data/prometheus.pid"
    echo "✓ Prometheus started"
fi

# Start Grafana (if installed)
if systemctl list-unit-files | grep -q grafana-server; then
    echo "Starting Grafana..."
    sudo systemctl start grafana-server
    if systemctl is-active --quiet grafana-server; then
        echo "✓ Grafana started"
    else
        echo "✗ Failed to start Grafana"
    fi
fi

# Start the framework
echo "Starting Multi-Agent Testing Framework..."
cd "$FRAMEWORK_DIR"
npm run start:production &
echo $! > "$FRAMEWORK_DIR/data/framework.pid"

echo "✓ All services started successfully"
echo
echo "Service URLs:"
echo "- Framework API: http://localhost:3000"
echo "- Framework WebSocket: ws://localhost:8080"
echo "- Prometheus: http://localhost:9090"
echo "- Grafana: http://localhost:3000"
echo "- Redis: localhost:6379"
```

### 3. Docker Setup

#### Development Docker Compose

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  framework:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
      - "8080:8080"
      - "9229:9229"  # Debug port
    environment:
      - NODE_ENV=development
      - DEBUG=framework:*
      - REDIS_URL=redis://redis:6379
    volumes:
      - .:/app
      - /app/node_modules
      - ./data:/app/data
      - ./config:/app/config
    depends_on:
      - redis
      - prometheus
    command: npm run dev

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
      - ./monitoring/redis/redis.conf:/usr/local/etc/redis/redis.conf
    command: redis-server /usr/local/etc/redis/redis.conf

  prometheus:
    image: prom/prometheus:v2.40.0
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./monitoring/prometheus/rules:/etc/prometheus/rules
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'

  grafana:
    image: grafana/grafana:9.0.0
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.5.0
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

  kibana:
    image: docker.elastic.co/kibana/kibana:8.5.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    depends_on:
      - elasticsearch

volumes:
  redis_data:
  prometheus_data:
  grafana_data:
  elasticsearch_data:
```

#### Production Docker Compose

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  framework:
    build:
      context: .
      dockerfile: Dockerfile.prod
    ports:
      - "3000:3000"
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - LOG_LEVEL=info
    volumes:
      - ./data:/app/data
      - ./config/production.json:/app/config/production.json:ro
    depends_on:
      - redis
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
      - ./monitoring/redis/redis-prod.conf:/usr/local/etc/redis/redis.conf
    command: redis-server /usr/local/etc/redis/redis.conf
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 1G

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./deployment/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./deployment/nginx/ssl:/etc/nginx/ssl:ro
      - ./data/artifacts/reports:/usr/share/nginx/html/reports:ro
    depends_on:
      - framework
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:v2.40.0
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus/prometheus-prod.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    restart: unless-stopped

  grafana:
    image: grafana/grafana:9.0.0
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_SERVER_ROOT_URL=https://monitoring.yourdomain.com
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards:ro
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources:ro
    restart: unless-stopped

volumes:
  redis_data:
  prometheus_data:
  grafana_data:

networks:
  default:
    driver: bridge
```

### 4. Environment Variables

```bash
# .env.example

# System Configuration
NODE_ENV=development
LOG_LEVEL=info
PORT=3000
WEBSOCKET_PORT=8080

# Database Configuration
REDIS_URL=redis://localhost:6379
SQLITE_PATH=./data/sqlite/main.db

# Security
JWT_SECRET=your-super-secret-jwt-key-here
ENCRYPTION_KEY=your-32-character-encryption-key
API_RATE_LIMIT=1000

# OpenAI Integration
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_ORGANIZATION=your-openai-org-id
OPENAI_MODEL=gpt-4

# Playwright Configuration
PLAYWRIGHT_HEADLESS=true
PLAYWRIGHT_SLOW_MO=0
PLAYWRIGHT_TIMEOUT=30000

# Monitoring
PROMETHEUS_URL=http://localhost:9090
GRAFANA_URL=http://localhost:3001
ELASTICSEARCH_URL=http://localhost:9200

# External Services
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook/url
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=your-email@gmail.com
EMAIL_SMTP_PASS=your-app-password

# GitHub Integration
GITHUB_TOKEN=your-github-token
GITHUB_WEBHOOK_SECRET=your-webhook-secret

# Feature Flags
ENABLE_AI_OPTIMIZATION=false
ENABLE_ADVANCED_REPORTING=true
ENABLE_REAL_TIME_MONITORING=true

# Performance Tuning
MAX_CONCURRENT_TESTS=10
MAX_BROWSER_INSTANCES=20
TEST_TIMEOUT=600000
REPORT_GENERATION_TIMEOUT=300000

# Data Retention
LOG_RETENTION_DAYS=90
ARTIFACT_RETENTION_DAYS=30
METRICS_RETENTION_DAYS=365
```

---

## Error Handling Protocols

### 1. Error Classification System

```typescript
enum ErrorCategory {
  SYSTEM = 'system',
  AGENT = 'agent',
  INTEGRATION = 'integration',
  VALIDATION = 'validation',
  BUSINESS = 'business',
  SECURITY = 'security'
}

enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

enum ErrorRecoveryStrategy {
  RETRY = 'retry',
  FALLBACK = 'fallback',
  ESCALATE = 'escalate',
  IGNORE = 'ignore',
  MANUAL_INTERVENTION = 'manual_intervention'
}

interface FrameworkError {
  id: string;                          // Unique error identifier
  code: string;                        // Error code (e.g., 'AGENT_TIMEOUT')
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;                     // Human-readable message
  details: ErrorDetails;
  context: ErrorContext;
  timestamp: Date;
  source: ErrorSource;
  recoveryStrategy: ErrorRecoveryStrategy;
  retryCount: number;
  maxRetries: number;
  resolved: boolean;
  resolvedAt?: Date;
  resolution?: string;
}

interface ErrorDetails {
  originalError?: Error;
  stackTrace?: string;
  additionalInfo: Record<string, any>;
  affectedComponents: string[];
  userImpact: string;
  technicalDetails: string;
}

interface ErrorContext {
  agentType?: AgentType;
  agentInstanceId?: string;
  testCaseId?: string;
  executionId?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  environment: string;
  version: string;
}

interface ErrorSource {
  component: string;
  function: string;
  file: string;
  line?: number;
  version: string;
}
```

### 2. Error Handler Implementation

```typescript
class ErrorHandler {
  private errorStore: ErrorStore;
  private alertManager: AlertManager;
  private recoveryManager: RecoveryManager;
  private logger: Logger;
  
  constructor(
    errorStore: ErrorStore,
    alertManager: AlertManager,
    recoveryManager: RecoveryManager,
    logger: Logger
  ) {
    this.errorStore = errorStore;
    this.alertManager = alertManager;
    this.recoveryManager = recoveryManager;
    this.logger = logger;
  }
  
  async handleError(error: Error, context: ErrorContext): Promise<ErrorHandlingResult> {
    // Generate unique error ID
    const errorId = this.generateErrorId();
    
    // Classify the error
    const classification = this.classifyError(error, context);
    
    // Create framework error
    const frameworkError: FrameworkError = {
      id: errorId,
      code: classification.code,
      category: classification.category,
      severity: classification.severity,
      message: this.generateUserFriendlyMessage(error, classification),
      details: this.extractErrorDetails(error, context),
      context,
      timestamp: new Date(),
      source: this.extractErrorSource(error),
      recoveryStrategy: classification.recoveryStrategy,
      retryCount: 0,
      maxRetries: classification.maxRetries,
      resolved: false
    };
    
    // Store the error
    await this.errorStore.store(frameworkError);
    
    // Log the error
    this.logger.error('Error occurred', {
      errorId,
      code: frameworkError.code,
      category: frameworkError.category,
      severity: frameworkError.severity,
      message: frameworkError.message,
      context
    });
    
    // Send alerts if necessary
    if (this.shouldAlert(frameworkError)) {
      await this.alertManager.sendAlert(frameworkError);
    }
    
    // Attempt recovery
    const recoveryResult = await this.attemptRecovery(frameworkError);
    
    return {
      errorId,
      handled: true,
      recovered: recoveryResult.success,
      recoveryAction: recoveryResult.action,
      shouldRetry: recoveryResult.shouldRetry,
      retryDelay: recoveryResult.retryDelay
    };
  }
  
  private classifyError(error: Error, context: ErrorContext): ErrorClassification {
    // Agent-specific errors
    if (context.agentType) {
      return this.classifyAgentError(error, context);
    }
    
    // Integration errors
    if (error.message.includes('playwright') || error.message.includes('browser')) {
      return {
        code: 'PLAYWRIGHT_ERROR',
        category: ErrorCategory.INTEGRATION,
        severity: ErrorSeverity.HIGH,
        recoveryStrategy: ErrorRecoveryStrategy.RETRY,
        maxRetries: 3
      };
    }
    
    if (error.message.includes('openai') || error.message.includes('gpt')) {
      return {
        code: 'OPENAI_ERROR',
        category: ErrorCategory.INTEGRATION,
        severity: ErrorSeverity.MEDIUM,
        recoveryStrategy: ErrorRecoveryStrategy.FALLBACK,
        maxRetries: 2
      };
    }
    
    // Network errors
    if (error.message.includes('ECONNREFUSED') || error.message.includes('timeout')) {
      return {
        code: 'NETWORK_ERROR',
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.HIGH,
        recoveryStrategy: ErrorRecoveryStrategy.RETRY,
        maxRetries: 5
      };
    }
    
    // Database errors
    if (error.message.includes('database') || error.message.includes('sqlite')) {
      return {
        code: 'DATABASE_ERROR',
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.CRITICAL,
        recoveryStrategy: ErrorRecoveryStrategy.ESCALATE,
        maxRetries: 1
      };
    }
    
    // Validation errors
    if (error.name === 'ValidationError') {
      return {
        code: 'VALIDATION_ERROR',
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        recoveryStrategy: ErrorRecoveryStrategy.IGNORE,
        maxRetries: 0
      };
    }
    
    // Default classification
    return {
      code: 'UNKNOWN_ERROR',
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.MEDIUM,
      recoveryStrategy: ErrorRecoveryStrategy.ESCALATE,
      maxRetries: 1
    };
  }
  
  private classifyAgentError(error: Error, context: ErrorContext): ErrorClassification {
    const agentType = context.agentType!;
    
    switch (agentType) {
      case 'test_writer':
        if (error.message.includes('timeout')) {
          return {
            code: 'TEST_WRITER_TIMEOUT',
            category: ErrorCategory.AGENT,
            severity: ErrorSeverity.MEDIUM,
            recoveryStrategy: ErrorRecoveryStrategy.RETRY,
            maxRetries: 2
          };
        }
        if (error.message.includes('generation failed')) {
          return {
            code: 'TEST_GENERATION_FAILED',
            category: ErrorCategory.AGENT,
            severity: ErrorSeverity.HIGH,
            recoveryStrategy: ErrorRecoveryStrategy.FALLBACK,
            maxRetries: 1
          };
        }
        break;
        
      case 'test_executor':
        if (error.message.includes('browser crashed')) {
          return {
            code: 'BROWSER_CRASHED',
            category: ErrorCategory.AGENT,
            severity: ErrorSeverity.HIGH,
            recoveryStrategy: ErrorRecoveryStrategy.RETRY,
            maxRetries: 3
          };
        }
        if (error.message.includes('element not found')) {
          return {
            code: 'ELEMENT_NOT_FOUND',
            category: ErrorCategory.AGENT,
            severity: ErrorSeverity.MEDIUM,
            recoveryStrategy: ErrorRecoveryStrategy.FALLBACK,
            maxRetries: 2
          };
        }
        break;
        
      case 'report_generator':
        if (error.message.includes('template not found')) {
          return {
            code: 'TEMPLATE_NOT_FOUND',
            category: ErrorCategory.AGENT,
            severity: ErrorSeverity.MEDIUM,
            recoveryStrategy: ErrorRecoveryStrategy.FALLBACK,
            maxRetries: 1
          };
        }
        break;
    }
    
    return {
      code: `${agentType.toUpperCase()}_ERROR`,
      category: ErrorCategory.AGENT,
      severity: ErrorSeverity.MEDIUM,
      recoveryStrategy: ErrorRecoveryStrategy.RETRY,
      maxRetries: 2
    };
  }
  
  private async attemptRecovery(error: FrameworkError): Promise<RecoveryResult> {
    switch (error.recoveryStrategy) {
      case ErrorRecoveryStrategy.RETRY:
        return await this.recoveryManager.retry(error);
        
      case ErrorRecoveryStrategy.FALLBACK:
        return await this.recoveryManager.fallback(error);
        
      case ErrorRecoveryStrategy.ESCALATE:
        return await this.recoveryManager.escalate(error);
        
      case ErrorRecoveryStrategy.IGNORE:
        return { success: true, action: 'ignored', shouldRetry: false };
        
      case ErrorRecoveryStrategy.MANUAL_INTERVENTION:
        return await this.recoveryManager.requestManualIntervention(error);
        
      default:
        return { success: false, action: 'none', shouldRetry: false };
    }
  }
  
  private shouldAlert(error: FrameworkError): boolean {
    // Always alert for critical errors
    if (error.severity === ErrorSeverity.CRITICAL) {
      return true;
    }
    
    // Alert for high severity errors in production
    if (error.severity === ErrorSeverity.HIGH && process.env.NODE_ENV === 'production') {
      return true;
    }
    
    // Alert for repeated errors
    if (error.retryCount >= error.maxRetries) {
      return true;
    }
    
    // Alert for security-related errors
    if (error.category === ErrorCategory.SECURITY) {
      return true;
    }
    
    return false;
  }
}
```

### 3. Recovery Strategies

```typescript
class RecoveryManager {
  private agentManager: AgentManager;
  private configManager: ConfigurationManager;
  private logger: Logger;
  
  async retry(error: FrameworkError): Promise<RecoveryResult> {
    if (error.retryCount >= error.maxRetries) {
      return {
        success: false,
        action: 'max_retries_exceeded',
        shouldRetry: false
      };
    }
    
    // Calculate retry delay with exponential backoff
    const baseDelay = 1000; // 1 second
    const retryDelay = baseDelay * Math.pow(2, error.retryCount);
    
    // Update retry count
    error.retryCount++;
    
    this.logger.info(`Retrying operation after error`, {
      errorId: error.id,
      retryCount: error.retryCount,
      maxRetries: error.maxRetries,
      delay: retryDelay
    });
    
    return {
      success: true,
      action: 'retry_scheduled',
      shouldRetry: true,
      retryDelay
    };
  }
  
  async fallback(error: FrameworkError): Promise<RecoveryResult> {
    switch (error.code) {
      case 'OPENAI_ERROR':
        return await this.fallbackToLocalGeneration(error);
        
      case 'PLAYWRIGHT_ERROR':
        return await this.fallbackToAlternativeBrowser(error);
        
      case 'TEST_GENERATION_FAILED':
        return await this.fallbackToTemplateGeneration(error);
        
      case 'TEMPLATE_NOT_FOUND':
        return await this.fallbackToDefaultTemplate(error);
        
      default:
        return {
          success: false,
          action: 'no_fallback_available',
          shouldRetry: false
        };
    }
  }
  
  private async fallbackToLocalGeneration(error: FrameworkError): Promise<RecoveryResult> {
    this.logger.info('Falling back to local test generation', { errorId: error.id });
    
    // Switch to local template-based generation
    const config = await this.configManager.getConfiguration();
    config.agents.testWriter.ai.fallbackMode = true;
    await this.configManager.updateConfiguration('agents.testWriter.ai.fallbackMode', true);
    
    return {
      success: true,
      action: 'fallback_to_local_generation',
      shouldRetry: true,
      retryDelay: 1000
    };
  }
  
  private async fallbackToAlternativeBrowser(error: FrameworkError): Promise<RecoveryResult> {
    this.logger.info('Falling back to alternative browser', { errorId: error.id });
    
    // Try different browser if current one fails
    const browserFallbacks = {
      'chromium': 'firefox',
      'firefox': 'webkit',
      'webkit': 'chromium'
    };
    
    const currentBrowser = error.context.additionalInfo?.browser || 'chromium';
    const fallbackBrowser = browserFallbacks[currentBrowser];
    
    if (fallbackBrowser) {
      // Update execution context to use fallback browser
      error.context.additionalInfo = {
        ...error.context.additionalInfo,
        browser: fallbackBrowser,
        fallbackReason: 'browser_failure'
      };
      
      return {
        success: true,
        action: `fallback_to_${fallbackBrowser}`,
        shouldRetry: true,
        retryDelay: 2000
      };
    }
    
    return {
      success: false,
      action: 'no_browser_fallback_available',
      shouldRetry: false
    };
  }
  
  async escalate(error: FrameworkError): Promise<RecoveryResult> {
    this.logger.error('Escalating error for manual intervention', {
      errorId: error.id,
      code: error.code,
      severity: error.severity
    });
    
    // Create escalation ticket
    const escalationTicket = await this.createEscalationTicket(error);
    
    // Notify administrators
    await this.notifyAdministrators(error, escalationTicket);
    
    // Disable affected component if critical
    if (error.severity === ErrorSeverity.CRITICAL) {
      await this.disableAffectedComponent(error);
    }
    
    return {
      success: true,
      action: 'escalated_to_administrators',
      shouldRetry: false,
      escalationTicket: escalationTicket.id
    };
  }
  
  async requestManualIntervention(error: FrameworkError): Promise<RecoveryResult> {
    this.logger.warn('Manual intervention required', {
      errorId: error.id,
      code: error.code
    });
    
    // Create intervention request
    const interventionRequest = await this.createInterventionRequest(error);
    
    // Pause affected operations
    await this.pauseAffectedOperations(error);
    
    return {
      success: true,
      action: 'manual_intervention_requested',
      shouldRetry: false,
      interventionRequest: interventionRequest.id
    };
  }
  
  private async createEscalationTicket(error: FrameworkError): Promise<EscalationTicket> {
    return {
      id: `ESC-${Date.now()}`,
      errorId: error.id,
      title: `Critical Error: ${error.code}`,
      description: error.message,
      severity: error.severity,
      createdAt: new Date(),
      status: 'open',
      assignee: 'system-admin',
      details: error.details
    };
  }
  
  private async notifyAdministrators(error: FrameworkError, ticket: EscalationTicket): Promise<void> {
    // Send email notification
    // Send Slack notification
    // Create JIRA ticket (if integrated)
    // Update monitoring dashboard
  }
}
```

### 4. Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: Date | null = null;
  private successCount: number = 0;
  
  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeout: number = 60000, // 1 minute
    private readonly successThreshold: number = 3
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
      } else {
        throw new CircuitBreakerOpenError('Circuit breaker is open');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failureCount = 0;
    this.lastFailureTime = null;
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = CircuitBreakerState.CLOSED;
        this.successCount = 0;
      }
    }
  }
  
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
    }
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.OPEN;
      this.successCount = 0;
    }
  }
  
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    
    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.recoveryTimeout;
  }
  
  getState(): CircuitBreakerState {
    return this.state;
  }
  
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}
```

---

## Security Specifications

### 1. Authentication and Authorization

```typescript
interface SecurityConfiguration {
  authentication: {
    type: 'jwt' | 'oauth' | 'api_key';
    jwt?: JWTConfiguration;
    oauth?: OAuthConfiguration;
    apiKey?: APIKeyConfiguration;
  };
  authorization: {
    type: 'rbac' | 'abac';
    roles: Role[];
    permissions: Permission[];
    policies: Policy[];
  };
  encryption: {
    algorithm: 'aes-256-gcm' | 'aes-256-cbc';
    keyDerivation: 'pbkdf2' | 'scrypt';
    saltLength: number;
    iterations: number;
  };
  rateLimiting: {
    enabled: boolean;
    windowMs: number;
    max: number;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
  };
  audit: {
    enabled: boolean;
    logLevel: 'minimal' | 'standard' | 'detailed';
    retention: number; // days
    sensitiveFields: string[];
  };
}

interface JWTConfiguration {
  secret: string;
  algorithm: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512';
  expiresIn: string;
  refreshTokenExpiry: string;
  issuer: string;
  audience: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  inherits?: string[]; // Role inheritance
}

interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  conditions?: PermissionCondition[];
}

interface Policy {
  id: string;
  name: string;
  effect: 'allow' | 'deny';
  subjects: string[]; // Roles or users
  resources: string[];
  actions: string[];
  conditions?: PolicyCondition[];
}
```

#### JWT Authentication Implementation

```typescript
class JWTAuthenticationService {
  private jwtSecret: string;
  private jwtOptions: jwt.SignOptions;
  private refreshTokenStore: RefreshTokenStore;
  
  constructor(config: JWTConfiguration) {
    this.jwtSecret = config.secret;
    this.jwtOptions = {
      algorithm: config.algorithm,
      expiresIn: config.expiresIn,
      issuer: config.issuer,
      audience: config.audience
    };
    this.refreshTokenStore = new RefreshTokenStore();
  }
  
  async authenticate(credentials: LoginCredentials): Promise<AuthenticationResult> {
    // Validate credentials
    const user = await this.validateCredentials(credentials);
    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }
    
    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);
    
    // Store refresh token
    await this.refreshTokenStore.store(refreshToken, user.id);
    
    // Log authentication event
    await this.auditLogger.logAuthentication(user.id, 'success');
    
    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiryTime(this.jwtOptions.expiresIn!),
      user: this.sanitizeUser(user)
    };
  }
  
  async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        algorithms: [this.jwtOptions.algorithm!],
        issuer: this.jwtOptions.issuer,
        audience: this.jwtOptions.audience
      }) as JWTPayload;
      
      // Check if user still exists and is active
      const user = await this.userService.findById(decoded.sub);
      if (!user || !user.active) {
        return { valid: false, reason: 'user_inactive' };
      }
      
      return {
        valid: true,
        payload: decoded,
        user: this.sanitizeUser(user)
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return { valid: false, reason: 'token_expired' };
      } else if (error instanceof jwt.JsonWebTokenError) {
        return { valid: false, reason: 'token_invalid' };
      }
      
      return { valid: false, reason: 'validation_error' };
    }
  }
  
  async refreshToken(refreshToken: string): Promise<AuthenticationResult> {
    // Validate refresh token
    const userId = await this.refreshTokenStore.validate(refreshToken);
    if (!userId) {
      throw new AuthenticationError('Invalid refresh token');
    }
    
    // Get user
    const user = await this.userService.findById(userId);
    if (!user || !user.active) {
      throw new AuthenticationError('User not found or inactive');
    }
    
    // Generate new tokens
    const newAccessToken = this.generateAccessToken(user);
    const newRefreshToken = this.generateRefreshToken(user);
    
    // Replace refresh token
    await this.refreshTokenStore.replace(refreshToken, newRefreshToken, userId);
    
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: this.parseExpiryTime(this.jwtOptions.expiresIn!),
      user: this.sanitizeUser(user)
    };
  }
  
  private generateAccessToken(user: User): string {
    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      permissions: this.getUserPermissions(user),
      iat: Math.floor(Date.now() / 1000)
    };
    
    return jwt.sign(payload, this.jwtSecret, this.jwtOptions);
  }
  
  private generateRefreshToken(user: User): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
```

#### Role-Based Access Control (RBAC)

```typescript
class RBACAuthorizationService {
  private roles: Map<string, Role> = new Map();
  private permissions: Map<string, Permission> = new Map();
  private policies: Policy[] = [];
  
  constructor(config: AuthorizationConfiguration) {
    this.loadRoles(config.roles);
    this.loadPermissions(config.permissions);
    this.loadPolicies(config.policies);
  }
  
  async authorize(
    user: User,
    resource: string,
    action: string,
    context?: AuthorizationContext
  ): Promise<AuthorizationResult> {
    // Get user permissions
    const userPermissions = this.getUserPermissions(user);
    
    // Check direct permissions
    const hasDirectPermission = userPermissions.some(permission => 
      this.matchesPermission(permission, resource, action, context)
    );
    
    if (hasDirectPermission) {
      return { authorized: true, reason: 'direct_permission' };
    }
    
    // Check policy-based permissions
    const policyResult = this.evaluatePolicies(user, resource, action, context);
    if (policyResult.authorized) {
      return policyResult;
    }
    
    // Log authorization failure
    await this.auditLogger.logAuthorization(user.id, resource, action, false);
    
    return { authorized: false, reason: 'insufficient_permissions' };
  }
  
  private getUserPermissions(user: User): Permission[] {
    const permissions: Permission[] = [];
    
    // Get permissions from user roles
    for (const roleId of user.roles) {
      const role = this.roles.get(roleId);
      if (role) {
        // Add role permissions
        for (const permissionId of role.permissions) {
          const permission = this.permissions.get(permissionId);
          if (permission) {
            permissions.push(permission);
          }
        }
        
        // Add inherited permissions
        if (role.inherits) {
          for (const inheritedRoleId of role.inherits) {
            const inheritedRole = this.roles.get(inheritedRoleId);
            if (inheritedRole) {
              for (const permissionId of inheritedRole.permissions) {
                const permission = this.permissions.get(permissionId);
                if (permission) {
                  permissions.push(permission);
                }
              }
            }
          }
        }
      }
    }
    
    return permissions;
  }
  
  private matchesPermission(
    permission: Permission,
    resource: string,
    action: string,
    context?: AuthorizationContext
  ): boolean {
    // Check resource match
    if (!this.matchesResource(permission.resource, resource)) {
      return false;
    }
    
    // Check action match
    if (!this.matchesAction(permission.action, action)) {
      return false;
    }
    
    // Check conditions
    if (permission.conditions && context) {
      return this.evaluateConditions(permission.conditions, context);
    }
    
    return true;
  }
  
  private evaluatePolicies(
    user: User,
    resource: string,
    action: string,
    context?: AuthorizationContext
  ): AuthorizationResult {
    let allowPolicies: Policy[] = [];
    let denyPolicies: Policy[] = [];
    
    for (const policy of this.policies) {
      if (this.policyApplies(policy, user, resource, action, context)) {
        if (policy.effect === 'allow') {
          allowPolicies.push(policy);
        } else {
          denyPolicies.push(policy);
        }
      }
    }
    
    // Deny takes precedence
    if (denyPolicies.length > 0) {
      return {
        authorized: false,
        reason: 'denied_by_policy',
        policy: denyPolicies[0].id
      };
    }
    
    // Check for allow policies
    if (allowPolicies.length > 0) {
      return {
        authorized: true,
        reason: 'allowed_by_policy',
        policy: allowPolicies[0].id
      };
    }
    
    return { authorized: false, reason: 'no_applicable_policy' };
  }
}
```

### 2. Data Encryption

```typescript
class EncryptionService {
  private algorithm: string;
  private keyDerivation: string;
  private saltLength: number;
  private iterations: number;
  
  constructor(config: EncryptionConfiguration) {
    this.algorithm = config.algorithm;
    this.keyDerivation = config.keyDerivation;
    this.saltLength = config.saltLength;
    this.iterations = config.iterations;
  }
  
  async encrypt(data: string, password: string): Promise<EncryptedData> {
    // Generate salt
    const salt = crypto.randomBytes(this.saltLength);
    
    // Derive key
    const key = await this.deriveKey(password, salt);
    
    // Generate IV
    const iv = crypto.randomBytes(16);
    
    // Create cipher
    const cipher = crypto.createCipher(this.algorithm, key);
    cipher.setAAD(salt); // Additional authenticated data
    
    // Encrypt data
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get authentication tag
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      algorithm: this.algorithm
    };
  }
  
  async decrypt(encryptedData: EncryptedData, password: string): Promise<string> {
    // Convert hex strings back to buffers
    const salt = Buffer.from(encryptedData.salt, 'hex');
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    
    // Derive key
    const key = await this.deriveKey(password, salt);
    
    // Create decipher
    const decipher = crypto.createDecipher(encryptedData.algorithm, key);
    decipher.setAAD(salt);
    decipher.setAuthTag(authTag);
    
    // Decrypt data
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  private async deriveKey(password: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      if (this.keyDerivation === 'pbkdf2') {
        crypto.pbkdf2(password, salt, this.iterations, 32, 'sha256', (err, key) => {
          if (err) reject(err);
          else resolve(key);
        });
      } else if (this.keyDerivation === 'scrypt') {
        crypto.scrypt(password, salt, 32, (err, key) => {
          if (err) reject(err);
          else resolve(key);
        });
      } else {
        reject(new Error(`Unsupported key derivation: ${this.keyDerivation}`));
      }
    });
  }
  
  async encryptSensitiveFields(data: any, sensitiveFields: string[]): Promise<any> {
    const result = { ...data };
    const masterKey = process.env.ENCRYPTION_MASTER_KEY!;
    
    for (const field of sensitiveFields) {
      if (result[field]) {
        result[field] = await this.encrypt(result[field], masterKey);
      }
    }
    
    return result;
  }
  
  async decryptSensitiveFields(data: any, sensitiveFields: string[]): Promise<any> {
    const result = { ...data };
    const masterKey = process.env.ENCRYPTION_MASTER_KEY!;
    
    for (const field of sensitiveFields) {
      if (result[field] && typeof result[field] === 'object' && result[field].encrypted) {
        result[field] = await this.decrypt(result[field], masterKey);
      }
    }
    
    return result;
  }
}
```

### 3. Security Middleware

```typescript
class SecurityMiddleware {
  private authService: AuthenticationService;
  private authzService: AuthorizationService;
  private rateLimiter: RateLimiter;
  private auditLogger: AuditLogger;
  
  // Authentication middleware
  authenticate() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const token = this.extractToken(req);
        if (!token) {
          return res.status(401).json({ error: 'Authentication required' });
        }
        
        const validation = await this.authService.validateToken(token);
        if (!validation.valid) {
          return res.status(401).json({ 
            error: 'Invalid token',
            reason: validation.reason 
          });
        }
        
        req.user = validation.user;
        req.tokenPayload = validation.payload;
        
        next();
      } catch (error) {
        await this.auditLogger.logSecurityEvent('authentication_error', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          error: error.message
        });
        
        res.status(401).json({ error: 'Authentication failed' });
      }
    };
  }
  
  // Authorization middleware
  authorize(resource: string, action: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: 'Authentication required' });
        }
        
        const context: AuthorizationContext = {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date(),
          requestId: req.id,
          resource: req.params,
          query: req.query,
          body: req.body
        };
        
        const authzResult = await this.authzService.authorize(
          req.user,
          resource,
          action,
          context
        );
        
        if (!authzResult.authorized) {
          await this.auditLogger.logSecurityEvent('authorization_denied', {
            userId: req.user.id,
            resource,
            action,
            reason: authzResult.reason,
            ip: req.ip
          });
          
          return res.status(403).json({ 
            error: 'Access denied',
            reason: authzResult.reason 
          });
        }
        
        next();
      } catch (error) {
        await this.auditLogger.logSecurityEvent('authorization_error', {
          userId: req.user?.id,
          resource,
          action,
          error: error.message,
          ip: req.ip
        });
        
        res.status(403).json({ error: 'Authorization failed' });
      }
    };
  }
  
  // Rate limiting middleware
  rateLimit(options?: RateLimitOptions) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = this.getRateLimitKey(req);
        const allowed = await this.rateLimiter.isAllowed(key, options);
        
        if (!allowed.allowed) {
          await this.auditLogger.logSecurityEvent('rate_limit_exceeded', {
            ip: req.ip,
            userId: req.user?.id,
            key,
            limit: allowed.limit,
            remaining: allowed.remaining,
            resetTime: allowed.resetTime
          });
          
          return res.status(429).json({
            error: 'Rate limit exceeded',
            limit: allowed.limit,
            remaining: allowed.remaining,
            resetTime: allowed.resetTime
          });
        }
        
        // Add rate limit headers
        res.set({
          'X-RateLimit-Limit': allowed.limit.toString(),
          'X-RateLimit-Remaining': allowed.remaining.toString(),
          'X-RateLimit-Reset': allowed.resetTime.toString()
        });
        
        next();
      } catch (error) {
        // Don't block requests on rate limiter errors
        next();
      }
    };
  }
  
  // Input validation middleware
  validateInput(schema: ValidationSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
      const validation = this.validateRequest(req, schema);
      
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.errors
        });
      }
      
      next();
    };
  }
  
  // Security headers middleware
  securityHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Set security headers
      res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': "default-src 'self'",
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      });
      
      next();
    };
  }
  
  private extractToken(req: Request): string | null {
    const authHeader = req.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    // Check for token in query parameter (for WebSocket connections)
    if (req.query.token && typeof req.query.token === 'string') {
      return req.query.token;
    }
    
    return null;
  }
  
  private getRateLimitKey(req: Request): string {
    // Use user ID if authenticated, otherwise use IP
    if (req.user) {
      return `user:${req.user.id}`;
    }
    
    return `ip:${req.ip}`;
  }
}
```

### 4. Audit Logging

```typescript
class AuditLogger {
  private logger: Logger;
  private encryptionService: EncryptionService;
  private storage: AuditStorage;
  
  async logAuthentication(userId: string, result: 'success' | 'failure', details?: any): Promise<void> {
    const auditEvent: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      category: 'authentication',
      action: 'login',
      userId,
      result,
      details: await this.sanitizeDetails(details),
      severity: result === 'failure' ? 'warning' : 'info'
    };
    
    await this.storeAuditEvent(auditEvent);
  }
  
  async logAuthorization(
    userId: string,
    resource: string,
    action: string,
    result: boolean,
    details?: any
  ): Promise<void> {
    const auditEvent: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      category: 'authorization',
      action: `${action}:${resource}`,
      userId,
      result: result ? 'success' : 'failure',
      details: await this.sanitizeDetails(details),
      severity: result ? 'info' : 'warning'
    };
    
    await this.storeAuditEvent(auditEvent);
  }
  
  async logDataAccess(
    userId: string,
    resource: string,
    action: 'read' | 'write' | 'delete',
    details?: any
  ): Promise<void> {
    const auditEvent: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      category: 'data_access',
      action: `${action}:${resource}`,
      userId,
      result: 'success',
      details: await this.sanitizeDetails(details),
      severity: 'info'
    };
    
    await this.storeAuditEvent(auditEvent);
  }
  
  async logSecurityEvent(
    eventType: string,
    details: any,
    severity: 'info' | 'warning' | 'error' | 'critical' = 'warning'
  ): Promise<void> {
    const auditEvent: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      category: 'security',
      action: eventType,
      userId: details.userId,
      result: 'info',
      details: await this.sanitizeDetails(details),
      severity
    };
    
    await this.storeAuditEvent(auditEvent);
    
    // Send alerts for critical security events
    if (severity === 'critical') {
      await this.sendSecurityAlert(auditEvent);
    }
  }
  
  private async sanitizeDetails(details: any): Promise<any> {
    if (!details) return details;
    
    const sanitized = { ...details };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'credential'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
  
  private async storeAuditEvent(event: AuditEvent): Promise