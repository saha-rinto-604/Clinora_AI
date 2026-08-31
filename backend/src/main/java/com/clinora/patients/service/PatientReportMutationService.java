package com.clinora.patients.service;

import com.clinora.patients.api.PatientApiException;
import com.clinora.patients.security.PatientReportMalwareScanner;
import com.clinora.patients.security.PatientReportMalwareScanner.ScanResult;
import com.clinora.config.PatientReportSecurityProperties;
import com.clinora.patients.service.PatientReportService.ReportView;
import com.clinora.patients.service.PatientReportService.UpdateReportCommand;
import com.clinora.patients.service.PatientReportService.UploadReportCommand;
import com.clinora.patients.service.PatientTimelineService.TimelineCategory;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PatientReportMutationService {
    private final PatientReportService reports;
    private final PatientTimelineService timeline;
    private final PatientReportMalwareScanner malwareScanner;
    private final PatientReportSecurityProperties security;
    private final Clock clock;

    public PatientReportMutationService(
        PatientReportService reports,
        PatientTimelineService timeline,
        PatientReportMalwareScanner malwareScanner,
        PatientReportSecurityProperties security,
        Clock clock
    ) {
        this.reports = reports;
        this.timeline = timeline;
        this.malwareScanner = malwareScanner;
        this.security = security;
        this.clock = clock;
    }

    @Transactional
    public ReportView upload(
        UUID patientUserId,
        UploadReportCommand command,
        MultipartFile file,
        String ipAddress,
        String userAgent
    ) {
        ScanResult scan = malwareScanner.scan(file);
        if (scan == ScanResult.INFECTED) {
            throw new PatientApiException(
                HttpStatus.BAD_REQUEST,
                "REPORT_MALWARE_DETECTED",
                "This file could not be accepted because it failed the security scan."
            );
        }
        if (scan == ScanResult.UNAVAILABLE && security.isFailClosed()) {
            throw new PatientApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "REPORT_SECURITY_SCAN_UNAVAILABLE",
                "Secure report scanning is temporarily unavailable. Please try again."
            );
        }
        ReportView report = reports.upload(patientUserId, command, file, ipAddress, userAgent);
        timeline.append(
            patientUserId, "REPORT_UPLOADED", TimelineCategory.REPORTS, "MEDICAL_REPORT", report.id(),
            "Medical report uploaded", report.reportName(), report.createdAt(), "report-uploaded:" + report.id()
        );
        return report;
    }

    @Transactional
    public ReportView updateMetadata(
        UUID patientUserId,
        UUID reportId,
        UpdateReportCommand command,
        String ipAddress,
        String userAgent
    ) {
        ReportView before = reports.detail(patientUserId, reportId);
        ReportView after = reports.updateMetadata(patientUserId, reportId, command, ipAddress, userAgent);
        if (!Objects.equals(before.reportName(), after.reportName())
            || !Objects.equals(before.reportType(), after.reportType())
            || !Objects.equals(before.reportDate(), after.reportDate())
            || !Objects.equals(before.providerLaboratory(), after.providerLaboratory())) {
            timeline.append(
                patientUserId, "REPORT_METADATA_UPDATED", TimelineCategory.REPORTS, "MEDICAL_REPORT", reportId,
                "Medical report details updated", after.reportName(), clock.instant(),
                "report-metadata:" + reportId + ":" + after.updatedAt().toEpochMilli()
            );
        }
        return after;
    }

    @Transactional
    public ReportView archive(UUID patientUserId, UUID reportId, String ipAddress, String userAgent) {
        ReportView before = reports.detail(patientUserId, reportId);
        ReportView after = reports.archive(patientUserId, reportId, ipAddress, userAgent);
        if (!before.archived() && after.archived()) {
            Instant when = after.archivedAt() == null ? clock.instant() : after.archivedAt();
            timeline.append(
                patientUserId, "REPORT_ARCHIVED", TimelineCategory.REPORTS, "MEDICAL_REPORT", reportId,
                "Medical report archived", after.reportName(), when, "report-archived:" + reportId + ":" + when.toEpochMilli()
            );
        }
        return after;
    }

    @Transactional
    public ReportView restore(UUID patientUserId, UUID reportId, String ipAddress, String userAgent) {
        ReportView before = reports.detail(patientUserId, reportId);
        ReportView after = reports.restore(patientUserId, reportId, ipAddress, userAgent);
        if (before.archived() && !after.archived()) {
            Instant when = clock.instant();
            timeline.append(
                patientUserId, "REPORT_RESTORED", TimelineCategory.REPORTS, "MEDICAL_REPORT", reportId,
                "Medical report restored", after.reportName(), when, "report-restored:" + reportId + ":" + when.toEpochMilli()
            );
        }
        return after;
    }
}

