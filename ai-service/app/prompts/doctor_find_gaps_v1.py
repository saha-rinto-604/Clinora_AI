from app.prompts.doctor_support_common import BASE_POLICY, user_payload

PROMPT_VERSION = "doctor_find_gaps_v1"
SCHEMA_VERSION = "doctor-support-gaps-v1"

def build_messages(request):
    return [{"role": "system", "content": BASE_POLICY}, {"role": "user", "content": user_payload(
        request, "Identify information absent from this authorized snapshot. Do not imply an absent item exists elsewhere or recommend treatment."
    )}]
