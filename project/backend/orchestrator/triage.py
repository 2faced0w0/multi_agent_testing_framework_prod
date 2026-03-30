from .state import SafestState
from langchain_ollama import OllamaLLM
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from typing import Literal
import json

ollama_llm = OllamaLLM(model="qwen2.5-coder:7b", base_url="http://ollama:11434", format="json")

triage_prompt = PromptTemplate.from_template("""
You are a test failure diagnostician. Analyze the error trace, DOM snapshot, and browser logs.
You MUST output a valid JSON object matching this schema:
{{
    "category": "<STALE_LOCATOR|APP_BUG|TIMING_ISSUE|UNKNOWN>",
    "confidence": <0.0 to 1.0>,
    "reason": "<brief explanation>"
}}

Guidelines for category:
- STALE_LOCATOR: selector not found, element not interactable, no DOM changes logged, missing ID/class.
- APP_BUG: JS console exceptions, HTTP 4xx/5xx in network logs, React error boundaries mentioned.
- TIMING_ISSUE: timeouts with no console errors, flaky assertions that might pass on retry.
- UNKNOWN: insufficient signal to decide.

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
        if category not in ["STALE_LOCATOR", "APP_BUG", "TIMING_ISSUE", "UNKNOWN"]:
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
