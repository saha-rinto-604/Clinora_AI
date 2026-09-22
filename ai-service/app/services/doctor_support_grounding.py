from __future__ import annotations

import logging
import re
from collections.abc import Mapping

from app.knowledge.models import RetrievedChunk
from app.schemas.doctor_support_execution import EvidenceSnapshot, TaskResult


LOGGER = logging.getLogger(__name__)


class UnsafeDoctorSupportOutputError(RuntimeError):
    def __init__(
        self,
        reason_code: str,
        *,
        invalid_handle: str | None = None,
        invalid_type: str | None = None,
        invalid_field: str | None = None,
    ) -> None:
        super().__init__("Doctor support output did not pass grounding and safety validation.")
        self.reason_code = reason_code
        self.failure_stage = "grounding"
        # These values are emitted in operational logs. Keep them limited to
        # schema vocabulary and compact E# handles; never retain model prose or
        # authoritative UUIDs here.
        self.invalid_handle = invalid_handle if re.fullmatch(r"E\d+", invalid_handle or "") else None
        self.invalid_type = invalid_type or _diagnostic_type(reason_code)
        self.invalid_field = invalid_field


_TREATMENT = re.compile(r"\b(prescribe|start|stop|increase|decrease|take|administer)\b.{0,40}\b(mg|mcg|tablet|dose|medication|drug|therapy)\b", re.I)
_CERTAINTY = re.compile(r"\b(definitely|certainly|proves?|confirmed diagnosis|diagnostic of|\d{1,3}% (?:likely|probability|confidence|chance))\b", re.I)
_RANKING = re.compile(r"\b(most likely|least likely|top diagnosis|ranked? differential|best explanation)\b", re.I)
_INVENTED_HISTORY = re.compile(r"\b(patient (?:reports|denies|presents with)|history of|symptoms? (?:include|of))\b", re.I)
_DIRECT_PATIENT_HISTORY = re.compile(r"\bpatient (?:reports|denies|presents with)\b", re.I)
_CAUSAL_RELATION = re.compile(r"\b(caused by|is due to)\b", re.I)
_CAUSAL_PROOF = re.compile(r"\b(proves that|demonstrates that)\b", re.I)
_DOCTOR_VERDICT = re.compile(r"\b(?:the )?doctor(?:'s assessment)? is (?:correct|wrong)\b", re.I)
_DIRECTION_VALUE_JUDGMENT = re.compile(r"\b(improving|worsening|recovering|deteriorating|treatment (?:is )?working|treatment failure)\b", re.I)
_DEFINITIVE_DIAGNOSIS = re.compile(r"\b(patient suffers from|diagnosis is|establishes? (?:a |the )?diagnosis)\b", re.I)
_PATIENT_HAS = re.compile(r"\bpatient has\b", re.I)
_IMPERATIVE_ORDER = re.compile(r"\b(must order|required test|order (?:a |an |the )?)\b", re.I)
_INVENTED_LINK = re.compile(r"https?://|www\.", re.I)
_REFERENCE_ATTRIBUTION = re.compile(r"\b(guidelines?|references?|published sources?|literature) (?:indicate|suggest|recommend|state|show)", re.I)
_NON_ASSERTIVE_HISTORY = re.compile(
    r"\b(whether|unknown|uncertain|missing|unavailable|not (?:documented|available|reported|provided|known)|"
    r"would (?:help|clarify)|needs? (?:clarification|confirmation|review|verification)|"
    r"to (?:clarify|confirm|review|verify|assess))\b",
    re.I,
)
_NON_ASSERTIVE_HISTORY_FIELDS = frozenset({"missingInformation", "whyRelevant", "limitations"})


