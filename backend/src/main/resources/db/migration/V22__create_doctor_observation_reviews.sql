ALTER TABLE appointment_report_shares
    ADD CONSTRAINT uq_appointment_report_share_review_scope
        UNIQUE (appointment_id, report_id, patient_user_id, doctor_user_id);

ALTER TABLE medical_report_extraction_results
    ADD CONSTRAINT uq_medical_report_extraction_result_report
        UNIQUE (id, report_id);

ALTER TABLE medical_report_observations
    ADD CONSTRAINT uq_medical_report_observation_result
        UNIQUE (id, extraction_result_id);

CREATE TABLE doctor_report_reviews (
    id UUID PRIMARY KEY,
    appointment_id UUID NOT NULL,
    report_id UUID NOT NULL,
    patient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    doctor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    first_viewed_at TIMESTAMPTZ NOT NULL,
    last_viewed_at TIMESTAMPTZ NOT NULL,
    last_observation_reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_doctor_report_review UNIQUE (appointment_id, report_id, doctor_user_id),
    CONSTRAINT fk_doctor_report_review_appointment
        FOREIGN KEY (appointment_id, patient_user_id, doctor_user_id)
        REFERENCES appointments(id, patient_user_id, doctor_user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_doctor_report_review_report
        FOREIGN KEY (report_id, patient_user_id)
        REFERENCES patient_medical_reports(id, patient_user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_doctor_report_review_share_scope
        FOREIGN KEY (appointment_id, report_id, patient_user_id, doctor_user_id)
        REFERENCES appointment_report_shares(appointment_id, report_id, patient_user_id, doctor_user_id)
        ON DELETE RESTRICT
);

CREATE INDEX ix_doctor_report_reviews_doctor_appointment
    ON doctor_report_reviews (doctor_user_id, appointment_id, last_viewed_at DESC);

CREATE TABLE medical_report_observation_doctor_reviews (
    id UUID PRIMARY KEY,
    observation_id UUID NOT NULL,
    extraction_result_id UUID NOT NULL,
    appointment_id UUID NOT NULL,
    report_id UUID NOT NULL,
    patient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    doctor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    decision VARCHAR(32) NOT NULL CHECK (decision IN ('CONFIRMED','DISAGREES','NEEDS_SOURCE_REVIEW')),
    comment VARCHAR(1200),
    reviewed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_observation_doctor_appointment UNIQUE (observation_id, doctor_user_id, appointment_id),
    CONSTRAINT fk_observation_review_appointment
        FOREIGN KEY (appointment_id, patient_user_id, doctor_user_id)
        REFERENCES appointments(id, patient_user_id, doctor_user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_observation_review_report
        FOREIGN KEY (report_id, patient_user_id)
        REFERENCES patient_medical_reports(id, patient_user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_observation_review_observation_result
        FOREIGN KEY (observation_id, extraction_result_id)
        REFERENCES medical_report_observations(id, extraction_result_id) ON DELETE RESTRICT,
    CONSTRAINT fk_observation_review_result_report
        FOREIGN KEY (extraction_result_id, report_id)
        REFERENCES medical_report_extraction_results(id, report_id) ON DELETE RESTRICT,
    CONSTRAINT fk_observation_review_share_scope
        FOREIGN KEY (appointment_id, report_id, patient_user_id, doctor_user_id)
        REFERENCES appointment_report_shares(appointment_id, report_id, patient_user_id, doctor_user_id)
        ON DELETE RESTRICT
);

CREATE INDEX ix_observation_doctor_reviews_observation
    ON medical_report_observation_doctor_reviews (observation_id);
CREATE INDEX ix_observation_doctor_reviews_appointment
    ON medical_report_observation_doctor_reviews (appointment_id, doctor_user_id);
CREATE INDEX ix_observation_doctor_reviews_report
    ON medical_report_observation_doctor_reviews (report_id, doctor_user_id);

COMMENT ON TABLE doctor_report_reviews IS
    'Doctor-side provenance for viewing a Patient-shared report within one authorized appointment.';
COMMENT ON TABLE medical_report_observation_doctor_reviews IS
    'Additive Doctor review provenance for Patient-shared structured observations. Patient corrections are never overwritten.';
