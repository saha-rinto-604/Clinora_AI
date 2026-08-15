package com.clinora.access.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.clinora.access.api.AccessApplicationException;
import com.clinora.access.domain.AccessApplication;
import com.clinora.access.domain.ApplicationDocument;
import com.clinora.access.domain.ApplicationDocumentType;
import com.clinora.access.domain.ApplicationEvent;
import com.clinora.access.domain.ApplicationEventType;
import com.clinora.access.domain.ApplicationReviewNote;
import com.clinora.access.domain.ApplicationStatus;
import com.clinora.access.domain.ApplicationType;
import com.clinora.access.domain.DoctorApplicationDetail;
import com.clinora.access.domain.ResearcherApplicationDetail;
import com.clinora.access.repository.AccessApplicationRepository;
import com.clinora.access.repository.ApplicationDocumentRepository;
import com.clinora.access.repository.ApplicationEventRepository;
import com.clinora.access.repository.ApplicationReviewNoteRepository;
import com.clinora.access.repository.DoctorApplicationDetailRepository;
import com.clinora.access.repository.DoctorQualificationRepository;
import com.clinora.access.repository.ResearcherApplicationDetailRepository;
import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

class AdminAccessReviewServiceTest {
    private static final Instant NOW = Instant.parse("2026-08-15T12:00:00Z");
    private static final UUID REVIEWER_ID = UUID.randomUUID();

    @Test
    void queueReturnsOnlyReviewSummaryAndSupportsFiltersAndPagination() {
        Fixture fixture = new Fixture();
        AccessApplication submitted = application(ApplicationType.DOCTOR, ApplicationStatus.SUBMITTED);
        when(fixture.applications.findReviewQueue(any(), eq(ApplicationType.DOCTOR), eq(ApplicationStatus.SUBMITTED), any(Pageable.class)))
            .thenAnswer(invocation -> new PageImpl<>(List.of(submitted), invocation.getArgument(3), 1));

        var page = fixture.service.queue(ApplicationType.DOCTOR, ApplicationStatus.SUBMITTED, 0, 10);

        assertEquals(1, page.totalItems());
        assertEquals(submitted.getId(), page.items().get(0).id());
        assertEquals("doctor@example.test", page.items().get(0).email());
        assertThrows(AccessApplicationException.class, () -> fixture.service.queue(null, ApplicationStatus.DRAFT, 0, 10));
    }

    @Test
    void detailRendersDoctorAndResearcherWithoutSecurityFields() {
        Fixture fixture = new Fixture();
        AccessApplication doctor = application(ApplicationType.DOCTOR, ApplicationStatus.SUBMITTED);
        AccessApplication researcher = application(ApplicationType.RESEARCHER, ApplicationStatus.UNDER_REVIEW);
        when(fixture.applications.findById(doctor.getId())).thenReturn(Optional.of(doctor));
        when(fixture.applications.findById(researcher.getId())).thenReturn(Optional.of(researcher));
        when(fixture.doctorDetails.findById(doctor.getId())).thenReturn(Optional.of(new DoctorApplicationDetail(doctor.getId())));
        when(fixture.researcherDetails.findById(researcher.getId())).thenReturn(Optional.of(new ResearcherApplicationDetail(researcher.getId())));

        var doctorView = fixture.service.detail(doctor.getId());
        var researcherView = fixture.service.detail(researcher.getId());

        assertEquals(ApplicationType.DOCTOR, doctorView.applicationType());
        assertEquals(ApplicationType.RESEARCHER, researcherView.applicationType());
        assertTrue(doctorView.internalNotes().isEmpty());
        assertTrue(researcherView.documents().isEmpty());
        assertThrows(AccessApplicationException.class, () -> fixture.service.detail(UUID.randomUUID()));
    }

    @Test
    void startReviewMovesSubmittedApplicationAndAuditsActor() {
        Fixture fixture = new Fixture();
        AccessApplication app = application(ApplicationType.DOCTOR, ApplicationStatus.SUBMITTED);
        when(fixture.applications.findByIdForReviewUpdate(app.getId())).thenReturn(Optional.of(app));
        when(fixture.doctorDetails.findById(app.getId())).thenReturn(Optional.of(new DoctorApplicationDetail(app.getId())));

        var result = fixture.service.startReview(app.getId(), REVIEWER_ID, "127.0.0.1", "JUnit");

        assertEquals(ApplicationStatus.UNDER_REVIEW, result.status());
        verify(fixture.events).save(any(ApplicationEvent.class));
        verify(fixture.audit).record(
            eq(REVIEWER_ID),
            eq(AuthAuditAction.APPLICATION_REVIEW_STARTED),
            eq(AuthAuditOutcome.SUCCESS),
            eq("127.0.0.1"),
            eq("JUnit"),
            eq(app.getId().toString()),
            eq("type=DOCTOR")
        );
    }

    @Test
    void startReviewRejectsInvalidTransitionButIsIdempotentForUnderReview() {
        Fixture fixture = new Fixture();
        AccessApplication draft = application(ApplicationType.DOCTOR, ApplicationStatus.DRAFT);
        AccessApplication underReview = application(ApplicationType.DOCTOR, ApplicationStatus.UNDER_REVIEW);
        when(fixture.applications.findByIdForReviewUpdate(draft.getId())).thenReturn(Optional.of(draft));
        when(fixture.applications.findByIdForReviewUpdate(underReview.getId())).thenReturn(Optional.of(underReview));
        when(fixture.doctorDetails.findById(underReview.getId())).thenReturn(Optional.of(new DoctorApplicationDetail(underReview.getId())));

        assertThrows(
            AccessApplicationException.class,
            () -> fixture.service.startReview(draft.getId(), REVIEWER_ID, null, null)
        );
        var result = fixture.service.startReview(underReview.getId(), REVIEWER_ID, null, null);
        assertEquals(ApplicationStatus.UNDER_REVIEW, result.status());
        verify(fixture.events, never()).save(any());
    }

