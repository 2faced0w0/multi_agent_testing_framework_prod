from fastapi import FastAPI, WebSocket, BackgroundTasks, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from prometheus_client import make_asgi_app, Counter, Histogram
from pydantic import BaseModel
import asyncio
import json
import os
import shutil
from pathlib import Path
from dotenv import load_dotenv
from langchain_ollama import OllamaLLM
from langchain_core.prompts import PromptTemplate

load_dotenv()

app = FastAPI(title="SAFEST v2 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Paths ───────────────────────────────────────────────────────────────────
# main.py lives at: project/backend/main.py
# generated_tests should be at: project/  (sibling of backend/)
BACKEND_DIR   = Path(__file__).resolve().parent
PROJECT_DIR   = BACKEND_DIR.parent
REPORTS_DIR   = PROJECT_DIR.parent / "generated_tests"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

# Serve every HTML report at  GET /reports/<run_dir>/report.html
app.mount("/reports", StaticFiles(directory=str(REPORTS_DIR)), name="reports")

# ── Prometheus metrics ───────────────────────────────────────────────────────
metrics_app          = make_asgi_app()
app.mount("/metrics", metrics_app)

total_healing_jobs    = Counter("total_healing_jobs",           "Total self-healing jobs triggered")
agent_node_exec_secs  = Histogram("agent_node_execution_seconds","Per-node execution time", ["node_name"])
llm_cascade_routes    = Counter("llm_cascade_routes",           "LLM routing target counts",   ["target"])
repo_ingest_total     = Counter("repo_ingest_total",            "Total repository ingestion requests")
chat_tests_generated  = Counter("chat_tests_generated",         "Total tests generated via chat")

# ── NL log summariser ────────────────────────────────────────────────────────
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")

_nl_summariser = OllamaLLM(model="qwen2.5-coder:7b", base_url=OLLAMA_HOST)
_nl_prompt     = PromptTemplate.from_template(
    "Summarise the following raw pipeline log in one plain English sentence a non-technical "
    "user would understand. Do not include raw Python or JSON.\n\nRaw log:\n{raw_log}\n\nSummary:"
)

def _nl_summarise(raw: str) -> str:
    try:
        return (_nl_prompt | _nl_summariser).invoke({"raw_log": raw}).strip()
    except Exception:
        return raw


# ── Pydantic models ──────────────────────────────────────────────────────────

class FailurePayload(BaseModel):
    error: str
    locator: str

class RepoIngestPayload(BaseModel):
    repo_url: str

class ChatMessage(BaseModel):
    message: str


# ── Healing pipeline trigger ─────────────────────────────────────────────────

GLOBAL_HEALING_JOBS = {}

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
    
    # 1. Check if chat_executor queued a real state
    initial_state = GLOBAL_HEALING_JOBS.pop(run_id, None)
    
    # 2. Otherwise fallback to mock payload for the "Simulate" Button
    if not initial_state:
        initial_state = {
            "run_id": run_id,
            "failure_data": {"error": "element not interactable", "locator": "#submit-btn"},
            "browser_logs": "Mocked test log trace.",
            "diagnosis_category": "UNKNOWN",
            "diagnosis_confidence": 0.0,
            "proposed_locators": [],
            "verification_status": "pending",
            "error_history": [],
        }

    try:
        for state_chunk in healing_graph.stream(initial_state):
            node_name  = list(state_chunk.keys())[0]
            node_data  = state_chunk[node_name]
            error_history = node_data.get("error_history", [])
            raw_log    = str(error_history[-1]) if error_history else f"Node {node_name} executed."
            # Natural-language conversion (runs in threadpool to avoid blocking event loop)
            human_log  = await asyncio.get_event_loop().run_in_executor(None, _nl_summarise, raw_log)
            llm_cascade_routes.labels(target="ollama").inc()
            await websocket.send_text(json.dumps({
                "node":   node_name,
                "status": "running",
                "output": human_log,
            }))
            await asyncio.sleep(0.5)
        await websocket.send_text(json.dumps({"status": "complete"}))
    except WebSocketDisconnect:
        print(f"Client disconnected from stream {run_id}")
    except RuntimeError:
        pass
    except Exception as e:
        try:
            await websocket.send_text(json.dumps({"status": "error", "output": str(e)}))
        except Exception:
            pass


# ── Feature 2: Repository Ingestion ─────────────────────────────────────────

@app.post("/api/repo/ingest")
async def ingest_repo(payload: RepoIngestPayload):
    import chromadb
    try:
        client = chromadb.Client()
        collection = client.get_collection("dom_chunks")
        existing = collection.get(where={"repo_url": payload.repo_url})
        if existing and existing["ids"]:
            return {"status": "success", "detail": "Repository already indexed."}
    except Exception:
        pass # collection might not exist yet

    repo_ingest_total.inc()
    github_token = os.getenv("GITHUB_TOKEN")
    try:
        from repo_ingestion import clone_and_index
        result = clone_and_index(payload.repo_url, github_token=github_token)
        return result
    except Exception as e:
        return {"status": "error", "detail": str(e)}

@app.get("/api/repo/list")
async def list_repos():
    import chromadb
    try:
        client = chromadb.Client()
        collection = client.get_collection("dom_chunks")
        data = collection.get(include=["metadatas"])
        repos = set()
        for meta in data.get("metadatas", []):
            if meta and "repo_url" in meta:
                repos.add(meta["repo_url"])
        return {"status": "success", "repos": list(repos)}
    except Exception as e:
        return {"status": "success", "repos": []}

@app.delete("/api/repo/delete")
async def delete_repo(repo_url: str):
    import chromadb
    try:
        client = chromadb.Client()
        collection = client.get_collection("dom_chunks")
        collection.delete(where={"repo_url": repo_url})
        return {"status": "deleted", "repo_url": repo_url}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


# ── Feature 3: Agentic Chat & Sandbox ────────────────────────────────────────

@app.websocket("/ws/generate-test")
async def generate_test_ws(websocket: WebSocket):
    await websocket.accept()
    try:
        raw     = await websocket.receive_text()
        payload = json.loads(raw)
        user_prompt = payload.get("prompt", "")
        target_url = payload.get("target_url", "http://localhost:5173")
        
        # Ensure target_url has protocol
        if not target_url.startswith("http"):
            target_url = "https://" + target_url

        chat_tests_generated.inc()

        from chat_executor import generate_and_execute
        async for event in generate_and_execute(user_prompt, target_url):
            if event.get("type") == "heal_job_started":
                GLOBAL_HEALING_JOBS[event["run_id"]] = event.pop("initial_state")
            await websocket.send_text(json.dumps(event))
    except WebSocketDisconnect:
        print("Client disconnected from chat stream.")
    except RuntimeError:
        pass
    except Exception as e:
        try:
            await websocket.send_text(json.dumps({"type": "error", "content": str(e)}))
        except Exception:
            pass


# ── Feature 4: Reports API ────────────────────────────────────────────────────

@app.get("/api/reports/list")
async def list_reports():
    """Return all test run folders sorted newest-first."""
    runs = []
    if REPORTS_DIR.exists():
        for entry in sorted(REPORTS_DIR.iterdir(), reverse=True):
            if entry.is_dir():
                report_html = entry / "report.html"
                test_script = entry / "test_script.py"
                runs.append({
                    "name":         entry.name,
                    "has_report":   report_html.exists(),
                    "has_script":   test_script.exists(),
                    "report_url":   f"/reports/{entry.name}/report.html",
                    "script_url":   f"/reports/{entry.name}/test_script.py",
                    "created_at":   entry.stat().st_mtime,
                })
    return {"runs": runs}


@app.delete("/api/reports/{folder_name}")
async def delete_report(folder_name: str):
    """Permanently delete a specific test run directory."""
    # Basic path traversal guard
    target = REPORTS_DIR / folder_name
    if not str(target.resolve()).startswith(str(REPORTS_DIR.resolve())):
        return {"status": "error", "detail": "Invalid path"}
    if target.exists() and target.is_dir():
        shutil.rmtree(target)
        return {"status": "deleted", "name": folder_name}
    return {"status": "error", "detail": "Folder not found"}
