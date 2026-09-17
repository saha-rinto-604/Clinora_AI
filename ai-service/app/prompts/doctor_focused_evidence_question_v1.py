from app.prompts.doctor_support_common import BASE_POLICY, user_payload

PROMPT_VERSION = "doctor_focused_evidence_question_v1"
SCHEMA_VERSION = "doctor-support-focused-question-v1"


def build_messages(request, chunks=()):
    return [{"role": "system", "content": BASE_POLICY}, {"role": "user", "content": user_payload(
        request,
        "Answer only the narrow question about the supplied authorized evidence. Cite every Patient-specific point "
        "with observation IDs and cite supplied reference chunks for general clinical statements when used. Do not "
        "expand into diagnosis, treatment, dosage, a full plan, or unrelated general medical chat.", chunks,
    )}]