    @Test
    void addInternalNoteRecordsReviewerAndDoesNotCreateApplicantEvent() {
        Fixture fixture = new Fixture();
        AccessApplication app = application(ApplicationType.RESEARCHER, ApplicationStatus.UNDER_REVIEW);
        when(fixture.applications.findById(app.getId())).thenReturn(Optional.of(app));
        when(fixture.researcherDetails.findById(app.getId())).thenReturn(Optional.of(new ResearcherApplicationDetail(app.getId())));
        when(fixture.notes.save(any(ApplicationReviewNote.class))).thenAnswer(invocation -> invocation.getArgument(0));

        fixture.service.addNote(app.getId(), REVIEWER_ID, "Needs institutional verification.", null, null);

        ArgumentCaptor<ApplicationReviewNote> note = ArgumentCaptor.forClass(ApplicationReviewNote.class);
        verify(fixture.notes).save(note.capture());
        assertEquals(REVIEWER_ID, note.getValue().getReviewerUserId());
        assertEquals("Needs institutional verification.", note.getValue().getText());
        verify(fixture.events, never()).save(any());
        assertThrows(
            AccessApplicationException.class,
            () -> fixture.service.addNote(app.getId(), REVIEWER_ID, " ", null, null)
        );
    }

    @Test
    void requestMoreInformationMovesStateAndCreatesApplicantVisibleEvent() {
        Fixture fixture = new Fixture();
        AccessApplication app = application(ApplicationType.RESEARCHER, ApplicationStatus.UNDER_REVIEW);
        when(fixture.applications.findByIdForReviewUpdate(app.getId())).thenReturn(Optional.of(app));
        when(fixture.researcherDetails.findById(app.getId())).thenReturn(Optional.of(new ResearcherApplicationDetail(app.getId())));

        var result = fixture.service.requestMoreInformation(
            app.getId(),
            REVIEWER_ID,
            "Please provide updated institutional evidence.",
            null,
            null
        );

        assertEquals(ApplicationStatus.MORE_INFO_REQUIRED, result.status());
        ArgumentCaptor<ApplicationEvent> event = ArgumentCaptor.forClass(ApplicationEvent.class);
        verify(fixture.events).save(event.capture());
        assertEquals(ApplicationEventType.MORE_INFO_REQUESTED, event.getValue().getEventType());
        assertEquals("Please provide updated institutional evidence.", event.getValue().getPublicMessage());
        verify(fixture.audit).record(
            eq(REVIEWER_ID),
            eq(AuthAuditAction.APPLICATION_MORE_INFO_REQUESTED),
            eq(AuthAuditOutcome.SUCCESS),
            isNull(),
            isNull(),
            eq(app.getId().toString()),
            eq("type=RESEARCHER")
        );
    }

    @Test
    void requestMoreInformationRejectsTerminalOrEditableStates() {
        Fixture fixture = new Fixture();
        AccessApplication app = application(ApplicationType.DOCTOR, ApplicationStatus.MORE_INFO_REQUIRED);
        when(fixture.applications.findByIdForReviewUpdate(app.getId())).thenReturn(Optional.of(app));

        assertThrows(
            AccessApplicationException.class,
            () -> fixture.service.requestMoreInformation(app.getId(), REVIEWER_ID, "More docs.", null, null)
        );
    }

    @Test
    void detailExposesDocumentMetadataWithoutStorageKeys() {
        Fixture fixture = new Fixture();
        AccessApplication app = application(ApplicationType.DOCTOR, ApplicationStatus.SUBMITTED);
        ApplicationDocument document = new ApplicationDocument(
            app.getId(),
            ApplicationDocumentType.CV,
            "applications/private/storage-key.pdf",
            "cv.pdf",
            "application/pdf",
            120,
            "checksum",
            NOW
        );
        when(fixture.applications.findById(app.getId())).thenReturn(Optional.of(app));
        when(fixture.doctorDetails.findById(app.getId())).thenReturn(Optional.of(new DoctorApplicationDetail(app.getId())));
        when(fixture.documents.findAllByApplicationIdOrderByCreatedAt(app.getId())).thenReturn(List.of(document));

        var detail = fixture.service.detail(app.getId());

        assertEquals("cv.pdf", detail.documents().get(0).originalFilename());
        assertFalse(detail.documents().toString().contains("storage-key"));
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

    private static class Fixture {
        AccessApplicationRepository applications = mock(AccessApplicationRepository.class);
        DoctorApplicationDetailRepository doctorDetails = mock(DoctorApplicationDetailRepository.class);
        ResearcherApplicationDetailRepository researcherDetails = mock(ResearcherApplicationDetailRepository.class);
        DoctorQualificationRepository qualifications = mock(DoctorQualificationRepository.class);
        ApplicationDocumentRepository documents = mock(ApplicationDocumentRepository.class);
        ApplicationEventRepository events = mock(ApplicationEventRepository.class);
        ApplicationReviewNoteRepository notes = mock(ApplicationReviewNoteRepository.class);
        AuthAuditService audit = mock(AuthAuditService.class);
        AdminAccessReviewService service = new AdminAccessReviewService(
            applications,
            doctorDetails,
            researcherDetails,
            qualifications,
            documents,
            events,
            notes,
            audit,
            Clock.fixed(NOW, ZoneOffset.UTC)
        );
    }
}
