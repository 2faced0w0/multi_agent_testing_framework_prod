# API and Messaging Additions (Sept 29, 2025)

This document summarizes the latest API endpoints, messaging reliability enhancements, and metrics instrumentation recently added to the framework.

## New/Extended REST Endpoints

- Test Cases
  - GET /api/v1/tests/cases
  - GET /api/v1/tests/cases/:id
  - POST /api/v1/tests/cases
  - PUT /api/v1/tests/cases/:id
  - DELETE /api/v1/tests/cases/:id

- Test Executions
  - GET /api/v1/tests/executions/:id/results
  - GET /api/v1/tests/executions/:id/results/:reportId
  - POST /api/v1/tests/executions/:id/cancel

- Reports
  - GET /api/v1/reports
  - GET /api/v1/reports/:id/download

- Logs
  - GET /api/v1/system/logs

- Agents (additions)
  - POST /api/v1/agents/test-writer/generate/batch
    - Body: { "items": [ { repo, branch, headCommit, changedFiles, compareUrl }... ], "priority"?: "high"|"critical" }
    - Constraints: MAX_TEST_GENERATION_BATCH (default 10). Returns 400 if exceeded.
    - Concurrency Guard: Rejects with 429 when total queued messages > MAX_TEST_GENERATION_INFLIGHT (default 50).
    - Response: { status: 'queued', count, results: [{ index, messageId, mqError? }] }

- System
  - GET /api/v1/system/metrics/queues (DB-backed stats)
  - GET /metrics (Prometheus text)

## Webhook Hardening

- Require JSON content-type (415 otherwise)
- Validate GitHub signature via X-Hub-Signature-256 when GITHUB_WEBHOOK_SECRET is set (401 on mismatch)
- Basic payload schema checks (repository, ref, head_commit)
- Optional repository allowlist via ALLOWED_REPOS (403 if not allowed)

## Messaging Reliability

- MessageQueue now supports:
  - Priority queues: default, high, critical
  - Idempotency key (optional) to drop duplicates for 1h window
  - Attempts tracking per message
  - Processing tracking (processing:<id>)
  - Acknowledge, retry, and move to DLQ when max retries exceeded
  - BLPOP consumption with priority order via consumeNext()

## Metrics Instrumentation

- API counters and simple duration buckets:
  - Test Cases: list/get/create/update/delete counters and error counters
  - Executions: list/get/enqueue (status-tagged)/results list/get/cancel (status-tagged)
  - Webhooks: invalid content type/signature/schema, repo disallowed, enqueue success/error

- MQ metrics:
  - mq_enqueue_total, mq_consume_total, mq_ack_total, mq_retry_total, mq_dlq_total

- AI Generation metrics (Prometheus):
  - matf_ai_requests_total{provider,model,status}
    - status in [ok, error, empty, missing-config, sdk-missing]
  - matf_ai_prompt_tokens_total{provider,model}
  - matf_ai_completion_tokens_total{provider,model}

- Test validation:
  - Generated test now undergoes a lightweight TypeScript transpile check before auto execution enqueue.
  - On compile error: execution enqueue is skipped; error logged (no new metric yet).

All metrics are exposed via the existing /metrics endpoint.

## Notes

- These changes are backward compatible with existing endpoints.
- Consider adding dashboards based on the new metrics (Grafana JSON exists under project/docs/observability).
- Batch generation allows rapid multi-scenario seeding while protecting system via queue depth guard.

## Test Generation Enhancements (Oct 7, 2025)

### Automatic Markdown Fence Stripping

The TestWriterAgent now automatically removes leading/trailing markdown code fences (e.g. ```typescript / ```ts / ```) from AI model output before persisting files under `generated_tests/`. This prevents residual fences from appearing in raw artifacts and avoids a manual cleanup step. Implementation lives in `src/agents/test-writer/utils.ts` (`stripCodeFences`). The helper is idempotent and preserves a single trailing newline for stable diffs.

No API changes were required; existing generation endpoints benefit transparently.
