import asyncio
import json
import subprocess
import tempfile
import os
from typing import AsyncGenerator
import chromadb
from langchain_ollama import OllamaLLM
from langchain_core.prompts import PromptTemplate

# Point to host Ollama when running locally; Docker override via env var
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")

code_gen_llm = OllamaLLM(
    model="qwen2.5-coder:7b",
    base_url=OLLAMA_HOST,
    stop=["```"],  # Stop after first code block
)

CODE_GEN_PROMPT = PromptTemplate.from_template("""
You are an expert Playwright test engineer. Write ONLY valid, executable pytest-playwright Python code.
Do NOT include explanations, markdown fences, or comments outside the code.
Output must start with `import` statements and be a complete pytest test function.

Relevant source code context from the repository:
{context}

User request: {user_message}

Python pytest-playwright code:
""")

def _query_chromadb_context(user_message: str, n_results: int = 5) -> str:
    """Query ChromaDB for source code relevant to the user's request."""
    try:
        client = chromadb.Client()
        collection = client.get_collection("dom_chunks")
        results = collection.query(query_texts=[user_message], n_results=n_results)
        docs = results.get("documents", [[]])[0]
        return "\n\n---\n\n".join(docs) if docs else "No repository context available."
    except Exception:
        return "No repository context available (ChromaDB empty or not initialised)."


async def generate_and_execute(user_message: str) -> AsyncGenerator[dict, None]:
    """
    Full pipeline: RAG context retrieval → code generation → sandbox execution.
    Yields structured event dicts for streaming over WebSocket.
    """
    # 1. Retrieve context
    yield {"type": "status", "content": "Querying repository context..."}
    context = _query_chromadb_context(user_message)

    # 2. Generate code via Ollama
    yield {"type": "status", "content": "Generating test with Ollama (qwen2.5-coder:7b)..."}
    try:
        chain = CODE_GEN_PROMPT | code_gen_llm
        generated_code = chain.invoke({"context": context, "user_message": user_message})
    except Exception as e:
        yield {"type": "error", "content": f"Code generation failed: {e}"}
        return

    yield {"type": "code", "content": generated_code}

    # 3. Write to temp file and execute in sandbox
    yield {"type": "status", "content": "Executing test in sandbox..."}

    tmp_path = os.path.join(tempfile.gettempdir(), "safest_temp_test.py")
    with open(tmp_path, "w", encoding="utf-8") as f:
        f.write(generated_code)

    proc = subprocess.Popen(
        ["python", "-m", "pytest", tmp_path, "-v", "--tb=short"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    exit_code = None
    loop = asyncio.get_event_loop()

    # Stream output line by line
    for line in proc.stdout:
        yield {"type": "stdout", "content": line.rstrip()}
        await asyncio.sleep(0)  # yield control back to event loop

    exit_code = proc.wait()

    if exit_code == 0:
        yield {"type": "done", "content": "✅ Test passed successfully."}
    else:
        yield {"type": "done", "content": f"❌ Test failed (exit {exit_code}). Triggering self-healing pipeline..."}
        # Integration: trigger LangGraph healing
        from orchestrator.workflow import build_graph
        from orchestrator.state import SafestState

        healing_graph = build_graph()
        initial_state: SafestState = {
            "run_id": "chat_sandbox_heal",
            "failure_data": {"error": "generated test failed", "locator": "unknown", "generated_code": generated_code},
            "browser_logs": "",
            "diagnosis_category": "UNKNOWN",
            "diagnosis_confidence": 0.0,
            "proposed_locators": [],
            "verification_status": "pending",
            "error_history": [],
        }
        for graph_state in healing_graph.stream(initial_state):
            yield {"type": "graph_state", "content": json.dumps(graph_state, default=str)}
            await asyncio.sleep(0)
