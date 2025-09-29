# SAFEST (Self-healing Agentic Framework for End-to-end Software Testing) — Developer & Deployment Guide

This document is the living source of truth for working on this repository. It covers development workflow, testing, local runtime, containers, Kubernetes, and how to extend agents. Keep it updated with each change.

---

## Project Mission

Monitor a MERN web application repository for UI changes and automatically generate and execute high-level Playwright tests in TypeScript.

Core principles:
- LLM-driven test generation (Mistral API) for TypeScript Playwright specs
- ML-based element locator synthesis for robust selectors and self-healing
- Multi-agent architecture communicating over Redis, persisting to a SQL database
- Artifacts on disk for traceability:
  - Generated tests in `project/generated_tests/*.ts`
  - Execution reports in `project/test_execution_reports/*.html`

Outcomes:
- Resilient, low-maintenance E2E tests that adapt to UI/API drift
- Transparent decisions with auditable logs, events, and Prometheus metrics
- Seamless CI/CD integration for gated merges and nightly runs

---

## Repo Structure (high-level)

- `project/src` — TypeScript source
  - `api` — Express server, routes (`/api/v1/system`, `/api/v1/tests/executions`, `/metrics`)
  - `agents` — Base agent and concrete agents (to be expanded): RepoWatcher/Webhook, TestWriter, Locator Synthesis, TestExecutor, ReportGenerator, TestOptimizer, ContextManager, Logger
  - `communication` — Redis-backed MQ/EventBus/SharedMemory
  - `database` — SQLite database manager and repositories
  - `monitoring` — In-app Prometheus metrics registry
  - `types` — Shared types
- `project/docker-compose.yml` — Local stack (framework + redis + monitoring)
- `project/Dockerfile` — Multi-stage image build
- `docs/` — Architecture, technical specs, roadmap
 - `project/generated_tests/` — Generated Playwright TypeScript tests (output)
 - `project/test_execution_reports/` — HTML execution reports (output)

---

## Prerequisites

- Node.js 18+ (Windows supported)
- Docker Desktop (for local stack)
- Redis (via compose) and SQLite (embedded)

---

## Install, Build, Test

- Install deps
  - `npm install`
- Build TS
  - `npm run build`
- Lint
  - `npm run lint` (or `npm run lint:fix`)
- Tests (Jest)
  - All: `npm test`
  - Unit: `npm run test:unit`
  - Integration: `npm run test:integration`

Notes:
- Path aliases are configured in `tsconfig.json`. Runtime uses `module-alias`.
- Jest config maps TS paths; integration tests expect Redis to be up.
- Ensure output dirs exist: `project/generated_tests` and `project/test_execution_reports`.

---

## Running Locally

- API (dev): `npm run dev` (ts-node)
- API (compiled): `npm start` (after build)
- Docker Compose (recommended):
  - Bring up Redis + framework: `docker-compose up -d redis framework`
  - API lives at: http://localhost:3005
  - Health: `GET http://localhost:3005/api/v1/system/health` (via system route)
  - Metrics: `GET http://localhost:3005/metrics` (Prometheus format)

