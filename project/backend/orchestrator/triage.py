from .state import SafestState
from langchain_ollama import OllamaLLM
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from typing import Literal
import json
import os

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
ollama_llm = OllamaLLM(model="qwen2.5-coder:7b", base_url=OLLAMA_HOST, format="json")

triage_prompt = PromptTemplate.from_template("""
You are an AI Diagnostician evaluating a failed Playwright test. Analyze the Error Trace, the DOM Context, and the Browser Logs. You must classify the root cause into one of the following strict categories:

1. **STALE_LOCATOR:** Use this if the test failed to find an element. 
   - CRITICAL RULE: If the error trace contains `TimeoutError` AND mentions `waiting for locator(...)`, this is almost ALWAYS a `STALE_LOCATOR`. It means the CSS selector is wrong or missing from the DOM. It does NOT mean the application is slow.
2. **APP_BUG:** Use this ONLY if the test failed AND the Browser Logs show a severe 4xx/5xx HTTP error or a critical JavaScript console exception indicating the UI itself crashed.
3. **TIMING_ISSUE:** Use this ONLY if the element IS present in the final DOM Context snapshot, but Playwright failed to interact with it in time.
4. **ASSERTION_MISMATCH:** Use this if a `TimeoutError` occurs on a verification or assertion step (e.g., `wait_for_selector`, `expect`, or looking for a success/failure message). 
   - Look at the DOM Context. If the DOM Context clearly shows that the application *did* reach the intended state (e.g., you see "Order Confirmed", "Thank You", or a dashboard UI), but the specific element the test was looking for is missing, classify this as an `ASSERTION_MISMATCH`. The UI is correct, but the test's assertion logic is outdated.
5. **UNKNOWN:** insufficient signal to decide.

You MUST output a valid JSON object matching this schema. Output your classification category exactly as written above, followed by a brief reasoning:
{{
    "category": "<STALE_LOCATOR|APP_BUG|TIMING_ISSUE|ASSERTION_MISMATCH|UNKNOWN>",
    "confidence": <0.0 to 1.0>,
    "reason": "<brief explanation here>"
}}

Input Data:
Failure Data: {failure_data}
Browser Logs: {browser_logs}

JSON Output:
""")

def triage_agent(state: SafestState) -> SafestState:
    chain = triage_prompt | ollama_llm | JsonOutputParser()
    try:
        response = chain.invoke({
            "failure_data": json.dumps(state.get("failure_data", {})),
            "browser_logs": state.get("browser_logs", "No logs provided.")
        })
        category = response.get("category", "UNKNOWN")
        confidence = float(response.get("confidence", 0.0))
        reason = response.get("reason", "No reason provided")
        
        # Ensure category is one of the allowed literals
        if category not in ["STALE_LOCATOR", "APP_BUG", "TIMING_ISSUE", "ASSERTION_MISMATCH", "UNKNOWN"]:
            category = "UNKNOWN"
            
        local_response = f"Triage [{category}] ({confidence}): {reason}"
    except Exception as e:
        local_response = f"Ollama triage failed formatting: {e}"
        category = "UNKNOWN"
        confidence = 0.0
        
    state["diagnosis_category"] = category
    state["diagnosis_confidence"] = confidence
    if "error_history" not in state:
        state["error_history"] = []
    state["error_history"].append(local_response)
    
    return state
