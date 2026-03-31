import asyncio
import json
import subprocess
import tempfile
import os
import sys
from pathlib import Path
from datetime import datetime
from typing import AsyncGenerator
import chromadb
from langchain_ollama import OllamaLLM
from langchain_core.prompts import PromptTemplate

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
# Root of the whole workspace (two levels up from backend/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
REPORTS_DIR = PROJECT_ROOT / "generated_tests"

code_gen_llm = OllamaLLM(
    model="qwen2.5-coder:7b",
    base_url=OLLAMA_HOST,
)

nl_summariser = OllamaLLM(
    model="qwen2.5-coder:7b",
    base_url=OLLAMA_HOST,
)

CODE_GEN_PROMPT = PromptTemplate.from_template("""
You are an expert QA Automation Engineer writing a pytest-playwright script.
You have been provided with the source code context of the application below.

CRITICAL RULES:
1. **SEMANTIC FLEXIBILITY (ALLOWED):** The user may use natural language that doesn't perfectly match the code (e.g., they say "Place Order", but the code says "Submit" or `id="submit-order-btn"`). You MUST use your reasoning to map the user's intent to the actual elements present in the provided React context.
2. **FEATURE HALLUCINATION (FORBIDDEN):** Do NOT invent elements for entirely missing features. If the user asks to test a "Login" or "Admin Dashboard" flow, and the context only contains a Checkout form, you cannot map that. 
3. **REJECTION PROTOCOL:** ONLY if the requested feature or entire workflow is completely absent from the context, output EXACTLY the word `REJECTED:` followed by a brief explanation. Otherwise, write the test using the closest semantic matches found in the context.
4. **ASSERTIONS:** If the user asks to verify success, look at the context to see how success is rendered (e.g., does a state change render a new component or message?) and assert against that actual implementation.

Application Context (React Source Code):
{context}

Target URL: {target_url}
User Request: {user_prompt}

Output ONLY valid, runnable Python code. If rejected, output ONLY the REJECTED message.
""")

NL_SUMMARY_PROMPT = PromptTemplate.from_template("""
Convert the following raw technical log from an automated test-healing pipeline into a single clear 
sentence that a non-technical user would understand. Be specific about what step is happening.
Do not include raw Python or JSON syntax in your answer.

Raw technical log:
{raw_log}

Human-readable summary:
""")


def _query_chromadb_context(user_message: str, n_results: int = 5) -> str:
    try:
        client = chromadb.Client()
        collection = client.get_collection("dom_chunks")
        results = collection.query(query_texts=[user_message], n_results=n_results)
        docs = results.get("documents", [[]])[0]
        return "\n\n---\n\n".join(docs) if docs else "No repository context available."
    except Exception:
        return "No repository context available (ChromaDB empty or not initialised)."


def summarise_log(raw: str) -> str:
    """Use Ollama to produce a plain-English one-liner from a raw log string."""
    try:
        chain = NL_SUMMARY_PROMPT | nl_summariser
        return chain.invoke({"raw_log": raw}).strip()
    except Exception:
        return raw  # fallback to raw if LLM unavailable


def _create_run_dir() -> Path:
    """Create a uniquely-named folder inside generated_tests/ for this run."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = REPORTS_DIR / f"run_{timestamp}"
    run_dir.mkdir(parents=True, exist_ok=True)
    return run_dir


async def generate_and_execute(user_prompt: str, target_url: str) -> AsyncGenerator[dict, None]:
    """
    Full pipeline: RAG context → code generation → save to disk → sandbox
    execution with HTML report → optional healing graph on failure.
    Yields structured event dicts for WebSocket streaming.
    """
    # 1. Retrieve RAG context
    yield {"type": "status", "content": "Querying repository context from ChromaDB…"}
    context = _query_chromadb_context(user_prompt)

    # 2. Generate code
    yield {"type": "status", "content": "Generating test with Ollama (qwen2.5-coder:7b)…"}
    try:
        chain = CODE_GEN_PROMPT | code_gen_llm
        generated_code = chain.invoke({
            "context": context,
            "user_prompt": user_prompt,
            "target_url": target_url
        })
        
        # 2a. Intercept LLM Rejection
        if generated_code.strip().upper().startswith("REJECTED:"):
            yield {"type": "error", "content": f"❌ TEST REJECTED BY AI: {generated_code.strip()}"}
            return
            
        if "```" in generated_code:

            import re
            match = re.search(r"```(?:python)?(.*?)```", generated_code, re.DOTALL)
            if match:
                generated_code = match.group(1).strip()
            else:
                generated_code = generated_code.replace("```python", "").replace("```", "").strip()

    except Exception as e:
        yield {"type": "error", "content": f"Code generation failed: {e}"}
        return

    yield {"type": "code", "content": generated_code}

    # 3. Persist to generated_tests/<timestamp>/
    run_dir = _create_run_dir()
    test_file  = run_dir / "test_script.py"
    report_file = run_dir / "report.html"
    test_file.write_text(generated_code, encoding="utf-8")
    yield {"type": "status", "content": f"Test saved to {run_dir.name}/test_script.py"}

    # 4. Execute via pytest with HTML report
    yield {"type": "status", "content": "Executing test in sandbox via pytest…"}
    proc = subprocess.Popen(
        [
            sys.executable, "-m", "pytest", str(test_file),
            "-v", "--tb=short",
            f"--html={str(report_file)}",
            "--self-contained-html",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        cwd=str(run_dir),
    )

    raw_output_lines = []
    for line in proc.stdout:
        stripped = line.rstrip()
        raw_output_lines.append(stripped)
        yield {"type": "stdout", "content": stripped}
        await asyncio.sleep(0)

    exit_code = proc.wait()

    # Emit the report link regardless of pass/fail
    yield {
        "type": "report",
        "content": f"run_{run_dir.name}",
        "label": run_dir.name
    }

    if exit_code == 0:
        yield {"type": "done", "content": "✅ Test passed successfully. Report saved."}
        return

    # 5. ON FAILURE: Return the payload needed for main.py to start background healing.
    yield {
        "type": "heal_job_started",
        "run_id": run_dir.name,
        "content": f"⚠️ Test exited with code {exit_code}. Triggering global self-healing pipeline…",
        "initial_state": {
            "run_id": run_dir.name,
            "failure_data": {
                "error": "generated test failed",
                "locator": "unknown",
                "generated_code": generated_code,
                "exit_code": exit_code,
            },
            "browser_logs": "\n".join(raw_output_lines[-20:]),
            "diagnosis_category": "UNKNOWN",
            "diagnosis_confidence": 0.0,
            "proposed_locators": [],
            "verification_status": "pending",
            "error_history": [],
        }
    }
