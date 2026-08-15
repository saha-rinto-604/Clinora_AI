package com.clinora.access.service;

import com.clinora.access.domain.ApplicationEvent;
import com.clinora.access.domain.ApplicationEventType;
import com.clinora.access.domain.DoctorInterviewReminderStatus;
import com.clinora.access.repository.AccessApplicationRepository;
import com.clinora.access.repository.ApplicationEventRepository;
import com.clinora.access.repository.DoctorInterviewReminderRepository;
import com.clinora.access.repository.DoctorInterviewRepository;
import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import java.time.Clock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DoctorInterviewReminderService {
    private final DoctorInterviewReminderRepository reminders;
    private final DoctorInterviewRepository interviews;
    private final AccessApplicationRepository applications;
    private final DoctorInterviewMailService mail;
    private final ApplicationEventRepository events;
    private final AuthAuditService audit;
    private final Clock clock;

    public DoctorInterviewReminderService(
        DoctorInterviewReminderRepository reminders,
        DoctorInterviewRepository interviews,
        AccessApplicationRepository applications,
        DoctorInterviewMailService mail,
        ApplicationEventRepository events,
        AuthAuditService audit,
        Clock clock
    ) {
        this.reminders = reminders;
        this.interviews = interviews;
        this.applications = applications;
        this.mail = mail;
        this.events = events;
        this.audit = audit;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${clinora.access-applications.interview-reminder-scan-delay-ms:60000}")
    @Transactional
    public void deliverDueReminders() {
        var now = clock.instant();
        var due = reminders.findTop50ByStatusAndDueAtLessThanEqualOrderByDueAtAsc(
            DoctorInterviewReminderStatus.PENDING,
            now
        );
        for (var reminder : due) {
            var interview = interviews.findById(reminder.getInterviewId()).orElse(null);
            if (interview == null
                || !interview.getStatus().isScheduledState()
                || interview.getScheduledStartUtc() == null
                || !interview.getScheduledStartUtc().equals(reminder.getScheduledStartUtc())
                || !interview.getScheduledStartUtc().isAfter(now)) {
                continue;
            }
            var application = applications.findById(interview.getApplicationId()).orElse(null);
            if (application == null) {
                continue;
            }
            try {
                mail.sendReminder(application.getEmail(), application.getFirstName(), interview);
            } catch (RuntimeException ignored) {
                // Leave the reminder PENDING so a later scan can retry after email delivery recovers.
                continue;
            }
            reminder.markSent(now);
            events.save(new ApplicationEvent(
                application.getId(),
                ApplicationEventType.DOCTOR_INTERVIEW_REMINDER_SENT,
                "A reminder was sent for your upcoming Doctor interview.",
                now
            ));
            audit.record(
                null,
                AuthAuditAction.DOCTOR_INTERVIEW_REMINDER_SENT,
                AuthAuditOutcome.SUCCESS,
                null,
                null,
                application.getId().toString(),
                "type=DOCTOR;offsetMinutes=" + reminder.getOffsetMinutes()
            );
        }
    }
}
