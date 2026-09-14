from app.parser_v3 import (
    TextBlock,
    estimate_known_lab_label_mentions,
    estimate_lab_row_candidates,
    observation_from_assisted_row,
    parse_observations,
    recognized_lab_labels,
)


def block(text: str, x1: float, y1: float, width: float = 120, height: float = 18) -> TextBlock:
    return TextBlock(text=text, confidence=0.99, x1=x1, y1=y1, x2=x1 + width, y2=y1 + height)


def row(y: float, *values: str) -> list[TextBlock]:
    result: list[TextBlock] = []
    x = 10.0
    for value in values:
        width = max(60.0, len(value) * 6.0)
        result.append(block(value, x, y, width))
        x += width + 18.0
    return result


def test_clean_synthetic_report_extracts_result_unit_and_reference_range() -> None:
    page = row(20, "Hemoglobin", "10.4", "g/dL", "12.0-15.5")

    observations = parse_observations([page], [(1000, 1200)], 0.95)

    assert len(observations) == 1
    assert observations[0].normalizedLabel == "Hemoglobin"
    assert observations[0].numericValue == 10.4
    assert observations[0].unit == "g/dL"
    assert observations[0].referenceRangeRaw == "12.0-15.5"
    assert observations[0].derivedRangeFlag == "BELOW_REPORTED_RANGE"
    assert observations[0].reviewRequired is False


def test_realistic_cbc_table_rejects_metadata_and_keeps_columns() -> None:
    page: list[TextBlock] = []
    page += row(10, "Lab ID", "10912", "Medical ID: 16220")
    page += row(40, "Haemoglobin", "14.1 g/dL", "Men: 14-18 g/dL, Women: 12-16 g/dL")
    page += row(70, "ESR", "25 mm in 1st hr", "Men: 0-10 mm in 1st hr, Women: 0-20 mm in 1st hr")
    page += row(100, "Total WBC Count", "9000 /Cmm", "Adult: 4000-11,000 /Cmm, Child: 5,000-15,500 /Cmm")
    page += row(130, "Neutrophils", "75 %", "40-75 %")
    page += row(160, "Basophils 00%", "<1.0%")
    page += row(190, "Total RBC Count", "4.62 million/Cmm", "M: 4.5-6.5, F: 3.6-5.8 million/Cmm")
    page += row(220, "Total Platelet Count", "1,60,000 /Cmm", "150,000-400,000 /Cmm")

    observations = parse_observations([page], [(1200, 1600)], 0.95)
    by_label = {item.normalizedLabel: item for item in observations}

    assert "Lab ID" not in by_label
    assert by_label["Hemoglobin"].numericValue == 14.1
    assert by_label["ESR"].numericValue == 25
    assert by_label["Basophils"].numericValue == 0
    assert by_label["Basophils"].referenceHigh == 1.0
    assert by_label["Platelets"].numericValue == 160000
    assert by_label["Platelets"].rawValue == "1,60,000"
    assert by_label["Platelets"].referenceLow == 150000
    assert by_label["Platelets"].referenceHigh == 400000
    assert estimate_lab_row_candidates([page]) >= 7
    assert estimate_known_lab_label_mentions([page]) >= 7


def test_demographic_reference_is_preserved_without_guessing_subgroup() -> None:
    page = row(20, "Total RBC Count", "4.62 million/Cmm", "M: 4.5-6.5, F: 3.6-5.8 million/Cmm")
    item = parse_observations([page], [(1000, 1000)], 0.95)[0]

    assert item.normalizedLabel == "Red blood cell count"
    assert item.referenceRangeRaw == "M: 4.5-6.5, F: 3.6-5.8 million/Cmm"
    assert item.referenceLow is None
    assert item.referenceHigh is None
    assert item.derivedRangeFlag is None
    assert item.reviewRequired is True


def test_hplc_and_iron_aliases_are_normalized_without_disease_rules() -> None:
    page: list[TextBlock] = []
    page += row(10, "Hb A2", "5.6 %", "2.0-3.5 %")
    page += row(40, "Hb F", "1.4 %", "<1.0 %")
    page += row(70, "Total Iron-Binding Capacity", "310 ug/dL", "250-450 ug/dL")
    labels = [item.normalizedLabel for item in parse_observations([page], [(1000, 1000)], 0.95)]
    assert labels == ["HbA2", "HbF", "TIBC"]


