# Multi-Agent Testing Framework - AI Agent Instructions

This is a **multi-agent testing framework** (MATF) that automates Playwright test generation and execution using specialized AI agents communicating over Redis. The system is built with TypeScript, uses SQLite for persistence, and supports both Docker Compose and Kubernetes deployments.

## Architecture Overview

### Multi-Agent System
The framework consists of **7 specialized agents** that extend `BaseAgent` and communicate via:
- **MessageQueue**: Redis-backed task queuing (high/default/critical priorities, DLQ support)
- **EventBus**: Pub/sub for system events (lifecycle, execution, health)
- **SharedMemory**: Redis KV store for shared state/artifacts

**Agent Roles**:
- `TestWriter`: Generates Playwright tests using Mistral AI from UI diffs
- `LocatorSynthesis`: Creates stable selectors with ML/heuristics
- `TestExecutor`: Runs Playwright tests, captures artifacts
- `ReportGenerator`: Produces HTML/JSON reports
- `TestOptimizer`: Detects flakiness, recommends healing
- `ContextManager`: Centralized config/auth/state coordination
- `Logger`: Aggregates logs, metrics, forwards to API

### Key Architectural Patterns
1. **Agent Communication**: Agents send `AgentMessage` via MQ, publish `SystemEvent` via EventBus
2. **Global Database Singleton**: Use `acquireGlobalDatabase()`/`releaseGlobalDatabase()` from `@database/GlobalDatabase` to avoid multi-connection issues
3. **Graceful Shutdown**: Agents handle shutdown via `isShuttingDown` flag; avoid Redis ops during teardown
4. **Circuit Breaker**: BaseAgent opens breaker at >50% failure rate for 10+ messages

## Project Structure

```
project/
├── src/
│   ├── agents/           # Agent implementations
│   │   ├── base/         # BaseAgent abstract class
│   │   ├── test-writer/  # Mistral-powered test generation
│   │   ├── test-executor/# Playwright execution engine
│   │   └── bootstrap.ts  # Agent startup/orchestration
│   ├── api/              # Express REST API + WebSocket
│   │   ├── server.ts     # Main app, routes, metrics
│   │   └── routes/       # /api/v1/* endpoints
│   ├── communication/    # MessageQueue, EventBus, SharedMemory
│   ├── database/         # DatabaseManager (SQLite)
│   ├── monitoring/       # Prometheus metrics (prom-client)
│   └── types/            # Shared TypeScript interfaces
├── generated_tests/      # Output: *.spec.ts files
├── test_execution_reports/ # Output: HTML reports
├── docker-compose.yml    # Local stack (framework, agents, redis, prometheus, grafana)
└── k8s/                  # Kubernetes manifests (base + overlays)
```

## Path Aliases (TypeScript)

Use these imports everywhere (configured in `tsconfig.json` + `jest.config.js` + runtime `module-alias`):
```typescript
import { MessageQueue } from '@communication/MessageQueue';
import { DatabaseManager } from '@database/DatabaseManager';
import { loadConfig } from '@api/config';
import type { AgentMessage } from '@app-types/communication';
import { metrics } from '@monitoring/Metrics';
```

## Development Workflows

### Build & Run
```bash
# Install & build
npm install
npm run build

# Development (ts-node with watch)
npm run dev              # API server
npm run dev:agents       # Agent consumer

# Production (compiled)
npm start                # API server
npm run start:agents     # Agent consumer

# Docker Compose (recommended)
cd project
docker compose up -d     # Full stack: API, agents, redis, monitoring
docker compose --profile playwright up -d  # With browser-enabled agents
```

### Testing
```bash
npm test                 # All Jest tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration (requires Redis)
npm run test:pw          # Playwright E2E tests
npm run test:coverage    # Coverage report

# Validate foundation
npm run validate:foundation
npm run validate:all
```

### Code Quality
```bash
npm run lint             # ESLint check
npm run lint:fix         # Auto-fix
npm run format           # Prettier
```

## Coding Conventions

