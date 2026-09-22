ALTER TABLE doctor_consultations
    ADD CONSTRAINT uq_doctor_consultations_identity
    UNIQUE (id, doctor_user_id, patient_user_id);

CREATE TABLE consultation_prescription_documents (
    id UUID PRIMARY KEY,
    consultation_id UUID NOT NULL,
    doctor_user_id UUID NOT NULL,
    patient_user_id UUID NOT NULL,
    position SMALLINT NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    object_key VARCHAR(512) NOT NULL UNIQUE,
    mime_type VARCHAR(80) NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256_checksum CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_prescription_document_consultation_identity
        FOREIGN KEY (consultation_id, doctor_user_id, patient_user_id)
        REFERENCES doctor_consultations (id, doctor_user_id, patient_user_id)
        ON DELETE CASCADE,
    CONSTRAINT ck_prescription_document_position
        CHECK (position >= 0 AND position < 5),
    CONSTRAINT ck_prescription_document_size
        CHECK (size_bytes > 0),
    CONSTRAINT uq_prescription_document_position
        UNIQUE (consultation_id, position),
    CONSTRAINT uq_prescription_document_checksum
        UNIQUE (consultation_id, sha256_checksum)
);

CREATE INDEX idx_prescription_document_patient
    ON consultation_prescription_documents (patient_user_id, created_at DESC);

CREATE INDEX idx_prescription_document_doctor
    ON consultation_prescription_documents (doctor_user_id, consultation_id);