def _diagnostic_type(reason_code: str) -> str:
    if "HANDLE" in reason_code:
        return "evidence_handle"
    if "OBSERVATION" in reason_code or reason_code == "NORMAL_AS_ABNORMAL":
        return "authoritative_observation"
    if "REFERENCE" in reason_code or "CHUNK" in reason_code:
        return "clinical_reference"
    if reason_code == "INVENTED_HISTORY":
        return "unsupported_history_assertion"
    if reason_code in {"DEFINITIVE_CERTAINTY", "DEFINITIVE_DIAGNOSIS", "HYPOTHESIS_AS_FACT", "RANKED_DIAGNOSIS"}:
        return "unsupported_certainty"
    if reason_code in {"TREATMENT_OR_DOSE", "IMPERATIVE_TEST_ORDER"}:
        return "treatment_or_order"
    return "safety_rule"


def _non_assertive_history(value: str, field: str) -> bool:
    # The response contract defines missingInformation entries as information
    # absent from the authorized evidence. A noun phrase such as "history of
    # blood loss" is therefore a gap label, not an assertion about the Patient.
    if field == "missingInformation":
        return not bool(_DIRECT_PATIENT_HISTORY.search(value))
    return field in _NON_ASSERTIVE_HISTORY_FIELDS and bool(_NON_ASSERTIVE_HISTORY.search(value))


def _non_assertive_patient_has(value: str, field: str) -> bool:
    # Unlike a gap noun phrase, "patient has ..." remains an assertion unless
    # the model explicitly marks it as unknown/conditional.
    return field in _NON_ASSERTIVE_HISTORY_FIELDS and bool(_NON_ASSERTIVE_HISTORY.search(value))


