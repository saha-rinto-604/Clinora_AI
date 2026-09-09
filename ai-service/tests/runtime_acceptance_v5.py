"""Opt-in local MedGemma acceptance; synthetic inputs only, no patient data.

Run from ai-service: .venv/Scripts/python.exe tests/runtime_acceptance_v5.py
This calls the real loopback llama.cpp runtime through the actual FastAPI route
in-process. It does not replace/restart the user's running service or publish data.
"""
from pathlib import Path
import json
import os
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.model_runtime import MedGemmaRuntime
from app.api.internal_analysis import build_router
from app.services.report_analysis_service import ReportAnalysisService
from app.prompts.patient_lab_report_v5 import model_payload_from_cluster_output
from fastapi import FastAPI
from fastapi.testclient import TestClient
from v5_cases import cases


class CapturingRuntime:
    def __init__(self):
        self.runtime = MedGemmaRuntime()
        self.metadata = self.runtime.metadata
        self.generations = []

    def generate(self, *args, **kwargs):
        generation = self.runtime.generate(*args, **kwargs)
        self.generations.append(generation)
        return generation


def main():
    # Isolate acceptance configuration from the user's existing R4 process.
    os.environ["AI_MAX_NEW_TOKENS"] = "2048"
    os.environ["LLAMA_READ_TIMEOUT_SECONDS"] = "240"
    output_path = Path(__file__).resolve().parents[2] / "docs/validation/phase10p-r5-runtime.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    results = {"syntheticOnly": True, "transport": "FastAPI route in-process -> real loopback llama.cpp", "reports": {}}
    runtime = CapturingRuntime()
    runtime.runtime.ensure_loaded()
    app = FastAPI()
    app.include_router(build_router(ReportAnalysisService(runtime)))
    with TestClient(app) as client:
        for label, request in cases().items():
            runtime.generations = []
            started = time.monotonic()
            print(f"REPORT {label}: real model generation started", flush=True)
            response = client.post("/internal/v1/report-analysis", json=request.model_dump(mode="json"),
                                   headers={"X-Clinora-Internal-Token": os.getenv("AI_INTERNAL_TOKEN", "").strip() or "dev-only-clinora-ai-token-change-me"})
            capture = {"httpStatus": response.status_code, "elapsedSeconds": round(time.monotonic()-started, 2), "generationCount": len(runtime.generations)}
            for generation in runtime.generations[-1:]:
                capture.update(finishReason=generation.finish_reason, completionTokens=generation.completion_tokens)
                try:
                    _, counts = model_payload_from_cluster_output(request, generation.content)
                    capture.update(counts)
                except ValueError:
                    capture["rawOutputParseable"] = False
            if response.is_success:
                result = response.json()
                capture.update(finalClinicalClusters=result["clinicalClusters"], finalPatientInterpretation=result["patientExplanation"],
                               analysisStatus=result["analysisStatus"], promptVersion=result["promptVersion"], schemaVersion=result["schemaVersion"])
            else:
                capture["failure"] = response.json()
            results["reports"][label] = capture
            output_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
            print(f"REPORT {label}: HTTP {response.status_code}; raw clusters={capture.get('modelClusters')}, raw candidates={capture.get('modelCandidates')}, accepted clusters={capture.get('acceptedClusters')}, accepted candidates={capture.get('acceptedCandidates')}", flush=True)
    passed = all(r["httpStatus"] == 200 for r in results["reports"].values())
    passed = passed and results["reports"]["B"].get("acceptedClusters", 0) >= 2
    passed = passed and results["reports"]["C"].get("acceptedCandidates", 1) == 0
    results["structuralAcceptancePassed"] = passed
    # Acceptance data may assert case-specific clinical behavior. This check is
    # deliberately outside production prompting/grounding and never changes output.
    incompatible_thyroid = any(
        "hypothyroid" in cluster["title"].lower()
        or any("hypothyroid" in candidate["name"].lower() for candidate in cluster["candidates"])
        for cluster in results["reports"]["B"].get("finalClinicalClusters", [])
    )
    results["clinicalAcceptancePassed"] = passed and not incompatible_thyroid
    results["clinicalReviewRequired"] = True
    results["clinicalAcceptanceNotes"] = (
        "Report B used a hypothyroidism label for the synthetic low-TSH/high-Free-T4 case; "
        "this does not satisfy the requested thyroid-hormone-excess acceptance behavior. "
        "Facts and structural grounding alone cannot establish medically correct inference."
        if incompatible_thyroid else
        "Fixture-specific checks passed; this is not comprehensive clinical validation."
    )
    output_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    return 0 if results["clinicalAcceptancePassed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
