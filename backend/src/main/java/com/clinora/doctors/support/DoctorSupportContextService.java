package com.clinora.doctors.support;

import com.clinora.doctors.service.DoctorClinicalAccessService;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class DoctorSupportContextService {
    private final DoctorClinicalAccessService access;
    private final DoctorSupportEvidenceScopeResolver scopeResolver;

    public DoctorSupportContextService(JdbcTemplate jdbc, DoctorClinicalAccessService access) {
        this.access = access;
        this.scopeResolver = new DoctorSupportEvidenceScopeResolver(jdbc, access);
    }

    public DoctorSupportContext build(UUID doctorId, UUID appointmentId, DoctorSupportRoutingRequest request) {
        var appointment = access.requireActiveOwnedAppointment(doctorId, appointmentId).appointment();
        var resolved = scopeResolver.resolve(doctorId, appointmentId, appointment.patientId(),
            request.currentReportId(), request.selectedReportIds(), request.selectedObservationIds());
        UUID current = request.currentReportId();
        return new DoctorSupportContext(
            doctorId, appointmentId, request.currentScreen(),
            current != null && resolved.reportIds().contains(current) ? current : null,
            scopeResolver.currentReportType(resolved, current),
            resolved.reportIds(), resolved.observationIds(), request.doctorAssessmentPresent(),
            request.doctorNotesPresent(), scopeResolver.comparableReportsAvailable(resolved), resolved.selectionType()
        );
    }
}
