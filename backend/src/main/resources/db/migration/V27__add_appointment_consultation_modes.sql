ALTER TABLE doctor_availability_slots
    ADD COLUMN consultation_mode VARCHAR(16) NOT NULL DEFAULT 'BOTH';

ALTER TABLE doctor_availability_slots
    ADD CONSTRAINT chk_doctor_availability_consultation_mode
        CHECK (consultation_mode IN ('ONLINE', 'IN_PERSON', 'BOTH'));

ALTER TABLE appointments
    ADD COLUMN consultation_mode VARCHAR(16),
    ADD COLUMN meeting_url VARCHAR(2048),
    ADD COLUMN meeting_link_updated_at TIMESTAMPTZ,
    ADD COLUMN visit_location VARCHAR(500);

ALTER TABLE appointments
    ADD CONSTRAINT chk_appointment_consultation_mode
        CHECK (consultation_mode IS NULL OR consultation_mode IN ('ONLINE', 'IN_PERSON')),
    ADD CONSTRAINT chk_appointment_mode_details
        CHECK (
            (consultation_mode = 'ONLINE' AND visit_location IS NULL)
            OR (consultation_mode = 'IN_PERSON' AND meeting_url IS NULL AND meeting_link_updated_at IS NULL)
            OR consultation_mode IS NULL
        );

COMMENT ON COLUMN appointments.consultation_mode IS
    'NULL only for legacy appointments created before consultation modes were recorded.';
