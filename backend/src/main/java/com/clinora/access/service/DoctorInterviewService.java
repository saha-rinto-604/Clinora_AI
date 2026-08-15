package com.clinora.access.service;

import com.clinora.access.api.AccessApplicationException;
import com.clinora.access.domain.AccessApplication;
import com.clinora.access.domain.ApplicationEvent;
import com.clinora.access.domain.ApplicationEventType;
import com.clinora.access.domain.ApplicationStatus;
import com.clinora.access.domain.ApplicationType;
import com.clinora.access.domain.DoctorInterview;
import com.clinora.access.domain.DoctorInterviewReminder;
import com.clinora.access.domain.DoctorInterviewReminderStatus;
import com.clinora.access.domain.DoctorInterviewStatus;
import com.clinora.access.domain.InterviewMeetingProvider;
import com.clinora.access.repository.AccessApplicationRepository;
import com.clinora.access.repository.ApplicationEventRepository;
import com.clinora.access.repository.DoctorInterviewReminderRepository;
import com.clinora.access.repository.DoctorInterviewRepository;
import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.config.AccessApplicationProperties;
import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.zone.ZoneRulesException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DoctorInterviewService {
    private static final int MIN_DURATION_MINUTES = 15;
    private static final int MAX_DURATION_MINUTES = 180;
    private static final int MAX_INSTRUCTIONS_LENGTH = 2000;
    private static final int MAX_RESCHEDULE_MESSAGE_LENGTH = 500;
    private static final int MAX_CANCELLATION_REASON_LENGTH = 500;

    private final AccessApplicationRepository applications;
    private final DoctorInterviewRepository interviews;
    private final DoctorInterviewReminderRepository reminders;
    private final ApplicationEventRepository events;
    private final DoctorInterviewMailService mail;
    private final AuthAuditService audit;
    private final AccessApplicationProperties properties;
    private final Clock clock;

    public DoctorInterviewService(
        AccessApplicationRepository applications,
        DoctorInterviewRepository interviews,
        DoctorInterviewReminderRepository reminders,
        ApplicationEventRepository events,
        DoctorInterviewMailService mail,
        AuthAuditService audit,
        AccessApplicationProperties properties,
        Clock clock
    ) {
        this.applications = applications;
        this.interviews = interviews;
        this.reminders = reminders;
        this.events = events;
        this.mail = mail;
        this.audit = audit;
        this.properties = properties;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Optional<DoctorInterviewModels.InterviewView> adminView(UUID applicationId) {
        AccessApplication application = requireDoctorApplication(applicationId, false);
        return interviews.findByApplicationId(application.getId()).map(interview -> view(interview, true));
    }

    @Transactional(readOnly = true)
    public Optional<DoctorInterviewModels.InterviewView> applicantView(UUID applicationId) {
        AccessApplication application = requireDoctorApplication(applicationId, false);
        return interviews.findByApplicationId(application.getId()).map(interview -> view(interview, false));
    }

    @Transactional
    public void requireInterview(UUID applicationId, UUID reviewerUserId, String ip, String userAgent) {
        AccessApplication application = requireDoctorApplication(applicationId, true);
        if (application.getStatus() == ApplicationStatus.INTERVIEW_REQUIRED) {
            return;
        }
        if (application.getStatus() != ApplicationStatus.UNDER_REVIEW) {
            throw AccessApplicationException.invalidInterviewTransition(
                "A Doctor interview can only be required after professional review has started."
            );
        }
        Instant now = clock.instant();
        application.moveToReviewStatus(ApplicationStatus.INTERVIEW_REQUIRED, now);
        events.save(new ApplicationEvent(
            applicationId,
            ApplicationEventType.DOCTOR_INTERVIEW_REQUIRED,
            "Your Doctor application has reached the mandatory interview stage. Scheduling details will follow.",
            now
        ));
        audit(reviewerUserId, AuthAuditAction.DOCTOR_INTERVIEW_REQUIRED, applicationId, ip, userAgent, "type=DOCTOR");
    }

    @Transactional
    public DoctorInterviewModels.InterviewView schedule(
        UUID applicationId,
        UUID reviewerUserId,
        DoctorInterviewModels.ScheduleInput input,
        String ip,
        String userAgent
    ) {
        AccessApplication application = requireDoctorApplication(applicationId, true);
        if (application.getStatus() != ApplicationStatus.INTERVIEW_REQUIRED) {
            throw AccessApplicationException.invalidInterviewTransition(
                "A Doctor interview can only be scheduled when the application is interview-required."
            );
        }
        ValidatedSchedule schedule = validateSchedule(input);
        Instant now = clock.instant();
        DoctorInterview interview = interviews.findByApplicationIdForUpdate(applicationId)
            .orElseGet(() -> new DoctorInterview(applicationId, now));
        if (!(interview.getStatus() == DoctorInterviewStatus.CANCELLED || interview.getStatus() == DoctorInterviewStatus.NO_SHOW)) {
            throw AccessApplicationException.invalidInterviewTransition("This Doctor application already has an active interview.");
        }
        interview.schedule(
            schedule.startUtc(),
            schedule.timezone(),
            schedule.durationMinutes(),
            schedule.provider(),
            schedule.meetingUrl(),
            schedule.instructions(),
            reviewerUserId,
            now
        );
        interview = interviews.save(interview);
        application.moveToReviewStatus(ApplicationStatus.INTERVIEW_SCHEDULED, now);
        replacePendingReminders(interview, now);
        events.save(new ApplicationEvent(
            applicationId,
            ApplicationEventType.DOCTOR_INTERVIEW_SCHEDULED,
            "Your mandatory Doctor interview has been scheduled. Open the secure interview panel for private meeting details.",
            now
        ));
        mail.sendScheduled(application.getEmail(), application.getFirstName(), interview);
        audit(reviewerUserId, AuthAuditAction.DOCTOR_INTERVIEW_SCHEDULED, applicationId, ip, userAgent, safeScheduleMetadata(interview));
        return view(interview, true);
    }

    @Transactional
    public DoctorInterviewModels.InterviewView reschedule(
        UUID applicationId,
        UUID reviewerUserId,
        DoctorInterviewModels.ScheduleInput input,
        String ip,
        String userAgent
    ) {
        AccessApplication application = requireDoctorApplication(applicationId, true);
        if (application.getStatus() != ApplicationStatus.INTERVIEW_SCHEDULED) {
            throw AccessApplicationException.invalidInterviewTransition("Only a scheduled Doctor interview can be rescheduled.");
        }
        DoctorInterview interview = interviews.findByApplicationIdForUpdate(applicationId)
            .orElseThrow(AccessApplicationException::interviewNotFound);
        if (!interview.getStatus().isScheduledState()) {
            throw AccessApplicationException.invalidInterviewTransition("This interview cannot be rescheduled from its current state.");
        }
        ValidatedSchedule schedule = validateSchedule(input);
        Instant now = clock.instant();
        interview.reschedule(
            schedule.startUtc(),
            schedule.timezone(),
            schedule.durationMinutes(),
            schedule.provider(),
            schedule.meetingUrl(),
            schedule.instructions(),
            reviewerUserId,
            now
        );
        replacePendingReminders(interview, now);
        events.save(new ApplicationEvent(
            applicationId,
            ApplicationEventType.DOCTOR_INTERVIEW_RESCHEDULED,
            "Your mandatory Doctor interview schedule has been updated. Open the secure interview panel for current details.",
            now
        ));
        mail.sendRescheduled(application.getEmail(), application.getFirstName(), interview);
        audit(reviewerUserId, AuthAuditAction.DOCTOR_INTERVIEW_RESCHEDULED, applicationId, ip, userAgent, safeScheduleMetadata(interview));
        return view(interview, true);
    }

    @Transactional
    public DoctorInterviewModels.InterviewView cancel(
        UUID applicationId,
        UUID reviewerUserId,
        String reason,
        String ip,
        String userAgent
    ) {
        AccessApplication application = requireDoctorApplication(applicationId, true);
        if (application.getStatus() != ApplicationStatus.INTERVIEW_SCHEDULED) {
            throw AccessApplicationException.invalidInterviewTransition("Only a scheduled Doctor interview can be cancelled.");
        }
        DoctorInterview interview = interviews.findByApplicationIdForUpdate(applicationId)
            .orElseThrow(AccessApplicationException::interviewNotFound);
        String safeReason = optionalText(reason, MAX_CANCELLATION_REASON_LENGTH);
        Instant now = clock.instant();
        try {
            interview.cancel(safeReason, now);
        } catch (IllegalStateException exception) {
            throw AccessApplicationException.invalidInterviewTransition(exception.getMessage());
        }
        application.moveToReviewStatus(ApplicationStatus.INTERVIEW_REQUIRED, now);
        reminders.deleteAllByInterviewIdAndStatus(interview.getId(), DoctorInterviewReminderStatus.PENDING);
        events.save(new ApplicationEvent(
            applicationId,
            ApplicationEventType.DOCTOR_INTERVIEW_CANCELLED,
            "Your Doctor interview has been cancelled. Clinora will provide a new schedule if the application continues.",
            now
        ));
        mail.sendCancelled(application.getEmail(), application.getFirstName(), interview);
        audit(reviewerUserId, AuthAuditAction.DOCTOR_INTERVIEW_CANCELLED, applicationId, ip, userAgent, "type=DOCTOR");
        return view(interview, true);
    }

    @Transactional
    public DoctorInterviewModels.InterviewView complete(
        UUID applicationId,
        UUID reviewerUserId,
        String ip,
        String userAgent
    ) {
        AccessApplication application = requireDoctorApplication(applicationId, true);
        DoctorInterview interview = requireScheduledInterview(application, applicationId);
        Instant now = clock.instant();
        requireInterviewHasStarted(interview, now);
        try {
            interview.complete(now);
        } catch (IllegalStateException exception) {
            throw AccessApplicationException.invalidInterviewTransition(exception.getMessage());
        }
        application.moveToReviewStatus(ApplicationStatus.INTERVIEW_COMPLETED, now);
        reminders.deleteAllByInterviewIdAndStatus(interview.getId(), DoctorInterviewReminderStatus.PENDING);
        events.save(new ApplicationEvent(
            applicationId,
            ApplicationEventType.DOCTOR_INTERVIEW_COMPLETED,
            "Your mandatory Doctor interview is complete. Your application is awaiting a later review decision.",
            now
        ));
        audit(reviewerUserId, AuthAuditAction.DOCTOR_INTERVIEW_COMPLETED, applicationId, ip, userAgent, "type=DOCTOR");
        return view(interview, true);
    }

    @Transactional
    public DoctorInterviewModels.InterviewView noShow(
        UUID applicationId,
        UUID reviewerUserId,
        String ip,
        String userAgent
    ) {
        AccessApplication application = requireDoctorApplication(applicationId, true);
        DoctorInterview interview = requireScheduledInterview(application, applicationId);
        Instant now = clock.instant();
        requireInterviewHasStarted(interview, now);
        try {
            interview.markNoShow(now);
        } catch (IllegalStateException exception) {
            throw AccessApplicationException.invalidInterviewTransition(exception.getMessage());
        }
        application.moveToReviewStatus(ApplicationStatus.INTERVIEW_REQUIRED, now);
        reminders.deleteAllByInterviewIdAndStatus(interview.getId(), DoctorInterviewReminderStatus.PENDING);
        events.save(new ApplicationEvent(
            applicationId,
            ApplicationEventType.DOCTOR_INTERVIEW_NO_SHOW,
            "The scheduled Doctor interview was marked as not attended. Clinora will contact you if rescheduling is available.",
            now
        ));
        audit(reviewerUserId, AuthAuditAction.DOCTOR_INTERVIEW_NO_SHOW, applicationId, ip, userAgent, "type=DOCTOR");
        return view(interview, true);
    }

    @Transactional
    public DoctorInterviewModels.InterviewView requestReschedule(
        UUID applicationId,
        String message,
        String ip,
        String userAgent
    ) {
        AccessApplication application = requireDoctorApplication(applicationId, true);
        if (application.getStatus() != ApplicationStatus.INTERVIEW_SCHEDULED) {
            throw AccessApplicationException.invalidInterviewTransition("There is no scheduled Doctor interview available for reschedule request.");
        }
        DoctorInterview interview = interviews.findByApplicationIdForUpdate(applicationId)
            .orElseThrow(AccessApplicationException::interviewNotFound);
        String requestMessage = requireText(message, MAX_RESCHEDULE_MESSAGE_LENGTH, "Reschedule request");
        Instant now = clock.instant();
        try {
            interview.requestReschedule(requestMessage, now);
        } catch (IllegalStateException exception) {
            throw AccessApplicationException.invalidInterviewTransition(exception.getMessage());
        }
        events.save(new ApplicationEvent(
            applicationId,
            ApplicationEventType.DOCTOR_INTERVIEW_RESCHEDULE_REQUESTED,
            "Your interview reschedule request has been received. The current schedule remains authoritative until Clinora updates it.",
            now
        ));
        audit(null, AuthAuditAction.DOCTOR_INTERVIEW_RESCHEDULE_REQUESTED, applicationId, ip, userAgent, "type=DOCTOR");
        return view(interview, false);
    }

    private AccessApplication requireDoctorApplication(UUID applicationId, boolean lock) {
        AccessApplication application = (lock
            ? applications.findByIdForReviewUpdate(applicationId)
            : applications.findById(applicationId))
            .orElseThrow(AccessApplicationException::notFound);
        if (application.getApplicationType() != ApplicationType.DOCTOR) {
            throw AccessApplicationException.validation("Researcher applications do not use interviews.");
        }
        return application;
    }

    private DoctorInterview requireScheduledInterview(AccessApplication application, UUID applicationId) {
        if (application.getStatus() != ApplicationStatus.INTERVIEW_SCHEDULED) {
            throw AccessApplicationException.invalidInterviewTransition("The Doctor application does not have a scheduled interview.");
        }
        DoctorInterview interview = interviews.findByApplicationIdForUpdate(applicationId)
            .orElseThrow(AccessApplicationException::interviewNotFound);
        if (!(interview.getStatus() == DoctorInterviewStatus.SCHEDULED || interview.getStatus() == DoctorInterviewStatus.RESCHEDULED)) {
            throw AccessApplicationException.invalidInterviewTransition("The Doctor interview cannot be finalized from its current state.");
        }
        return interview;
    }

    private void requireInterviewHasStarted(DoctorInterview interview, Instant now) {
        if (interview.getScheduledStartUtc() == null || now.isBefore(interview.getScheduledStartUtc())) {
            throw AccessApplicationException.invalidInterviewTransition("The interview cannot be finalized before its scheduled start time.");
        }
    }

    private ValidatedSchedule validateSchedule(DoctorInterviewModels.ScheduleInput input) {
        if (input == null || input.scheduledLocalDateTime() == null) {
            throw AccessApplicationException.validation("Interview date and time are required.");
        }
        String timezone = requireText(input.timezone(), 80, "Interview timezone");
        ZoneId zone;
        try {
            zone = ZoneId.of(timezone);
        } catch (ZoneRulesException exception) {
            throw AccessApplicationException.validation("Interview timezone must be a valid IANA timezone.");
        }
        LocalDateTime local = input.scheduledLocalDateTime();
        List<ZoneOffset> offsets = zone.getRules().getValidOffsets(local);
        if (offsets.size() != 1) {
            throw AccessApplicationException.validation(
                "Interview time is ambiguous or does not exist in the selected timezone. Choose another local time."
            );
        }
        Instant startUtc = local.toInstant(offsets.getFirst());
        if (!startUtc.isAfter(clock.instant())) {
            throw AccessApplicationException.validation("Interview must be scheduled in the future.");
        }
        int duration = input.durationMinutes() == null
            ? Math.toIntExact(properties.getInterviewDefaultDuration().toMinutes())
            : input.durationMinutes();
        if (duration < MIN_DURATION_MINUTES || duration > MAX_DURATION_MINUTES) {
            throw AccessApplicationException.validation("Interview duration must be between 15 and 180 minutes.");
        }
        if (input.meetingProvider() == null) {
            throw AccessApplicationException.validation("Meeting provider is required.");
        }
        String meetingUrl = requireHttpsUrl(input.meetingUrl());
        String instructions = optionalText(input.instructions(), MAX_INSTRUCTIONS_LENGTH);
        return new ValidatedSchedule(startUtc, zone.getId(), duration, input.meetingProvider(), meetingUrl, instructions);
    }

    private String requireHttpsUrl(String raw) {
        String value = requireText(raw, 1000, "Meeting URL");
        try {
            URI uri = URI.create(value);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getHost().isBlank()) {
                throw new IllegalArgumentException();
            }
            return uri.toString();
        } catch (IllegalArgumentException exception) {
            throw AccessApplicationException.validation("Meeting URL must be a valid HTTPS URL.");
        }
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

    private String optionalText(String text, int maxLength) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String trimmed = text.trim();
        if (trimmed.length() > maxLength) {
            throw AccessApplicationException.validation("Text exceeds the maximum supported length.");
        }
        return trimmed;
    }

    private void replacePendingReminders(DoctorInterview interview, Instant now) {
        reminders.deleteAllByInterviewIdAndStatus(interview.getId(), DoctorInterviewReminderStatus.PENDING);
        for (Duration offset : properties.getInterviewReminderOffsets()) {
            long minutes = offset.toMinutes();
            if (minutes <= 0 || minutes > Integer.MAX_VALUE) {
                continue;
            }
            Instant dueAt = interview.getScheduledStartUtc().minus(offset);
            if (dueAt.isAfter(now)) {
                reminders.save(new DoctorInterviewReminder(
                    interview.getId(),
                    interview.getScheduledStartUtc(),
                    Math.toIntExact(minutes),
                    dueAt,
                    now
                ));
            }
        }
    }

    private String safeScheduleMetadata(DoctorInterview interview) {
        return "type=DOCTOR;provider=" + interview.getMeetingProvider()
            + ";timezone=" + interview.getTimezone()
            + ";durationMinutes=" + interview.getDurationMinutes();
    }

    private void audit(UUID actor, AuthAuditAction action, UUID applicationId, String ip, String userAgent, String metadata) {
        audit.record(actor, action, AuthAuditOutcome.SUCCESS, ip, userAgent, applicationId.toString(), metadata);
    }

    private DoctorInterviewModels.InterviewView view(DoctorInterview interview, boolean includeReviewerIdentity) {
        return new DoctorInterviewModels.InterviewView(
            interview.getId(),
            interview.getStatus(),
            interview.getScheduledStartUtc(),
            interview.getTimezone(),
            interview.getDurationMinutes(),
            interview.getMeetingProvider(),
            interview.getMeetingUrl(),
            interview.getApplicantInstructions(),
            includeReviewerIdentity ? interview.getScheduledByUserId() : null,
            interview.getRescheduleRequestedAt(),
            interview.getRescheduleRequestMessage(),
            interview.getRescheduledAt(),
            interview.getCancelledAt(),
            interview.getCancellationReason(),
            interview.getCompletedAt(),
            interview.getNoShowAt(),
            interview.getUpdatedAt()
        );
    }

    private record ValidatedSchedule(
        Instant startUtc,
        String timezone,
        int durationMinutes,
        InterviewMeetingProvider provider,
        String meetingUrl,
        String instructions
    ) {}
}
