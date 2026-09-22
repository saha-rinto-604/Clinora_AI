from app.prompts.doctor_support_common import (
    BASE_POLICY, COMPACT_BASE_POLICY, COMPACT_REASONING_POLICY, compact_user_payload, user_payload,
)

PROMPT_VERSION = "doctor_focused_evidence_question_v1"
SCHEMA_VERSION = "doctor-support-focused-question-v1"


def build_messages(request, chunks=(), inference=None):
    instruction = (
        "Answer only the narrow question about the supplied authorized evidence. Cite every Patient-specific point "
        "with E handles and cite supplied reference chunks for general clinical statements when used. Do not "
        "expand into diagnosis, treatment, dosage, a full plan, or unrelated general medical chat. "
        + COMPACT_REASONING_POLICY
    )
    if inference is not None:
        return [{"role": "system", "content": COMPACT_BASE_POLICY}, {"role": "user", "content": compact_user_payload(
            request, instruction, inference.model_evidence_pack.render(), chunks,
        )}]
    return [{"role": "system", "content": BASE_POLICY}, {"role": "user", "content": user_payload(
        request, instruction, chunks,
    )}]
