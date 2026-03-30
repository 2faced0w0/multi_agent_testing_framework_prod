# Full-Stack Greenfield Agentic Architecture: SAFEST v2

## System Context & Role
You are an expert Principal Software Engineer and Cloud Architect. We are building a greenfield, fully containerized, self-healing test automation platform. You will build this architecture from scratch, ensuring modularity, live observability, and an interactive user experience.

## Target Architecture & Tech Stack
This is a modern, distributed system composed of 5 core layers:
1.  **Frontend (React.js):** A modular, component-based dashboard built with Vite and TailwindCSS. It uses WebSockets to display live agent execution traces and REST for historical data.
2.  **Backend API (FastAPI):** Exposes REST endpoints to trigger jobs, WebSockets to stream LangGraph state changes to the UI, and a `/metrics` endpoint for Prometheus.
3.  **Orchestration (LangGraph):** The core state machine orchestrating the AI agents, utilizing `AsyncSqliteSaver` for checkpointing.
4.  **LLM Cascade & RAG:** * **Tier 1:** Local `Ollama` container (constrained to 6GB VRAM) running a quantized coder model.
    * **Tier 2:** Cloud LLM (OpenAI) fallback.
    * **Context:** `ChromaDB` for lightweight DOM chunk retrieval to save tokens.
5.  **Observability (Prometheus + Grafana):** Prometheus scrapes the FastAPI metrics. Grafana visualizes LLM token usage, routing metrics, and agent success rates.

## Execution Plan & Step-by-Step Instructions

### Phase 1: Docker Orchestration & Scaffolding
1. Create a monorepo structure with `/frontend`, `/backend`, and `/observability`.
2. Write a comprehensive `docker-compose.yml` defining the following services:
    * `frontend`: React.js app on port 3000.
    * `backend`: FastAPI app on port 8000.
    * `ollama`: Local LLM runner with a strict 6GB VRAM GPU reservation.
    * `prometheus`: Scraping `backend:8000/metrics`.
    * `grafana`: Pre-provisioned to use Prometheus as a data source.
3. Include standard `requirements.txt` for Python and `package.json` for React.

### Phase 2: Instrumented FastAPI & LangGraph Setup
1. In the `backend/`, implement the LangGraph state machine (`SafestState`) with three nodes: `TriageAgent`, `ExpertFallbackAgent`, and `VerifierAgent`.
2. Implement the LLM routing logic: attempt Ollama first, catch low-confidence/errors, and fallback to OpenAI.
3. Instrument the FastAPI app with `prometheus_client`. Create custom metrics:
    * `Counter` for `total_healing_jobs`.
    * `Histogram` for `agent_node_execution_seconds`.
    * `Counter` for `llm_cascade_routes` (labels: `target="local" | "cloud"`).
4. Create a WebSocket endpoint (`/ws/stream/{run_id}`) that streams LangGraph state updates as JSON.

### Phase 3: React.js Interactive Dashboard
1. In the `frontend/`, build a modular React UI using functional components and hooks.
2. **Component 1 (Trigger Panel):** A form to submit a mocked test failure payload.
3. **Component 2 (Live Execution Graph):** A visual component that connects to the FastAPI WebSocket. As the LangGraph state updates, visually highlight which agent (Triage, Expert, or Verifier) is currently active, and display its output logs in real-time.
4. **Component 3 (Metrics Link):** An embedded iframe or link pointing to the Grafana dashboard port.

### Phase 4: DOM RAG Tooling
1. Write a utility using `BeautifulSoup` to chunk raw HTML error snapshots into semantic trees.
2. Index these chunks into an ephemeral `ChromaDB` collection and build a retrieval tool for the agents to pull only the relevant DOM neighborhood surrounding a broken locator.

### Phase 5: Verification Environment
1. Implement the `VerifierAgent` logic: an isolated Python subprocess that uses `pytest-playwright` to execute the AI-generated locator fix and returns a boolean pass/fail back to the LangGraph state.

## Output Constraints
* Start by outputting the `docker-compose.yml` so I can verify the network topology and GPU constraints.
* Next, output the `backend/main.py` demonstrating the FastAPI WebSocket setup alongside the Prometheus instrumentation.
* Write clean, modular, and heavily commented code. Ensure all LangChain syntax relies on modern `.invoke()` and `.stream()` methods.