from app.prompts.doctor_support_common import BASE_POLICY, user_payload

PROMPT_VERSION = "doctor_structure_notes_v1"
SCHEMA_VERSION = "doctor-support-structure-notes-v1"


def build_messages(request, chunks=()):
    return [{"role": "system", "content": BASE_POLICY}, {"role": "user", "content": user_payload(
        request,
        "Organize only the Doctor-authored notes into the allowed sections. Preserve uncertainty, medication names "
        "and doses exactly. Add no fact, symptom, diagnosis, assessment, plan, treatment, or dosage. Omit empty sections.",
    )}]
