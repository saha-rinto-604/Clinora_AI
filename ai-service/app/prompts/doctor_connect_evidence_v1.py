from app.prompts.doctor_support_common import BASE_POLICY, user_payload

PROMPT_VERSION = "doctor_connect_evidence_v1"
SCHEMA_VERSION = "doctor-support-connect-v1"

def build_messages(request):
    return [{"role": "system", "content": BASE_POLICY}, {"role": "user", "content": user_payload(
        request, "Connect related findings without inventing causality. Describe only relationships grounded in cited observations."
    )}]