### 1. Agent Development Pattern
All agents **must** extend `BaseAgent` and implement:
```typescript
import { BaseAgent, BaseAgentConfig } from './base/BaseAgent';
import type { AgentMessage } from '@app-types/communication';

export interface MyAgentConfig extends BaseAgentConfig {
  myAgentType: 'MyAgent';
  customSettings: { /* ... */ };
}

export class MyAgent extends BaseAgent {
  protected async processMessage(message: AgentMessage): Promise<void> {
    // Handle message types; avoid ops if this.isStopping
    if (this.isStopping) return;
    
    switch (message.messageType) {
      case 'MY_REQUEST': /* ... */ break;
      default: this.log('warn', 'Unknown message type', { type: message.messageType });
    }
  }

  protected async onInitialize(): Promise<void> {
    // Agent-specific setup (DB schema, subscriptions, etc.)
  }

  protected async onShutdown(): Promise<void> {
    // Clean up resources
  }

  protected getConfigSchema(): object {
    return { /* Joi/JSON schema */ };
  }
}
```

### 2. Message Communication
```typescript
// Sending messages
await this.sendMessage({
  target: { type: 'TestExecutor' },
  messageType: 'EXECUTE_TEST',
  priority: 'high',
  payload: { testId: '123', config: { /* ... */ } }
});

// Publishing events
await this.publishEvent('test.execution.completed', {
  executionId: '456',
  status: 'passed',
  duration: 1234
}, 'business');
```

### 3. Logging Pattern
Use `this.log()` in agents (auto-forwards to LoggerAgent):
```typescript
this.log('info', 'Processing test execution', { executionId, url });
this.log('error', 'Execution failed', { error: err.message, stack: err.stack });
```

In API/non-agent code:
```typescript
console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: 'INFO', message: '...' }));
```

### 4. Database Access
**Always use global singleton** to avoid "database is locked" errors:
```typescript
import { acquireGlobalDatabase, releaseGlobalDatabase } from '@database/GlobalDatabase';

// In BaseAgent constructor (automatic)
this.database = acquireGlobalDatabase(config.database);

// In API routes or services
import { ensureDatabaseInitialized, getDatabaseManager } from '@api/context';
await ensureDatabaseInitialized();
const db = getDatabaseManager();
const rows = await db.getDatabase().all('SELECT * FROM test_executions');
```

### 5. Error Handling
- **No custom Error classes** in codebase; use standard `Error` with descriptive messages
- Agents catch errors in `processMessage`, call `this.handleError()`, then `failMessage()` to DLQ
- API routes return `{ error: string }` with appropriate HTTP status codes
- Avoid throwing from shutdown/cleanup paths

### 6. Configuration Loading
```typescript
import { loadConfig } from '@api/config';

const cfg = loadConfig(); // Returns full system config
// Access: cfg.messageQueue, cfg.eventBus, cfg.database, cfg.mistral, etc.
```

Environment variables follow pattern: `REDIS_HOST`, `MISTRAL_API_KEY`, `DATABASE_URL`, `JWT_SECRET`, `WEBHOOK_SIGNATURE_SECRET`, etc.

## API Endpoints (Express)

Key routes under `/api/v1/`:
- `GET /system/health` - Health check (no auth)
- `GET /metrics` - Prometheus metrics (legacy + prom-client)
- `GET /tests/executions` - List executions
- `POST /tests/executions` - Enqueue test execution
- `POST /webhooks/github` - GitHub webhook receiver
- `GET /gui/watchers` - GUI watcher list
- `GET /reports/:id/download` - Download report

**Auth**: Optional JWT via `maybeAuth` middleware; role checks with `maybeRequireRole(['admin', 'ops', 'viewer'])`

## Docker & Deployment

### Compose Services
- `framework`: API server (port 3005:3000)
- `agents`: Message consumer running all agents (TE_MODE=playwright)
- `agents-playwright`: Profile-based Playwright-enabled agents
- `redis`: Message bus & cache
- `prometheus`: Metrics scraping (port 9090)
- `grafana`: Dashboards (port 3002)

### Environment Variables
Key vars in `.env`:
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- `DATABASE_URL` (default: `sqlite:///app/data/framework.db`)
- `MISTRAL_API_KEY`, `MISTRAL_MODEL` (default: `mistral-large-2411`)
- `JWT_SECRET`, `WEBHOOK_SIGNATURE_SECRET`
- `TE_MODE` (simulate|playwright)
- `LOG_LEVEL` (debug|info|warn|error)

