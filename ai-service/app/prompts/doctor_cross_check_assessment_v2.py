from app.prompts.doctor_support_common import BASE_POLICY, user_payload

PROMPT_VERSION = "doctor_cross_check_assessment_v2"
SCHEMA_VERSION = "doctor-support-cross-check-v2"


def build_messages(request, chunks=()):
    return [{"role": "system", "content": BASE_POLICY}, {"role": "user", "content": user_payload(
        request, "Cross-check the Doctor-authored assessment against available evidence. Assess evidence consistency, not whether a diagnosis is correct. Cite supplied reference chunks for general criteria when used.", chunks
    )}]
