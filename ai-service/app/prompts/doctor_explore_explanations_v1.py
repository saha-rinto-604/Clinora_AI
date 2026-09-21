from app.prompts.doctor_support_common import (
    BASE_POLICY, COMPACT_BASE_POLICY, COMPACT_REASONING_POLICY, compact_user_payload, user_payload,
)

PROMPT_VERSION = "doctor_explore_explanations_v2"
SCHEMA_VERSION = "doctor-support-explore-v2"


def build_messages(request, chunks=(), inference=None):
    instruction = (
        "Provide at most four non-ranked possible explanations, each assigned to a concise clinical cluster. Separate "
        "potentially independent red-cell, thyroid, metabolic, or other patterns instead of forcing all abnormalities "
        "into one process. Each name and general clinical claim must be "
        "supported by supplied clinical references; put every reference handle used by an explanation in that "
        "explanation's refs array, and do not mention reference titles, publishers, or uncited reference text. "
        "Evidence fit and limits must cite supplied E handles. "
        "Use possibility language only. If the evidence cannot reasonably support an explanation, return zero explanations and state the limitation. Do not give probability, confidence, diagnosis, treatment, or dosage."
        if chunks else
        "Provide at most four non-ranked possible explanations using the authorized evidence and general medical "
        "knowledge. Keep refs empty because no approved reference chunks were supplied. Use possibility "
        "language only, state supporting evidence, limiting evidence and missing information, and do not give "
        "probability, confidence, diagnosis, treatment, or dosage. Assign each explanation to a concise clinical "
        "cluster and keep potentially independent findings separate. If the evidence cannot reasonably support an "
        "explanation, return zero explanations and state the limitation. Keep each explanation concise."
    )
    instruction += " " + COMPACT_REASONING_POLICY
    if inference is not None:
        return [{"role": "system", "content": COMPACT_BASE_POLICY}, {"role": "user", "content": compact_user_payload(
            request, instruction, inference.model_evidence_pack.render(), chunks,
        )}]
    return [{"role": "system", "content": BASE_POLICY}, {"role": "user", "content": user_payload(
        request, instruction, chunks,
    )}]
