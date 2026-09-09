from __future__ import annotations

import unittest
from types import SimpleNamespace

from app.clinical_ranges import range_state


def observation(
    value: str,
    raw: str | None,
    *,
    low: str | None = None,
    high: str | None = None,
    flag: str | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        valueType="NUMERIC",
        numericValue=value,
        referenceRangeRaw=raw,
        referenceLow=low,
        referenceHigh=high,
        rangeFlag=flag,
    )


class ClinicalRangeTests(unittest.TestCase):
    def test_parses_simple_upper_exclusive_reference(self) -> None:
        self.assertEqual(range_state(observation("2.95", "< 1.00 Ratio")), "HIGH")
        self.assertEqual(range_state(observation("0.15", "< 1.00 Ratio")), "IN_RANGE")
        self.assertEqual(range_state(observation("1.00", "< 1.00 Ratio")), "HIGH")

    def test_parses_inclusive_and_lower_thresholds(self) -> None:
        self.assertEqual(range_state(observation("1.00", "<= 1.00")), "IN_RANGE")
        self.assertEqual(range_state(observation("5", "> 5")), "LOW")
        self.assertEqual(range_state(observation("5", ">= 5")), "IN_RANGE")

    def test_parses_comma_separated_interval(self) -> None:
        self.assertEqual(range_state(observation("3700", "4,000 - 11,000")), "LOW")
        self.assertEqual(range_state(observation("6000", "4,000 - 11,000")), "IN_RANGE")
        self.assertEqual(range_state(observation("12000", "4,000 - 11,000")), "HIGH")

    def test_structured_bound_and_verified_flag_take_precedence(self) -> None:
        self.assertEqual(range_state(observation("7", "< 1", low="5", high="10")), "IN_RANGE")
        self.assertEqual(range_state(observation("7", "< 1", flag="ABOVE_REPORTED_RANGE")), "HIGH")

    def test_does_not_guess_complex_qualitative_assay_cutoffs(self) -> None:
        self.assertEqual(
            range_state(observation("1.1", "Negative <1.0; equivocal 1.0-1.2; positive >1.2")),
            "UNKNOWN",
        )


if __name__ == "__main__":
    unittest.main()
