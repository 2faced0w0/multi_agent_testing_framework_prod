from .state import SafestState
from langchain_mistralai import ChatMistralAI
from langchain_core.prompts import PromptTemplate

mistral_llm = ChatMistralAI(model="mistral-large-latest")

def expert_fallback_agent(state: SafestState) -> SafestState:
    prompt = PromptTemplate.from_template("Deep diagnose complex failure: {failure_data}\nBrowser Logs: {browser_logs}")
    mistral_chain = prompt | mistral_llm
    try:
        response = mistral_chain.invoke({
            "failure_data": state.get("failure_data", {}),
            "browser_logs": state.get("browser_logs", "No logs provided.")
        }).content
        state["diagnosis_confidence"] = 0.95
        if "error_history" not in state:
            state["error_history"] = []
        state["error_history"].append(f"Expert diagnosis: {response}")
    except Exception as e:
        if "error_history" not in state:
            state["error_history"] = []
        state["error_history"].append(f"Expert failed: {e}")
    return state

def verifier_agent(state: SafestState) -> SafestState:
    # Verifier sub-process trigger (placeholder)
    state["verification_status"] = "success"
    return state

def escalate_to_human_node(state: SafestState) -> SafestState:
    # App bug detected, halt test repair iteration
    if "error_history" not in state:
        state["error_history"] = []
    state["error_history"].append("CRITICAL: Application bug detected. Escalating to human. Halting self-heal.")
    state["verification_status"] = "escalated"
    return state

synthesizer_prompt = PromptTemplate.from_template("""
You are an Expert SDET responsible for healing broken Playwright tests. You will receive the broken test code, the error trace, the actual DOM context at the time of failure, and a diagnosis category.

CRITICAL INSTRUCTIONS BASED ON DIAGNOSIS:
- If `diagnosis_category` is `STALE_LOCATOR`: Find the new element in the DOM and replace the broken CSS selector in the test code.
- If `diagnosis_category` is `ASSERTION_MISMATCH`: The application successfully transitioned to a new state, but the test is asserting the wrong thing. You have permission to completely REWRITE the failing assertion line. Look at the provided DOM Context, identify the new semantic indicator of success (e.g., an `<h1>` with "Order Confirmed", a new status badge, etc.), and write a modern Playwright assertion (e.g., `expect(page.locator("h1")).to_contain_text("Order Confirmed")`) to verify this new state. Remove the old `wait_for_selector` if it is no longer relevant.

Output ONLY valid, runnable Python code.

Diagnosis Category: {diagnosis_category}
Broken Test Code: {generated_code}
Error Trace: {error}
""")

def synthesizer_agent(state: SafestState) -> SafestState:
    chain = synthesizer_prompt | mistral_llm
    try:
        response = chain.invoke({
            "diagnosis_category": state.get("diagnosis_category", "UNKNOWN"),
            "generated_code": state.get("failure_data", {}).get("generated_code", ""),
            "error": state.get("failure_data", {}).get("error", ""),
        }).content
        if "error_history" not in state:
            state["error_history"] = []
        state["error_history"].append(f"Synthesized fixed code:\n{response[:100]}...")
        # update failure_data with new code
        state["failure_data"]["generated_code"] = response
    except Exception as e:
        if "error_history" not in state:
            state["error_history"] = []
        state["error_history"].append(f"Synthesizer failed: {e}")
    return state
