#!/usr/bin/env python3
"""Repeat Clinora OCR/MedGemma validation on one de-identified/synthetic report.

Run from a Python environment containing httpx. The script does not upload the
report anywhere except the configured local Clinora endpoints.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import os
import re
import sys
import uuid
from pathlib import Path

import httpx


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True, type=Path)
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--ocr-url", default=os.getenv("OCR_VALIDATION_URL", "http://127.0.0.1:8000"))
    parser.add_argument("--ocr-token", default=os.getenv("OCR_INTERNAL_TOKEN", "dev-only-clinora-ocr-token-change-me"))
    parser.add_argument("--ai-url", default=os.getenv("AI_VALIDATION_URL", "http://127.0.0.1:8001"))
    parser.add_argument("--ai-token", default=os.getenv("AI_INTERNAL_TOKEN", ""))
    parser.add_argument("--skip-ai", action="store_true")
    return parser.parse_args()


def extract(client: httpx.Client, args: argparse.Namespace) -> dict:
    content_type = mimetypes.guess_type(args.file.name)[0] or "application/octet-stream"
    with args.file.open("rb") as handle:
        response = client.post(
            args.ocr_url.rstrip("/") + "/internal/v1/extract",
            headers={"X-Clinora-Internal-Token": args.ocr_token},
            data={"requestId": str(uuid.uuid4())},
            files={"file": (args.file.name, handle, content_type)},
        )
    response.raise_for_status()
    return response.json()


def observation_fingerprint(payload: dict) -> str:
    rows = []
    for item in payload.get("observations", []):
        rows.append(
            (
                str(item.get("normalizedLabel", "")).casefold(),
                item.get("valueType"), item.get("numericValue"), item.get("textValue"),
                item.get("comparator"), item.get("unit"), item.get("referenceRangeRaw"),
                item.get("referenceLow"), item.get("referenceHigh"), item.get("derivedRangeFlag"),
            )
        )
    encoded = json.dumps(sorted(rows, key=lambda row: str(row)), sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


def invalid_metadata_labels(payload: dict) -> list[str]:
    bad = re.compile(r"\b(?:lab|medical|patient|sample)\s*(?:id|no\.?|number)\b|\b(?:name|address|phone|mobile|print date)\b", re.I)
    return [str(item.get("normalizedLabel", "")) for item in payload.get("observations", []) if bad.search(str(item.get("normalizedLabel", "")))]


def ai_payload(extraction: dict, run_number: int) -> dict:
    namespace = uuid.UUID("f7b32d1e-53d8-4e79-b22f-410992e5018b")
    observations = []
    for index, item in enumerate(extraction.get("observations", [])):
        stable = "|".join([
            str(item.get("normalizedLabel", "")), str(item.get("numericValue", "")),
            str(item.get("textValue", "")), str(index),
        ])
        observations.append({
            "observationId": str(uuid.uuid5(namespace, stable)),
            "label": item.get("normalizedLabel") or item.get("sourceLabel") or "Extracted result",
            "valueType": item.get("valueType"),
            "numericValue": item.get("numericValue"),
            "textValue": item.get("textValue"),
            "comparator": item.get("comparator"),
            "unit": item.get("unit"),
            "referenceRangeRaw": item.get("referenceRangeRaw"),
            "referenceLow": item.get("referenceLow"),
            "referenceHigh": item.get("referenceHigh"),
            "rangeFlag": item.get("derivedRangeFlag") or item.get("sourceFlag"),
        })
    return {
        "requestId": str(uuid.uuid5(namespace, f"validation-run-{run_number}")),
        "reportType": extraction.get("documentType") or "LAB_REPORT",
        "observations": observations,
    }


def analyze(client: httpx.Client, args: argparse.Namespace, extraction: dict, run_number: int) -> dict:
    response = client.post(
        args.ai_url.rstrip("/") + "/internal/v1/report-analysis",
        headers={"X-Clinora-Internal-Token": args.ai_token},
        json=ai_payload(extraction, run_number),
    )
    response.raise_for_status()
    return response.json()


def candidate_signature(result: dict) -> tuple[str, tuple[str, ...]]:
    names = []
    for cluster in result.get("clinicalClusters", []) or []:
        for candidate in cluster.get("candidates", []) or []:
            name = str(candidate.get("name", "")).strip()
            if name:
                names.append(name.casefold())
    return str(result.get("analysisStatus", "")), tuple(sorted(names))


def main() -> int:
    args = parse_args()
    if not args.file.is_file():
        print(f"ERROR: report not found: {args.file}", file=sys.stderr)
        return 2
    runs = max(2, min(args.runs, 5))
    extraction_runs: list[dict] = []
    ai_runs: list[dict] = []

    with httpx.Client(timeout=httpx.Timeout(240.0, connect=5.0)) as client:
        for run in range(1, runs + 1):
            extracted = extract(client, args)
            extraction_runs.append(extracted)
            warnings = extracted.get("warnings", [])
            labels = [item.get("normalizedLabel") for item in extracted.get("observations", [])]
            print(f"OCR run {run}: {len(labels)} rows; warnings={warnings}")
            print("  labels:", ", ".join(str(label) for label in labels))
            if "EXTRACTION_QUALITY_INSUFFICIENT" in warnings:
                print("ERROR: extraction quality gate failed; AI reasoning must not proceed.", file=sys.stderr)
                return 1
            bad_labels = invalid_metadata_labels(extracted)
            if bad_labels:
                print(f"ERROR: metadata leaked into clinical observations: {bad_labels}", file=sys.stderr)
                return 1
            if not labels:
                print("ERROR: no laboratory observations were extracted.", file=sys.stderr)
                return 1

        fingerprints = [observation_fingerprint(item) for item in extraction_runs]
        if len(set(fingerprints)) != 1:
            print("ERROR: extraction changed across repeated runs.", file=sys.stderr)
            return 1
        print(f"PASS: extraction fingerprint stable across {runs} runs: {fingerprints[0][:16]}")

        if not args.skip_ai:
            if not args.ai_token:
                print("SKIP AI: provide AI_INTERNAL_TOKEN or use --skip-ai.")
            else:
                for run, extracted in enumerate(extraction_runs, start=1):
                    result = analyze(client, args, extracted, run)
                    ai_runs.append(result)
                    print(f"AI run {run}: signature={candidate_signature(result)}")
                signatures = [candidate_signature(item) for item in ai_runs]
                if len(set(signatures)) != 1:
                    print("ERROR: clinical candidate/status output changed across deterministic runs.", file=sys.stderr)
                    return 1
                print(f"PASS: AI status/candidate signature stable across {runs} runs.")

    print("PASS: repeatability checklist completed. This validates pipeline stability, not clinical correctness.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
