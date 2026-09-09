"""Ground model-created clinical clusters without synthesizing medical associations.

Only MedGemma creates groups, candidates and medical relationships. Clinora prunes
individual invalid references and factual clauses, then preserves the remaining
model interpretation. The compatibility projection never changes cluster ownership.
"""
from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from typing import Any

from app.clinical_evidence import evidence_class, is_strong_evidence, qualitative_class, support_level, support_eligibility, is_context_only, authoritative_states
from app.clinical_ranges import range_state
from app.schemas.report_analysis import ReportAnalysisRequest

_UUID = re.compile(r"\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b", re.I)
_NUMBER = re.compile(r"(?<![\w.])[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?!\w|\.\d)")
_INTERNAL = re.compile(r"\b(?:observationId|clinoraRangeStatus|clinoraEvidenceClass|supportEligibility|authoritativeStatus|VERIFIED_[A-Z_]+|CONTEXT_ONLY|POSSIBLE_CLINICAL_PATTERN|INSUFFICIENT_EVIDENCE|NO_CLEAR_ABNORMAL_PATTERN)\b")
_TITLE_REASON = re.compile(
    r"\b(?:report\s+(?:title|type|name|heading)|title\s+of\s+(?:the\s+)?report|"
    r"(?:report|profile)\s+is\s+(?:called|named|titled))\b", re.I,
)
_PATIENT_ASSERTION = re.compile(
    r"\b(?:you|(?:the |this )?patient)(?:'s)?\s+(?:have|has|had|reports?|reported|denies?|"
    r"presents?\s+with|experiences?|experienced|takes?|is\s+taking|was\s+taking|"
    r"is\s+(?:a\s+)?\d+|is\s+(?:pregnant|male|female))\b|"
    r"\b(?:your|(?:the |this )?patient's)\s+(?:symptoms?|history|medications?|fever|fatigue|pain)\b|"
    r"\b(?:reported|ongoing|recent)\s+(?:fever|fatigue|weight\s+loss|symptoms?|medication\s+use)\b",
    re.I,
)
_CONTEXT_ASSERTION = re.compile(r"\b(?:history\s+of|presents?\s+with|experiencing|taking\s+medication)\b", re.I)
_CONDITIONAL = re.compile(r"\b(?:if|whether|ask|missing|needed|unknown|assess|review|clarify|could|may|might|possible|consider)\b", re.I)
_CONTEXT_QUESTION = re.compile(r"\b(?:if|whether|ask|missing|needed|unknown|assess|review|clarify)\b", re.I)
_UNSAFE = re.compile(
    r"\b(?:the\s+diagnosis\s+is|diagnosed\s+with|confirmed\s+diagnosis|this\s+proves|"
    r"you\s+(?:definitely|certainly)\s+have|start\s+taking|stop\s+taking|change\s+your\s+dose|"
    r"i\s+prescribe|take\s+\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml))\b|"
    r"\b(?:probability|confidence|likelihood)\D{0,8}\d+(?:\.\d+)?\s*%|"
    r"\d+(?:\.\d+)?\s*%\s*(?:chance|probability|confidence|likelihood)", re.I,
)
_UNFINISHED = re.compile(r"\b(?:and|or|but|which|that|because|can|could|may|might|to|with|including|of|for)\s*[,;:.!?-]?\s*$", re.I)
_NEGATIVE_WORD = re.compile(r"\b(?:negative|non[- ]?reactive|not\s+detected|absent)\b", re.I)
_POSITIVE_WORD = re.compile(r"\b(?:positive|reactive|detected|present)\b", re.I)
_QUALITATIVE_BRIDGE = r"(?:\s+(?:is|was|are|were|reported|result|test|assay|as|has|been|remains)){0,5}\s*"


def _text(value: object, limit: int = 2400) -> str:
    return re.sub(r"\s+", " ", value).strip()[:limit] if isinstance(value, str) else ""


