import pytest
from app.clinical_evidence import support_eligibility, is_strong_evidence
from app.schemas.report_analysis import ClinicalObservation
from v5_cases import numeric, oid

@pytest.mark.parametrize("fields,expected,eligible", [
    (dict(numericValue="20"), "VERIFIED_ABNORMAL", True),
    (dict(numericValue="5"), "VERIFIED_NORMAL", False),
    (dict(referenceLow=None, referenceHigh=None), "UNKNOWN", False),
    (dict(valueType="QUALITATIVE", textValue="Detected", referenceLow=None, referenceHigh=None), "VERIFIED_QUALITATIVE_POSITIVE", True),
    (dict(valueType="QUALITATIVE", textValue="Non-reactive", referenceLow=None, referenceHigh=None), "VERIFIED_QUALITATIVE_NEGATIVE", False),
    (dict(valueType="TEXT", textValue="Pending", referenceLow=None, referenceHigh=None), "CONTEXT_ONLY", False),
])
def test_shared_support_eligibility(fields, expected, eligible):
    item = ClinicalObservation.model_validate({**numeric(1, "Test", 5, 0, 10), **fields})
    assert support_eligibility(item) == expected
    assert is_strong_evidence(item) is eligible
