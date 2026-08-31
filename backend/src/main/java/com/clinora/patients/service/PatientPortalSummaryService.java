package com.clinora.patients.service;

import com.clinora.appointments.service.PatientAppointmentService;
import com.clinora.appointments.service.PatientAppointmentService.PortalCareSummary;
import com.clinora.notifications.service.PatientNotificationService;
import com.clinora.patients.service.PatientTimelineService.TimelineEventView;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PatientPortalSummaryService {
    private final PatientAppointmentService appointments;
    private final PatientTimelineService timeline;
    private final PatientNotificationService notifications;

    public PatientPortalSummaryService(
        PatientAppointmentService appointments,
        PatientTimelineService timeline,
        PatientNotificationService notifications
    ) {
        this.appointments = appointments;
        this.timeline = timeline;
        this.notifications = notifications;
    }

    @Transactional(readOnly = true)
    public PortalSummaryView summary(UUID patientUserId) {
        PortalCareSummary care = appointments.portalSummary(patientUserId);
        List<TimelineEventView> recent = timeline.recent(patientUserId, 4);
        return new PortalSummaryView(care, recent, notifications.unreadCount(patientUserId));
    }

    public record PortalSummaryView(PortalCareSummary care, List<TimelineEventView> recentHealthActivity, long unreadNotifications) {}
}

