from __future__ import annotations

import re
from dataclasses import dataclass

from app.schemas.doctor_support_execution import DoctorSupportExecutionRequest


@dataclass(frozen=True)
class KnowledgeQuery:
    text: str
    domains: tuple[str, ...]


_DOMAIN_BY_REPORT = {
    "CBC": "hematology",
    "COMPLETE BLOOD COUNT": "hematology",
    "THYROID": "endocrinology",
    "THYROID FUNCTION": "endocrinology",
    "DENGUE": "infectious_disease",
    "RENAL": "nephrology",
    "KIDNEY": "nephrology",
    "LIVER": "hepatology",
}

_DOMAIN_BY_CONCEPT = {
    "hematology": {"mcv", "mch", "mchc", "rbc", "hgb", "hemoglobin", "haemoglobin", "rdw", "platelet", "platelets"},
    "endocrinology": {"tsh", "t3", "t4", "ft3", "ft4", "thyroid"},
    "infectious_disease": {"ns1", "dengue", "malaria", "crp"},
    "nephrology": {"creatinine", "egfr", "urea", "bun"},
    "hepatology": {"alt", "ast", "bilirubin", "alp"},
}

_SAFE_ASSESSMENT_TERMS = re.compile(
    r"\b(iron deficiency|thalass?emia|microcyt(?:ic|osis)|macrocyt(?:ic|osis)|anemia|"
    r"thyroid|hypothyroid|hyperthyroid|dengue|infection|inflammation|renal|kidney|liver|"
    r"ferritin|hemoglobin|haemoglobin|platelet|mcv|mch|tsh|t3|t4|ns1)\b",
    re.IGNORECASE,
)


class ClinicalKnowledgeQueryBuilder:
    """Builds a bounded clinical-concept query; identifiers and prose instructions are excluded."""

    def build(self, task_id: str, request: DoctorSupportExecutionRequest) -> KnowledgeQuery:
        reports = sorted({item.reportType.strip() for item in request.evidenceSnapshot.reports if item.reportType.strip()})
        concepts = sorted({
            value.strip().lower()
            for item in request.evidenceSnapshot.observations
            for value in (item.canonicalCode, item.label)
            if value and value.strip()
        })
        statuses = sorted({item.authoritativeStatus.lower().replace("_", " ") for item in request.evidenceSnapshot.observations})
        assessment_terms = sorted({match.group(0).lower() for match in _SAFE_ASSESSMENT_TERMS.finditer(request.doctorAssessment or "")})
        domains = tuple(sorted(
            {
                domain
                for report in reports
                for key, domain in _DOMAIN_BY_REPORT.items()
                if key in report.upper()
            }
            | {
                domain
                for domain, markers in _DOMAIN_BY_CONCEPT.items()
                if markers.intersection(concepts)
            }
        ))
        task_phrase = {
            "CONNECT_EVIDENCE": "clinical relationships interpretation",
            "CROSS_CHECK_ASSESSMENT": "assessment supporting and conflicting evidence",
            "FIND_GAPS": "recommended evaluation information limitations",
            "EXPLORE_EXPLANATIONS": "possible explanations distinguishing evidence limitations",
            "FOCUSED_EVIDENCE_QUESTION": "focused clinical evidence interpretation",
        }.get(task_id, "focused clinical evidence")
        parts = [task_phrase, *reports[:4], *concepts[:24], *statuses[:6], *assessment_terms[:8]]
        return KnowledgeQuery(" ".join(dict.fromkeys(part for part in parts if part)), domains)
