from fastapi import FastAPI, WebSocket, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import make_asgi_app, Counter, Histogram
from pydantic import BaseModel
import asyncio
import json
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="SAFEST v2 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus metrics
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

total_healing_jobs    = Counter("total_healing_jobs",           "Total self-healing jobs triggered")
agent_node_exec_secs  = Histogram("agent_node_execution_seconds","Per-node execution time", ["node_name"])
llm_cascade_routes    = Counter("llm_cascade_routes",           "LLM routing target counts",   ["target"])
repo_ingest_total     = Counter("repo_ingest_total",            "Total repository ingestion requests")
chat_tests_generated  = Counter("chat_tests_generated",         "Total tests generated via chat")


# ── Pydantic models ──────────────────────────────────────────────────────────

class FailurePayload(BaseModel):
    error: str
    locator: str

class RepoIngestPayload(BaseModel):
    repo_url: str

class ChatMessage(BaseModel):
    message: str


# ── Existing: Healing pipeline trigger ──────────────────────────────────────

@app.post("/jobs/trigger")
async def trigger_job(payload: FailurePayload, background_tasks: BackgroundTasks):
    total_healing_jobs.inc()
    import uuid
    run_id = str(uuid.uuid4())[:8]
    return {"status": "job_started", "run_id": run_id}


@app.websocket("/ws/stream/{run_id}")
async def websocket_stream(websocket: WebSocket, run_id: str):
    await websocket.accept()
    from orchestrator.workflow import build_graph
    from orchestrator.state import SafestState

    healing_graph = build_graph()
    initial_state: SafestState = {
        "run_id": run_id,
        "failure_data": {"error": "element not interactable", "locator": "#submit-btn"},
        "browser_logs": "",
        "diagnosis_category": "UNKNOWN",
        "diagnosis_confidence": 0.0,
        "proposed_locators": [],
        "verification_status": "pending",
        "error_history": [],
    }
    try:
        for state_chunk in healing_graph.stream(initial_state):
            node_name = list(state_chunk.keys())[0]
            llm_cascade_routes.labels(target="ollama").inc()
            await websocket.send_text(json.dumps({
                "node":   node_name,
                "status": "running",
                "output": str(state_chunk[node_name].get("error_history", [])[-1:]),
            }))
            await asyncio.sleep(0.5)
        await websocket.send_text(json.dumps({"status": "complete"}))
    except Exception as e:
        await websocket.send_text(json.dumps({"status": "error", "output": str(e)}))


# ── Feature 2: Repository Ingestion ─────────────────────────────────────────

@app.post("/api/repo/ingest")
async def ingest_repo(payload: RepoIngestPayload):
    repo_ingest_total.inc()
    github_token = os.getenv("GITHUB_TOKEN")
    try:
        from repo_ingestion import clone_and_index
        result = clone_and_index(payload.repo_url, github_token=github_token)
        return result
    except Exception as e:
        return {"status": "error", "detail": str(e)}


# ── Feature 3: Agentic Chat & Test Execution Sandbox ────────────────────────

@app.websocket("/ws/generate-test")
async def generate_test_ws(websocket: WebSocket):
    await websocket.accept()
    try:
        raw = await websocket.receive_text()
        payload = json.loads(raw)
        user_message = payload.get("message", "")
        chat_tests_generated.inc()

        from chat_executor import generate_and_execute
        async for event in generate_and_execute(user_message):
            await websocket.send_text(json.dumps(event))

        await websocket.send_text(json.dumps({"type": "done", "content": "Stream complete."}))
    except Exception as e:
        await websocket.send_text(json.dumps({"type": "error", "content": str(e)}))