Environment variables:
- `PORT` (default 3000; compose maps 3005:3000)
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB`, `REDIS_PASSWORD`
- `DATABASE_URL` (default inside container `/app/data/framework.db`)
- `CORS_ALLOWED_ORIGINS`, `RATE_LIMIT_*`
 - `MISTRAL_API_KEY` (LLM test generation)
 - `WEBHOOK_SECRET` (GitHub webhook signature verification)
 - `REPO_PATH` or `REPO_URL` (for local polling or webhook context)

---

## Agents — Roles and End-to-end Flow

Agents work in tandem to detect UI changes in a MERN repo and continuously generate, heal, execute, and report tests:

1) RepoWatcher/Webhook Agent
  - Listens to GitHub webhook or polls a repo
  - Detects UI diffs (e.g., `client/src/**/*`) and queues TEST_GENERATION_REQUEST

2) TestWriter Agent (Mistral)
  - Builds prompts using repo context and diffs
  - Calls Mistral to generate TS Playwright specs
  - Emits LOCATOR_SYNTHESIS_REQUEST for robust selectors
  - Saves `.ts` files under `project/generated_tests` and records metadata in SQL

3) Locator Synthesis Agent (ML)
  - Produces stable selectors with ML/heuristics
  - Returns LOCATOR_SYNTHESIS_RESPONSE to TestWriter

4) TestExecutor Agent (Playwright)
  - Executes generated tests, captures artifacts
  - Saves HTML reports to `project/test_execution_reports`
  - Updates SQL with results; publishes EXECUTION_RESULT

5) ReportGenerator Agent
  - Aggregates runs into a high-level HTML report and persists metadata

6) TestOptimizer Agent
  - Detects flakiness and recommends healing (selectors, waits, retries)

7) ContextManager Agent
  - Centralizes config, secrets, auth, and shared context

8) Logger Agent
  - Ingests logs/events and exposes metrics counters

Acceptance for MVP (each agent):
1) process ≥1 message type; 2) publish ≥1 event; 3) persist minimal state/artifact; 4) health via BaseAgent.getHealth(); 5) unit tests; 6) integration test for Redis message flow.

---

## API Quick Reference

- `GET /` — ping
- `GET /metrics` — Prometheus metrics
- `GET /api/v1/system/health` — system health
- `GET /api/v1/tests/executions` — list executions
- `POST /api/v1/tests/executions` — enqueue an execution
 - (Planned) `POST /api/v1/webhook/github` — GitHub webhook receiver (RepoWatcher)

Example (PowerShell):
- `iwr http://localhost:3005/metrics` or `iwr http://localhost:3005/api/v1/system/health`

---

## Containers

- Build and run: `docker-compose up -d --build framework`
- Logs: `docker-compose logs -f framework`
- Redis auth is enabled; set `REDIS_PASSWORD` when starting framework.
 - Mount volumes so generated tests and reports persist:
   - `./project/generated_tests:/app/generated_tests`
   - `./project/test_execution_reports:/app/test_execution_reports`

---

## Kubernetes (overview)

- Base manifests in `project/k8s` with overlays for staging/production
- Secrets: `matf-secrets` (jwtSecret, mistralApiKey, redisPassword), alertmanager secret
- PVC for SQLite and artifacts; backup CronJob included
 - Add PVCs for generated tests and reports; mount into the framework pod
- Apply with kustomize overlay; run smoke tests post-deploy

---

## Development Conventions

- TypeScript strict mode; prefer narrow types
- Path aliases under `tsconfig.json`
- Jest for unit/integration; keep integration fast (Dockerized Redis)
- Commits should update this document when changing run/test/deploy flows
 - Generated outputs must be committed or archived depending on environment policy; ensure `.gitignore` matches policy

---

## Common Issues

- Module alias not working in runtime
  - Ensure `module-alias/register` is required before app start (see Dockerfile/`bootstrap.ts`).
- Port 3000 already in use
  - Compose maps to 3005; adjust `PORT` if running locally.
- Redis auth failures
  - Confirm `REDIS_PASSWORD` matches compose config.
 - Webhook signature mismatch
   - Verify `WEBHOOK_SECRET` and GitHub delivery headers validation.
 - Missing output folders
   - Ensure `project/generated_tests` and `project/test_execution_reports` exist and are writable in all environments.

---

## Roadmap Snapshots

- Implement all agents with MVP flows and tests
- End-to-end pipeline: Writer -> Executor -> Report
- Observability full stack: Prometheus, Grafana, Alertmanager
- K8s deployment hardened with RBAC, limits, probes

---

Maintainers: update sections as you implement agents, add APIs, or change deployment. PRs should mention which sections were touched here.
