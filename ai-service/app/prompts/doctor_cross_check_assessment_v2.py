from app.prompts.doctor_support_common import (
    BASE_POLICY, COMPACT_BASE_POLICY, COMPACT_REASONING_POLICY, compact_user_payload, user_payload,
)

PROMPT_VERSION = "doctor_cross_check_assessment_v3"
SCHEMA_VERSION = "doctor-support-cross-check-v3"


def build_messages(request, chunks=(), inference=None):
    instruction = (
        "Cross-check the Doctor-authored assessment against available evidence. Assess evidence consistency, not "
        "whether a diagnosis is correct. Give a direct evidence-fit result and meaningful points separated into "
        "supports, contradicts, uncertain, or unrelated findings. If evidence is insufficient, name the important "
        "missing information instead of returning empty arrays. Do not call the Doctor correct or wrong and do not "
        "state a definitive diagnosis. Cite supplied reference chunks for general criteria when used. "
        + COMPACT_REASONING_POLICY
    )
    if inference is not None:
        return [{"role": "system", "content": COMPACT_BASE_POLICY}, {"role": "user", "content": compact_user_payload(
            request, instruction, inference.model_evidence_pack.render(), chunks, include_assessment=True,
        )}]
    return [{"role": "system", "content": BASE_POLICY}, {"role": "user", "content": user_payload(
        request, instruction, chunks
    )}]
