import pytest

from app.parser_v3 import TextBlock, parse_observations
from golden_cases import CASES


@pytest.mark.parametrize("name", CASES)
def test_golden_rows_preserve_values_units_ranges_and_association(name):
    rows = CASES[name]
    blocks = [TextBlock("Laboratory ID", .99, 70, 20, 260, 45),
              TextBlock("123456", .99, 630, 20, 760, 45)]
    for index, row in enumerate(rows):
        y = 200 + index * 110
        for x, text in zip((70, 630, 960, 1230), row):
            if text:
                blocks.append(TextBlock(text, .99, x, y, x + max(70, len(text)*12), y+30))
    observations = parse_observations([blocks], [(1800, 1600)], .95)
    assert len(observations) == len(rows)
    for result, (label, value, unit, reference) in zip(observations, rows):
        assert result.sourceLabel == label
        assert result.rawValue == value
        assert result.unit == (unit or None)
        assert result.referenceRangeRaw == (reference or None)
        assert result.pageNumber == 1
        if value == "Positive":
            assert result.numericValue is None
            assert result.textValue.lower() == "positive"
        else:
            assert result.numericValue == float(value.replace(",", "").lstrip("<>"))
        assert result.comparator == (">" if value.startswith(">") else None)
    assert not any(item.normalizedLabel == "Laboratory ID" for item in observations)
