from __future__ import annotations

from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    x: float = Field(ge=0.0, le=1.0)
    y: float = Field(ge=0.0, le=1.0)
    width: float = Field(ge=0.0, le=1.0)
    height: float = Field(ge=0.0, le=1.0)


class Observation(BaseModel):
    sourceLabel: str
    normalizedLabel: str
    valueType: str
    numericValue: float | None = None
    textValue: str | None = None
    comparator: str | None = None
    unit: str | None = None
    referenceRangeRaw: str | None = None
    referenceLow: float | None = None
    referenceHigh: float | None = None
    sourceFlag: str | None = None
    derivedRangeFlag: str | None = None
    pageNumber: int = Field(ge=1)
    boundingBox: BoundingBox | None = None
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    reviewRequired: bool = False


class ExtractionResponse(BaseModel):
    engine: str
    engineVersion: str
    documentType: str
    pageCount: int = Field(ge=1)
    overallConfidence: float | None = Field(default=None, ge=0.0, le=1.0)
    parserVersion: str = "clinora-lab-parser-v1"
    normalizerVersion: str = "clinora-lab-normalizer-v1"
    observations: list[Observation]
    warnings: list[str] = Field(default_factory=list)
