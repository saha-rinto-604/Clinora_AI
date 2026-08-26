CREATE TABLE doctor_interviews (
    id UUID PRIMARY KEY,
    application_id UUID NOT NULL UNIQUE REFERENCES access_applications(id) ON DELETE CASCADE,
    scheduled_start_utc TIMESTAMPTZ,
    timezone VARCHAR(80),
    duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 15 AND 180),
    status VARCHAR(32) NOT NULL CHECK (status IN (
        'SCHEDULED','RESCHEDULE_REQUESTED','RESCHEDULED','CANCELLED','COMPLETED','NO_SHOW'
    )),
    meeting_provider VARCHAR(32) CHECK (meeting_provider IS NULL OR meeting_provider IN ('GOOGLE_MEET','ZOOM','OTHER')),
    meeting_url VARCHAR(1000),
    applicant_instructions VARCHAR(2000),
    scheduled_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reschedule_requested_at TIMESTAMPTZ,
    reschedule_request_message VARCHAR(500),
    rescheduled_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason VARCHAR(500),
    completed_at TIMESTAMPTZ,
    no_show_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_doctor_interviews_status_start
    ON doctor_interviews(status, scheduled_start_utc);

CREATE TABLE doctor_interview_reminders (
    id UUID PRIMARY KEY,
    interview_id UUID NOT NULL REFERENCES doctor_interviews(id) ON DELETE CASCADE,
    scheduled_start_utc TIMESTAMPTZ NOT NULL,
    offset_minutes INTEGER NOT NULL CHECK (offset_minutes > 0),
    due_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(24) NOT NULL CHECK (status IN ('PENDING','SENT')),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_doctor_interview_reminder_schedule UNIQUE (interview_id, scheduled_start_utc, offset_minutes)
);

CREATE INDEX idx_doctor_interview_reminders_due
    ON doctor_interview_reminders(status, due_at);
