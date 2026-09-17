from app.prompts.doctor_support_common import BASE_POLICY, user_payload

PROMPT_VERSION = "doctor_cross_check_assessment_v1"
SCHEMA_VERSION = "doctor-support-cross-check-v1"

def build_messages(request):
    return [{"role": "system", "content": BASE_POLICY}, {"role": "user", "content": user_payload(
        request, "Cross-check the Doctor-authored assessment against available evidence. Assess evidence fit, not whether a diagnosis is correct."
    )}]
