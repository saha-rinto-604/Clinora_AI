"""Synthetic-only live MedGemma acceptance runner for Phase 6D.

This script never reads the application database. It builds an ephemeral approved
knowledge index from the test corpus and submits synthetic evidence directly to
the private execution service.
"""
from __future__ import annotations

import json
import tempfile
import time
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from app.knowledge.chunking import ClinicalDocumentChunker
from app.knowledge.embeddings import ClinicalHashEmbeddingProvider
from app.knowledge.ingestion import ClinicalKnowledgeIngestionService
from app.knowledge.retrieval import ClinicalKnowledgeRetriever
from app.knowledge.store import SqliteClinicalKnowledgeStore
from app.model_runtime import MedGemmaRuntime
from app.schemas.doctor_support_execution import DoctorSupportExecutionRequest
from app.services.doctor_support_execution_service import DoctorSupportExecutionService

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "tests" / "fixtures" / "clinical_knowledge"
VERSIONS = {
    "BRIEF_PATIENT": ("doctor_brief_patient_v1", "doctor-support-brief-v1", "DISABLED"),
    "CONNECT_EVIDENCE": ("doctor_connect_evidence_v2", "doctor-support-connect-v2", "OPTIONAL"),
    "COMPARE_EVIDENCE": ("doctor_compare_evidence_v1", "doctor-support-compare-v1", "DISABLED"),
    "CROSS_CHECK_ASSESSMENT": ("doctor_cross_check_assessment_v2", "doctor-support-cross-check-v2", "OPTIONAL"),
    "FIND_GAPS": ("doctor_find_gaps_v2", "doctor-support-gaps-v2", "REQUIRED_WHEN_AVAILABLE"),
    "EXPLORE_EXPLANATIONS": ("doctor_explore_explanations_v1", "doctor-support-explore-v1", "REQUIRED_WHEN_AVAILABLE"),
    "STRUCTURE_NOTES": ("doctor_structure_notes_v1", "doctor-support-structure-notes-v1", "DISABLED"),
    "FOCUSED_EVIDENCE_QUESTION": ("doctor_focused_evidence_question_v1", "doctor-support-focused-question-v1", "OPTIONAL"),
}


class ObservedRuntime:
    def __init__(self, runtime):
        self.runtime = runtime
        self.calls = 0
        self.finish_reasons: list[str | None] = []

    @property
    def metadata(self):
        return self.runtime.metadata

    def generate(self, *args, **kwargs):
        self.calls += 1
        result = self.runtime.generate(*args, **kwargs)
        self.finish_reasons.append(result.finish_reason)
        return result


def uid(name: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"clinora-phase6d6:{name}"))


def observation(case, name, label, code, value, unit, status, low=None, high=None, text=None):
    numeric = value if isinstance(value, (int, float)) else None
    return {
        "observationId": uid(f"{case}:{name}"), "reportId": uid(f"{case}:report"),
        "label": label, "canonicalCode": code, "valueType": "NUMERIC" if numeric is not None else "TEXT",
        "numericValue": numeric, "textValue": text if text is not None else (value if numeric is None else None),
        "comparator": None, "unit": unit, "referenceLow": low, "referenceHigh": high,
        "referenceRangeRaw": None, "authoritativeStatus": status, "verificationStatus": "PATIENT_CONFIRMED",
        "normalizedNumericValue": numeric, "normalizedUnit": unit.lower() if unit else None,
        "comparisonKey": unit.lower() if unit else None,
    }


def request(case, question, task, observations, assessment=None, notes=None, reports=None, comparisons=None):
    prompt, schema, rag = VERSIONS[task]
    reports = reports or [{"reportId": uid(f"{case}:report"), "reportType": "CBC", "clinicalDate": "2026-09-01", "dateReliability": "REPORT_DATE"}]
    return DoctorSupportExecutionRequest.model_validate({
        "executionId": uid(f"{case}:execution:{task}"), "originalQuestion": question,
        "doctorAssessment": assessment, "doctorNotes": notes,
        "appointmentContext": {"reason": "Synthetic acceptance case", "scheduledStart": "2026-09-17T10:00:00Z", "scheduledEnd": "2026-09-17T10:30:00Z", "timezone": "UTC"},
        "evidenceSnapshot": {"snapshotHash": "a" * 64, "reports": reports, "observations": observations, "comparisonFacts": comparisons or []},
        "tasks": [{"taskId": task, "promptVersion": prompt, "schemaVersion": schema, "ragPolicy": rag}],
    })


