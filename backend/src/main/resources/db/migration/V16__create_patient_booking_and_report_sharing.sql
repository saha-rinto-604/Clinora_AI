CREATE TABLE doctor_booking_profiles (
    doctor_user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
    application_id UUID NOT NULL UNIQUE REFERENCES access_applications(id) ON DELETE RESTRICT,
    display_name VARCHAR(260) NOT NULL,
    professional_title VARCHAR(160),
    specialization VARCHAR(180) NOT NULL,
    years_experience INTEGER CHECK (years_experience IS NULL OR years_experience >= 0),
    current_organization VARCHAR(220),
    current_position VARCHAR(180),
    registration_jurisdiction VARCHAR(160),
    registration_authority VARCHAR(220),
    registration_type VARCHAR(120),
    registration_valid_until DATE,
    booking_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_doctor_booking_display_name CHECK (btrim(display_name) <> ''),
    CONSTRAINT ck_doctor_booking_specialization CHECK (btrim(specialization) <> '')
);

CREATE INDEX ix_doctor_booking_search
    ON doctor_booking_profiles (booking_enabled, specialization, display_name);

INSERT INTO doctor_booking_profiles (
    doctor_user_id,
    application_id,
    display_name,
    professional_title,
    specialization,
    years_experience,
    current_organization,
    current_position,
    registration_jurisdiction,
    registration_authority,
    registration_type,
    registration_valid_until,
    booking_enabled,
    created_at,
    updated_at
)
SELECT
    u.id,
    a.id,
    concat_ws(' ', a.first_name, a.last_name),
    d.professional_title,
    d.specialization,
    d.years_experience,
    d.current_organization,
    d.current_position,
    d.registration_jurisdiction,
    d.registration_authority,
    d.registration_type,
    d.registration_valid_until,
    TRUE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM users u
JOIN LATERAL (
    SELECT candidate.*
    FROM access_applications candidate
    WHERE candidate.normalized_email = u.normalized_email
      AND candidate.application_type = 'DOCTOR'
      AND candidate.status = 'ACTIVATED'
    ORDER BY candidate.updated_at DESC, candidate.id DESC
    LIMIT 1
) a ON TRUE
JOIN doctor_application_details d ON d.application_id = a.id
WHERE u.role = 'DOCTOR'
  AND u.account_status = 'ACTIVE'
  AND u.email_verified_at IS NOT NULL
  AND d.specialization IS NOT NULL
  AND btrim(d.specialization) <> ''
ON CONFLICT (doctor_user_id) DO NOTHING;

CREATE TABLE doctor_availability_slots (
    id UUID PRIMARY KEY,
    doctor_user_id UUID NOT NULL REFERENCES doctor_booking_profiles(doctor_user_id) ON DELETE RESTRICT,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    timezone VARCHAR(80) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'AVAILABLE',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT ck_doctor_slot_time CHECK (ends_at > starts_at),
    CONSTRAINT ck_doctor_slot_status CHECK (status IN ('AVAILABLE','BOOKED','BLOCKED')),
    CONSTRAINT uq_doctor_slot UNIQUE (doctor_user_id, starts_at, ends_at),
    CONSTRAINT uq_doctor_slot_identity UNIQUE (id, doctor_user_id)
);

CREATE INDEX ix_doctor_slots_discovery
    ON doctor_availability_slots (doctor_user_id, status, starts_at);

CREATE TABLE appointments (
    id UUID PRIMARY KEY,
    patient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    doctor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    slot_id UUID NOT NULL,
    status VARCHAR(24) NOT NULL,
    reason_for_visit VARCHAR(500),
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,
    booking_timezone VARCHAR(80) NOT NULL,
    idempotency_key VARCHAR(120) NOT NULL,
    booked_at TIMESTAMPTZ NOT NULL,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason VARCHAR(240),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT ck_appointment_time CHECK (scheduled_end > scheduled_start),
    CONSTRAINT ck_appointment_status CHECK (status IN ('BOOKED','CANCELLED','COMPLETED')),
    CONSTRAINT uq_patient_appointment_idempotency UNIQUE (patient_user_id, idempotency_key),
    CONSTRAINT uq_appointment_owner_scope UNIQUE (id, patient_user_id, doctor_user_id),
    CONSTRAINT fk_appointment_slot_doctor
        FOREIGN KEY (slot_id, doctor_user_id)
        REFERENCES doctor_availability_slots(id, doctor_user_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX uq_active_booked_slot
    ON appointments (slot_id)
    WHERE status = 'BOOKED';

CREATE INDEX ix_patient_appointments_start
    ON appointments (patient_user_id, scheduled_start DESC);
CREATE INDEX ix_doctor_appointments_start
    ON appointments (doctor_user_id, scheduled_start DESC);

ALTER TABLE patient_medical_reports
    ADD CONSTRAINT uq_patient_medical_reports_owner UNIQUE (id, patient_user_id);

CREATE TABLE appointment_report_shares (
    id UUID PRIMARY KEY,
    appointment_id UUID NOT NULL,
    report_id UUID NOT NULL,
    patient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    doctor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    shared_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_appointment_report_share UNIQUE (appointment_id, report_id),
    CONSTRAINT fk_report_share_appointment_owner
        FOREIGN KEY (appointment_id, patient_user_id, doctor_user_id)
        REFERENCES appointments(id, patient_user_id, doctor_user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_report_share_report_owner
        FOREIGN KEY (report_id, patient_user_id)
        REFERENCES patient_medical_reports(id, patient_user_id) ON DELETE RESTRICT
);

CREATE INDEX ix_report_shares_active_doctor
    ON appointment_report_shares (doctor_user_id, appointment_id, report_id)
    WHERE revoked_at IS NULL;
CREATE INDEX ix_report_shares_patient
    ON appointment_report_shares (patient_user_id, appointment_id, shared_at DESC);

