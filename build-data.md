# SAFEST Architecture Migration Plan

## System Context & Role
You are an expert AI Systems Architect and Senior Software Engineer. Your task is to refactor a self-healing test automation framework called "SAFEST". You will fundamentally alter its orchestration layer and its LLM utilization strategy. You will nuke the entire original project and build from ground up.

## Current Architecture (The "Before" State)
* **project dir:** D:\multi_agent_testing_framework_prod\project
* **Codebase:** A hybrid Node.js/TypeScript and Python monorepo.
* **Messaging:** Agents communicate asynchronously via a custom Redis Pub/Sub event bus.
* **State Management:** Managed by a `ContextManagerAgent` interacting with Redis.
* **Orchestration:** A `CI-OrchestratorAgent` acts as a state machine listening to `.completed` events to dispatch the next job.
* **Agents:** * `PlannerAgent`: Python, uses LangChain and OpenAI to diagnose failures.
    * `LocatorSynthesiserAgent`: Python, uses scikit-learn for ML fallback predictions.
    * `VerifierAgent`: TypeScript, uses Playwright to test fixes in an isolated browser.
* **Pain Point:** The system currently relies exclusively on expensive online LLM APIs (OpenAI) for all test regeneration and diagnosis tasks, resulting in token exhaustion and high costs.

## Target Architecture (The "After" State)
1.  **Orchestration Swap:** Deprecate the custom Redis Pub/Sub and `ContextManagerAgent`. Replace them with **LangGraph** (Python). LangGraph will handle the cyclical state machine, routing, and memory persistence natively.
2.  **LLM Cascade Strategy:** Implement a dual-LLM routing system. 
    * **Tier 1 (Local):** An Ollama-hosted local model (e.g., `qwen2.5-coder:7b` or `phi3:mini`) running within a strict 6GB VRAM constraint. This will act as the first-pass triage and handle simple fixes.
    * **Tier 2 (Cloud):** The existing OpenAI GPT-4o API. This will be used strictly as a fallback for complex edge cases or when the Tier 1 model yields low confidence.
3.  **Standardization:** Port the high-level orchestration logic into Python to natively utilize LangGraph. (The TypeScript `VerifierAgent` can either be wrapped in a Python subprocess or ported to `pytest-playwright`).

## Execution Plan & Step-by-Step Instructions

### Phase 1: Docker & Dependency Updates
1. Update `docker-compose.yml` to include an `ollama` service constraint to 6GB VRAM (using `deploy.resources.reservations`). Set it to pull a lightweight coding model (e.g., `ollama run qwen2.5-coder:7b`).
2. Add `langgraph`, `langchain-community`, and `langchain-ollama` to the Python `requirements.txt`.

### Phase 2: Define the LangGraph State
1. Create a new file `orchestrator/graph_state.py`.
2. Define a `TypedDict` class named `SafestState` that will replace the old Redis context. It must include fields for: `run_id`, `failure_data`, `diagnosis_confidence`, `proposed_locators`, `verification_status`, and `error_history`.

### Phase 3: Implement the LLM Cascade (Model Routing)
1. In the `PlannerAgent`, implement a routing function.
2. Initialize an `OllamaLLM` instance. Instruct the local model to perform a rapid triage of the failure context.
3. Add logic: *IF* the local model returns a simple fix (e.g., a basic CSS selector change) with high confidence, proceed. *IF* the local model fails, encounters a complex logical error, or runs out of context window, gracefully degrade to the `ChatOpenAI` instance.

### Phase 4: Build the LangGraph Nodes and Edges
1. Convert the core logic of `PlannerAgent`, `LocatorSynthesiserAgent`, and `VerifierAgent` into LangGraph nodes (Python functions that take `SafestState` and return a dict updating that state).
2. Create `orchestrator/workflow.py`. Initialize a `StateGraph(SafestState)`.
3. Add the nodes to the graph.
4. Define the conditional edges. Example: `diagnose_failure` routes to `synthesize_locator` if a stale locator is found, otherwise it ends. `verify_fix` routes to END if successful, or loops back to `synthesize_locator` if the verification fails.

### Phase 5: Clean Up & Deprecation
1. Once the LangGraph workflow successfully passes an end-to-end test, safely delete the old `BaseAgent.ts`, `ContextManagerAgent.ts`, and `CI-OrchestratorAgent.ts` files.
2. Remove the Redis Pub/Sub logic from the codebase.

## Output Constraints:
* Show me the code for `graph_state.py` and `workflow.py` first so I can review the LangGraph structure.
* Ensure all LangChain integrations use the latest `.invoke()` syntax, not the deprecated `.predict()` or `.run()`.
* Output the updated `docker-compose.yml` to ensure the local Ollama container is properly configured.