package com.clinora.access.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "doctor_interviews")
public class DoctorInterview {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "application_id", nullable = false, unique = true)
    private UUID applicationId;

    @Column(name = "scheduled_start_utc")
    private Instant scheduledStartUtc;

    @Column(length = 80)
    private String timezone;

    @Column(name = "duration_minutes")
    private Integer durationMinutes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private DoctorInterviewStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "meeting_provider", length = 32)
    private InterviewMeetingProvider meetingProvider;

    @Column(name = "meeting_url", length = 1000)
    private String meetingUrl;

    @Column(name = "applicant_instructions", length = 2000)
    private String applicantInstructions;

    @Column(name = "scheduled_by_user_id")
    private UUID scheduledByUserId;

    @Column(name = "reschedule_requested_at")
    private Instant rescheduleRequestedAt;

    @Column(name = "reschedule_request_message", length = 500)
    private String rescheduleRequestMessage;

    @Column(name = "rescheduled_at")
    private Instant rescheduledAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "cancellation_reason", length = 500)
    private String cancellationReason;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "no_show_at")
    private Instant noShowAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version @Column(nullable = false)
    private long version;

    protected DoctorInterview() {}

    public DoctorInterview(UUID applicationId, Instant now) {
        this.applicationId = applicationId;
        this.status = DoctorInterviewStatus.CANCELLED;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void schedule(
        Instant scheduledStartUtc,
        String timezone,
        int durationMinutes,
        InterviewMeetingProvider meetingProvider,
        String meetingUrl,
        String applicantInstructions,
        UUID scheduledByUserId,
        Instant now
    ) {
        this.scheduledStartUtc = scheduledStartUtc;
        this.timezone = timezone;
        this.durationMinutes = durationMinutes;
        this.meetingProvider = meetingProvider;
        this.meetingUrl = meetingUrl;
        this.applicantInstructions = applicantInstructions;
        this.scheduledByUserId = scheduledByUserId;
        this.status = DoctorInterviewStatus.SCHEDULED;
        this.rescheduleRequestedAt = null;
        this.rescheduleRequestMessage = null;
        this.cancelledAt = null;
        this.cancellationReason = null;
        this.completedAt = null;
        this.noShowAt = null;
        this.updatedAt = now;
    }

    public void requestReschedule(String message, Instant now) {
        if (!(status == DoctorInterviewStatus.SCHEDULED || status == DoctorInterviewStatus.RESCHEDULED)) {
            throw new IllegalStateException("Interview cannot request rescheduling from its current state.");
        }
        status = DoctorInterviewStatus.RESCHEDULE_REQUESTED;
        rescheduleRequestedAt = now;
        rescheduleRequestMessage = message;
        updatedAt = now;
    }

    public void reschedule(
        Instant scheduledStartUtc,
        String timezone,
        int durationMinutes,
        InterviewMeetingProvider meetingProvider,
        String meetingUrl,
        String applicantInstructions,
        UUID scheduledByUserId,
        Instant now
    ) {
        if (!status.isScheduledState()) {
            throw new IllegalStateException("Interview cannot be rescheduled from its current state.");
        }
        this.scheduledStartUtc = scheduledStartUtc;
        this.timezone = timezone;
        this.durationMinutes = durationMinutes;
        this.meetingProvider = meetingProvider;
        this.meetingUrl = meetingUrl;
        this.applicantInstructions = applicantInstructions;
        this.scheduledByUserId = scheduledByUserId;
        this.status = DoctorInterviewStatus.RESCHEDULED;
        this.rescheduleRequestedAt = null;
        this.rescheduleRequestMessage = null;
        this.rescheduledAt = now;
        this.cancelledAt = null;
        this.cancellationReason = null;
        this.updatedAt = now;
    }

    public void cancel(String reason, Instant now) {
        if (!status.isScheduledState()) {
            throw new IllegalStateException("Interview cannot be cancelled from its current state.");
        }
        status = DoctorInterviewStatus.CANCELLED;
        cancellationReason = reason;
        cancelledAt = now;
        updatedAt = now;
    }

    public void complete(Instant now) {
        if (!(status == DoctorInterviewStatus.SCHEDULED || status == DoctorInterviewStatus.RESCHEDULED)) {
            throw new IllegalStateException("Interview cannot be completed from its current state.");
        }
        status = DoctorInterviewStatus.COMPLETED;
        completedAt = now;
        updatedAt = now;
    }

    public void markNoShow(Instant now) {
        if (!(status == DoctorInterviewStatus.SCHEDULED || status == DoctorInterviewStatus.RESCHEDULED)) {
            throw new IllegalStateException("Interview cannot be marked no-show from its current state.");
        }
        status = DoctorInterviewStatus.NO_SHOW;
        noShowAt = now;
        updatedAt = now;
    }

    public UUID getId() { return id; }
    public UUID getApplicationId() { return applicationId; }
    public Instant getScheduledStartUtc() { return scheduledStartUtc; }
    public String getTimezone() { return timezone; }
    public Integer getDurationMinutes() { return durationMinutes; }
    public DoctorInterviewStatus getStatus() { return status; }
    public InterviewMeetingProvider getMeetingProvider() { return meetingProvider; }
    public String getMeetingUrl() { return meetingUrl; }
    public String getApplicantInstructions() { return applicantInstructions; }
    public UUID getScheduledByUserId() { return scheduledByUserId; }
    public Instant getRescheduleRequestedAt() { return rescheduleRequestedAt; }
    public String getRescheduleRequestMessage() { return rescheduleRequestMessage; }
    public Instant getRescheduledAt() { return rescheduledAt; }
    public Instant getCancelledAt() { return cancelledAt; }
    public String getCancellationReason() { return cancellationReason; }
    public Instant getCompletedAt() { return completedAt; }
    public Instant getNoShowAt() { return noShowAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
