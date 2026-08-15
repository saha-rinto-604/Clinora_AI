package com.clinora.access.domain;

public enum DoctorInterviewStatus {
    SCHEDULED,
    RESCHEDULE_REQUESTED,
    RESCHEDULED,
    CANCELLED,
    COMPLETED,
    NO_SHOW;

    public boolean isScheduledState() {
        return this == SCHEDULED || this == RESCHEDULED || this == RESCHEDULE_REQUESTED;
    }
}
