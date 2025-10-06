# MATF Agents Postman Testing Guide

This guide walks you through exercising every agent via the HTTP trigger endpoints added under `/api/v1/agents`.

## Prerequisites
- Framework API and Agents containers running (or local `npm run dev` + `ts-node src/agents/bootstrap.ts`).
- Import `MATF.postman_collection.json` into Postman.
- Optionally set an environment with variable `baseUrl` (defaults to `http://localhost:3000`).

## Recommended Order
1. System Health
2. Test Writer - Generate
3. List Executions & (optionally) Enqueue Execution
4. Optimizer - Optimize Recent
5. Locator - Synthesize
6. Context - Update, then Context - Get
7. Report - Generate (use an execution id from step 3 or writer/auto execution)
8. Logger - Custom Log, then Logger - Query Logs
9. Metrics (Prometheus) to confirm counters increased

## Details Per Agent
### Test Writer
- Endpoint: `POST /api/v1/agents/test-writer/generate`
- Effect: Uses Mistral AI (if `MISTRAL_API_KEY` + `MISTRAL_MODEL` set) to synthesize a high‑level Playwright test. Falls back to a deterministic placeholder when AI config is missing or an error occurs. Always enqueues an `EXECUTION_REQUEST` to TestExecutor after writing the file.
- Verify: Check new file in `generated_tests/` (look for header `Generated Playwright Test (mistral)` vs `fallback`). Examine `/metrics` for increment (e.g., `tests_generated_total`).

### Test Executor
- Triggered indirectly by Writer or by `/api/v1/tests/executions` POST.
- Verify: `/api/v1/tests/executions` list shows status transitions (`queued` -> `running` -> final).

### Report Generator
- Endpoint: `POST /api/v1/agents/report/generate` with body `{ "executionId": "<id>" }`.
- Effect: Writes JSON summary in `test_execution_reports/<id>.summary.json` and DB row.
- Verify: File existence & event `report.generated` (if you subscribe via future SSE/websocket integration) and metrics (`matf_execution_completions_total`).

### Test Optimizer
- Endpoint: `POST /api/v1/agents/optimizer/optimize`.
- Effect: Publishes optimization completion event; placeholder for advanced analysis.

### Locator Synthesis
- Endpoint: `POST /api/v1/agents/locator/synthesize` with an element description.
- Effect: Persists locator candidates & publishes `locator.synthesis.completed`.

### Context Manager
- Update: `POST /api/v1/agents/context/update` (key/value/ttl)
- Get: `POST /api/v1/agents/context/get` (key)
- Failure hook: Trigger by causing an execution to fail; executor sends failure message.

### Logger
- Log: `POST /api/v1/agents/logger/log`
- Query: `POST /api/v1/agents/logger/query` (returns 202; results logged via event + stored in DB)
- Direct fetch: Use existing `GET /api/v1/system/logs?query=Manual` to confirm persistence.

## Metrics Quick Checks
After running a few requests, open `/metrics` and confirm these increase:
- `matf_mq_messages_total{action="enqueued"}`
- `matf_tests_generated_total`
- `matf_execution_starts_total`
- `matf_execution_completions_total`
- `matf_queue_wait_seconds_count`

## Troubleshooting
| Issue | Likely Cause | Fix |
|-------|--------------|-----|
| 500 on agent endpoint | Redis not reachable | Check `messageQueue.redis` config & container health |
| Execution stuck in queued | Executor agent not running | Ensure agents process is up (bootstrap) |
| Report JSON missing | ReportGenerator not initialized | Restart agents process |
| Metrics missing new counters | Using stale image | Rebuild images and restart stack |

## Cleanup
To reset state: use the queue reset UI control (if implemented) or restart Redis & delete `framework.db` (data loss!).

---
Happy testing! File issues or extend collection as new agents/flows are added.
