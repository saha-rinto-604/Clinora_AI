from app.prompts.doctor_support_common import BASE_POLICY, user_payload

PROMPT_VERSION = "doctor_explore_explanations_v1"
SCHEMA_VERSION = "doctor-support-explore-v1"


def build_messages(request, chunks=()):
    return [{"role": "system", "content": BASE_POLICY}, {"role": "user", "content": user_payload(
        request,
        "Provide at most three non-ranked possible explanations. Each name and general clinical claim must be "
        "supported by supplied clinical references; Patient fit and limits must cite supplied observation IDs. "
        "Use possibility language only. Do not give probability, confidence, diagnosis, treatment, or dosage.", chunks,
    )}]
