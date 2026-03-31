# SAFEST v2 Project Build Data & Handover Context

**Project Name**: SAFEST v2 (Self-Healing Automated Functional Evaluation & Semantic Testing)  
**Status**: Feature Extensions Phase 1 & 2 Complete  
**Last Updated**: 2026-03-31  

---

## 🚀 Architecture Overview

SAFEST v2 is an autonomous test-healing and generation platform built on a 5-layer agentic architecture.

- **Frontend**: React 18, Vite, TailwindCSS (Vanilla CSS for custom components). Modern minimalist dark theme with ambient UI effects.
- **Backend**: FastAPI (Python 3.11+).
- **Orchestration**: LangGraph (State machine for complex multi-agent reasoning loops).
- **LLM Cascade**:
  - **Tier 1 (Local)**: Ollama (`qwen2.5-coder:7b`) for code generation, triage, and natural language log summarisation.
  - **Tier 2 (Cloud)**: Mistral AI (`mistral-large-latest`) for complex expert-level failure diagnosis fallback.
- **Vector DB**: ChromaDB for RAG-based codebase context retrieval.
- **Observability**: Prometheus (metrics) and Grafana (dashboards) integrated for real-time pipeline telemetry.

---

## 🛠️ Key Features Implemented

### 1. Smart Triage & Autonomous Healing (LangGraph)
- **Files**: `backend/orchestrator/` (`workflow.py`, `state.py`, `triage.py`, `agents.py`).
- **Logic**: A 5-node graph classifies test failures using a strict JSON rubric.
- **Safeguard**: Differentiates between `STALE_LOCATOR` (auto-heals) and `APP_BUG` (escalates to human, halts loop).
- **Telemetry**: `backend/verifier.py` uses Playwright async listeners to capture JS console errors and network failures (4xx/5xx) as diagnostic input.

### 2. Dynamic Repository Ingestion (RAG)
- **File**: `backend/repo_ingestion.py`.
- **Logic**: Shallow clones GitHub repos (supports private via `GITHUB_TOKEN`), chunks `.js/.ts/.jsx/.html` files, and indexes them into ChromaDB.
- **UI**: "Connect Codebase" panel in the dashboard.

### 3. Agentic Chat & Test Sandbox
- **File**: `backend/chat_executor.py`, `frontend/src/components/TestGeneratorChat.jsx`.
- **Flow**: User Message → ChromaDB Context Lookup → Ollama Code Generation → Subprocess Sandbox Execution → HTML Report Generation.
- **Auto-Healing**: If a generated test fails in the sandbox, the healing pipeline is automatically triggered and streams progress back to the chat terminal.

### 4. HTML Reporting & Management
- **Persistence**: All runs saved to `generated_tests/run_<timestamp>/`.
- **Artifacts**: Contains `test_script.py` and a self-contained `report.html` (via `pytest-html`).
- **UI**: Dedicated "Reports" tab with a list view, delete functionality, and open-in-new-tab links.

---

## 📂 Project Structure

```text
/
├── project/
│   ├── backend/
│   │   ├── orchestrator/      # LangGraph logic (Triage, Workflow, Agents)
│   │   ├── chat_executor.py   # RAG + Sandbox execution
│   │   ├── main.py            # FastAPI API & WebSocket Endpoints
│   │   ├── repo_ingestion.py  # Git -> ChromaDB indexing
│   │   ├── verifier.py        # Playwright telemetry capture
│   │   └── requirements.txt   # Backend dependencies (inc. GitPython, pytest-html)
│   ├── frontend/              # Vite + React 18
│   │   ├── src/
│   │   │   ├── components/    # (RepoConfigurator, TestGeneratorChat)
│   │   │   ├── App.jsx        # Navigation + Reports Tab + Pipeline Stream
│   │   │   └── index.css      # Design System (Glassmorphism / Dark Mode)
│   ├── generated_tests/       # [ROOT PERSISTENCE] Execution reports
│   ├── .env                   # Mistral & GitHub API Keys
│   └── start-local.ps1        # One-click local startup script
├── safest/                    # Python VENV (Workspace Root)
└── build-data.md              # [THIS FILE] Context handover
```

---

## ⚡ Development & Execution

- **Local Startup**: Run `D:\multi_agent_testing_framework_prod\project\start-local.ps1` from PowerShell. It handles VENV activation and absolute path resolution.
- **Pipelines**:
  - **Backend**: `http://localhost:8000`
  - **Frontend**: `http://localhost:5173`
  - **Grafana**: `http://localhost:3001/dashboards`
- **Dependencies**: Ensure the `safest` virtual environment is active before running terminal commands.

---

## 🐞 Critical Bugfixes Applied
- **Premature WS Close**: Fixed `chat_executor` prematurely sending `done` before the healing pipeline could finish streaming.
- **Tab State**: Replaced conditional rendering with CSS `display: none` in `App.jsx` to preserve active WebSocket connections and terminal scroll positions.
- **WebSocketDisconnect**: Added robust backend handling for early client disconnections to prevent `RuntimeError`.

---

## 🔮 Future Roadmap Suggestions
1. **Multi-Agent Coding**: Allow the chat agent to modify physical files in a project instead of just a sandbox.
2. **Visual Diffing**: Capture screenshots on failure and use a Vision LLM for UI regression diagnosis.
3. **CI/CD Integration**: A CLI tool to run the healing pipeline as a GitHub Action.