def cases():
    micro = [
        observation("micro", "mcv", "MCV", "MCV", 70, "fL", "LOW", 80, 100),
        observation("micro", "mch", "MCH", "MCH", 22, "pg", "LOW", 27, 33),
        observation("micro", "rbc", "RBC", "RBC", 5.8, "10^12/L", "HIGH", 4.2, 5.4),
    ]
    dengue = [
        observation("dengue", "ns1", "Dengue NS1 antigen", "NS1", "Detected", None, "POSITIVE", text="Detected"),
        observation("dengue", "platelets", "Platelet count", "PLATELET", 110, "10^9/L", "LOW", 150, 450),
        observation("dengue", "wbc", "WBC", "WBC", 3.1, "10^9/L", "LOW", 4, 11),
    ]
    thyroid = [
        observation("thyroid", "tsh", "TSH", "TSH", 8.1, "mIU/L", "HIGH", 0.4, 4.5),
        observation("thyroid", "t4", "Free T4", "FT4", 0.7, "ng/dL", "LOW", 0.8, 1.8),
    ]
    normal = [observation("normal", "hgb", "Hemoglobin", "HGB", 14.1, "g/dL", "IN_RANGE", 12, 16)]
    conflict = [
        observation("conflict", "mcv", "MCV", "MCV", 74, "fL", "LOW", 80, 100),
        observation("conflict", "ferritin", "Ferritin", "FERRITIN", 88, "ng/mL", "IN_RANGE", 20, 200),
    ]
    old_id, new_id = uid("compare:mcv-old"), uid("compare:mcv-new")
    old_report, new_report = uid("compare:old-report"), uid("compare:report")
    compare_observations = [
        {**observation("compare", "mcv-old", "MCV", "MCV", 74, "fL", "LOW", 80, 100), "observationId": old_id, "reportId": old_report},
        {**observation("compare", "mcv-new", "MCV", "MCV", 70, "fL", "LOW", 80, 100), "observationId": new_id, "reportId": new_report},
    ]
    compare_reports = [
        {"reportId": old_report, "reportType": "CBC", "clinicalDate": "2026-08-01", "dateReliability": "REPORT_DATE"},
        {"reportId": new_report, "reportType": "CBC", "clinicalDate": "2026-09-01", "dateReliability": "REPORT_DATE"},
    ]
    comparison = [{"canonicalCode": "MCV", "label": "MCV", "earlierObservationId": old_id, "laterObservationId": new_id,
                   "earlierDate": "2026-08-01", "laterDate": "2026-09-01", "earlierValue": 74, "laterValue": 70, "unit": "fL", "direction": "DECREASED"}]
    return [
        ("micro-connect", request("micro", "How are these three values connected?", "CONNECT_EVIDENCE", micro)),
        ("micro-gaps", request("micro", "What relevant information is missing?", "FIND_GAPS", micro)),
        ("micro-explore", request("micro", "What could explain this pattern?", "EXPLORE_EXPLANATIONS", micro)),
        ("micro-cross", request("micro", "Does anything argue against my assessment?", "CROSS_CHECK_ASSESSMENT", micro, assessment="Possible iron deficiency")),
        ("dengue-focused", request("dengue", "What does this positive NS1 mean with these findings?", "FOCUSED_EVIDENCE_QUESTION", dengue)),
        ("thyroid-connect", request("thyroid", "How do these thyroid findings relate?", "CONNECT_EVIDENCE", thyroid)),
        ("normal-brief", request("normal", "Brief me for this appointment.", "BRIEF_PATIENT", normal)),
        ("insufficient-focused", request("normal", "What can be said from this selected value?", "FOCUSED_EVIDENCE_QUESTION", normal)),
        ("conflicting-cross", request("conflict", "Does my assessment fit?", "CROSS_CHECK_ASSESSMENT", conflict, assessment="Possible iron deficiency")),
        ("structure-notes", request("notes", "Structure these notes.", "STRUCTURE_NOTES", [], notes="? iron deficiency, low MCV, tired 2 weeks, consider ferritin", reports=[])),
        ("compare", request("compare", "Compare these CBC results.", "COMPARE_EVIDENCE", compare_observations, reports=compare_reports, comparisons=comparison)),
    ]


def main():
    with tempfile.TemporaryDirectory(prefix="clinora-phase6d6-") as folder:
        embedding = ClinicalHashEmbeddingProvider()
        store = SqliteClinicalKnowledgeStore(Path(folder) / "knowledge.db", create=True, embedding_model=embedding.model_id)
        ClinicalKnowledgeIngestionService(store, ClinicalDocumentChunker(embedding)).ingest_manifest(FIXTURES / "manifest.json")
        observed = ObservedRuntime(MedGemmaRuntime())
        service = DoctorSupportExecutionService(observed, ClinicalKnowledgeRetriever(store, embedding))
        output = []
        for case_id, payload in cases():
            before = observed.calls
            started = time.perf_counter()
            try:
                result = service.execute(payload).taskResults[0]
                record = {
                    "case": case_id, "taskId": result.taskId, "status": result.status,
                    "safeFailureCode": result.safeFailureCode, "ragUsed": result.ragUsed,
                    "retrievalStatus": result.retrievalStatus, "groundingStatus": result.groundingStatus,
                    "repairUsed": observed.calls - before > 1,
                    "completionTruncated": any(reason == "length" for reason in observed.finish_reasons[before:]),
                    "latencyMs": round((time.perf_counter() - started) * 1000),
                }
                output.append(record)
            except Exception as exc:  # diagnostic type only; never emit model content
                record = {"case": case_id, "status": "RUNTIME_ERROR", "errorType": type(exc).__name__,
                          "latencyMs": round((time.perf_counter() - started) * 1000)}
                output.append(record)
            print(json.dumps(record), flush=True)
        print(json.dumps({"syntheticOnly": True, "embeddingModel": embedding.model_id, "cases": output}, indent=2))


if __name__ == "__main__":
    main()
