package com.clinora.patients.domain;

/**
 * Identifies whose medical information a Patient-owned report describes.
 * SELF reports belong to the signed-in Patient's own longitudinal record.
 * OTHER reports are private uploads for another person and must stay isolated
 * from the signed-in Patient's health record and appointment sharing flows.
 */
public enum PatientReportSubjectType {
    SELF,
    OTHER
}