def _normal(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def sanitize_reasoning(
    request: ReportAnalysisRequest, text: object, observation_id: str | None = None,
    *, missing_context: bool = False,
) -> str:
    """Remove false clauses, retaining accurate analyte direction and clinical prose.

    Reuse R4's tested association parser, which prevents a neighboring analyte's
    direction bleeding into another. Import at call time because the orchestration
    service imports this module for v5 grounding.
    """
    from app.services.report_analysis_service import (
        _alias_regex, _direction_claims, _direction_claims_for_observation,
        _observation_aliases, _observation_mentions,
    )

    value = re.sub(r"\b(?:strong possibility|highly likely|very likely|most likely)\b", "possible", _text(text), flags=re.I)
    if _normal(value) in {"context", "supports", "support", "contradicts", "unknown", "not applicable"}:
        return ""
    observations = tuple(request.observations)
    by_id = {str(item.observationId): item for item in observations}
    bound_observation = by_id.get(observation_id or "")
    clauses = re.split(r"(?<=[.!?])\s+|[;\r\n]+", value)
    kept: list[str] = []
    for clause in clauses:
        clause = clause.strip()
        if not clause or _UUID.search(clause) or _INTERNAL.search(clause) or _UNFINISHED.search(clause):
            continue
        if clause.endswith((",", ":", ";")):
            continue
        if missing_context and re.search(r"\b(?:this|these|their|its)\s*[.,;:]?$", clause, re.I):
            continue
        if _TITLE_REASON.search(clause) or _UNSAFE.search(clause):
            continue
        if _PATIENT_ASSERTION.search(clause) and not _CONTEXT_QUESTION.search(clause):
            # A patient can have a verified test finding. This exception cannot
            # assert symptoms/history just because a laboratory label also occurs.
            verified_assertion = any(re.search(
                rf"\b(?:patient|you)\s+(?:has|have)\s+(?:evidence\s+of\s+)?(?:an?\s+)?(?:verified\s+)?"
                rf"(?:(?:positive|negative|low|high|elevated|reduced)\s+)?{_alias_regex(alias)}",
                clause, re.I,
            ) for item in observations for alias in _observation_aliases(item))
            if not verified_assertion:
                continue
        if not missing_context and _CONTEXT_ASSERTION.search(clause) and not _CONTEXT_QUESTION.search(clause):
            continue

        mentioned_ids = _mentions(request, clause)
        mentioned = [item for item in observations if str(item.observationId) in mentioned_ids]
        if bound_observation is not None and mentioned_ids and observation_id not in mentioned_ids:
            if not re.search(r"\b(?:this|it|the result|the measurement|the finding)\b", clause, re.I):
                continue
        targets = mentioned or ([bound_observation] if bound_observation is not None else [])
        coordinated_claims = _coordinated_direction_claims(request, clause)
        mismatch = False
        for observation in targets:
            claims = _direction_claims_for_observation(
                clause, observation, observations, allow_ambiguous_aliases=True,
            )
            claims |= coordinated_claims.get(str(observation.observationId), set())
            if not mentioned and bound_observation is observation:
                claims |= _direction_claims(clause)
            expected = range_state(observation)
            if claims and (expected == "UNKNOWN" or any(claim != expected for claim in claims)):
                mismatch = True
                break
            if expected != "UNKNOWN" or qualitative_class(observation):
                if any(re.search(
                    rf"{_alias_regex(alias)}\s+(?:(?:range|status|classification|interpretation)\s+)?"
                    r"(?:is|are|remains?)\s+(?:unknown|unclassified|unavailable)\b", clause, re.I,
                ) for alias in _observation_aliases(observation)):
                    mismatch = True
                    break

            # Associate qualitative claims with a specific label. Negative phrases
            # are consumed before looking for positive substrings ("not detected").
            normalized = _normal(clause)
            qualitative_parts = []
            for alias in _observation_aliases(observation):
                name = _alias_regex(alias)
                term = r"(?:negative|non\s*reactive|not\s+detected|absent|positive|reactive|detected|present)"
                for pattern in (rf"{name}{_QUALITATIVE_BRIDGE}({term})\b", rf"\b({term})\s+{name}"):
                    qualitative_parts.extend(match.group(1) for match in re.finditer(pattern, normalized, re.I))
            if not mentioned and bound_observation is observation:
                qualitative_parts.extend(match.group(0) for match in _NEGATIVE_WORD.finditer(clause))
                without_negative = _NEGATIVE_WORD.sub("", clause)
                qualitative_parts.extend(match.group(0) for match in _POSITIVE_WORD.finditer(without_negative))
            category = qualitative_class(observation)
            for phrase in qualitative_parts:
                is_negative = bool(_NEGATIVE_WORD.search(phrase))
                required = "QUALITATIVE_NEGATIVE" if is_negative else "QUALITATIVE_POSITIVE"
                if category != required:
                    mismatch = True
                    break
            if mismatch:
                break

        # A named-but-unsupplied assay assertion cannot become a laboratory fact.
        if not targets and _direction_claims(clause) and not _CONDITIONAL.search(clause):
            mismatch = True

        # Exact numbers, if the model supplies any despite the prompt, must match
        # the referenced observation. Digits embedded in real labels (e.g. T4) are
        # not numeric assertions. Multiple-test numeric prose is ambiguous, so its
        # factual sentence is omitted while independent clinical sentences remain.
        numeric_clause = clause
        for item in observations:
            numeric_clause = re.sub(re.escape(item.label), "", numeric_clause, flags=re.I)
        numbers = _NUMBER.findall(numeric_clause)
        if numbers:
            if len(targets) != 1:
                mismatch = True
            else:
                item = targets[0]
                allowed_values = [item.numericValue]
                if re.search(r"\b(?:reference|range|interval|limit)\b", clause, re.I):
                    allowed_values.extend([item.referenceLow, item.referenceHigh])
                allowed = {number for number in allowed_values if number is not None}
                try:
                    if any(Decimal(number) not in allowed for number in numbers):
                        mismatch = True
                except InvalidOperation:
                    mismatch = True
                # Numeric prose must not attach a different laboratory unit to
                # an otherwise correct number. Exact facts remain on verified cards.
                numeric_units = re.findall(
                    r"(?<!\w)(?:[+-]?\d+(?:\.\d+)?|\.\d+)\s*"
                    r"((?:[A-Za-z\u00b5\u03bc]+/(?:dL|mL|L)|mIU|IU|U|fL|pg|%))(?=$|[\s),.;])",
                    numeric_clause,
                )
                if any(unit != (item.unit or "") for unit in numeric_units):
                    mismatch = True
        # Even a status-free conclusion cannot use an unclassified measurement
        # as its premise. Keep explicit missing-classification context only.
        if any(is_context_only(item) for item in targets) and not _context_limitation(clause):
            if not (missing_context and not _direction_claims(clause)):
                mismatch = True
        if mismatch:
            continue
        clause = re.sub(r"\bIN_RANGE\b", "within the supplied reference range", clause)
        clause = re.sub(r"\bUNCLASSIFIED\b|\bUNKNOWN\b", "unclassified", clause)
        kept.append(clause)
    return " ".join(kept)[:2400]



def _context_limitation(text: str) -> bool:
    """Recognize unavailable-classification context, not conditional diagnoses."""
    return bool(re.search(
        r"\b(?:reference|range|classification|classified|classify|interpretation|status)\b.{0,70}"
        r"\b(?:unavailable|unknown|missing|unclassified|cannot|not available|not supplied|needed|incomplete)\b|"
        r"\b(?:cannot|unable to|not enough|insufficient|without|missing|unavailable|no usable)\b.{0,70}"
        r"\b(?:classify|characterize|classification|reference|range|status)\b", text, re.I,
    ))


def _coordinated_direction_claims(request: ReportAnalysisRequest, text: str) -> dict[str, set[str]]:
    """Bind a shared adjective to an explicit list of supplied test labels.

    Stop at any unrecognized text or a new direction: 'high A and low B' must
    never propagate HIGH to B. No clinical associations or ranges are inferred.
    """
    from app.services.report_analysis_service import _observation_aliases, _alias_regex, _NEGATED_DIRECTION_PATTERN
    aliases = sorted(((alias, str(o.observationId)) for o in request.observations
                      for alias in _observation_aliases(o)), key=lambda item: len(item[0]), reverse=True)
    text = _NEGATED_DIRECTION_PATTERN.sub(" ", text.lower())
    result: dict[str, set[str]] = {}
    for lead in re.finditer(r"\b(high|elevated|raised|increased|low|reduced|decreased|normal)\s+"
                            r"(?:(?:levels?|counts?|values?|concentrations?)\s+of\s+)?", text):
        state = "IN_RANGE" if lead[1] == "normal" else "LOW" if lead[1] in {"low", "reduced", "decreased"} else "HIGH"
        position = lead.end()
        while True:
            matched = next(((re.match(_alias_regex(alias), text[position:]), key)
                            for alias, key in aliases if re.match(_alias_regex(alias), text[position:])), None)
            if matched is None:
                break
            match, key = matched
            result.setdefault(key, set()).add(state)
            position += match.end()
            separator = re.match(r"\s*(?:,\s*(?:and\s+)?|and\s+|&\s*)", text[position:])
            if separator is None:
                break
            position += separator.end()
    return result


def _mentions(request: ReportAnalysisRequest, text: str) -> set[str]:
    from app.services.report_analysis_service import _observation_mentions
    found = {str(key) for key in _observation_mentions(text, tuple(request.observations))}
    # Recognize a supplied all-capital abbreviation when the prose spells its
    # initials out. No disease dictionary or reference-range knowledge is used.
    words = re.findall(r"[a-z]+", text.lower())
    for observation in request.observations:
        label = observation.label.strip()
        if re.fullmatch(r"[A-Z]{2,5}", label):
            size = len(label)
            if any("".join(word[0] for word in words[i:i+size]) == label.lower()
                   for i in range(max(0, len(words)-size+1))):
                found.add(str(observation.observationId))
    return found


def _without_hypotheses(text: str, names: set[str]) -> str:
    """Close hypothesis channels using this output's names, never a disease list."""
    # Hypothesis discourse belongs to candidate objects even when the model
    # forgot to supply a candidate name. This checks sentence function, not a
    # catalogue of diseases. Factual/physiological descriptions remain welcome.
    hypothesis_cue = re.compile(r"\b(?:may indicate|could indicate|consistent with|compatible with|"
        r"(?:strong )?possibility|highly likely|very likely|most likely|potentially|possibly|such as|like|may suggest|suggests|suggestive)\b", re.I)
    aliases: set[str] = set()
    for name in names:
        aliases.add(re.sub(r"^(?:possible|potential)\s+", "", name, flags=re.I))
        aliases.update(re.findall(r"\(([^()]+)\)", name))
        aliases.add(re.sub(r"\s*\([^()]+\)", "", name))
        aliases.update(part.strip() for part in re.split(r"\s+(?:/|or)\s+", name, flags=re.I))
    return " ".join(part for part in re.split(r"(?<=[.!?;])\s+|[\r\n]+", text)
        if not hypothesis_cue.search(part) and not any(
            re.search(rf"(?<!\w){re.escape(name.strip())}s?(?!\w)", part, re.I)
            for name in aliases if name.strip()
        ))


def _safe_list(request: ReportAnalysisRequest, value: object, *, missing: bool = False, limit: int = 8) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for raw in value:
        text = sanitize_reasoning(request, _text(raw, 400), missing_context=missing)
        if text and text not in result:
            result.append(text)
        if len(result) >= limit:
            break
    return result


def _fact_relevance(observation: object) -> str:
    state = range_state(observation)
    if state == "LOW":
        return "This verified result is below the supplied reference range."
    if state == "HIGH":
        return "This verified result is above the supplied reference range."
    if state == "IN_RANGE":
        return "This verified result is within the supplied reference range and provides context."
    category = evidence_class(observation)
    if category == "QUALITATIVE_POSITIVE":
        return "The supplied report explicitly records a positive qualitative result."
    if category == "QUALITATIVE_NEGATIVE":
        return "The supplied report explicitly records a negative qualitative result."
    return "This verified finding provides context; its range interpretation is unclassified."


def ground_cluster_output(
    request: ReportAnalysisRequest, parsed: dict[str, Any],
) -> tuple[dict[str, object], dict[str, int | str]]:
    by_id = {str(item.observationId): item for item in request.observations}
    raw_clusters = parsed.get("clusters", parsed.get("clinicalClusters", []))
    raw_clusters = raw_clusters if isinstance(raw_clusters, list) else []
    raw_candidates = sum(len(item.get("candidates", [])) for item in raw_clusters if isinstance(item, dict) and isinstance(item.get("candidates", []), list))
    clusters: list[dict[str, Any]] = []
    seen_candidates: set[str] = set()
    discarded = 0
    reclassified = 0
    pruned_claims = 0
    neutralized = 0
    unknown_pruned = 0
    context_recovered = 0
    fallback_groups: dict[frozenset[str], dict[str, Any]] = {}
    all_names = {
        _text(item.get("name"), 180) for group in raw_clusters if isinstance(group, dict)
        for item in (group.get("candidates") or []) if isinstance(item, dict)
    } - {""}
    all_names = {name for name in all_names if _normal(name) not in {_normal(o.label) for o in request.observations}}

    def noncandidate(value: str, names: set[str] = all_names) -> str:
        nonlocal neutralized
        result = _without_hypotheses(value, names)
        if value != result:
            neutralized += 1
        return result


    def safe(value: object, bound: str | None = None, limit: int = 2400) -> str:
        nonlocal pruned_claims
        source = _text(value, limit)
        result = sanitize_reasoning(request, source, bound)
        if source and result != source:
            pruned_claims += 1
        return result

    for raw_cluster in raw_clusters[:12]:
        if len(clusters) >= 3:
            break
        if not isinstance(raw_cluster, dict):
            continue
        evidence: dict[str, dict[str, str]] = {}
        raw_evidence = raw_cluster.get("evidence", [])
        for item in raw_evidence[:40] if isinstance(raw_evidence, list) else []:
            if not isinstance(item, dict):
                discarded += 1
                continue
            observation_id = str(item.get("observationId", "")).strip()
            observation = by_id.get(observation_id)
            role = str(item.get("role", "")).upper()
            if observation is None or role not in {"SUPPORTS", "CONTRADICTS", "CONTEXT"}:
                discarded += 1
                continue
            if item.get("observationLabel") is not None and item["observationLabel"] != observation.label:
                discarded += 1
                continue
            if item.get("authoritativeStatus") is not None and item["authoritativeStatus"] not in authoritative_states(observation):
                discarded += 1
                continue
            if observation_id in evidence:
                continue
            if role == "CONTRADICTS" and is_context_only(observation):
                role = "CONTEXT"
            if role == "SUPPORTS" and not is_strong_evidence(observation):
                role = "CONTEXT"
                reclassified += 1
                discarded += 1
                unknown_pruned += int(is_context_only(observation))
            relevance = safe(item.get("clinicalRelevance"), observation_id)
            evidence[observation_id] = {
                "observationId": observation_id, "role": role,
                "clinicalRelevance": noncandidate(relevance) or _fact_relevance(observation),
                "supportEligibility": support_eligibility(observation),
            }
            if len(evidence) >= 20:
                break

        # Recover contextual references that the model explicitly made by test
        # label but omitted from its evidence array. Identity is resolved solely
        # against this verified case. These entries can NEVER become support.
        narrative = " ".join(_text(raw_cluster.get(field)) for field in ("interpretation",))
        for raw_item in raw_cluster.get("candidates", []) if isinstance(raw_cluster.get("candidates"), list) else []:
            if isinstance(raw_item, dict):
                narrative += " " + _text(raw_item.get("rationale"))
        for key in sorted(_mentions(request, narrative)):
            if key not in evidence and is_context_only(by_id[key]) and len(evidence) < 20:
                evidence[key] = {"observationId": key, "role": "CONTEXT",
                    "clinicalRelevance": _fact_relevance(by_id[key]),
                    "supportEligibility": support_eligibility(by_id[key])}
                context_recovered += 1

        # A cluster needs meaningful verified evidence. Normal/unknown references
        # cannot justify an abnormal interpretation merely because a title suggests it.
        has_support = any(item["role"] == "SUPPORTS" for item in evidence.values())
        has_unknown = any(is_context_only(by_id[key]) for key in evidence)
        if not evidence or not (has_support or has_unknown):
            continue

        def claims(value: object, *, candidate_support: list[str] | None = None) -> str:
            nonlocal pruned_claims
            retained: list[str] = []
            for claim in value[:8] if isinstance(value, list) else []:
                if not isinstance(claim, dict):
                    pruned_claims += 1
                    continue
                premises = claim.get("premises", [])
                kind = claim.get("kind")
                ids = {str(p.get("observationId")) for p in premises if isinstance(p, dict)}
                valid = bool(ids) and ids <= evidence.keys() and kind in {"RELATIONSHIP", "LIMITATION"}
                valid = valid and all(isinstance(p, dict) and str(p.get("observationId")) in evidence
                    and p.get("status") in authoritative_states(by_id[str(p["observationId"])]) for p in premises)
                if kind == "RELATIONSHIP":
                    valid = valid and all(not is_context_only(by_id[key]) for key in ids if key in by_id)
                    valid = valid and all(p.get("status") != "UNKNOWN" for p in premises if isinstance(p, dict))
                if candidate_support is not None:
                    valid = valid and kind == "RELATIONSHIP" and bool(ids & set(candidate_support))
                # Each structured claim is one complete conclusion. A grammar
                # length cap can terminate a word while leaving valid outer JSON.
                complete = _text(claim.get("text")).endswith((".", "!", "?"))
                text = safe(claim.get("text")) if valid and complete else ""
                # A declared premise list cannot conceal a named undeclared finding.
                if _mentions(request, text) - ids:
                    text = ""
                if kind == "LIMITATION" and not _context_limitation(text):
                    text = ""
                if not text:
                    pruned_claims += 1
                    continue
                retained.append(text)
            return " ".join(retained)[:2400]

        def clean_ids(value: object, *, supporting: bool) -> list[str]:
            nonlocal discarded
            ids: list[str] = []
            for raw_id in value[:40] if isinstance(value, list) else []:
                key = str(raw_id).strip()
                if key not in evidence:
                    discarded += 1
                    continue
                if supporting and (evidence[key]["role"] != "SUPPORTS" or not is_strong_evidence(by_id[key])):
                    discarded += 1
                    continue
                if key not in ids:
                    ids.append(key)
                if len(ids) >= 20:
                    break
            return ids

        candidates: list[dict[str, Any]] = []
        raw_candidate_items = raw_cluster.get("candidates", [])
        for item in raw_candidate_items[:10] if isinstance(raw_candidate_items, list) else []:
            if len(candidates) >= 2:
                break
            if not isinstance(item, dict):
                continue
            name = safe(item.get("name"), limit=180)
            supporting = clean_ids(item.get("supportingObservationIds"), supporting=True)
            if "rationaleClaims" in item:
                rationale = claims(item["rationaleClaims"], candidate_support=supporting)
            else:
                rationale = safe(item.get("rationale", item.get("reasoning")))
                rationale = " ".join(part for part in re.split(r"(?<=[.!?])\s+", rationale)
                    if not (_mentions(request, part) - evidence.keys()))
                # Older free prose must stand on its remaining premises after a
                # context-only item was removed. An unrelated valid ID is not a
                # license for a conclusion derived from an unknown measurement.
                removed_context = any(str(key) in by_id and is_context_only(by_id[str(key)])
                    for key in item.get("supportingObservationIds", []))
                removed_context = removed_context or any(is_context_only(by_id[key])
                    for key in _mentions(request, _text(item.get("rationale", item.get("reasoning")))))
                if removed_context:
                    rationale = " ".join(part for part in re.split(r"(?<=[.!?])\s+", rationale)
                        if _mentions(request, part) & set(supporting)
                        and not any(is_context_only(by_id[key]) for key in _mentions(request, part)))
            contradictory = [key for key in clean_ids(item.get("contradictoryObservationIds"), supporting=False)
                             if key not in supporting and not is_context_only(by_id[key])]
            level = support_level(by_id[key] for key in supporting)
            missing = _safe_list(request, item.get("missingEvidence"), missing=True, limit=12)
            alternatives = _safe_list(request, item.get("alternatives", item.get("possibleCauses")))
            # Follow an explicit model withdrawal, not a deterministic medical
            # judgment. Acknowledging contrary evidence alone is not withdrawal.
            withdrawn = bool(name and re.search(
                rf"\b(?:not|rather than|rules? out)\s+{re.escape(name)}\b|"
                r"\bcontradicts?\s+this\b[^.!?]*\binstead\b", rationale, re.I))
            combined_hypotheses = bool(re.search(r"\s+(?:/|or)\s+", name, re.I))
            test_label_as_candidate = _normal(name) in {_normal(o.label) for o in request.observations}
            if (not missing or not alternatives or not name or not rationale or level is None or _normal(name) in seen_candidates
                or withdrawn or combined_hypotheses or test_label_as_candidate
                or any(_normal(other["name"]) == _normal(name) for other in candidates)):
                continue
            candidates.append({
                "name": name, "rationale": rationale, "supportLevel": level,
                "supportingObservationIds": supporting,
                "contradictoryObservationIds": contradictory,
                "missingEvidence": missing, "alternatives": alternatives,
            })

        # Titles are organizational facts. Keep a legacy title too, so old
        # consumers cannot accidentally redisplay an unvalidated model diagnosis.
        labels = [by_id[key].label for key in evidence][:3]
        title = (" + ".join(labels)[:155] + " pattern")[:180]
        if title != _text(raw_cluster.get("title"), 180):
            neutralized += 1
        blocked_names = set(all_names)
        if has_unknown:
            blocked_names.add(_text(raw_cluster.get("title")))
        interpretation = (claims(raw_cluster["interpretationClaims"]) if "interpretationClaims" in raw_cluster
                          else safe(raw_cluster.get("interpretation")))
        interpretation = noncandidate(interpretation, blocked_names)
        if has_unknown and "interpretationClaims" not in raw_cluster:
            interpretation = " ".join(part for part in re.split(r"(?<=[.!?])\s+", interpretation)
                if _context_limitation(part) or (_mentions(request, part) and
                    all(not is_context_only(by_id[key]) for key in _mentions(request, part))))
        for key, item in evidence.items():
            item["clinicalRelevance"] = noncandidate(item["clinicalRelevance"], blocked_names) or _fact_relevance(by_id[key])
        if not interpretation:
            # Preserve surviving model-authored evidence reasoning rather than
            # promoting candidate disease rationale into an unvalidated channel.
            interpretation = " ".join(item["clinicalRelevance"] for item in evidence.values()
                if item["clinicalRelevance"] != _fact_relevance(by_id[item["observationId"]]))[:2400]
        contextual_fallback = not interpretation and has_unknown
        if contextual_fallback:
            interpretation = ("The reported " + " and ".join(labels[:2]) + " findings can be reviewed together, "
                "but unavailable report-specific reference information limits how this group can be characterized. "
                "Clinical context and usable reference information are needed before drawing a condition-level conclusion.")
        if not interpretation and candidates:
            # Invalid pattern prose is a local error, not a reason to discard an
            # independently grounded candidate. Keep its medical explanation in
            # the candidate channel and use only Clinora facts for this heading.
            interpretation = " ".join(dict.fromkeys(
                _fact_relevance(by_id[key]) for candidate in candidates
                for key in candidate["supportingObservationIds"]
            ))
        if not interpretation:
            continue
        def context_list(value: object, *, missing: bool = False) -> list[str]:
            result = []
            for text in _safe_list(request, value, missing=missing, limit=12 if missing else 8):
                cleaned = noncandidate(text, blocked_names)
                if cleaned:
                    result.append(cleaned)
            return result

        group = {
            "title": title, "displayTitle": title, "interpretation": interpretation,
            "evidence": list(evidence.values()), "candidates": candidates,
            "missingEvidence": context_list(raw_cluster.get("missingEvidence"), missing=True),
            "alternatives": [] if has_unknown or (raw_candidate_items and not candidates) else context_list(raw_cluster.get("alternatives")),
        }
        support_key = frozenset(key for key, item in evidence.items() if item["role"] == "SUPPORTS")
        duplicate = next((previous for previous in clusters
            if _normal(previous["interpretation"]) == _normal(interpretation)
            and {(e["observationId"], e["role"]) for e in previous["evidence"]}
                == {(e["observationId"], e["role"]) for e in evidence.values()}), None)
        if contextual_fallback and not candidates and support_key:
            duplicate = duplicate or fallback_groups.get(support_key)
        if duplicate is not None:
            # Merge repetitions of the same grounded relationship. Distinct
            # support groups and distinct surviving medical reasoning stay separate.
            duplicate["candidates"].extend(candidates[:max(0, 2-len(duplicate["candidates"]))])
            known = {e["observationId"] for e in duplicate["evidence"]}
            duplicate["evidence"].extend(e for key, e in evidence.items()
                if key not in known and e["role"] == "CONTEXT")
            duplicate["evidence"] = duplicate["evidence"][:20]
            for candidate in duplicate["candidates"]:
                seen_candidates.add(_normal(candidate["name"]))
            continue
        for candidate in candidates:
            seen_candidates.add(_normal(candidate["name"]))
        clusters.append(group)
        if contextual_fallback and not candidates and support_key:
            fallback_groups[support_key] = group

    notable = [{
        "observationId": str(item.observationId), "title": item.label,
        "interpretation": _fact_relevance(item),
    } for item in request.observations if is_strong_evidence(item)][:50]
    accepted_candidates = sum(len(cluster["candidates"]) for cluster in clusters)
    # Synthesize already grounded relationships. Free overall prose must not
    # resurrect premises removed from an individual cluster or candidate.
    overall = " ".join(cluster["interpretation"] for cluster in clusters)[:2400]
    rejected_names = {
        _text(candidate.get("name"), 180)
        for raw_cluster in raw_clusters if isinstance(raw_cluster, dict)
        for candidate in (raw_cluster.get("candidates") or []) if isinstance(candidate, dict)
        if _normal(_text(candidate.get("name"), 180)) not in seen_candidates
    } - {""}
    if rejected_names:
        overall = " ".join(sentence for sentence in re.split(r"(?<=[.!?])\s+", overall)
                           if not any(re.search(rf"(?<!\w){re.escape(name)}(?!\w)", sentence, re.I)
                                      for name in rejected_names))
    if clusters:
        # This fallback is only a synthesis of the surviving model interpretations.
        # No clinical associations or diseases are inferred by deterministic code.
        overall = overall or " ".join(cluster["interpretation"] for cluster in clusters)[:2400]
        status = "POSSIBLE_CLINICAL_PATTERN"
    elif notable:
        overall = "Some verified findings are outside the supplied reference ranges or explicitly positive, but no clear clinical pattern could be grounded from this analysis."
        status = "INSUFFICIENT_EVIDENCE"
    elif any(evidence_class(item) in {"UNCLASSIFIED", "QUALITATIVE_REPORTED"} for item in request.observations):
        overall = "The supplied reference information is incomplete, so a clear abnormal pattern could not be established. Clinical context is needed."
        status = "INSUFFICIENT_EVIDENCE"
    else:
        overall = "The verified observations do not show a clear abnormal pattern. Clinical context may still matter when discussing this report with a clinician."
        status = "NO_CLEAR_ABNORMAL_PATTERN"

    # Keep the old consumer shape additive; its existing maximum is five. The full
    # authoritative group structure still contains up to six (3 x 2) candidates.
    patterns = [{
        "name": candidate["name"], "supportLevel": candidate["supportLevel"],
        "reasoning": candidate["rationale"],
        "supportingObservationIds": candidate["supportingObservationIds"],
        "contradictoryObservationIds": candidate["contradictoryObservationIds"],
        "missingEvidence": candidate["missingEvidence"], "possibleCauses": candidate["alternatives"],
    } for cluster in clusters for candidate in cluster["candidates"]][:5]
    payload: dict[str, object] = {
        "analysisStatus": status, "summary": overall,
        "clinicalClusters": clusters, "overallInterpretation": overall,
        "notableFindings": notable, "clinicalPatterns": patterns,
        "discussionPoints": [{
            "type": "CLINICAL_QUESTION", "title": "Discuss how these findings fit your clinical context",
            "reason": "Symptoms, timing, medical history, examination and any needed confirmation can change the interpretation.",
        }],
        "patientExplanation": overall,
        "limitations": [
            "This AI-generated interpretation is not a diagnosis and should not replace evaluation by a qualified clinician.",
            "The analysis is limited to confirmed laboratory observations and does not include a physical examination or complete clinical history.",
        ],
    }
    eligibility = [support_eligibility(item) for item in request.observations]
    diagnostics: dict[str, int | str] = {
        "input_observation_count": len(by_id),
        "verified_abnormal_count": eligibility.count("VERIFIED_ABNORMAL"),
        "verified_positive_count": eligibility.count("VERIFIED_QUALITATIVE_POSITIVE"),
        "verified_normal_count": eligibility.count("VERIFIED_NORMAL"),
        "unknown_context_count": sum(is_context_only(item) for item in request.observations),
        "context_reference_recovered_count": context_recovered,
        "raw_cluster_count": len(raw_clusters), "raw_candidate_count": raw_candidates,
        "support_to_context_reclassification_count": reclassified,
        "unknown_support_pruned_count": unknown_pruned,
        "factual_claim_pruned_count": pruned_claims,
        "condition_leakage_neutralized_count": neutralized,
        "accepted_cluster_count": len(clusters), "accepted_candidate_count": accepted_candidates,
        "downgraded_candidate_count": max(0, raw_candidates - accepted_candidates),
        "modelClusters": len(raw_clusters), "modelCandidates": raw_candidates,
        "acceptedClusters": len(clusters), "acceptedCandidates": accepted_candidates,
        "rejectedClusters": max(0, len(raw_clusters) - len(clusters)),
        "rejectedCandidates": max(0, raw_candidates - accepted_candidates),
        "discardedEvidenceIds": discarded, "reclassifiedEvidenceItems": reclassified,
        "prunedReasoningFields": pruned_claims,
    }
    return payload, diagnostics
