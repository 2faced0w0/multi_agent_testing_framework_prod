from typing import TypedDict, List, Dict, Any, Literal

class SafestState(TypedDict):
    run_id: str
    failure_data: Dict[str, Any]
    browser_logs: str  # NEW - captured JS exceptions & network errors
    diagnosis_category: Literal[  # NEW - classification output
        "STALE_LOCATOR", "APP_BUG", "TIMING_ISSUE", "ASSERTION_MISMATCH", "UNKNOWN"
    ]
    diagnosis_confidence: float
    proposed_locators: List[Dict[str, Any]]
    verification_status: str
    error_history: List[str]
