from typing import TypedDict, List, Dict, Any
from langgraph.graph import StateGraph, START, END
from langchain_ollama import OllamaLLM
from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate

class SafestState(TypedDict):
    run_id: str
    failure_data: Dict[str, Any]
    diagnosis_confidence: float
    proposed_locators: List[Dict[str, Any]]
    verification_status: str
    error_history: List[str]

# Note: OLLAMA_HOST should be configured, defaulted to http://ollama:11434
ollama_llm = OllamaLLM(model="qwen2.5-coder:7b", base_url="http://ollama:11434")
openai_llm = ChatOpenAI(model="gpt-4o")

def triage_agent(state: SafestState) -> SafestState:
    prompt = PromptTemplate.from_template("Diagnose the failure: {failure_data}")
    chain = prompt | ollama_llm
    try:
        local_response = chain.invoke({"failure_data": state["failure_data"]})
        confidence = 0.9 if "simple" in local_response.lower() else 0.4
    except Exception as e:
        local_response = f"Ollama failed: {e}"
        confidence = 0.0

    state["diagnosis_confidence"] = confidence
    state["error_history"].append(local_response)
    # Increment prometheus counter logic would go here if synced, but it's simpler to do at the API boundary
    return state

def expert_fallback_agent(state: SafestState) -> SafestState:
    prompt = PromptTemplate.from_template("Deep diagnose complex failure: {failure_data}")
    openai_chain = prompt | openai_llm
    try:
        response = openai_chain.invoke({"failure_data": state["failure_data"]}).content
        state["diagnosis_confidence"] = 0.95
        state["error_history"].append(response)
    except Exception as e:
        state["error_history"].append(f"Expert failed: {e}")
    return state

def verifier_agent(state: SafestState) -> SafestState:
    # Verifier sub-process trigger (placeholder)
    state["verification_status"] = "success"
    return state

def route_triage(state: SafestState) -> str:
    if state["diagnosis_confidence"] > 0.7:
        return "verifier"
    return "expert_fallback"

def build_graph():
    builder = StateGraph(SafestState)
    builder.add_node("TriageAgent", triage_agent)
    builder.add_node("ExpertFallbackAgent", expert_fallback_agent)
    builder.add_node("VerifierAgent", verifier_agent)

    builder.add_edge(START, "TriageAgent")
    builder.add_conditional_edges("TriageAgent", route_triage, {"verifier": "VerifierAgent", "expert_fallback": "ExpertFallbackAgent"})
    builder.add_edge("ExpertFallbackAgent", "VerifierAgent")
    builder.add_edge("VerifierAgent", END)

    return builder.compile()

graph = build_graph()
