from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class AbnormalitySample(StrictModel):
    sampleKey: str = Field(min_length=1, max_length=100)
    test: str = Field(min_length=1, max_length=100)
    value: float
    unit: str = Field(min_length=1, max_length=50)
    referenceLow: float
    referenceHigh: float

    @model_validator(mode="after")
    def valid_range(self):
        if self.referenceLow > self.referenceHigh:
            raise ValueError("Invalid reference interval")
        return self


class AbnormalityEvaluationRequest(StrictModel):
    samples: list[AbnormalitySample] = Field(min_length=1)

    @model_validator(mode="after")
    def unique_samples(self):
        if len({s.sampleKey for s in self.samples}) != len(self.samples):
            raise ValueError("Duplicate sample keys")
        return self


class AbnormalityPrediction(StrictModel):
    sampleKey: str
    label: Literal["NORMAL", "ABNORMAL"]


class PredictionPayload(StrictModel):
    predictions: list[AbnormalityPrediction]


class AbnormalityEvaluationResponse(PredictionPayload):
    executionProvider: Literal["LLAMA_CPP_MEDGEMMA"]
    modelName: str
    modelRevision: str
    promptVersion: Literal["abnormality-all-v1"]
    generationCallCount: int
    inferenceDurationMs: int
