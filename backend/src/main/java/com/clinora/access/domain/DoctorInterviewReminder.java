package com.clinora.access.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "doctor_interview_reminders")
public class DoctorInterviewReminder {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "interview_id", nullable = false)
    private UUID interviewId;

    @Column(name = "scheduled_start_utc", nullable = false)
    private Instant scheduledStartUtc;

    @Column(name = "offset_minutes", nullable = false)
    private int offsetMinutes;

    @Column(name = "due_at", nullable = false)
    private Instant dueAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private DoctorInterviewReminderStatus status;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected DoctorInterviewReminder() {}

    public DoctorInterviewReminder(UUID interviewId, Instant scheduledStartUtc, int offsetMinutes, Instant dueAt, Instant now) {
        this.interviewId = interviewId;
        this.scheduledStartUtc = scheduledStartUtc;
        this.offsetMinutes = offsetMinutes;
        this.dueAt = dueAt;
        this.status = DoctorInterviewReminderStatus.PENDING;
        this.createdAt = now;
    }

    public void markSent(Instant now) {
        this.status = DoctorInterviewReminderStatus.SENT;
        this.sentAt = now;
    }

    public UUID getId() { return id; }
    public UUID getInterviewId() { return interviewId; }
    public Instant getScheduledStartUtc() { return scheduledStartUtc; }
    public int getOffsetMinutes() { return offsetMinutes; }
    public Instant getDueAt() { return dueAt; }
    public DoctorInterviewReminderStatus getStatus() { return status; }
    public Instant getSentAt() { return sentAt; }
}
