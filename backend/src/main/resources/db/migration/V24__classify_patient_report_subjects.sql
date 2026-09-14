ALTER TABLE patient_medical_reports
    ADD COLUMN subject_type VARCHAR(16) NOT NULL DEFAULT 'SELF',
    ADD COLUMN subject_label VARCHAR(120) NULL;

ALTER TABLE patient_medical_reports
    ADD CONSTRAINT ck_patient_medical_reports_subject_type
        CHECK (subject_type IN ('SELF', 'OTHER')),
    ADD CONSTRAINT ck_patient_medical_reports_subject_label
        CHECK (
            (subject_type = 'SELF' AND subject_label IS NULL)
            OR
            (subject_type = 'OTHER' AND subject_label IS NOT NULL AND btrim(subject_label) <> '')
        );

CREATE INDEX ix_patient_medical_reports_owner_subject_collection
    ON patient_medical_reports (patient_user_id, subject_type, archived_at, report_date DESC, created_at DESC);

COMMENT ON COLUMN patient_medical_reports.subject_type IS
    'SELF contributes to the account holder health record; OTHER is an isolated report uploaded for another person.';
COMMENT ON COLUMN patient_medical_reports.subject_label IS
    'Patient-provided private label for OTHER reports, such as Mother or Family member. Never required for SELF.';
