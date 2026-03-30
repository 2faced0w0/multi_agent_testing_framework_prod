# Running MATF Locally (Without Docker)

This guide shows you how to run the Multi-Agent Testing Framework locally without Docker.

## Prerequisites

✅ **Required:**
- Node.js 20+ installed
- Redis running (either via Docker or local install)
- npm dependencies installed (`npm install`)

✅ **Optional:**
- Playwright browsers (for real test execution): `npx playwright install`

## Quick Start

### Option 1: Automated Startup (Recommended)

Run the PowerShell script that manages everything:

```powershell
cd project
.\start-local.ps1
```

This will:
- ✅ Check Redis connection
- ✅ Build TypeScript if needed
- ✅ Start API server on port 3001
- ✅ Start all agents
- ✅ Monitor both processes
- ✅ Show access URLs and commands

### Option 2: Manual Startup (Two Terminals)

**Terminal 1 - API Server:**
```powershell
cd project
$env:PORT = "3001"
$env:REDIS_HOST = "localhost"
$env:REDIS_PORT = "6379"
$env:DATABASE_URL = "sqlite:///D:/multi_agent_testing_framework_prod/project/data/framework.db"
npm run start
```

**Terminal 2 - Agents:**
```powershell
cd project
$env:REDIS_HOST = "localhost"
$env:REDIS_PORT = "6379"
$env:DATABASE_URL = "sqlite:///D:/multi_agent_testing_framework_prod/project/data/framework.db"
$env:TE_MODE = "simulate"  # or "playwright" for real tests
npm run start:agents
```

### Option 3: Interactive Menu

```powershell
cd project
.\start-simple.ps1
```

Select what to run from the menu.

## Environment Variables

### Required for Both API & Agents:

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `localhost` | Redis server hostname |
| `REDIS_PORT` | `6379` | Redis server port |
| `DATABASE_URL` | `sqlite:///./data/framework.db` | SQLite database path |

### API Server Only:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | API server port (use 3001 to avoid Docker conflict) |
| `JWT_SECRET` | (optional) | JWT signing secret |
| `WEBHOOK_SIGNATURE_SECRET` | (optional) | GitHub webhook verification |

### Agents Only:

| Variable | Default | Description |
|----------|---------|-------------|
| `TE_MODE` | `simulate` | Test execution mode: `simulate` or `playwright` |
| `MISTRAL_API_KEY` | (required) | Mistral AI API key for test generation |
| `LOG_LEVEL` | `info` | Logging level: `debug`, `info`, `warn`, `error` |

## Redis Setup

The framework needs Redis running. Choose one:

### Option A: Use Docker Compose Redis Only
```powershell
docker compose up -d redis
```

### Option B: Local Redis Installation
1. Install Redis for Windows: https://github.com/tporadowski/redis/releases
2. Start Redis: `redis-server`

## Access Points

Once running locally:

- 🌐 **Dashboard**: http://localhost:3001/
- 🔌 **API**: http://localhost:3001/api/v1/
- 💚 **Health Check**: http://localhost:3001/api/v1/system/health
- 📊 **Metrics**: http://localhost:3001/metrics

## Test Execution Modes

### Simulate Mode (Fast, No Browser)
```powershell
$env:TE_MODE = "simulate"
```
- ✅ Fast (no browser startup)
- ✅ Good for development/testing
- ❌ Doesn't actually run Playwright tests

### Playwright Mode (Real Browser Tests)
```powershell
$env:TE_MODE = "playwright"
```
- ✅ Executes real Playwright tests
- ✅ Generates actual test reports
- ❌ Slower (browser startup)
- ⚠️ Requires Playwright browsers: `npx playwright install`

## Stopping the Framework

If using `start-local.ps1` (background jobs):
```powershell
# Get job IDs (shown when you started)
Get-Job

# Stop specific jobs
Stop-Job -Id <API_JOB_ID>,<AGENTS_JOB_ID>
Remove-Job -Id <API_JOB_ID>,<AGENTS_JOB_ID>

# Or stop all jobs
Get-Job | Stop-Job
Get-Job | Remove-Job
```

If running in terminals directly:
- Press **Ctrl+C** in each terminal

## Troubleshooting

### Port 3000 Already in Use
Docker is running on that port. Use `PORT=3001`:
```powershell
$env:PORT = "3001"
```

### Redis Connection Failed
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Fix:** Start Redis:
```powershell
# Option 1: Docker
docker compose up -d redis

# Option 2: Local Redis
redis-server
```

### Module Not Found Errors
```
Cannot find module '@communication/...'
```

**Fix:** Rebuild TypeScript:
```powershell
npm run build
```

### Database Locked
```
SQLITE_BUSY: database is locked
```

**Fix:** Only one instance should run. Stop all processes:
```powershell
Get-Job | Stop-Job
docker compose down
```

### Playwright Tests Fail
```
Executable doesn't exist at <path>
```

**Fix:** Install Playwright browsers:
```powershell
npx playwright install
```

## Development Workflow

### Making Code Changes

1. **Edit TypeScript files** in `src/`
2. **Rebuild**: `npm run build`
3. **Restart processes** (Ctrl+C and rerun startup script)

### Running Tests

```powershell
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests (requires Redis)
npm run test:integration

# Coverage
npm run test:coverage
```

### Watching Logs

If using background jobs:
```powershell
# API logs
Receive-Job -Id <API_JOB_ID> -Keep

# Agent logs
Receive-Job -Id <AGENTS_JOB_ID> -Keep

# Follow logs (PowerShell 7+)
Receive-Job -Id <JOB_ID> -Keep -Wait
```

## Switching Between Local and Docker

### From Docker to Local:
1. Stop Docker: `docker compose down`
2. Keep Redis: `docker compose up -d redis`
3. Run local: `.\start-local.ps1`

### From Local to Docker:
1. Stop local jobs: `Get-Job | Stop-Job; Get-Job | Remove-Job`
2. Start Docker: `docker compose up -d`

## Performance Notes

**Local (simulate mode):**
- ⚡ Fastest for development
- 💾 Lower memory usage
- 🔧 Easy debugging with Node.js inspector

**Docker (production-like):**
- 🐳 Isolated environment
- 🔒 Consistent with production
- 📦 Includes Prometheus/Grafana monitoring

## Need Help?

- 📖 Full docs: `docs/`
- 🏗️ Architecture: `docs/architecture.md`
- 🚀 Deployment: `docs/deployment_operations_guide.md`
- 🪟 Windows guide: `docs/QUICKSTART-WINDOWS.md`
