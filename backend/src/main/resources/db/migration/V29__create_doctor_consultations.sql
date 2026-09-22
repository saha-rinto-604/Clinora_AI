CREATE TABLE doctor_consultations (
    id UUID PRIMARY KEY,
    appointment_id UUID NOT NULL UNIQUE,
    doctor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    patient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(24) NOT NULL DEFAULT 'IN_PROGRESS',
    history_notes TEXT,
    findings_notes TEXT,
    assessment TEXT,
    plan TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT ck_doctor_consultation_status CHECK (status IN ('IN_PROGRESS', 'COMPLETED')),
    CONSTRAINT ck_doctor_consultation_completion CHECK (
        (status = 'IN_PROGRESS' AND completed_at IS NULL)
        OR (status = 'COMPLETED' AND completed_at IS NOT NULL)
    ),
    CONSTRAINT fk_doctor_consultation_appointment_owner
        FOREIGN KEY (appointment_id, patient_user_id, doctor_user_id)
        REFERENCES appointments(id, patient_user_id, doctor_user_id) ON DELETE RESTRICT
);

CREATE INDEX ix_doctor_consultations_doctor_status
    ON doctor_consultations (doctor_user_id, status, started_at DESC);

CREATE INDEX ix_doctor_consultations_patient_completed
    ON doctor_consultations (patient_user_id, completed_at DESC)
    WHERE status = 'COMPLETED';

COMMENT ON TABLE doctor_consultations IS
    'Doctor-authored encounter record. Appointment remains scheduling/logistics; this table stores clinical documentation.';
