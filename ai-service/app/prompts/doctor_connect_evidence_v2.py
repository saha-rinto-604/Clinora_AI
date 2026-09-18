from app.prompts.doctor_support_common import BASE_POLICY, user_payload

PROMPT_VERSION = "doctor_connect_evidence_v2"
SCHEMA_VERSION = "doctor-support-connect-v2"


def build_messages(request, chunks=()):
    return [{"role": "system", "content": BASE_POLICY}, {"role": "user", "content": user_payload(
        request,
        "Connect related findings without inventing causality. Describe only relationships grounded in cited observations; "
        "cite supplied reference chunks for general clinical relationships when used. Before writing each relationship, "
        "copy every cited observation's authoritativeStatus exactly: LOW means low, HIGH means high, IN_RANGE means "
        "in range, POSITIVE means positive, and NEGATIVE means negative. Do not apply one finding's status to another "
        "finding or group observations with different statuses under a shared status. Describe the evidence as "
        "'the cited observations show' or 'the authorized findings include'. Never write 'the patient has', "
        "'the patient suffers from', or state a diagnosis. Set summary exactly to 'The authorized findings can be "
        "reviewed together.' Begin every relationship with 'The cited observations' and keep pattern titles as short "
        "noun phrases. Do not use the words patient or person in any generated prose field. Create a pattern only "
        "when it cites at least two distinct authorized observation IDs. Never repeat an observation ID within an "
        "evidence array; return fewer or zero patterns when two distinct observations cannot support a relationship.",
        chunks,
    )}]