def validate_grounding(
    result: TaskResult, evidence: EvidenceSnapshot, retrieved_chunks: tuple[RetrievedChunk, ...] = (),
    doctor_notes: str | None = None, appointment_context: dict | None = None,
    *, handle_payload: dict | None = None, handle_observations: Mapping[str, object] | None = None,
) -> None:
    dumped = result.model_dump(mode="json")
    policy_dump = dumped
    if dumped.get("taskId") == "BRIEF_PATIENT":
        # appointmentReason is an exact server-authorized pass-through field,
        # validated below. Do not mistake its source wording for a model claim.
        policy_dump = {**dumped, "appointmentReason": None}
    text = " ".join(_strings(policy_dump))
    if _TREATMENT.search(text):
        raise UnsafeDoctorSupportOutputError("TREATMENT_OR_DOSE")
    if _CERTAINTY.search(text):
        raise UnsafeDoctorSupportOutputError("DEFINITIVE_CERTAINTY")
    if _RANKING.search(text):
        raise UnsafeDoctorSupportOutputError("RANKED_DIAGNOSIS")
    for field, value in _text_fields(policy_dump):
        if _INVENTED_HISTORY.search(value) and not _non_assertive_history(value, field):
            LOGGER.info("doctor_grounding_rejection category=invented_history field=%s", field)
            raise UnsafeDoctorSupportOutputError("INVENTED_HISTORY", invalid_field=field)
    if _has_unhedged_causal_fact(text):
        raise UnsafeDoctorSupportOutputError("HYPOTHESIS_AS_FACT")
    if _DOCTOR_VERDICT.search(text):
        raise UnsafeDoctorSupportOutputError("DOCTOR_CORRECTNESS_VERDICT")
    explicit_diagnosis = _DEFINITIVE_DIAGNOSIS.search(text)
    unsupported_patient_has = _has_unsupported_patient_has_claim(policy_dump, evidence)
    if explicit_diagnosis or unsupported_patient_has:
        LOGGER.info(
            "doctor_grounding_rejection category=definitive_diagnosis syntax=%s",
            "explicit_diagnosis" if explicit_diagnosis else "unsupported_patient_has",
        )
        raise UnsafeDoctorSupportOutputError("DEFINITIVE_DIAGNOSIS")
    if dumped.get("taskId") == "COMPARE_EVIDENCE" and _DIRECTION_VALUE_JUDGMENT.search(text):
        raise UnsafeDoctorSupportOutputError("UNSUPPORTED_IMPROVEMENT_JUDGMENT")
    if dumped.get("taskId") == "FIND_GAPS" and _IMPERATIVE_ORDER.search(text):
        raise UnsafeDoctorSupportOutputError("IMPERATIVE_TEST_ORDER")
    if any(value.strip().endswith(("...", "…")) for value in _strings(dumped)):
        raise UnsafeDoctorSupportOutputError("TRUNCATED_TEXT")

    if _INVENTED_LINK.search(text):
        raise UnsafeDoctorSupportOutputError("INVENTED_REFERENCE_LINK")
    allowed_chunk_ids = {item.chunk.chunk_id for item in retrieved_chunks}
    cited_chunk_ids = list(_reference_chunk_ids(dumped))
    if any(len(items) != len(set(items)) for items in _reference_lists(dumped)):
        raise UnsafeDoctorSupportOutputError("DUPLICATE_REFERENCE_CHUNK_ID")
    if not set(cited_chunk_ids).issubset(allowed_chunk_ids):
        raise UnsafeDoctorSupportOutputError("UNKNOWN_REFERENCE_CHUNK_ID")
    if _REFERENCE_ATTRIBUTION.search(text) and not cited_chunk_ids:
        raise UnsafeDoctorSupportOutputError("UNCITED_REFERENCE_CLAIM")

    if retrieved_chunks:
        # Available approved references must support explanation/gap claims, not merely be retrieved.
        for item in dumped.get("explanations", []) + dumped.get("gaps", []):
            if not item.get("referenceChunkIds"):
                raise UnsafeDoctorSupportOutputError("UNCITED_REFERENCE_CLAIM")

    observations = {str(item.observationId): item for item in evidence.observations}
    refs = list(_evidence_references(dumped))
    for evidence_list in _evidence_lists(dumped):
        ids = [str(item.get("observationId")) for item in evidence_list]
        if len(ids) != len(set(ids)):
            raise UnsafeDoctorSupportOutputError("DUPLICATE_EVIDENCE_ID")
    for observation_id, label in refs:
        observation = observations.get(observation_id)
        if observation is None:
            raise UnsafeDoctorSupportOutputError("UNKNOWN_OBSERVATION_ID")
        if observation.label != label:
            raise UnsafeDoctorSupportOutputError("OBSERVATION_LABEL_MISMATCH")
        if dumped.get("taskId") == "CROSS_CHECK_ASSESSMENT":
            for point in dumped.get("points", []):
                if point.get("relation") == "SUPPORTS" and any(
                    str(ref.get("observationId")) == observation_id for ref in point.get("evidence", [])
                ) and observation.authoritativeStatus == "REPORTED":
                    raise UnsafeDoctorSupportOutputError("CONTEXT_ONLY_AS_SUPPORT")

    if handle_payload is not None:
        # Handle-based tasks are grounded from the internal item tree. Expanded
        # public references above still undergo exact UUID/label authorization checks.
        # No serialized-field order or label-neighbor window participates here.
        _validate_handle_claims(handle_payload, handle_observations or {}, evidence.observations)
    else:
        # Legacy non-handle tasks keep their established structured result grounding.
        for group_refs, claim_fields in _evidence_claim_groups(dumped):
            group_observations = []
            for observation_id, label in group_refs:
                observation = observations.get(observation_id)
                if observation is None:
                    raise UnsafeDoctorSupportOutputError("UNKNOWN_OBSERVATION_ID")
                if observation.label != label:
                    raise UnsafeDoctorSupportOutputError("OBSERVATION_LABEL_MISMATCH")
                group_observations.append(observation)
            _reject_unreferenced_observation_labels(claim_fields, group_observations, observations.values())
            for observation in group_observations:
                _validate_observation_claims(observation, group_observations, claim_fields)

    if dumped.get("taskId") == "COMPARE_EVIDENCE":
        facts = {item.canonicalCode: item for item in evidence.comparisonFacts}
        for comparison in dumped.get("comparisons", []):
            fact = facts.get(comparison.get("canonicalCode"))
            if fact is None:
                raise UnsafeDoctorSupportOutputError("UNKNOWN_COMPARISON")
            if fact.direction != comparison.get("direction"):
                raise UnsafeDoctorSupportOutputError("WRONG_COMPARISON_DIRECTION")
            ids = [item.get("observationId") for item in comparison.get("evidence", [])]
            if set(ids) != {str(fact.earlierObservationId), str(fact.laterObservationId)}:
                raise UnsafeDoctorSupportOutputError("WRONG_COMPARISON_EVIDENCE")

    if dumped.get("taskId") == "BRIEF_PATIENT":
        expected_reason = (appointment_context or {}).get("reason")
        if dumped.get("appointmentReason") != expected_reason:
            raise UnsafeDoctorSupportOutputError("APPOINTMENT_CONTEXT_MISMATCH")
        report_dates = {str(item.reportId): item.clinicalDate for item in evidence.reports if item.clinicalDate}
        observation_reports = {str(item.observationId): str(item.reportId) for item in evidence.observations}
        facts = {
            frozenset((str(item.earlierObservationId), str(item.laterObservationId))) for item in evidence.comparisonFacts
        }
        for chronology in dumped.get("chronology", []):
            ids = [str(item.get("observationId")) for item in chronology.get("evidence", [])]
            reports = {observation_reports.get(item) for item in ids}
            dated_reports = {item for item in reports if item in report_dates}
            if chronology.get("kind") == "CHANGE" and not any(fact.issubset(set(ids)) for fact in facts):
                raise UnsafeDoctorSupportOutputError("UNSUPPORTED_CHRONOLOGY")
            if chronology.get("kind") == "PERSISTENCE" and len(dated_reports) < 3:
                raise UnsafeDoctorSupportOutputError("UNSUPPORTED_PERSISTENCE")

    if dumped.get("taskId") == "STRUCTURE_NOTES":
        _validate_structured_notes(dumped, doctor_notes or "")


