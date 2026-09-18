from app.prompts.doctor_support_common import BASE_POLICY, user_payload

PROMPT_VERSION = "doctor_brief_patient_v1"
SCHEMA_VERSION = "doctor-support-brief-v1"


def build_messages(request, chunks=()):
    return [{"role": "system", "content": BASE_POLICY}, {"role": "user", "content": user_payload(
        request,
        "Prepare a concise encounter briefing. Use only the authorized appointment context and verified evidence. "
        "A single result is a current finding, two reliable dated results may support only a change statement, and "
        "persistence requires at least three reliable dated results. Never use upload time as clinical chronology. "
        "Do not diagnose or rank diseases. Set summary exactly to 'Authorized appointment context and verified "
        "evidence are available for review.' Copy appointmentReason exactly from the authorized appointment context. "
        "Do not use 'patient reports', 'history of', or add symptoms in chronology statements. RAG is disabled for this task.",
    )}]
