package com.clinora.access.service;

import com.clinora.access.domain.DoctorInterview;
import com.clinora.notifications.email.EmailDeliveryPort;
import com.clinora.notifications.email.TransactionalEmail;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import org.springframework.stereotype.Service;

@Service
public class DoctorInterviewMailService {
    private static final DateTimeFormatter DISPLAY_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm z");

    private final EmailDeliveryPort emailDeliveryPort;

    public DoctorInterviewMailService(EmailDeliveryPort emailDeliveryPort) {
        this.emailDeliveryPort = emailDeliveryPort;
    }

    public void sendScheduled(String to, String firstName, DoctorInterview interview) {
        sendInterviewMessage(
            to,
            "Clinora Doctor interview scheduled",
            firstName,
            "Your mandatory Doctor onboarding interview has been scheduled.",
            interview
        );
    }

    public void sendRescheduled(String to, String firstName, DoctorInterview interview) {
        sendInterviewMessage(
            to,
            "Clinora Doctor interview rescheduled",
            firstName,
            "Your mandatory Doctor onboarding interview has been rescheduled.",
            interview
        );
    }

    public void sendCancelled(String to, String firstName, DoctorInterview interview) {
        String text = "Hi " + firstName + ", your Clinora Doctor onboarding interview has been cancelled. "
            + "Return to your secure applicant portal for the latest application status.";
        String html = "<p>Hi " + escape(firstName) + ",</p>"
            + "<p>Your Clinora Doctor onboarding interview has been cancelled.</p>"
            + "<p>Return to your secure applicant portal for the latest application status.</p>";
        emailDeliveryPort.send(new TransactionalEmail(to, "Clinora Doctor interview cancelled", text, html));
    }

    public void sendReminder(String to, String firstName, DoctorInterview interview) {
        sendInterviewMessage(
            to,
            "Clinora Doctor interview reminder",
            firstName,
            "This is a reminder for your upcoming mandatory Doctor onboarding interview.",
            interview
        );
    }

    private void sendInterviewMessage(String to, String subject, String firstName, String introduction, DoctorInterview interview) {
        String when = displayTime(interview);
        String instructions = interview.getApplicantInstructions() == null || interview.getApplicantInstructions().isBlank()
            ? ""
            : " Instructions: " + interview.getApplicantInstructions();
        String text = "Hi " + firstName + ", " + introduction + " "
            + "When: " + when + ". Duration: " + interview.getDurationMinutes() + " minutes. "
            + "Provider: " + interview.getMeetingProvider() + ". Join: " + interview.getMeetingUrl() + "."
            + instructions;
        String html = "<p>Hi " + escape(firstName) + ",</p>"
            + "<p>" + escape(introduction) + "</p>"
            + "<p><strong>When:</strong> " + escape(when) + "<br>"
            + "<strong>Duration:</strong> " + interview.getDurationMinutes() + " minutes<br>"
            + "<strong>Provider:</strong> " + escape(interview.getMeetingProvider().name()) + "</p>"
            + "<p><a href=\"" + escape(interview.getMeetingUrl()) + "\">Join interview</a></p>"
            + (interview.getApplicantInstructions() == null || interview.getApplicantInstructions().isBlank()
                ? ""
                : "<p>" + escape(interview.getApplicantInstructions()) + "</p>");
        emailDeliveryPort.send(new TransactionalEmail(to, subject, text, html));
    }

    private String displayTime(DoctorInterview interview) {
        return DISPLAY_TIME.format(interview.getScheduledStartUtc().atZone(ZoneId.of(interview.getTimezone())));
    }

    private String escape(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace("\"", "&quot;").replace("'", "&#39;");
    }
}
