# Master Blueprint: SAFEST v2 Full-Stack Agentic Platform

## System Context & Role
You are an expert Principal Software Engineer and AI Architect. We are expanding a greenfield, fully containerized, self-healing test automation platform called "SAFEST v2". The current stack includes FastAPI, React.js, LangGraph, ChromaDB, and a local Ollama LLM. 

You need to implement new interactive features (Repo Ingestion & Chat) AND a critical architectural safeguard (Smart Diagnosis Routing) to prevent the AI from trying to fix tests when the application itself is fundamentally broken.

## Feature 1: Enhanced Telemetry & Smart Routing (The Safeguard)
**Goal:** The system must differentiate between a brittle test (`STALE_LOCATOR`) and a genuine application defect (`APP_BUG`) using browser logs to prevent infinite test regeneration loops.
1. **Playwright Telemetry Update:** Update the test execution environment to capture browser console errors (JavaScript exceptions) and Network failures (HTTP 4xx/5xx).
2. **State Update (`orchestrator/state.py`):** Update the `SafestState` TypedDict to include:
   - `browser_logs: str`
   - `diagnosis_category: Literal["STALE_LOCATOR", "APP_BUG", "TIMING_ISSUE", "UNKNOWN"]`
3. **Triage Agent Rubric (`agents/triage.py`):** Update the local Ollama LLM system prompt to act as a strict diagnostician. It must analyze the error trace, DOM context, AND browser logs to classify the failure into one of the `diagnosis_category` literals.
4. **LangGraph Conditional Routing (`orchestrator/workflow.py`):** Implement a conditional edge after the Triage Node. 
   - IF `STALE_LOCATOR` -> Route to the Synthesizer/Test Generation node.
   - IF `APP_BUG` -> Route to an `escalate_to_human_node` which halts the graph and pushes a critical alert to the frontend via WebSockets indicating the UI is broken, not the test.

## Feature 2: Dynamic Repository Ingestion
**Goal:** Allow a user to input a GitHub URL on the frontend, which the backend will clone and index for context.
1. **Frontend (React):** Create a `RepoConfigurator` component with a text input for a GitHub URL and a "Connect" button. It POSTs to the backend.
2. **Backend (FastAPI):** Create a `POST /api/repo/ingest` endpoint.
   - Use Python's `subprocess` or `GitPython` to shallow clone the provided repository into a temporary local directory.
   - Parse the repository's frontend source files (focusing on `.js`, `.jsx`, `.ts`, `.tsx`, `.html`).
   - Chunk the source code and index it into the existing `ChromaDB` instance so the LLM understands the app's structure.

## Feature 3: Agentic Chat & Test Execution Sandbox
**Goal:** A chat interface where the user commands the local LLM to write and execute a Playwright test against the ingested repo.
1. **Frontend (React):** Build a `TestGeneratorChat` component with a chat window and a side-by-side `TerminalOutput` component to stream test execution results.
2. **Backend (FastAPI & LangChain):** Create a WebSocket endpoint `ws://.../generate-test`.
   - **Context Retrieval:** Query ChromaDB for relevant React components based on the user's prompt.
   - **Code Generation:** Pass the user prompt and retrieved source code to the local `Ollama` model (`qwen2.5-coder:7b`). Force the LLM to output ONLY valid, executable `pytest-playwright` Python code.
   - **Sandbox Execution:** Save the LLM's output to a temporary file (`temp_test_run.py`) and use `subprocess.Popen` to execute it.
   - **Stream Results:** Stream `stdout` and `stderr` back through the WebSocket to the React UI.
   - **Integration:** If this generated test fails during execution, automatically trigger the LangGraph healing workflow (Feature 1) and stream those state changes to the UI.

## Output Constraints & Execution Order
1. **First, output the LangGraph updates:** Show me `state.py`, `triage.py` (with the new prompt rubric), and `workflow.py` (with the conditional routing logic).
2. **Second, output the FastAPI endpoints:** Show me the `/ingest` logic and the WebSocket implementation for the chat execution.
3. **Third, output the React components:** Provide the UI for the Repo Configurator and the Split-Pane Chat/Terminal. 
Ensure all code is production-ready, highly modular, and well-commented.