def _validate_structured_notes(dumped, doctor_notes):
    source = doctor_notes.lower()
    if not source.strip():
        raise UnsafeDoctorSupportOutputError("DOCTOR_NOTES_REQUIRED")
    source_tokens = set(re.findall(r"[a-z0-9]+", source))
    output_text = " ".join(
        item for section in dumped.get("sections", []) for item in section.get("items", [])
    ).lower()
    output_tokens = set(re.findall(r"[a-z0-9]+", output_text))
    allowed_structure = {
        "possible", "reported", "stated", "consider", "reason", "context", "symptoms", "history",
        "finding", "findings", "assessment", "plan", "other", "for", "the", "a", "an", "of", "and",
    }
    if "tired" in source or "tiredness" in source:
        allowed_structure.add("fatigue")
    novel = {token for token in output_tokens - source_tokens - allowed_structure if len(token) > 2}
    if novel:
        raise UnsafeDoctorSupportOutputError("NOTES_FACT_ADDED")
    source_numbers = set(re.findall(r"\b\d+(?:\.\d+)?\b", source))
    output_numbers = set(re.findall(r"\b\d+(?:\.\d+)?\b", output_text))
    if not output_numbers.issubset(source_numbers):
        raise UnsafeDoctorSupportOutputError("NOTES_DOSE_OR_VALUE_CHANGED")
    uncertain = bool(re.search(r"(?:^|\s)\?|\b(possible|possibly|consider|query|suspect)\b", source))
    assessment = " ".join(
        item for section in dumped.get("sections", []) if section.get("section") == "ASSESSMENT"
        for item in section.get("items", [])
    ).lower()
    if uncertain and assessment and not re.search(r"\b(possible|possibly|consider|query|suspect|uncertain)\b", assessment):
        raise UnsafeDoctorSupportOutputError("NOTES_UNCERTAINTY_INCREASED")


def _has_unhedged_causal_fact(text):
    if _CAUSAL_PROOF.search(text):
        return True
    for match in _CAUSAL_RELATION.finditer(text):
        prefix = text[max(0, match.start() - 56):match.start()]
        if re.search(r"\b(?:could|may|might|can|possibly)\b[^.;\n]{0,44}$", prefix, re.I):
            continue
        return True
    return False