def test_explicit_report_sex_and_age_select_matching_report_subrange_but_still_require_review() -> None:
    page: list[TextBlock] = []
    page += row(5, "Sex", "Male")
    page += row(25, "Age", "24 Years")
    page += row(60, "Haemoglobin", "14.1 g/dL", "Men: 14-18 g/dL, Women: 12-16 g/dL")
    page += row(90, "ESR", "25 mm in 1st hr", "Men: 0-10 mm in 1st hr, Women: 0-20 mm in 1st hr")
    page += row(120, "Total WBC Count", "9000 /Cmm", "Adult: 4000-11,000 /Cmm, Child: 5,000-15,500 /Cmm")

    by_label = {item.normalizedLabel: item for item in parse_observations([page], [(1200, 1600)], 0.95)}
    hb = by_label["Hemoglobin"]
    esr = by_label["ESR"]
    wbc = by_label["White blood cell count"]

    assert (hb.referenceLow, hb.referenceHigh, hb.derivedRangeFlag) == (14.0, 18.0, "WITHIN_REPORTED_RANGE")
    assert (esr.referenceLow, esr.referenceHigh, esr.derivedRangeFlag) == (0.0, 10.0, "ABOVE_REPORTED_RANGE")
    assert (wbc.referenceLow, wbc.referenceHigh, wbc.derivedRangeFlag) == (4000.0, 11000.0, "WITHIN_REPORTED_RANGE")
    assert hb.reviewRequired and esr.reviewRequired and wbc.reviewRequired


def test_method_suffix_and_long_form_hour_unit_preserve_esr_row() -> None:
    page = row(
        20,
        "ESR (Westergren)",
        "25 mm in 1st hours",
        "Men: 0-10, Women: 0-20 mm in 1st hours",
    )

    item = parse_observations([page], [(1000, 1000)], 0.95)[0]

    assert item.normalizedLabel == "ESR"
    assert item.rawValue == "25"
    assert item.numericValue == 25
    assert item.unit == "mm in 1st hours"


def test_ocr_ordinal_glyph_confusion_does_not_drop_complete_row() -> None:
    page = row(
        20,
        "ESR (Westergren)",
        "25 mm in Ist hours",
        "Men:0-10.Women:0-20mm in 1sthours",
    )

    item = parse_observations([page], [(1000, 1000)], 0.95)[0]

    assert item.normalizedLabel == "ESR"
    assert item.rawValue == "25"
    assert item.numericValue == 25
    assert item.referenceRangeRaw == "Men:0-10.Women:0-20mm in 1sthours"


def test_tall_next_label_cannot_bridge_adjacent_table_rows() -> None:
    page = [
        block("First analyte", 40, 814, 120, 26),
        block("9.3L", 317, 822, 47, 25),
        block("7.0-11.0L", 452, 826, 80, 21),
        block("Second analyte", 44, 837, 120, 29),
        block("0.14%", 314, 849, 47, 19),
        block("0.1-0.2%", 453, 850, 80, 18),
    ]

    from app.parser_v3 import _group_rows

    grouped = _group_rows(page)

    assert [[cell.text for cell in cells] for cells in grouped] == [
        ["First analyte", "9.3L", "7.0-11.0L"],
        ["Second analyte", "0.14%", "0.1-0.2%"],
    ]


def test_same_row_reference_supports_conservative_unit_repairs() -> None:
    page: list[TextBlock] = []
    page += row(20, "Haemoglobin", "14.1 g/d1", "12-16 g/dl")
    page += row(50, "MCV", "83.5 L", "76.00-96.00 fL")
    page += row(80, "MCHC", "36.5 g/dLl.", "32.00-36.00 g/dL")

    by_label = {item.normalizedLabel: item for item in parse_observations([page], [(1000, 1000)], 0.95)}

    assert by_label["Hemoglobin"].unit == "g/dl"
    assert by_label["MCV"].unit == "fL"
    assert by_label["MCHC"].unit == "g/dL"


def test_unsafe_unit_repair_is_not_applied_and_requires_review() -> None:
    page = row(20, "MCV", "83.5 mg", "76.00-96.00 fL")

    item = parse_observations([page], [(1000, 1000)], 0.95)[0]

    assert item.unit == "mg"
    assert item.reviewRequired is True


def test_multiple_known_analytes_in_one_label_are_detected_generically() -> None:
    assert recognized_lab_labels("PCT MPV") == ["Plateletcrit", "MPV"]
    assert recognized_lab_labels("Total RBC Count") == ["Red blood cell count"]


def test_assisted_result_that_duplicates_a_reference_range_is_ignored() -> None:
    assert observation_from_assisted_row({
        "label": "Eosinophils",
        "value": "1-6",
        "unit": "%",
        "referenceRange": "1-6 %",
    }, 1) is None
