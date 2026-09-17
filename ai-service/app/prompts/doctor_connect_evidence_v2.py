from app.prompts.doctor_support_common import BASE_POLICY, user_payload

PROMPT_VERSION = "doctor_connect_evidence_v2"
SCHEMA_VERSION = "doctor-support-connect-v2"


def build_messages(request, chunks=()):
    return [{"role": "system", "content": BASE_POLICY}, {"role": "user", "content": user_payload(
        request, "Connect related findings without inventing causality. Describe only relationships grounded in cited observations; cite supplied reference chunks for general clinical relationships when used.", chunks
    )}]
