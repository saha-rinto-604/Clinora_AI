"""Temporary acceptance-only FastAPI host; captures allowlisted synthetic inputs only."""
from pathlib import Path
import json
import time
import os
from fastapi import FastAPI
from app.api.internal_analysis import build_router
from app.model_runtime import MedGemmaRuntime
from app.services.report_analysis_service import ReportAnalysisService
from app.prompts.patient_lab_report_v5 import model_payload_from_cluster_output

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "backend/target/r51-runtime-inputs.json"
CAPTURE = ROOT / os.getenv("R51_CAPTURE_PATH", "docs/validation/phase10p-r51-runtime.json")
runtime = MedGemmaRuntime()


class CaptureRuntime:
    metadata = runtime.metadata
    def __init__(self):
        self.generations = []
    def generate(self, *args, **kwargs):
        generation = runtime.generate(*args, **kwargs)
        self.generations.append(generation)
        return generation


class AcceptanceService:
    def analyze(self, request):
        fixtures = json.loads(MANIFEST.read_text(encoding="utf-8"))["reports"]
        label = next((label for label, entry in fixtures.items()
            if {o["observationId"] for o in entry["request"]["observations"]} == {str(o.observationId) for o in request.observations}), None)
        if label is None:
            return ReportAnalysisService(runtime).analyze(request)
        captured = CaptureRuntime()
        started = time.monotonic()
        info = {"newJobId": str(request.requestId)}
        try:
            result = ReportAnalysisService(captured).analyze(request)
            info.update(finalClinicalClusters=result.model_dump(mode="json")["clinicalClusters"],
                finalPatientInterpretation=result.patientExplanation, analysisStatus=str(result.analysisStatus),
                promptVersion=result.promptVersion, schemaVersion=result.schemaVersion)
            return result
        except Exception as exc:
            info.update(failureType=type(exc).__name__, failureCode=getattr(exc, "reason_code", None))
            raise
        finally:
            info.update(elapsedSeconds=round(time.monotonic()-started, 2), generationCount=len(captured.generations))
            if captured.generations:
                generation = captured.generations[-1]
                info.update(finishReason=generation.finish_reason, completionTokens=generation.completion_tokens,
                    contentLength=len(generation.content), promptTokens=generation.prompt_tokens)
                try:
                    _, counts = model_payload_from_cluster_output(request, generation.content)
                    info.update(counts)
                    info["rawModelOutput"] = json.loads(generation.content)
                except ValueError:
                    info["rawOutputParseable"] = False
            report = json.loads(CAPTURE.read_text(encoding="utf-8")) if CAPTURE.exists() else {
                "syntheticOnly": True,
                "transport": "New authenticated backend job -> RabbitMQ -> FastAPI -> real local MedGemma -> persisted backend result",
                "reports": {}}
            report["reports"][label] = info
            CAPTURE.write_text(json.dumps(report, indent=2), encoding="utf-8")


app = FastAPI()
app.include_router(build_router(AcceptanceService()))

@app.get("/health")
def health():
    return {"status": "UP", "acceptanceOnly": True}
