CREATE TABLE consultation_prescriptions (
    id UUID PRIMARY KEY,
    consultation_id UUID NOT NULL REFERENCES doctor_consultations(id) ON DELETE RESTRICT,
    position INTEGER NOT NULL,
    medication_name VARCHAR(180) NOT NULL,
    strength VARCHAR(120),
    dose VARCHAR(120),
    route VARCHAR(120),
    frequency VARCHAR(160),
    duration VARCHAR(160),
    instructions VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_consultation_prescription_position CHECK (position >= 0),
    CONSTRAINT ck_consultation_prescription_name CHECK (btrim(medication_name) <> ''),
    CONSTRAINT uq_consultation_prescription_position UNIQUE (consultation_id, position)
);

CREATE TABLE consultation_investigations (
    id UUID PRIMARY KEY,
    consultation_id UUID NOT NULL REFERENCES doctor_consultations(id) ON DELETE RESTRICT,
    position INTEGER NOT NULL,
    test_name VARCHAR(180) NOT NULL,
    reason VARCHAR(1000),
    instructions VARCHAR(1000),
    priority VARCHAR(16) NOT NULL DEFAULT 'ROUTINE',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_consultation_investigation_position CHECK (position >= 0),
    CONSTRAINT ck_consultation_investigation_name CHECK (btrim(test_name) <> ''),
    CONSTRAINT ck_consultation_investigation_priority CHECK (priority IN ('ROUTINE', 'URGENT')),
    CONSTRAINT uq_consultation_investigation_position UNIQUE (consultation_id, position)
);

CREATE TABLE consultation_follow_ups (
    id UUID PRIMARY KEY,
    consultation_id UUID NOT NULL UNIQUE REFERENCES doctor_consultations(id) ON DELETE RESTRICT,
    recommended_date DATE NOT NULL,
    reason VARCHAR(1000),
    instructions VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX ix_consultation_follow_ups_date
    ON consultation_follow_ups (recommended_date, consultation_id);

COMMENT ON TABLE consultation_prescriptions IS
    'Structured Doctor-authored medication instructions. No autonomous medication or dosage recommendation is generated.';
COMMENT ON TABLE consultation_investigations IS
    'Structured Doctor-requested investigations linked to a consultation.';
COMMENT ON TABLE consultation_follow_ups IS
    'Doctor follow-up recommendation linked to a consultation and reusable by the Patient booking workflow.';