### Kubernetes
- Manifests in `project/k8s/` with base + overlays (staging/production)
- Use `kustomize build` for deployment
- Secrets: `matf-secrets` (JWT, Mistral API key, Redis password)
- PVCs for SQLite, generated tests, reports

## Testing Framework-Specific Patterns

### Test Execution Flow
1. User submits `POST /api/v1/tests/executions` with `{ url, config }`
2. API enqueues `EXECUTE_TEST` message to `TestExecutor` agent
3. TestExecutor runs Playwright, saves artifacts to `test_execution_reports/`
4. Publishes `EXECUTION_RESULT` event
5. ReportGenerator creates HTML report, stores in DB

### Test Generation Flow
1. RepoWatcher detects UI diff or webhook triggers `TEST_GENERATION_REQUEST`
2. TestWriter queries Mistral with repo context, generates `.spec.ts`
3. Emits `LOCATOR_SYNTHESIS_REQUEST` to LocatorSynthesis agent
4. Saves test to `generated_tests/`, records metadata in `generated_tests` table

### Playwright Configuration
- Config in `playwright.config.ts`
- Generated tests output to `generated_tests/*.spec.ts`
- Execution reports in `test_execution_reports/*.html`
- Use `TE_MODE=simulate` to skip browser (fast dev), `TE_MODE=playwright` for real execution

## Common Pitfalls & Solutions

### 1. Module Alias Not Working
**Symptom**: `Cannot find module '@communication/...'`
**Fix**: Ensure `module-alias/register` is loaded at app entry:
```typescript
import 'module-alias/register'; // Before other imports
```
Or run with: `node -r module-alias/register dist/api/server.js`

### 2. Database Locked Errors
**Symptom**: `SQLITE_BUSY: database is locked`
**Fix**: Use global DB singleton (`acquireGlobalDatabase()`) instead of creating new `DatabaseManager` instances

### 3. Redis Connection Failures During Shutdown
**Symptom**: Unhandled Redis errors when agents stop
**Fix**: Check `this.isStopping` before Redis ops; skip MQ/EventBus calls during teardown

### 4. Missing Output Directories
**Symptom**: Tests fail writing to `generated_tests/` or `test_execution_reports/`
**Fix**: Ensure directories exist; Docker mounts them as volumes

### 5. Port Conflicts
**Symptom**: `EADDRINUSE: address already in use :::3000`
**Fix**: Docker Compose maps to 3005 externally; adjust `PORT` env var for local runs

## Metrics & Observability

### Prometheus Metrics
- `http_requests_total{method,route,status}` - Request counts
- `http_request_duration_seconds{method,route,status}` - Latency histogram
- `matf_queue_depth{queue}` - MQ depth gauge
- `matf_executions_running`, `matf_executions_queued` - Execution state

Access: `http://localhost:3005/metrics` (Prometheus format)

### Grafana Dashboards
Provisioned dashboards in `docs/observability/grafana/dashboards/`
Access: `http://localhost:3002` (admin/admin by default)

## Extension Points

### Adding a New Agent
1. Create `src/agents/my-agent/MyAgent.ts` extending `BaseAgent`
2. Implement `processMessage`, `onInitialize`, `onShutdown`, `getConfigSchema`
3. Register in `src/agents/bootstrap.ts`:
   ```typescript
   const myAgentCfg: MyAgentConfig = { ...baseAgentCfg, agentType: 'MyAgent', /* ... */ };
   const myAgent = new MyAgent(myAgentCfg);
   agents.push(myAgent);
   ```
4. Add message consumer loop (see existing agents)
5. Write unit + integration tests

### Adding New API Endpoint
1. Create route file in `src/api/routes/my-route.ts`
2. Mount in `src/api/server.ts`: `app.use('/api/v1/my-route', myRoutes);`
3. Use auth middleware: `router.get('/', maybeAuth, maybeRequireRole(['viewer']), async (req, res) => { /* ... */ });`
4. Update Prometheus route normalization if needed

## References

- Architecture: `docs/architecture.md`
- Developer Guide: `copilot-instructions.md` (root)
- Windows Quickstart: `project/docs/QUICKSTART-WINDOWS.md`
- Package Scripts: `project/package.json`
- Deployment: `docs/deployment_operations_guide.md`

---

**When making changes**: Update this file, run tests (`npm run validate:all`), check Docker build (`docker compose build`), and verify Prometheus metrics still export.
