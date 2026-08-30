package com.clinora.patients.repository;

import com.clinora.patients.domain.PatientMedicalReport;
import com.clinora.patients.domain.PatientReportType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PatientMedicalReportRepository extends JpaRepository<PatientMedicalReport, UUID> {

    Optional<PatientMedicalReport> findByIdAndPatientUserId(UUID id, UUID patientUserId);

    long countByPatientUserIdAndArchivedAtIsNull(UUID patientUserId);

    long countByPatientUserIdAndArchivedAtIsNotNull(UUID patientUserId);

    Optional<PatientMedicalReport> findFirstByPatientUserIdAndArchivedAtIsNullOrderByCreatedAtDesc(UUID patientUserId);

    @Query("""
        SELECT report FROM PatientMedicalReport report
        WHERE report.patientUserId = :patientUserId
          AND ((:archived = false AND report.archivedAt IS NULL)
            OR (:archived = true AND report.archivedAt IS NOT NULL))
          AND (:reportType IS NULL OR report.reportType = :reportType)
          AND (:searchText = ''
            OR LOCATE(LOWER(:searchText), LOWER(report.reportName)) > 0
            OR LOCATE(LOWER(:searchText), LOWER(COALESCE(report.providerLaboratory, ''))) > 0
            OR LOCATE(LOWER(:searchText), LOWER(report.originalFilename)) > 0)
        ORDER BY CASE WHEN report.reportDate IS NULL THEN 1 ELSE 0 END,
          report.reportDate DESC,
          report.createdAt DESC
        """)
    Page<PatientMedicalReport> search(
        @Param("patientUserId") UUID patientUserId,
        @Param("archived") boolean archived,
        @Param("reportType") PatientReportType reportType,
        @Param("searchText") String searchText,
        Pageable pageable
    );
}
