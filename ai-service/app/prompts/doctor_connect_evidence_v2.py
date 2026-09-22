from app.prompts.doctor_support_common import (
    BASE_POLICY, COMPACT_BASE_POLICY, COMPACT_REASONING_POLICY, compact_user_payload, user_payload,
)

PROMPT_VERSION = "doctor_connect_evidence_v2"
SCHEMA_VERSION = "doctor-support-connect-v2"


def build_messages(request, chunks=(), inference=None):
    instruction = (
        "Connect findings without inventing causality. Return one short pattern; use two only if distinct. "
        "Each needs a phrase, one sentence, 2+ distinct supporting E handles, and a limit sentence. "
        "Cite available refs only. Return none if unsupported. Never restate facts in prose. "
        "Never write a diagnosis or use phrases such as 'diagnosis is', 'establishes a diagnosis', or 'patient has'. "
        "Describe only that the cited findings occur together as a pattern. "
        + COMPACT_REASONING_POLICY
    )
    if inference is not None:
        return [{"role": "system", "content": COMPACT_BASE_POLICY}, {"role": "user", "content": compact_user_payload(
            request, instruction, inference.model_evidence_pack.render(), chunks,
        )}]
    return [{"role": "system", "content": BASE_POLICY}, {"role": "user", "content": user_payload(
        request, instruction, chunks,
    )}]