def _has_unsupported_patient_has_claim(policy_dump, evidence):
    labels = tuple(item.label for item in evidence.observations)
    for field, value in _text_fields(policy_dump):
        for match in _PATIENT_HAS.finditer(value):
            if _non_assertive_patient_has(value, field):
                continue
            # A short clause such as "patient has low MCV" may restate an
            # authorized finding. Other "patient has" claims remain prohibited.
            clause = re.split(r"[.;\n]", value[match.end():match.end() + 160], maxsplit=1)[0]
            if not any(re.search(rf"\b{re.escape(label)}\b", clause, re.I) for label in labels):
                LOGGER.info(
                    "doctor_grounding_patient_has_features status_term=%s evidence_term=%s",
                    bool(re.search(r"\b(low|high|in[- ]?range|normal|positive|negative|elevated|reduced)\b", clause, re.I)),
                    bool(re.search(r"\b(finding|findings|observation|observations|result|results|value|values|index|indices|pattern)\b", clause, re.I)),
                )
                return True
    return False


_HANDLE_LIST_FIELDS = frozenset({"support", "limiting", "related", "evidence"})
_STATUS_PHRASES = (
    (r"not detected", "NEGATIVE"),
    (r"within (?:the )?(?:reported |reference |normal )?range", "IN_RANGE"),
    (r"in[- ]?range", "IN_RANGE"),
    (r"above (?:the )?(?:reported |reference |normal )?range", "HIGH"),
    (r"below (?:the )?(?:reported |reference |normal )?range", "LOW"),
    (r"elevated|high", "HIGH"),
    (r"reduced|low", "LOW"),
    (r"positive|detected|reactive", "POSITIVE"),
    (r"negative|absent", "NEGATIVE"),
    (r"abnormal", "ABNORMAL"),
    (r"normal(?!\s+(?:reference|range|interval|limits?))", "IN_RANGE"),
)


def _validate_handle_claims(payload, handle_observations, _all_observations):
    """Ground model prose by explicit structured item ownership.

    An item owns only the handles in that same object. Fact validation recognizes
    explicit subject/status or subject/value assertions; it never scans neighboring
    fields, flattened JSON, or N-character regions around an injected label.
    """
    all_handles = set(handle_observations)
    for handles, claim_fields in _handle_claim_groups(payload):
        if len(handles) != len(set(handles)):
            raise UnsafeDoctorSupportOutputError("DUPLICATE_EVIDENCE_ID")
        owned = []
        for handle in handles:
            observation = handle_observations.get(handle)
            if observation is None:
                code = "UNKNOWN_EVIDENCE_HANDLE" if re.fullmatch(r"E\d+", handle or "") else "UNAUTHORIZED_EVIDENCE_HANDLE"
                raise UnsafeDoctorSupportOutputError(code, invalid_handle=handle, invalid_field="evidence")
            owned.append((handle, observation))

        for field in claim_fields:
            mentioned = set(re.findall(r"\bE\d+\b", field))
            unknown = mentioned - all_handles
            if unknown:
                raise UnsafeDoctorSupportOutputError(
                    "UNKNOWN_EVIDENCE_HANDLE", invalid_handle=sorted(unknown)[0], invalid_field="claim"
                )
            if mentioned - set(handles):
                raise UnsafeDoctorSupportOutputError(
                    "UNREFERENCED_EVIDENCE_HANDLE",
                    invalid_handle=sorted(mentioned - set(handles))[0],
                    invalid_field="claim",
                )

        for handle, observation in owned:
            for field in claim_fields:
                _validate_explicit_handle_fact(observation, [handle], [handle], field)


