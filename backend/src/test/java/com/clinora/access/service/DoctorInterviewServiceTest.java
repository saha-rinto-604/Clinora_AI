package com.clinora.access.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.clinora.access.api.AccessApplicationException;
import com.clinora.access.domain.AccessApplication;
import com.clinora.access.domain.ApplicationEvent;
import com.clinora.access.domain.ApplicationStatus;
import com.clinora.access.domain.ApplicationType;
import com.clinora.access.domain.DoctorInterview;
import com.clinora.access.domain.DoctorInterviewReminder;
import com.clinora.access.domain.DoctorInterviewStatus;
import com.clinora.access.domain.InterviewMeetingProvider;
import com.clinora.access.repository.AccessApplicationRepository;
import com.clinora.access.repository.ApplicationEventRepository;
import com.clinora.access.repository.DoctorInterviewReminderRepository;
import com.clinora.access.repository.DoctorInterviewRepository;
import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditService;
import com.clinora.config.AccessApplicationProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

class DoctorInterviewServiceTest {
    private static final Instant NOW = Instant.parse("2026-08-15T12:00:00Z");
    private static final UUID REVIEWER_ID = UUID.randomUUID();

    @Test
    void requiresInterviewForReviewedDoctorAndRejectsResearcher() {
        Fixture fixture = new Fixture();
        AccessApplication doctor = application(ApplicationType.DOCTOR, ApplicationStatus.UNDER_REVIEW);
        when(fixture.applications.findByIdForReviewUpdate(doctor.getId())).thenReturn(Optional.of(doctor));

        fixture.service.requireInterview(doctor.getId(), REVIEWER_ID, "127.0.0.1", "JUnit");

        assertEquals(ApplicationStatus.INTERVIEW_REQUIRED, doctor.getStatus());
        verify(fixture.events).save(any(ApplicationEvent.class));
        verify(fixture.audit).record(
            eq(REVIEWER_ID),
            eq(AuthAuditAction.DOCTOR_INTERVIEW_REQUIRED),
            any(), any(), any(), eq(doctor.getId().toString()), eq("type=DOCTOR")
        );

        AccessApplication researcher = application(ApplicationType.RESEARCHER, ApplicationStatus.UNDER_REVIEW);
        when(fixture.applications.findByIdForReviewUpdate(researcher.getId())).thenReturn(Optional.of(researcher));
        assertThrows(
            AccessApplicationException.class,
            () -> fixture.service.requireInterview(researcher.getId(), REVIEWER_ID, null, null)
        );
        assertEquals(ApplicationStatus.UNDER_REVIEW, researcher.getStatus());
    }

    @Test
    void scheduleStoresUtcTimezonePrivateUrlAndCreatesConfiguredReminders() {
        Fixture fixture = new Fixture();
        AccessApplication doctor = application(ApplicationType.DOCTOR, ApplicationStatus.INTERVIEW_REQUIRED);
        when(fixture.applications.findByIdForReviewUpdate(doctor.getId())).thenReturn(Optional.of(doctor));
        when(fixture.interviews.findByApplicationIdForUpdate(doctor.getId())).thenReturn(Optional.empty());
        when(fixture.interviews.save(any(DoctorInterview.class))).thenAnswer(invocation -> {
            DoctorInterview interview = invocation.getArgument(0);
            ReflectionTestUtils.setField(interview, "id", UUID.randomUUID());
            return interview;
        });

        var view = fixture.service.schedule(
            doctor.getId(),
            REVIEWER_ID,
            new DoctorInterviewModels.ScheduleInput(
                LocalDateTime.parse("2026-08-17T18:30:00"),
                "Asia/Dhaka",
                30,
                InterviewMeetingProvider.GOOGLE_MEET,
                "https://meet.google.com/abc-defg-hij",
                "Join five minutes early."
            ),
            "127.0.0.1",
            "JUnit"
        );

        assertEquals(ApplicationStatus.INTERVIEW_SCHEDULED, doctor.getStatus());
        assertEquals(Instant.parse("2026-08-17T12:30:00Z"), view.scheduledStartUtc());
        assertEquals("Asia/Dhaka", view.timezone());
        assertEquals("https://meet.google.com/abc-defg-hij", view.meetingUrl());
        verify(fixture.reminders, org.mockito.Mockito.times(2)).save(any(DoctorInterviewReminder.class));
        verify(fixture.mail).sendScheduled(eq(doctor.getEmail()), eq(doctor.getFirstName()), any(DoctorInterview.class));

        ArgumentCaptor<String> metadata = ArgumentCaptor.forClass(String.class);
        verify(fixture.audit).record(
            eq(REVIEWER_ID),
            eq(AuthAuditAction.DOCTOR_INTERVIEW_SCHEDULED),
            any(), any(), any(), eq(doctor.getId().toString()), metadata.capture()
        );
        assertFalse(metadata.getValue().contains("meet.google.com"));
    }

    @Test
    void scheduleRejectsInvalidTimezoneAndNonHttpsUrl() {
        Fixture fixture = new Fixture();
        AccessApplication doctor = application(ApplicationType.DOCTOR, ApplicationStatus.INTERVIEW_REQUIRED);
        when(fixture.applications.findByIdForReviewUpdate(doctor.getId())).thenReturn(Optional.of(doctor));

        assertThrows(
            AccessApplicationException.class,
            () -> fixture.service.schedule(
                doctor.getId(), REVIEWER_ID,
                new DoctorInterviewModels.ScheduleInput(
                    LocalDateTime.parse("2026-08-17T18:30:00"), "Not/AZone", 30,
                    InterviewMeetingProvider.OTHER, "https://example.test/interview", null
                ), null, null
            )
        );

        assertThrows(
            AccessApplicationException.class,
            () -> fixture.service.schedule(
                doctor.getId(), REVIEWER_ID,
                new DoctorInterviewModels.ScheduleInput(
                    LocalDateTime.parse("2026-08-17T18:30:00"), "UTC", 30,
                    InterviewMeetingProvider.OTHER, "http://example.test/interview", null
                ), null, null
            )
        );
    }

