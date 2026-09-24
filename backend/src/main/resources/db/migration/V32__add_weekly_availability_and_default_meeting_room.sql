ALTER TABLE doctor_booking_profiles
    ADD COLUMN default_meeting_url VARCHAR(2048),
    ADD COLUMN weekly_routine_version BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN weekly_slot_minutes INTEGER NOT NULL DEFAULT 30,
    ADD CONSTRAINT ck_weekly_slot_minutes CHECK (weekly_slot_minutes BETWEEN 15 AND 120 AND weekly_slot_minutes % 5 = 0);

CREATE TABLE doctor_weekly_availability_rules (
    id UUID PRIMARY KEY,
    doctor_user_id UUID NOT NULL REFERENCES doctor_booking_profiles(doctor_user_id) ON DELETE RESTRICT,
    weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
    local_start_time TIME NOT NULL,
    local_end_time TIME NOT NULL,
    consultation_mode VARCHAR(16) NOT NULL CHECK (consultation_mode IN ('ONLINE', 'IN_PERSON', 'BOTH')),
    slot_minutes INTEGER NOT NULL CHECK (slot_minutes BETWEEN 15 AND 120 AND slot_minutes % 5 = 0),
    timezone VARCHAR(80) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    routine_version BIGINT NOT NULL,
    CONSTRAINT ck_weekly_rule_time CHECK (local_end_time > local_start_time),
    CONSTRAINT uq_weekly_rule_doctor UNIQUE (id, doctor_user_id)
);
CREATE INDEX ix_weekly_rules_doctor ON doctor_weekly_availability_rules (doctor_user_id, routine_version, weekday);
ALTER TABLE doctor_availability_slots ADD COLUMN weekly_rule_id UUID;
ALTER TABLE doctor_availability_slots ADD CONSTRAINT fk_slot_weekly_rule
    FOREIGN KEY (weekly_rule_id, doctor_user_id) REFERENCES doctor_weekly_availability_rules(id, doctor_user_id) ON DELETE RESTRICT;
CREATE INDEX ix_slots_weekly_rule ON doctor_availability_slots (weekly_rule_id) WHERE weekly_rule_id IS NOT NULL;