def _handle_claim_groups(value):
    if isinstance(value, dict):
        present = [
            value.get(key) for key in _HANDLE_LIST_FIELDS
            if isinstance(value.get(key), list)
        ]
        handles = [handle for items in present for handle in items if isinstance(handle, str)]
        if present:
            ignored = _HANDLE_LIST_FIELDS | {"refs"}
            claims = []
            for key, item in value.items():
                if key in ignored:
                    continue
                if isinstance(item, str):
                    claims.append(item)
                elif isinstance(item, list) and all(isinstance(child, str) for child in item):
                    claims.extend(item)
            yield handles, tuple(claims)
        for key, item in value.items():
            if key not in _HANDLE_LIST_FIELDS:
                yield from _handle_claim_groups(item)
    elif isinstance(value, list):
        for item in value:
            yield from _handle_claim_groups(item)


def _validate_explicit_handle_fact(observation, status_aliases, value_aliases, field):
    claimed_statuses = set()
    for alias in status_aliases:
        subject = _subject_pattern(alias)
        for phrase, status in _STATUS_PHRASES:
            after = rf"{subject}\s*(?::|=|\bis\b|\bwas\b|\bremains?\b|\breported as\b|\bappears?\b|\bshows?\b|\bdemonstrates?\b)\s*(?:an?\s+)?(?:{phrase})\b"
            before = rf"\b(?:{phrase})\b\s+(?:value\s+|finding\s+)?{subject}"
            if re.search(after, field, re.I) or re.search(before, field, re.I):
                claimed_statuses.add(status)
    for claimed in claimed_statuses:
        if _status_conflicts(observation.authoritativeStatus, claimed):
            code = "NORMAL_AS_ABNORMAL" if observation.authoritativeStatus == "IN_RANGE" else "OBSERVATION_STATUS_CHANGED"
            LOGGER.info("doctor_grounding_rejection category=%s ownership=structured_handle", code.lower())
            raise UnsafeDoctorSupportOutputError(code)

    allowed_values = {
        float(value) for value in (observation.numericValue, observation.normalizedNumericValue)
        if value is not None
    }
    if not allowed_values:
        return
    unit_pattern = r"(?:mg/dl|mmol/l|g/dl|ng/dl|ng/ml|fl|pg|iu/l|miu/l|u/l|10\^\d+/l|%)"
    for alias in value_aliases:
        subject = _subject_pattern(alias)
        after = re.compile(
            rf"{subject}\s*(?::|=|\bis\b|\bwas\b|\breported as\b|\bvalue is\b|\bvalue was\b)\s*"
            rf"[<>=]?\s*(\d+(?:\.\d+)?)(?:\s*({unit_pattern}))?\b",
            re.I,
        )
        before = re.compile(
            rf"(?<![a-z0-9.])(\d+(?:\.\d+)?)(?:\s*({unit_pattern}))?\s+(?:value\s+)?{subject}",
            re.I,
        )
        for match in (*after.finditer(field), *before.finditer(field)):
            if not any(abs(float(match.group(1)) - allowed) < 1e-9 for allowed in allowed_values):
                raise UnsafeDoctorSupportOutputError("OBSERVATION_VALUE_CHANGED")
            mentioned_unit = match.group(2)
            known_units = {
                value.lower() for value in (observation.unit, observation.normalizedUnit) if value
            }
            if mentioned_unit and mentioned_unit.lower() not in known_units:
                raise UnsafeDoctorSupportOutputError("OBSERVATION_UNIT_CHANGED")


def _subject_pattern(value):
    escaped = re.escape(value)
    return rf"(?<![\w]){escaped}(?![\w])"


def _status_conflicts(authoritative, claimed):
    if claimed == "ABNORMAL":
        return authoritative in {"IN_RANGE", "NEGATIVE", "REPORTED"}
    if authoritative == "REPORTED":
        return True
    return authoritative != claimed