    @Test
    void applicantRescheduleRequestDoesNotOverwriteAuthoritativeSchedule() {
        Fixture fixture = new Fixture();
        AccessApplication doctor = application(ApplicationType.DOCTOR, ApplicationStatus.INTERVIEW_SCHEDULED);
        DoctorInterview interview = scheduledInterview(doctor.getId(), NOW.plus(Duration.ofDays(2)));
        Instant originalStart = interview.getScheduledStartUtc();
        when(fixture.applications.findByIdForReviewUpdate(doctor.getId())).thenReturn(Optional.of(doctor));
        when(fixture.interviews.findByApplicationIdForUpdate(doctor.getId())).thenReturn(Optional.of(interview));

        var result = fixture.service.requestReschedule(
            doctor.getId(),
            "I have a clinical duty conflict.",
            "127.0.0.1",
            "JUnit"
        );

        assertEquals(DoctorInterviewStatus.RESCHEDULE_REQUESTED, result.status());
        assertEquals(originalStart, result.scheduledStartUtc());
        assertEquals(ApplicationStatus.INTERVIEW_SCHEDULED, doctor.getStatus());
        assertEquals("I have a clinical duty conflict.", result.rescheduleRequestMessage());
        assertNull(result.scheduledByUserId());
    }

    @Test
    void completionRequiresStartedInterviewAndMovesOnlyDoctorApplicationState() {
        Fixture fixture = new Fixture();
        AccessApplication doctor = application(ApplicationType.DOCTOR, ApplicationStatus.INTERVIEW_SCHEDULED);
        DoctorInterview future = scheduledInterview(doctor.getId(), NOW.plusSeconds(60));
        when(fixture.applications.findByIdForReviewUpdate(doctor.getId())).thenReturn(Optional.of(doctor));
        when(fixture.interviews.findByApplicationIdForUpdate(doctor.getId())).thenReturn(Optional.of(future));

        assertThrows(
            AccessApplicationException.class,
            () -> fixture.service.complete(doctor.getId(), REVIEWER_ID, null, null)
        );

        DoctorInterview started = scheduledInterview(doctor.getId(), NOW.minusSeconds(60));
        when(fixture.interviews.findByApplicationIdForUpdate(doctor.getId())).thenReturn(Optional.of(started));
        var completed = fixture.service.complete(doctor.getId(), REVIEWER_ID, null, null);

        assertEquals(DoctorInterviewStatus.COMPLETED, completed.status());
        assertEquals(ApplicationStatus.INTERVIEW_COMPLETED, doctor.getStatus());
    }

    @Test
    void applicantViewHardRejectsResearcherInterviewPath() {
        Fixture fixture = new Fixture();
        AccessApplication researcher = application(ApplicationType.RESEARCHER, ApplicationStatus.UNDER_REVIEW);
        when(fixture.applications.findById(researcher.getId())).thenReturn(Optional.of(researcher));

        assertThrows(AccessApplicationException.class, () -> fixture.service.applicantView(researcher.getId()));
    }

    private static AccessApplication application(ApplicationType type, ApplicationStatus status) {
        AccessApplication app = new AccessApplication(
            type,
            type == ApplicationType.DOCTOR ? "Dora" : "Rhea",
            "Applicant",
            type == ApplicationType.DOCTOR ? "doctor@example.test" : "researcher@example.test",
            type == ApplicationType.DOCTOR ? "doctor@example.test" : "researcher@example.test",
            "+15555550123",
            "US",
            NOW.minusSeconds(600)
        );
        ReflectionTestUtils.setField(app, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(app, "status", status);
        ReflectionTestUtils.setField(app, "emailVerifiedAt", NOW.minusSeconds(500));
        ReflectionTestUtils.setField(app, "submittedAt", NOW.minusSeconds(300));
        ReflectionTestUtils.setField(app, "updatedAt", NOW.minusSeconds(100));
        return app;
    }

    private static DoctorInterview scheduledInterview(UUID applicationId, Instant start) {
        DoctorInterview interview = new DoctorInterview(applicationId, NOW.minusSeconds(300));
        ReflectionTestUtils.setField(interview, "id", UUID.randomUUID());
        interview.schedule(
            start,
            "UTC",
            30,
            InterviewMeetingProvider.ZOOM,
            "https://zoom.example.test/j/123",
            "Private instructions",
            REVIEWER_ID,
            NOW.minusSeconds(200)
        );
        return interview;
    }

    private static class Fixture {
        AccessApplicationRepository applications = mock(AccessApplicationRepository.class);
        DoctorInterviewRepository interviews = mock(DoctorInterviewRepository.class);
        DoctorInterviewReminderRepository reminders = mock(DoctorInterviewReminderRepository.class);
        ApplicationEventRepository events = mock(ApplicationEventRepository.class);
        DoctorInterviewMailService mail = mock(DoctorInterviewMailService.class);
        AuthAuditService audit = mock(AuthAuditService.class);
        AccessApplicationProperties properties = new AccessApplicationProperties();
        DoctorInterviewService service = new DoctorInterviewService(
            applications,
            interviews,
            reminders,
            events,
            mail,
            audit,
            properties,
            Clock.fixed(NOW, ZoneOffset.UTC)
        );
    }
}
