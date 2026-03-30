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

def synthesizer_agent(state: SafestState) -> SafestState:
    if "error_history" not in state:
        state["error_history"] = []
    state["error_history"].append("Synthesizer generating new locators...")
    return state

