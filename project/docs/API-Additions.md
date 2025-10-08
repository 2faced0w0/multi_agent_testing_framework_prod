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

### Multi-Layer Test Sanitization & Execution Hardening (Oct 7, 2025 - Phase 2)

To eradicate residual markdown fences and HTML comment scaffolding that occasionally slipped through into containerized executions, a multi-layer sanitizer pipeline was introduced:

1. Generation Layer (TestWriterAgent)
  - Immediately runs `sanitizeGeneratedTest()` on AI output.
  - Performs a late re-check before enqueueing execution if a stray leading fence appears.

2. Post-Processing Layer (`scripts/postprocess-generated-tests.ts`)
  - Re-sanitizes while normalizing imports, injecting a standard header, and renaming to `.pw.ts`.

3. Bulk Cleanup (`scripts/cleanup-generated-tests.ts`)
  - One-off / cron-eligible script to sanitize any legacy artifacts still containing fences.

4. Execution Layer (TestExecutorAgent)
  - Pipeline mode: sanitizes the resolved test file if fences detected.
  - Playwright CLI mode: iterates all `*.spec.ts` files in the target directory and sanitizes as a last-resort pass before invoking Playwright.

### Debug Logging Flag

Set `TEST_SANITIZE_LOG=true` (env) to emit structured debug logs at every sanitation point showing whether content changed. This aids diagnosing stale container layers vs. runtime generation paths.

### Static Asset Freshness & Cache Busting

Problem: Updated `public/app.js` occasionally appeared stale inside rebuilt containers due to cached layers or external proxies.

Mitigations:
  - Added dynamic script injection in `public/index.html` that appends a `?v=<timestamp>` query param to `/app.js`.
  - Added server-side `Cache-Control: no-cache, no-store, must-revalidate` headers for `app.js` and `index.html`.
  - Introduced a diagnostic endpoint: `GET /api/v1/gui/debug/assets-hash` returning SHA256 (short) + mtime for key assets (app.js, index.html, styles.css) to verify deployed bytes.

Example response:
```
{ "assets": { "app.js": { "hash": "9af3c1d0e4bb7a12", "mtime": "2025-10-07T18:42:10.123Z", "size": 31247 } } }
```

### Operational Guidance (Docker)

When updating frontend or sanitizer logic:

1. Force a clean build: `docker compose build --no-cache framework` (adjust service name as needed).
2. Recreate containers: `docker compose up -d`.
3. Verify asset hashes: `curl http://<host>:<port>/api/v1/gui/debug/assets-hash`.
4. (Optional) Enable sanitizer debug: add `TEST_SANITIZE_LOG=true` to the framework & agent service environments to confirm live sanitation.

### Security & Stability Notes

- Sanitizer only strips known scaffolding (markdown fences, standalone HTML comments) and collapses excessive blank lines; it does NOT execute or transform code semantics.
- All sanitation steps are idempotent; repeated application yields deterministic output (aiding reproducibility in CI/CD).

### Future Enhancements (Proposed)

- Add a Prometheus counter `sanitizer_changes_total{stage=...}` to quantify how often each layer modifies artifacts.
- Introduce a build-time asset manifest whose hash is exposed for stronger integrity checks.
- Provide a CLI `matf doctor` command to run sanitation + asset hash diagnostics locally.

## Strict Content Security Policy (Oct 8, 2025)

To eliminate CSP violations and prevent inline script/style execution on the main dashboard, a strict CSP header is now applied to `index.html`, `app.js`, and `styles.css` responses:

```
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' data:;
font-src 'self' data:;
connect-src 'self';
frame-ancestors 'self';
base-uri 'self';
form-action 'self'
```

Changes implemented:
1. Removed inline cache-busting script in `index.html`; replaced with `<script src="/app.js" defer>`.
2. Converted critical inline style attributes to utility classes in `public/styles.css` (e.g., `.toolbar-row`, `.modal`, `.debug-log`).
3. Added a secure modal and debug log styling without inline CSS.
4. Reports at `/reports-static` retain a relaxed CSP permitting `'unsafe-inline'` to accommodate Playwright's generated HTML.

### Relax / Extend Policy (Development Only)
- You can conditionalize CSP in `server.ts` to append `'unsafe-inline'` for rapid prototyping (NOT recommended for production).
- For individual inline script allowance, switch to nonce-based approach: generate a per-response nonce, inject `nonce="..."`, and add `script-src 'self' 'nonce-XYZ'`.

### Asset Versioning Without Inline Scripts
Current approach relies on `Cache-Control: no-cache` for core assets. To enable long-lived caching:
- Hash filenames (build step produces `app.[hash].js`; reference directly in HTML).
- Or server-render `index.html` template substituting `?v=${process.env.SERVER_START_TIME}` appended to `app.js` URL (still no inline JS needed—string replace on file contents before send).

### Adding External Resources
Explicitly list needed origins (e.g., `https://fonts.gstatic.com`). Avoid wildcards. Add them to the appropriate directive (`font-src`, `style-src`, etc.).

### Debugging CSP Issues
Look for `Refused to load the script` console errors. Confirm the blocked URL and extend policy deliberately—or refactor to self-host.

### Security Rationale
Removing inline execution sharply reduces XSS risk scope: attackers would need to control an external JavaScript file or compromise headers instead of injecting HTML alone.

