"""Opt-in local persisted runtime acceptance; create NEW synthetic reports/jobs.
Run from repository root with ai-service/.venv/Scripts/python.exe and seed or run.
Requires Docker access. Never prints secrets or queries real patient report data.
Synthetic fixtures deliberately remain for review; this script deletes nothing.
"""
from pathlib import Path
import base64
import hashlib
import hmac
import json
import os
import subprocess
import sys
import time
from uuid import uuid4
import httpx

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ai-service"))
from v51_cases import runtime_cases

MANIFEST = ROOT / "backend/target/r51-runtime-inputs.json"
CAPTURE = ROOT / os.getenv("R51_CAPTURE_PATH", "docs/validation/phase10p-r51-runtime.json")


def docker(*args):
    completed = subprocess.run(["docker", "compose", *args], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    if completed.returncode:
        raise RuntimeError("Local Docker operation failed; no sensitive output printed")
    return completed.stdout.strip()


def sql(statement):
    completed = subprocess.run(["docker", "compose", "exec", "-T", "postgres", "psql", "-U", "clinora", "-d", "clinora", "-At", "-v", "ON_ERROR_STOP=1"],
        cwd=ROOT, input=statement, capture_output=True, text=True, encoding="utf-8")
    if completed.returncode:
        # SQL contains synthetic fixture data only, but keep routine logs minimal.
        raise RuntimeError("Synthetic fixture SQL failed: " + completed.stderr[:300])
    return completed.stdout.strip()


def q(value):
    return "NULL" if value is None else "'" + str(value).replace("'", "''") + "'"


def seed():
    patient_id = str(uuid4())
    statements = ["BEGIN;", f"""INSERT INTO users
        (id,first_name,last_name,email,normalized_email,password_hash,role,account_status,email_verified_at,created_at,updated_at,version)
        VALUES ({q(patient_id)},'Synthetic','R51 acceptance',{q('r51-'+patient_id+'@example.invalid')},
        {q('r51-'+patient_id+'@example.invalid')},'disabled-synthetic-login','PATIENT','ACTIVE',now(),now(),now(),0);"""]
    manifest = dict(syntheticUserId=patient_id, reports={})
    for label, request in runtime_cases().items():
        report_id, job_id, extraction_id = (str(uuid4()) for _ in range(3))
        for observation in request.observations:
            observation.observationId = uuid4()
        request.observations.sort(key=lambda o: o.label)
        manifest["reports"][label] = dict(reportId=report_id, request=request.model_dump(mode="json"))
        statements.extend([
            f"""INSERT INTO patient_medical_reports
                (id,patient_user_id,report_name,report_type,object_key,original_filename,mime_type,size_bytes,sha256_checksum,created_at,updated_at)
                VALUES ({q(report_id)},{q(patient_id)},{q('SYNTHETIC R5.1 Report '+label)},'LAB_RESULTS',
                {q('synthetic-r51/'+report_id)},'synthetic-fixture.pdf','application/pdf',1,{'0'*64!r},now(),now());""",
            f"""INSERT INTO medical_report_extraction_jobs
                (id,report_id,patient_user_id,source_checksum,status,requested_at,completed_at,created_at,updated_at)
                VALUES ({q(job_id)},{q(report_id)},{q(patient_id)},{'0'*64!r},'SUCCEEDED',now(),now(),now(),now());""",
            f"""INSERT INTO medical_report_extraction_results
                (id,job_id,report_id,document_type,page_count,parser_version,normalizer_version,review_status,confirmed_at,created_at,updated_at)
                VALUES ({q(extraction_id)},{q(job_id)},{q(report_id)},'LAB_REPORT',1,'synthetic-r51','synthetic-r51','VERIFIED',now(),now(),now());""",
        ])
        for o in request.observations:
            statements.append(f"""INSERT INTO medical_report_observations
                (id,extraction_result_id,source_label,normalized_label,effective_label,ocr_value_type,effective_value_type,
                ocr_numeric_value,ocr_text_value,effective_numeric_value,effective_text_value,ocr_unit,effective_unit,
                reference_range_raw,reference_low,reference_high,page_number,verification_status,created_at,updated_at)
                VALUES ({q(o.observationId)},{q(extraction_id)},{q(o.label)},{q(o.label)},{q(o.label)},{q(o.valueType)},{q(o.valueType)},
                {q(o.numericValue)},{q(o.textValue)},{q(o.numericValue)},{q(o.textValue)},{q(o.unit)},{q(o.unit)},
                {q(o.referenceRangeRaw)},{q(o.referenceLow)},{q(o.referenceHigh)},1,'PATIENT_CONFIRMED',now(),now());""")
    statements.append("COMMIT;")
    sql("\n".join(statements))
    MANIFEST.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("Created four new isolated synthetic confirmed reports; no existing reports changed.", flush=True)


def token(patient_id):
    secret = docker("exec", "-T", "backend", "printenv", "JWT_SECRET")
    now = int(time.time())
    encode = lambda value: base64.urlsafe_b64encode(json.dumps(value, separators=(",", ":")).encode()).rstrip(b"=")
    payload = b".".join([encode(dict(alg="HS256", typ="JWT")), encode(dict(iss="clinora-ai", sub=patient_id, jti=str(uuid4()), iat=now, exp=now+3600, role="PATIENT"))])
    return (payload+b"."+base64.urlsafe_b64encode(hmac.new(secret.encode(), payload, hashlib.sha256).digest()).rstrip(b"=")).decode()


def run(labels):
    for _ in range(40):
        try:
            ready = httpx.get("http://127.0.0.1:8080/actuator/health", timeout=3)
            if ready.status_code < 500:
                break
        except httpx.HTTPError:
            pass
        time.sleep(3)
    else:
        raise RuntimeError("Local backend did not become ready within the bounded startup wait")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    with httpx.Client(base_url="http://127.0.0.1:8080", timeout=15, headers={"Authorization": "Bearer " + token(manifest["syntheticUserId"])}) as client:
        for label, entry in manifest["reports"].items():
            if labels and label not in labels:
                continue
            path = f"/api/v1/patient/reports/{entry['reportId']}/ai-analysis"
            response = client.post(path)
            response.raise_for_status()
            initial = response.json()["data"]
            print(f"REPORT {label}: new backend analysis requested; status={initial.get('status')}", flush=True)
            started = time.monotonic()
            while time.monotonic()-started < 360:
                response = client.get(path)
                response.raise_for_status()
                state = response.json()["data"]
                if state["status"] in {"SUCCEEDED", "FAILED"}:
                    break
                time.sleep(3)
            print(f"REPORT {label}: backend status={state['status']}; failure={state.get('failureCode')}", flush=True)
            captured = json.loads(CAPTURE.read_text(encoding="utf-8")) if CAPTURE.exists() else dict(syntheticOnly=True, reports={})
            info = captured["reports"].setdefault(label, {})
            info.update(backendStatus=state["status"], backendFailureCode=state.get("failureCode"), newJobRequested=True)
            if state.get("result"):
                info["persistedClinicalClusters"] = state["result"].get("clinicalClusters")
                info["persistedPatientInterpretation"] = state["result"].get("patientExplanation")
            CAPTURE.write_text(json.dumps(captured, indent=2), encoding="utf-8")


if __name__ == "__main__":
    seed() if sys.argv[1] == "seed" else run(sys.argv[2:])
