"""Non-PHI acceptance cases shared by parser and real-engine benchmarks."""
from PIL import Image, ImageDraw, ImageFont

CASES = {
    "thyroid_metabolic": (
        ("TSH", "2.10", "mIU/L", "0.40-4.00"),
        ("Free T4", "1.20", "ng/dL", "0.80-1.80"),
        ("Glucose", "92", "mg/dL", "70-100"),
        ("Creatinine", "0.90", "mg/dL", "0.60-1.20"),
    ),
    "normal_cbc": (
        ("Hemoglobin", "14.1", "g/dL", "12.0-16.0"),
        ("WBC", "7000", "/Cmm", "4000-11000"),
        ("Platelets", "1,60,000", "/Cmm", "150000-400000"),
        ("MCV", "90", "fL", "80-100"),
    ),
    "assay_cbc": (
        ("Dengue IgM", "2.95", "", "<1.00"),
        ("Dengue NS1", "Positive", "", ""),
        ("WBC", "3000", "/Cmm", "4000-11000"),
        ("Platelets", "98,000", "/Cmm", "150000-400000"),
        ("Hemoglobin", "10.4", "g/dL", "12.0-16.0"),
        ("Basophils", "0.15", "%", "<1.00"),
        ("PCT", "0.14", "%", "0.10-0.20"),
        ("MPV", ">10", "fL", "7-10"),
    ),
}


def render_case(name: str) -> Image.Image:
    image = Image.new("RGB", (1800, 1600), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=30)
    draw.text((90, 80), "SYNTHETIC LABORATORY ACCEPTANCE FIXTURE", font=font, fill="black")
    rows = (("Test", "Result", "Unit", "Reference range"), *CASES[name])
    columns = (70, 630, 960, 1230, 1710)
    for index, row in enumerate(rows):
        top = 240 + index * 110
        for left, value in zip(columns, row):
            draw.text((left + 20, top + 30), value, font=font, fill="black")
        if name != "thyroid_metabolic":
            draw.line((columns[0], top, columns[-1], top), fill="black", width=2)
    if name != "thyroid_metabolic":
        bottom = 240 + len(rows) * 110
        draw.line((columns[0], bottom, columns[-1], bottom), fill="black", width=2)
        for left in columns:
            draw.line((left, 240, left, bottom), fill="black", width=2)
    return image
