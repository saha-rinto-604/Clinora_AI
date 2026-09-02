import unittest

from app.parser import TextBlock, parse_observations


class LabParserTest(unittest.TestCase):
    def test_extracts_numeric_value_unit_and_report_range(self):
        pages = [[
            TextBlock("Hemoglobin", 0.99, 10, 20, 180, 45),
            TextBlock("10.4", 0.99, 220, 20, 270, 45),
            TextBlock("g/dL", 0.99, 300, 20, 350, 45),
            TextBlock("12.0-15.5", 0.99, 390, 20, 500, 45),
        ]]
        values = parse_observations(pages, [(1000, 1200)], 0.95)
        self.assertEqual(1, len(values))
        self.assertEqual("Hemoglobin", values[0].normalizedLabel)
        self.assertEqual(10.4, values[0].numericValue)
        self.assertEqual("g/dL", values[0].unit)
        self.assertEqual("BELOW_REPORTED_RANGE", values[0].derivedRangeFlag)
        self.assertFalse(values[0].reviewRequired)

    def test_low_confidence_numeric_value_requires_review(self):
        pages = [[
            TextBlock("Creatinine", 0.99, 10, 20, 170, 45),
            TextBlock("1.1", 0.73, 220, 20, 270, 45),
            TextBlock("mg/dL", 0.98, 300, 20, 370, 45),
        ]]
        values = parse_observations(pages, [(1000, 1200)], 0.95)
        self.assertEqual(1, len(values))
        self.assertTrue(values[0].reviewRequired)

    def test_supports_decimal_comma_without_treating_it_as_thousands(self):
        pages = [[TextBlock("Hemoglobin 10,4 g/dL 12,0-15,5", 0.99, 10, 10, 500, 30)]]
        observations = parse_observations(pages, [(1000, 1000)], 0.95)

        self.assertEqual(len(observations), 1)
        self.assertEqual(observations[0].numericValue, 10.4)
        self.assertEqual(observations[0].referenceLow, 12.0)
        self.assertEqual(observations[0].referenceHigh, 15.5)
        self.assertEqual(observations[0].derivedRangeFlag, "BELOW_REPORTED_RANGE")

    def test_parses_mpv_with_reference_range_split_across_ocr_cells(self):
        pages = [[
            TextBlock("MPV", 0.99, 20, 20, 100, 42),
            TextBlock("8", 0.99, 240, 20, 270, 42),
            TextBlock("7.5", 0.99, 390, 20, 440, 42),
            TextBlock("-", 0.99, 450, 20, 460, 42),
            TextBlock("11.5", 0.99, 470, 20, 520, 42),
            TextBlock("fL", 0.99, 650, 20, 690, 42),
        ]]

        observations = parse_observations(pages, [(1000, 1200)], 0.95)

        self.assertEqual(1, len(observations))
        self.assertEqual("MPV", observations[0].normalizedLabel)
        self.assertEqual(8.0, observations[0].numericValue)
        self.assertEqual(7.5, observations[0].referenceLow)
        self.assertEqual(11.5, observations[0].referenceHigh)
        self.assertEqual("fL", observations[0].unit)
        self.assertFalse(observations[0].reviewRequired)

    def test_parses_mchc_without_using_range_endpoint_as_result(self):
        pages = [[
            TextBlock("MCHC", 0.99, 20, 20, 120, 42),
            TextBlock("37.50", 0.99, 240, 20, 300, 42),
            TextBlock("31.5", 0.99, 390, 20, 440, 42),
            TextBlock("-", 0.99, 450, 20, 460, 42),
            TextBlock("34.5", 0.99, 470, 20, 520, 42),
            TextBlock("g/dL", 0.99, 650, 20, 700, 42),
        ]]

        observations = parse_observations(pages, [(1000, 1200)], 0.95)

        self.assertEqual(1, len(observations))
        self.assertEqual("MCHC", observations[0].normalizedLabel)
        self.assertEqual(37.5, observations[0].numericValue)
        self.assertEqual(31.5, observations[0].referenceLow)
        self.assertEqual(34.5, observations[0].referenceHigh)
        self.assertEqual("g/dL", observations[0].unit)
        self.assertEqual("ABOVE_REPORTED_RANGE", observations[0].derivedRangeFlag)

    def test_parses_rdw_cv_result_range_and_unit(self):
        pages = [[
            TextBlock("RDW-CV", 0.99, 20, 20, 120, 42),
            TextBlock("12", 0.99, 240, 20, 280, 42),
            TextBlock("11.6", 0.99, 390, 20, 440, 42),
            TextBlock("-", 0.99, 450, 20, 460, 42),
            TextBlock("14", 0.99, 470, 20, 510, 42),
            TextBlock("%", 0.99, 650, 20, 670, 42),
        ]]

        observations = parse_observations(pages, [(1000, 1200)], 0.95)

        self.assertEqual(1, len(observations))
        self.assertEqual("RDW-CV", observations[0].normalizedLabel)
        self.assertEqual(12.0, observations[0].numericValue)
        self.assertEqual(11.6, observations[0].referenceLow)
        self.assertEqual(14.0, observations[0].referenceHigh)
        self.assertEqual("%", observations[0].unit)

    def test_supports_result_unit_range_column_order(self):
        pages = [[
            TextBlock("Hemoglobin", 0.99, 20, 20, 180, 42),
            TextBlock("15", 0.99, 240, 20, 280, 42),
            TextBlock("g/dL", 0.99, 330, 20, 380, 42),
            TextBlock("12.0 - 15.5", 0.99, 470, 20, 590, 42),
        ]]

        observations = parse_observations(pages, [(1000, 1200)], 0.95)

        self.assertEqual(1, len(observations))
        self.assertEqual(15.0, observations[0].numericValue)
        self.assertEqual("g/dL", observations[0].unit)
        self.assertEqual(12.0, observations[0].referenceLow)
        self.assertEqual(15.5, observations[0].referenceHigh)
        self.assertFalse(observations[0].reviewRequired)

    def test_inverted_reference_range_requires_structural_review(self):
        pages = [[
            TextBlock("MPV", 0.99, 20, 20, 100, 42),
            TextBlock("8", 0.99, 240, 20, 270, 42),
            TextBlock("11.5 - 7.5", 0.99, 390, 20, 500, 42),
            TextBlock("fL", 0.99, 650, 20, 690, 42),
        ]]

        observations = parse_observations(pages, [(1000, 1200)], 0.95)

        self.assertEqual(1, len(observations))
        self.assertEqual(8.0, observations[0].numericValue)
        self.assertTrue(observations[0].reviewRequired)

    def test_ambiguous_unseparated_numeric_cells_require_structural_review(self):
        pages = [[
            TextBlock("MPV", 0.99, 20, 20, 100, 42),
            TextBlock("8", 0.99, 240, 20, 270, 42),
            TextBlock("7.5", 0.99, 390, 20, 440, 42),
            TextBlock("11.5", 0.99, 470, 20, 520, 42),
            TextBlock("fL", 0.99, 650, 20, 690, 42),
        ]]

        observations = parse_observations(pages, [(1000, 1200)], 0.95)

        self.assertEqual(1, len(observations))
        self.assertEqual(8.0, observations[0].numericValue)
        self.assertIsNone(observations[0].referenceLow)
        self.assertIsNone(observations[0].referenceHigh)
        self.assertTrue(observations[0].reviewRequired)

    def test_preserves_common_thousands_separator_in_cell_count(self):
        pages = [[TextBlock("WBC 8,200 cells/uL 4,000-11,000", 0.99, 10, 10, 500, 30)]]
        observations = parse_observations(pages, [(1000, 1000)], 0.95)

        self.assertEqual(len(observations), 1)
        self.assertEqual(observations[0].numericValue, 8200.0)
        self.assertEqual(observations[0].referenceLow, 4000.0)
        self.assertEqual(observations[0].referenceHigh, 11000.0)
        self.assertFalse(observations[0].reviewRequired)

    def test_extracts_qualitative_results(self):
        pages = [[
            TextBlock("Protein", 0.98, 10, 20, 140, 45),
            TextBlock("Negative", 0.98, 220, 20, 310, 45),
        ]]
        values = parse_observations(pages, [(1000, 1200)], 0.95)
        self.assertEqual(1, len(values))
        self.assertEqual("QUALITATIVE", values[0].valueType)
        self.assertEqual("Negative", values[0].textValue)


if __name__ == "__main__":
    unittest.main()
