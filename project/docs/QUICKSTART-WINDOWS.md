# Quickstart (Windows)

This guide helps you run the Multi-Agent Testing Framework on Windows using either Docker Compose or Node.js locally.

## Option A: Run with Docker Compose (recommended)

Requirements:
- Docker Desktop for Windows
- Git

Steps:
1. Open PowerShell or Command Prompt.
2. Clone the repo and enter the project folder.
3. Copy env file and set secrets.
4. Start the stack.
5. Verify health.

Commands:

- Clone and setup env
  git clone <your-repo-url>
  cd multi_agent_testing_framework_prod\project
  copy .env.example .env
  rem Edit .env and set at least GRAFANA_ADMIN_PASSWORD and JWT_SECRET

- Start containers (Docker Desktop must be running)
  docker compose up -d

- Verify services
  curl http://localhost:3005/ # API welcome
  curl http://localhost:3005/api/v1/system/health
  curl http://localhost:9090/  # Prometheus
  curl http://localhost:3002/  # Grafana

Notes:
- API is exposed on http://localhost:3005 (internal 3000 remapped to avoid conflicts)
- Redis is started for you with a password from .env (REDIS_PASSWORD)
- Data, logs, generated tests, and reports are mounted from the host into the container

## Option B: Run locally (Node + Redis)

Requirements:
- Node.js 18+
- Redis (use Docker or native install)
- Git

Steps:
1. Install dependencies and build.
2. Start Redis (locally or via Docker).
3. Copy env file.
4. Run API and Agents.

Commands (cmd.exe):

- Install deps and build
  cd project
  npm ci
  npm run build

- Start Redis quickly using Docker (recommended):
  docker run -p 6379:6379 --name matf-redis -d redis:7-alpine

- Setup env
  copy .env.example .env
  rem Ensure REDIS_HOST=localhost and JWT_SECRET set

- Run API server
  npm start
  rem API: http://localhost:3000

- In a second terminal, run agents (message consumer)
  npm run start:agents

- Verify
  curl http://localhost:3000/api/v1/system/health
  curl http://localhost:3000/metrics

### Playwright browsers (only needed if TE_MODE=playwright)
By default `TE_MODE=simulate` so no browsers are required. If you want to execute real browser tests:

- Install Playwright browsers
  npx playwright install --with-deps

- Switch mode
  set TE_MODE=playwright

If using Docker Compose, the container can be extended to include browsers; otherwise install them on the host.

## Common issues
- Port 3000 already in use: Adjust `PORT` in `.env`, or use Docker Compose which maps API to port 3005.
- Redis connection refused: Ensure Redis is running on localhost:6379, or use Docker: `docker run -p 6379:6379 redis:7-alpine`.
- Webhook signature errors: Set `WEBHOOK_SIGNATURE_SECRET` and send the correct signature header.
- Metrics empty: Hit a few API routes and the consumer to generate activity, then check `/metrics`.

## Next steps
- Explore API routes under `/api/v1/*`
- Submit a test execution via `/api/v1/tests/executions`
- Tail logs in `project/logs` and open HTML reports in `project/test_execution_reports`
