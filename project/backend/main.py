from fastapi import FastAPI, WebSocket, BackgroundTasks
from prometheus_client import make_asgi_app, Counter, Histogram
import asyncio
import json

app = FastAPI(title="SAFEST v2 API")

# Setup Prometheus metrics
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

# Custom metrics
total_healing_jobs = Counter('total_healing_jobs', 'Total number of self-healing jobs requested')
agent_node_execution_seconds = Histogram('agent_node_execution_seconds', 'Execution time per LangGraph node', ['node_name'])
llm_cascade_routes = Counter('llm_cascade_routes', 'LLM routing target counts', ['target'])

@app.post("/jobs/trigger")
async def trigger_job(failure_payload: dict, background_tasks: BackgroundTasks):
    total_healing_jobs.inc()
    return {"status": "job_started", "run_id": "mock_run_123"}

@app.websocket("/ws/stream/{run_id}")
async def websocket_stream(websocket: WebSocket, run_id: str):
    await websocket.accept()
    # Mock stream simulating LangGraph execution ticks
    mock_states = [
        {"node": "TriageAgent", "status": "running", "output": "Analyzing failure..."},
        {"node": "ExpertFallbackAgent", "status": "pending", "output": ""},
        {"node": "VerifierAgent", "status": "pending", "output": ""}
    ]
    try:
        for state in mock_states:
            await websocket.send_text(json.dumps(state))
            await asyncio.sleep(2)
        await websocket.send_text(json.dumps({"status": "complete"}))
    except Exception as e:
        print(f"WebSocket closed: {e}")
