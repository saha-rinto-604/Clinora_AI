package com.clinora.access.service;

import com.clinora.access.domain.DoctorInterviewStatus;
import com.clinora.access.domain.InterviewMeetingProvider;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

public final class DoctorInterviewModels {
    private DoctorInterviewModels() {}

    public record ScheduleInput(
        LocalDateTime scheduledLocalDateTime,
        String timezone,
        Integer durationMinutes,
        InterviewMeetingProvider meetingProvider,
        String meetingUrl,
        String instructions
    ) {}

    public record InterviewView(
        UUID id,
        DoctorInterviewStatus status,
        Instant scheduledStartUtc,
        String timezone,
        Integer durationMinutes,
        InterviewMeetingProvider meetingProvider,
        String meetingUrl,
        String instructions,
        UUID scheduledByUserId,
        Instant rescheduleRequestedAt,
        String rescheduleRequestMessage,
        Instant rescheduledAt,
        Instant cancelledAt,
        String cancellationReason,
        Instant completedAt,
        Instant noShowAt,
        Instant updatedAt
    ) {}
}
