## Agent Workflow Context & Optimization Loop

### Purpose
This document captures the cross-agent responsibilities and the automated failure recovery loop integrating TestExecutor, ContextManager, LocatorSynthesis, TestOptimizer, and (optionally) TestWriter for regeneration.

### Core Agents
| Agent | Responsibility |
|-------|----------------|
| TestExecutorAgent | Runs tests (simulate / pipeline / Playwright CLI), emits `execution.completed` and `EXECUTION_RESULT` (enriched). |
| ContextManagerAgent | Stores transient execution / failure context in shared memory; dispatches optimization requests. |
| LocatorSynthesisAgent | Generates ranked locator candidates given an element description and optional component analysis. |
| TestOptimizerAgent | Applies retry policy, patches failing tests (selector substitution), re-triggers execution. |
| TestWriterAgent | Generates new tests (AI) – can be invoked to regenerate after unrecoverable failures (future enhancement). |

### Enriched Failure Flow
1. TestExecutorAgent executes tests.
2. On failure it parses output for a probable failing selector and attaches `failedTests` to:
   - Event: `execution.completed`
   - Message: `EXECUTION_RESULT` (payload: `{ executionId, status, summary, failedTests: [...] }`).
3. ContextManagerAgent receives `EXECUTION_RESULT` where `status=failed`:
   - Extracts first failing test metadata (file, `selectorGuess`, snippet)
   - Persists under key: `ctx:lastFailure:<executionId>`
   - Sends `OPTIMIZE_TEST_FILE` to TestOptimizerAgent.
4. TestOptimizerAgent handles `OPTIMIZE_TEST_FILE`:
   - Loads failure context
   - Derives element descriptor from original selector (e.g. testId -> `{ "data-testid": "value", tag: "header" }`)
   - Requests new candidates via `LOCATOR_SYNTHESIS_REQUEST`
   - Patches test (replaces old selector with candidate fallback, currently `page.getByRole('banner')` heuristic)
   - Re-sends `EXECUTION_REQUEST` with `testFilePath` for a fresh attempt.
5. Retry cycle continues until success or `maxAttempts` reached (tracked separately by existing EXECUTION_RESULT logic in TestOptimizerAgent’s retry handler or future extension to merge counters).

### Shared Memory Keys
| Key Pattern | Data |
|-------------|------|
| `ctx:lastFailure:<execId>` | `{ executionId, file, selectorGuess, errorSnippet, summary, ts }` |
| `execAttempts:<execId>` | `{ attempts }` (already used by optimizer retry) |

### Future Enhancements
* Integrate candidate selection directly (subscribe to locator synthesis response events)
* AST-based patching for safer modifications
* Multi-selector fallback chain (testId -> role -> aria-label -> text)
* Automatic regeneration via TestWriterAgent after unrecoverable selector failures
* Confidence scoring persisted with recommendation entries

### Safety & Idempotence
Patches append a comment line documenting substitutions to avoid repeated identical rewrites. A future improvement: add a guard preventing more than N patches per file per execution id.

### Current Limitations
* Selector parsing is regex-based and may miss complex chained locators.
* LocatorSynthesis response is not yet directly captured back into optimizer (first version uses heuristic replacement).
* Pipeline mode failing test introspection not yet wired (only CLI path enriched parsing implemented).

### Quick Start for Optimization Loop (Manual Trigger)
1. Run a failing test via TestExecutorAgent (or direct Playwright CLI with integration).
2. Ensure Redis/event bus running so messages propagate.
3. Observe logs for:
   - `EXECUTION_RESULT` with `failedTests`
   - `ContextManager` dispatching `OPTIMIZE_TEST_FILE`
   - `TestOptimizer` patch and re-run
4. On success, expect subsequent `EXECUTION_RESULT` with `status=passed`.

---
Document version: initial draft.