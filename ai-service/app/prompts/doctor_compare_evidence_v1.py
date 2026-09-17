from app.prompts.doctor_support_common import BASE_POLICY, user_payload

PROMPT_VERSION = "doctor_compare_evidence_v1"
SCHEMA_VERSION = "doctor-support-compare-v1"

def build_messages(request):
    return [{"role": "system", "content": BASE_POLICY}, {"role": "user", "content": user_payload(
        request, "Explain only supplied deterministic comparisonFacts. Never infer chronology from upload order or compare incompatible units."
    )}]
