from app.prompts.doctor_support_common import (
    BASE_POLICY, COMPACT_BASE_POLICY, COMPACT_REASONING_POLICY, compact_user_payload, user_payload,
)

PROMPT_VERSION = "doctor_find_gaps_v2"
SCHEMA_VERSION = "doctor-support-gaps-v2"


def build_messages(request, chunks=(), inference=None):
    instruction = (
        "Identify information absent from this authorized evidence pack, using supplied clinical references to establish "
        "relevance. Return at most two useful gaps. Do not imply an absent item exists elsewhere or issue imperative test orders."
        if chunks else
        "Identify at most two useful pieces of information absent from this authorized evidence pack that could help a Doctor "
        "distinguish possibilities. Use general medical knowledge conservatively, keep refs empty because no "
        "approved reference chunks were supplied, do not imply the information exists elsewhere, and do not issue imperative test orders."
    )
    instruction += " " + COMPACT_REASONING_POLICY
    if inference is not None:
        return [{"role": "system", "content": COMPACT_BASE_POLICY}, {"role": "user", "content": compact_user_payload(
            request, instruction, inference.model_evidence_pack.render(), chunks,
        )}]
    return [{"role": "system", "content": BASE_POLICY}, {"role": "user", "content": user_payload(
        request, instruction, chunks
    )}]
