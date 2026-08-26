package com.clinora.access.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.clinora.access.domain.AccessApplication;
import com.clinora.access.domain.ApplicationType;
import com.clinora.access.domain.DoctorInterview;
import com.clinora.access.domain.DoctorInterviewReminder;
import com.clinora.access.domain.DoctorInterviewReminderStatus;
import com.clinora.access.domain.InterviewMeetingProvider;
import com.clinora.access.repository.AccessApplicationRepository;
import com.clinora.access.repository.ApplicationEventRepository;
import com.clinora.access.repository.DoctorInterviewReminderRepository;
import com.clinora.access.repository.DoctorInterviewRepository;
import com.clinora.audit.AuthAuditService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class DoctorInterviewReminderServiceTest {
    private static final Instant NOW = Instant.parse("2026-08-15T12:00:00Z");

    @Test
    void dueReminderSendsOnceAndMarksPersistentState() {
        DoctorInterviewReminderRepository reminders = mock(DoctorInterviewReminderRepository.class);
        DoctorInterviewRepository interviews = mock(DoctorInterviewRepository.class);
        AccessApplicationRepository applications = mock(AccessApplicationRepository.class);
        DoctorInterviewMailService mail = mock(DoctorInterviewMailService.class);
        ApplicationEventRepository events = mock(ApplicationEventRepository.class);
        AuthAuditService audit = mock(AuthAuditService.class);
        DoctorInterviewReminderService service = new DoctorInterviewReminderService(
            reminders, interviews, applications, mail, events, audit, Clock.fixed(NOW, ZoneOffset.UTC)
        );

        UUID applicationId = UUID.randomUUID();
        DoctorInterview interview = new DoctorInterview(applicationId, NOW.minusSeconds(3600));
        UUID interviewId = UUID.randomUUID();
        ReflectionTestUtils.setField(interview, "id", interviewId);
        interview.schedule(
            NOW.plusSeconds(3600), "UTC", 30, InterviewMeetingProvider.GOOGLE_MEET,
            "https://meet.google.com/test", null, UUID.randomUUID(), NOW.minusSeconds(1800)
        );
        DoctorInterviewReminder reminder = new DoctorInterviewReminder(
            interviewId, interview.getScheduledStartUtc(), 60, NOW.minusSeconds(1), NOW.minusSeconds(3600)
        );
        AccessApplication application = new AccessApplication(
            ApplicationType.DOCTOR, "Dora", "Applicant", "doctor@example.test", "doctor@example.test",
            "+15555550123", "US", NOW.minusSeconds(7200)
        );
        ReflectionTestUtils.setField(application, "id", applicationId);

        when(reminders.findTop50ByStatusAndDueAtLessThanEqualOrderByDueAtAsc(DoctorInterviewReminderStatus.PENDING, NOW))
            .thenReturn(List.of(reminder));
        when(interviews.findById(interviewId)).thenReturn(Optional.of(interview));
        when(applications.findById(applicationId)).thenReturn(Optional.of(application));

        service.deliverDueReminders();

        verify(mail).sendReminder(eq("doctor@example.test"), eq("Dora"), eq(interview));
        verify(events).save(any());
        assertEquals(DoctorInterviewReminderStatus.SENT, reminder.getStatus());
    }
}
