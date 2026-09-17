from app.prompts.doctor_support_common import BASE_POLICY, user_payload

PROMPT_VERSION = "doctor_find_gaps_v2"
SCHEMA_VERSION = "doctor-support-gaps-v2"


def build_messages(request, chunks=()):
    return [{"role": "system", "content": BASE_POLICY}, {"role": "user", "content": user_payload(
        request, "Identify information absent from this authorized snapshot, using the supplied clinical references to establish relevance. Do not imply an absent item exists elsewhere or issue imperative test orders.", chunks
    )}]
