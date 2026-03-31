from langgraph.graph import StateGraph, START, END
from .state import SafestState
from .triage import triage_agent
from .agents import expert_fallback_agent, verifier_agent, escalate_to_human_node, synthesizer_agent

def route_triage(state: SafestState) -> str:
    category = state.get("diagnosis_category", "UNKNOWN")
    if category == "APP_BUG":
        return "escalate"
    elif category in ["STALE_LOCATOR", "ASSERTION_MISMATCH"]:
        return "synthesize" 
    else:
        # TIMING_ISSUE or UNKNOWN
        return "expert_fallback"

def build_graph():
    builder = StateGraph(SafestState)
    builder.add_node("TriageAgent", triage_agent)
    builder.add_node("ExpertFallbackAgent", expert_fallback_agent)
    builder.add_node("SynthesizerNode", synthesizer_agent)
    builder.add_node("VerifierAgent", verifier_agent)
    builder.add_node("EscalateToHuman", escalate_to_human_node)
    
    builder.add_edge(START, "TriageAgent")
    
    builder.add_conditional_edges(
        "TriageAgent", 
        route_triage, 
        {
            "escalate": "EscalateToHuman",
            "synthesize": "SynthesizerNode",
            "expert_fallback": "ExpertFallbackAgent"
        }
    )
    
    builder.add_edge("ExpertFallbackAgent", "VerifierAgent")
    builder.add_edge("SynthesizerNode", "VerifierAgent")
    builder.add_edge("VerifierAgent", END)
    builder.add_edge("EscalateToHuman", END)

    return builder.compile()

graph = build_graph()