def _validate_observation_claims(observation, group_observations, claim_fields=()):
    label = re.escape(observation.label)
    matching_fields = tuple(
        field for field in claim_fields
        if _field_mentions_label(field, observation.label, group_observations)
    )
    if not matching_fields:
        return
    status_conflicts = {
        "LOW": r"\b(high|elevated|in[- ]?range|normal(?!\s+(?:range|reference|interval|limit))|positive)\b",
        "HIGH": r"\b(low|in[- ]?range|normal(?!\s+(?:range|reference|interval|limit))|negative)\b",
        "IN_RANGE": r"\b(high|low|elevated|reduced|abnormal|positive|negative)\b",
        "POSITIVE": r"\bnegative|not detected|absent\b",
        "NEGATIVE": r"\bpositive|detected|present|reactive\b",
    }
    related = [item for item in group_observations if item.label == observation.label]
    statuses = {item.authoritativeStatus for item in related}
    conflict = status_conflicts.get(observation.authoritativeStatus) if len(statuses) == 1 else None
    if conflict:
        # Associate a status with its label instead of scanning an entire prose
        # window. In multi-finding sentences, a later finding's status must not
        # be attributed to the earlier label (for example, "low MCV with normal RBC").
        before = rf"(?:{conflict})\s+(?:value\s+)?{label}\b"
        after = (
            rf"\b{label}\b\s+(?:(?:is|was|were|remains?|appears?|reported(?:\s+as)?|"
            rf"value\s+(?:is|was)|level\s+(?:is|was))\s+|"
            rf"demonstrates\s+(?:an?\s+)?)?(?:{conflict})"
        )
        before_match = next((re.search(before, field, re.I) for field in matching_fields if re.search(before, field, re.I)), None)
        after_match = next((re.search(after, field, re.I) for field in matching_fields if re.search(after, field, re.I)), None)
        if before_match or after_match:
            reason_code = (
                "NORMAL_AS_ABNORMAL"
                if observation.authoritativeStatus == "IN_RANGE"
                else "OBSERVATION_STATUS_CHANGED"
            )
            LOGGER.info(
                "doctor_grounding_rejection category=%s association=%s claim_field_match=%s",
                reason_code.lower(),
                "before_label" if before_match else "after_label",
                True,
            )
            raise UnsafeDoctorSupportOutputError(reason_code)
    allowed_numbers = {
        float(value)
        for item in related
        for value in (item.numericValue, item.referenceLow, item.referenceHigh, item.normalizedNumericValue)
        if value is not None
    }
    unit_pattern = r"(?:mg/dl|mmol/l|g/dl|ng/dl|ng/ml|fl|pg|iu/l|miu/l|10\^\d+/l|%)"
    value_after = re.compile(
        rf"\b{label}\b\s+(?:(?:is|was|were|remains?|reported(?:\s+as)?|value\s+(?:is|was)|"
        rf"level\s+(?:is|was))\s+)?(?:[<>=]\s*)?(\d+(?:\.\d+)?)(?:\s*({unit_pattern}))?",
        re.I,
    )
    value_before = re.compile(
        rf"(?<![a-z])(\d+(?:\.\d+)?)(?:\s*({unit_pattern}))?\s+(?:value\s+)?{label}\b",
        re.I,
    )
    for field in matching_fields:
        for match in (*value_after.finditer(field), *value_before.finditer(field)):
            number = match.group(1)
            if not any(abs(float(number) - allowed) < 1e-9 for allowed in allowed_numbers):
                raise UnsafeDoctorSupportOutputError("OBSERVATION_VALUE_CHANGED")
            mentioned_unit = match.group(2)
            known_units = {
                value.lower() for item in related for value in (item.unit, item.normalizedUnit) if value
            }
            if mentioned_unit and mentioned_unit.lower() not in known_units:
                raise UnsafeDoctorSupportOutputError("OBSERVATION_UNIT_CHANGED")


def _evidence_claim_groups(value):
    """Yield references and prose owned by the same structured result item."""
    if isinstance(value, dict):
        evidence_keys = {
            "evidence", "supportingEvidence", "limitingEvidence",
            "relatedEvidence", "evidenceHighlights",
        }
        direct_lists = [value.get(key) for key in evidence_keys if isinstance(value.get(key), list)]
        refs = [reference for items in direct_lists for reference in _evidence_references(items)]
        if refs:
            yield refs, tuple(_direct_claim_strings(value, evidence_keys))
        for key, item in value.items():
            if key not in evidence_keys:
                yield from _evidence_claim_groups(item)
    elif isinstance(value, list):
        for item in value:
            yield from _evidence_claim_groups(item)


