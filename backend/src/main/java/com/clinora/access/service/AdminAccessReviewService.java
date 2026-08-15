package com.clinora.access.service;

import com.clinora.access.api.AccessApplicationException;
import com.clinora.access.domain.AccessApplication;
import com.clinora.access.domain.ApplicationEvent;
import com.clinora.access.domain.ApplicationEventType;
import com.clinora.access.domain.ApplicationReviewNote;
import com.clinora.access.domain.ApplicationStatus;
import com.clinora.access.domain.ApplicationType;
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
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminAccessReviewService {
    private static final int MAX_PAGE_SIZE = 50;
    private static final int MAX_NOTE_LENGTH = 2000;
    private static final int MAX_REQUEST_MESSAGE_LENGTH = 500;
    private static final List<ApplicationStatus> REVIEW_QUEUE_STATUSES = List.of(
        ApplicationStatus.SUBMITTED,
        ApplicationStatus.UNDER_REVIEW,
        ApplicationStatus.MORE_INFO_REQUIRED,
        ApplicationStatus.INTERVIEW_REQUIRED,
        ApplicationStatus.INTERVIEW_SCHEDULED,
        ApplicationStatus.INTERVIEW_COMPLETED
    );

    private final AccessApplicationRepository applications;
    private final DoctorApplicationDetailRepository doctorDetails;
    private final ResearcherApplicationDetailRepository researcherDetails;
    private final DoctorQualificationRepository qualifications;
    private final ApplicationDocumentRepository documents;
    private final ApplicationEventRepository events;
    private final ApplicationReviewNoteRepository notes;
    private final AuthAuditService audit;
    private final Clock clock;

    public AdminAccessReviewService(
        AccessApplicationRepository applications,
        DoctorApplicationDetailRepository doctorDetails,
        ResearcherApplicationDetailRepository researcherDetails,
        DoctorQualificationRepository qualifications,
        ApplicationDocumentRepository documents,
        ApplicationEventRepository events,
        ApplicationReviewNoteRepository notes,
        AuthAuditService audit,
        Clock clock
    ) {
        this.applications = applications;
        this.doctorDetails = doctorDetails;
        this.researcherDetails = researcherDetails;
        this.qualifications = qualifications;
        this.documents = documents;
        this.events = events;
        this.notes = notes;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public AdminAccessReviewModels.PageView<AdminAccessReviewModels.QueueItem> queue(
        ApplicationType applicationType,
        ApplicationStatus status,
        int page,
        int size
    ) {
        if (status != null && !REVIEW_QUEUE_STATUSES.contains(status)) {
            throw AccessApplicationException.validation("That status is not available in the review queue.");
        }
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), MAX_PAGE_SIZE);
        var result = applications.findReviewQueue(
            REVIEW_QUEUE_STATUSES,
            applicationType,
            status,
            PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "updatedAt"))
        );
        return new AdminAccessReviewModels.PageView<>(
            result.getContent().stream().map(this::queueItem).toList(),
            result.getNumber(),
            result.getSize(),
            result.getTotalElements(),
            result.getTotalPages()
        );
    }

    @Transactional(readOnly = true)
    public AdminAccessReviewModels.DetailView detail(UUID applicationId) {
        return detailView(applications.findById(applicationId).orElseThrow(AccessApplicationException::notFound));
    }

    @Transactional
    public AdminAccessReviewModels.DetailView startReview(UUID applicationId, UUID reviewerUserId, String ip, String userAgent) {
        AccessApplication app = applications.findByIdForReviewUpdate(applicationId)
            .orElseThrow(AccessApplicationException::notFound);
        if (app.getStatus() == ApplicationStatus.UNDER_REVIEW) {
            return detailView(app);
        }
        if (app.getStatus() != ApplicationStatus.SUBMITTED) {
            throw AccessApplicationException.invalidReviewTransition(
                "Only submitted applications can be moved into review."
            );
        }
        var now = clock.instant();
        app.moveToReviewStatus(ApplicationStatus.UNDER_REVIEW, now);
        events.save(new ApplicationEvent(applicationId, ApplicationEventType.REVIEW_STARTED, "Clinora review has started.", now));
        audit.record(
            reviewerUserId,
            AuthAuditAction.APPLICATION_REVIEW_STARTED,
            AuthAuditOutcome.SUCCESS,
            ip,
            userAgent,
            applicationId.toString(),
            "type=" + app.getApplicationType()
        );
        return detailView(app);
    }

    @Transactional
    public AdminAccessReviewModels.DetailView addNote(
        UUID applicationId,
        UUID reviewerUserId,
        String text,
        String ip,
        String userAgent
    ) {
        AccessApplication app = applications.findById(applicationId).orElseThrow(AccessApplicationException::notFound);
        String noteText = requireText(text, MAX_NOTE_LENGTH, "Internal note");
        notes.save(new ApplicationReviewNote(applicationId, reviewerUserId, noteText, clock.instant()));
        audit.record(
            reviewerUserId,
            AuthAuditAction.APPLICATION_REVIEW_NOTE_ADDED,
            AuthAuditOutcome.SUCCESS,
            ip,
            userAgent,
            applicationId.toString(),
            "type=" + app.getApplicationType()
        );
        return detailView(app);
    }

    @Transactional
    public AdminAccessReviewModels.DetailView requestMoreInformation(
        UUID applicationId,
        UUID reviewerUserId,
        String message,
        String ip,
        String userAgent
    ) {
        AccessApplication app = applications.findByIdForReviewUpdate(applicationId)
            .orElseThrow(AccessApplicationException::notFound);
        if (!(app.getStatus() == ApplicationStatus.SUBMITTED || app.getStatus() == ApplicationStatus.UNDER_REVIEW)) {
            throw AccessApplicationException.invalidReviewTransition(
                "More information can only be requested from submitted or under-review applications."
            );
        }
        String publicMessage = requireText(message, MAX_REQUEST_MESSAGE_LENGTH, "Information request");
        var now = clock.instant();
        app.moveToReviewStatus(ApplicationStatus.MORE_INFO_REQUIRED, now);
        events.save(new ApplicationEvent(applicationId, ApplicationEventType.MORE_INFO_REQUESTED, publicMessage, now));
        audit.record(
            reviewerUserId,
            AuthAuditAction.APPLICATION_MORE_INFO_REQUESTED,
            AuthAuditOutcome.SUCCESS,
            ip,
            userAgent,
            applicationId.toString(),
            "type=" + app.getApplicationType()
        );
        return detailView(app);
    }

    private String requireText(String text, int maxLength, String label) {
        if (text == null || text.isBlank()) {
            throw AccessApplicationException.validation(label + " is required.");
        }
        String trimmed = text.trim();
        if (trimmed.length() > maxLength) {
            throw AccessApplicationException.validation(label + " exceeds the maximum supported length.");
        }
        return trimmed;
    }

    private AdminAccessReviewModels.QueueItem queueItem(AccessApplication app) {
        return new AdminAccessReviewModels.QueueItem(
            app.getId(),
            app.getApplicationType(),
            app.getFirstName(),
            app.getLastName(),
            app.getEmail(),
            app.getStatus(),
            app.getSubmittedAt(),
            app.getUpdatedAt()
        );
    }

    private AdminAccessReviewModels.DetailView detailView(AccessApplication app) {
        var documentViews = documents.findAllByApplicationIdOrderByCreatedAt(app.getId()).stream()
            .map(doc -> new AdminAccessReviewModels.DocumentView(
                doc.getId(),
                doc.getDocumentType(),
                doc.getOriginalFilename(),
                doc.getMimeType(),
                doc.getSizeBytes(),
                doc.getCreatedAt()
            ))
            .toList();
        var eventViews = events.findAllByApplicationIdOrderByCreatedAtDesc(app.getId()).stream()
            .filter(event -> event.getEventType() != ApplicationEventType.EMAIL_VERIFICATION_SENT)
            .map(event -> new AdminAccessReviewModels.EventView(
                event.getEventType().name(),
                event.getPublicMessage(),
                event.getCreatedAt()
            ))
            .toList();
        var noteViews = notes.findAllByApplicationIdOrderByCreatedAtDesc(app.getId()).stream()
            .map(note -> new AdminAccessReviewModels.ReviewNoteView(
                note.getId(),
                note.getReviewerUserId(),
                note.getText(),
                note.getCreatedAt()
            ))
            .toList();

        if (app.getApplicationType() == ApplicationType.DOCTOR) {
            var doctor = doctorDetails.findById(app.getId()).orElseThrow(AccessApplicationException::notFound);
            var qualificationViews = qualifications.findAllByApplicationIdOrderById(app.getId()).stream()
                .map(q -> new AccessApplicationModels.QualificationView(
                    q.getId(),
                    q.getQualificationName(),
                    q.getInstitution(),
                    q.getCountryCode(),
                    q.getCompletionYear()
                ))
                .toList();
            return new AdminAccessReviewModels.DetailView(
                app.getId(),
                app.getApplicationType(),
                app.getFirstName(),
                app.getLastName(),
                app.getEmail(),
                app.getPhone(),
                app.getCountryCode(),
                app.getStatus(),
                app.getEmailVerifiedAt(),
                app.getSubmittedAt(),
                app.getUpdatedAt(),
                new AccessApplicationModels.DoctorDetailView(
                    doctor.getProfessionalTitle(),
                    doctor.getSpecialization(),
                    doctor.getYearsExperience(),
                    doctor.getCurrentOrganization(),
                    doctor.getCurrentPosition(),
                    doctor.getProfessionalProfileUrl(),
                    doctor.getRegistrationJurisdiction(),
                    doctor.getRegistrationAuthority(),
                    doctor.getRegistrationNumber(),
                    doctor.getRegistrationType(),
                    doctor.getRegistrationIssuedAt(),
                    doctor.getRegistrationValidUntil()
                ),
                null,
                qualificationViews,
                documentViews,
                eventViews,
                noteViews,
                allowedNextStatuses(app)
            );
        }

        var researcher = researcherDetails.findById(app.getId()).orElseThrow(AccessApplicationException::notFound);
        return new AdminAccessReviewModels.DetailView(
            app.getId(),
            app.getApplicationType(),
            app.getFirstName(),
            app.getLastName(),
            app.getEmail(),
            app.getPhone(),
            app.getCountryCode(),
            app.getStatus(),
            app.getEmailVerifiedAt(),
            app.getSubmittedAt(),
            app.getUpdatedAt(),
            null,
            new AccessApplicationModels.ResearcherDetailView(
                researcher.getInstitution(),
                researcher.getDepartment(),
                researcher.getProfessionalTitle(),
                researcher.getInstitutionalProfileUrl(),
                researcher.getResearchField(),
                researcher.getResearchPurpose(),
                researcher.getResearchSummary(),
                researcher.getOrcid(),
                researcher.getResearchProfileUrl(),
                researcher.getPublicationProfileUrl(),
                researcher.getEthicsReference(),
                researcher.getProjectApprovalReference()
            ),
            List.of(),
            documentViews,
            eventViews,
            noteViews,
            allowedNextStatuses(app)
        );
    }

    private List<ApplicationStatus> allowedNextStatuses(AccessApplication app) {
        if (app.getStatus() == ApplicationStatus.SUBMITTED) {
            return List.of(ApplicationStatus.UNDER_REVIEW, ApplicationStatus.MORE_INFO_REQUIRED);
        }
        if (app.getStatus() == ApplicationStatus.UNDER_REVIEW) {
            if (app.getApplicationType() == ApplicationType.DOCTOR) {
                return List.of(ApplicationStatus.MORE_INFO_REQUIRED, ApplicationStatus.INTERVIEW_REQUIRED);
            }
            return List.of(ApplicationStatus.MORE_INFO_REQUIRED);
        }
        return List.of();
    }
}