def _direct_claim_strings(value, evidence_keys):
    ignored = {
        "taskId", "observationId", "reportId", "canonicalCode", "referenceChunkIds",
        "summaryReferenceChunkIds", "sourceId", "documentId", "chunkId", "appointmentReason",
        *evidence_keys,
    }
    for key, item in value.items():
        if key in ignored:
            continue
        if isinstance(item, str):
            yield item
        elif isinstance(item, list) and all(isinstance(child, str) for child in item):
            yield from item


def _field_mentions_label(field, label, group_observations):
    candidate = re.compile(rf"\b{re.escape(label)}\b", re.I)
    longer_labels = {
        item.label for item in group_observations
        if len(item.label) > len(label) and re.search(rf"\b{re.escape(label)}\b", item.label, re.I)
    }
    for match in candidate.finditer(field):
        if any(
            longer.start() <= match.start() and longer.end() >= match.end()
            for longer_label in longer_labels
            for longer in re.finditer(rf"\b{re.escape(longer_label)}\b", field, re.I)
        ):
            continue
        return True
    return False


def _reject_unreferenced_observation_labels(claim_fields, group_observations, all_observations):
    referenced_labels = {item.label for item in group_observations}
    all_labels = sorted({item.label for item in all_observations}, key=len, reverse=True)
    for field in claim_fields:
        for label in all_labels:
            if label in referenced_labels:
                continue
            if re.search(rf"\b{re.escape(label)}\b", field, re.I):
                LOGGER.info("doctor_grounding_rejection category=unreferenced_observation_claim")
                raise UnsafeDoctorSupportOutputError("OBSERVATION_LABEL_MISMATCH")


def _strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from _strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from _strings(item)


def _evidence_references(value):
    if isinstance(value, dict):
        if set(("observationId", "label")).issubset(value):
            yield str(value["observationId"]), value["label"]
        for item in value.values():
            yield from _evidence_references(item)
    elif isinstance(value, list):
        for item in value:
            yield from _evidence_references(item)


def _text_fields(value, field="root"):
    # Log schema field names only; never model-controlled text or keys.
    allowed = {"summary", "name", "whyItMayFit", "supportingEvidence", "limitingEvidence",
               "missingInformation", "limitations", "category", "whyRelevant", "answer",
               "relationship", "statement", "rationale", "title", "label", "items"}
    if isinstance(value, dict):
        for key, item in value.items():
            yield from _text_fields(item, key if key in allowed else "container")
    elif isinstance(value, list):
        for item in value:
            yield from _text_fields(item, field)
    elif isinstance(value, str):
        yield field, value


def _evidence_lists(value):
    if isinstance(value, dict):
        for key in ("evidence", "supportingEvidence", "limitingEvidence", "relatedEvidence", "evidenceHighlights"):
            evidence = value.get(key)
            if isinstance(evidence, list):
                yield evidence
        for item in value.values():
            yield from _evidence_lists(item)
    elif isinstance(value, list):
        for item in value:
            yield from _evidence_lists(item)


def _reference_chunk_ids(value):
    if isinstance(value, dict):
        for key, item in value.items():
            if key in {"referenceChunkIds", "summaryReferenceChunkIds"} and isinstance(item, list):
                for chunk_id in item:
                    yield str(chunk_id)
            else:
                yield from _reference_chunk_ids(item)
    elif isinstance(value, list):
        for item in value:
            yield from _reference_chunk_ids(item)


def _reference_lists(value):
    if isinstance(value, dict):
        for key, item in value.items():
            if key in {"referenceChunkIds", "summaryReferenceChunkIds"} and isinstance(item, list):
                yield [str(chunk_id) for chunk_id in item]
            else:
                yield from _reference_lists(item)
    elif isinstance(value, list):
        for item in value:
            yield from _reference_lists(item)
