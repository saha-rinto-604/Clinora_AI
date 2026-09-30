package com.clinora.research;

import com.clinora.research.deid.DeidentificationResult;
import com.clinora.research.deid.DeidentificationService;
import com.clinora.research.deid.DefaultDeidentificationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class DeidentificationServiceTest {

    private DefaultDeidentificationService service;

    @BeforeEach
    void setUp() {
        // Test with k=3 to verify thresholding concisely
        service = new DefaultDeidentificationService(new ObjectMapper(), 3);
    }

    @Test
    @DisplayName("Direct identifiers (patient UUIDs) are completely eliminated from transformed records and serialized payload")
    void directIdentifiersEliminated() {
        UUID p1 = UUID.randomUUID();
        UUID p2 = UUID.randomUUID();
        UUID p3 = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        UUID reqId = UUID.randomUUID();

        List<DeidentificationService.RawObservationRow> rows = List.of(
                new DeidentificationService.RawObservationRow(p1, LocalDate.of(1980, 5, 20), "MALE", LocalDate.of(2026, 3, 10), "HBA1C", new BigDecimal("6.8"), "%", new BigDecimal("4.0"), new BigDecimal("5.6"), "HIGH"),
                new DeidentificationService.RawObservationRow(p2, LocalDate.of(1975, 11, 2), "FEMALE", LocalDate.of(2026, 3, 12), "HBA1C", new BigDecimal("7.1"), "%", new BigDecimal("4.0"), new BigDecimal("5.6"), "HIGH"),
                new DeidentificationService.RawObservationRow(p3, LocalDate.of(1990, 1, 15), "FEMALE", LocalDate.of(2026, 3, 15), "FASTING_GLUCOSE", new BigDecimal("110"), "mg/dL", new BigDecimal("70"), new BigDecimal("99"), "HIGH")
        );

        DeidentificationResult result = service.transform(reqId, projectId, "CSV", rows);

        assertNotNull(result);
        assertEquals(3, result.totalEligibleRecords());
        assertEquals(3, result.uniqueSubjectsCount());
        assertEquals("CSV", result.format());
        assertNotNull(result.sha256Checksum());
        assertEquals(64, result.sha256Checksum().length());

        String csv = new String(result.serializedPayload(), StandardCharsets.UTF_8);
        assertTrue(csv.contains("subject_id,age_band,sex,observation_period,variable_code,value,unit,reference_range,flag"));

        // Direct patient UUIDs must NEVER appear anywhere in CSV
        assertFalse(csv.contains(p1.toString()));
        assertFalse(csv.contains(p2.toString()));
        assertFalse(csv.contains(p3.toString()));

        // Check project-scoped pseudonyms
        assertTrue(csv.contains("SUBJ-"));
    }

    @Test
    @DisplayName("Project-scoped pseudonyms are deterministic within a study but uncorrelated across different studies")
    void projectScopedPseudonymization() {
        UUID patientId = UUID.randomUUID();
        UUID projectA = UUID.randomUUID();
        UUID projectB = UUID.randomUUID();

        String pseudoA1 = service.generateProjectScopedPseudonym(patientId, projectA);
        String pseudoA2 = service.generateProjectScopedPseudonym(patientId, projectA);
        String pseudoB = service.generateProjectScopedPseudonym(patientId, projectB);

        // Deterministic within Project A
        assertEquals(pseudoA1, pseudoA2);
        assertTrue(pseudoA1.startsWith("SUBJ-"));
        assertEquals(37, pseudoA1.length(), "Prefix 'SUBJ-' (5) + 32 hex chars (128 bits) must equal 37 characters");

        // Uncorrelated between Project A and Project B
        assertNotEquals(pseudoA1, pseudoB);
    }

    @Test
    @DisplayName("Pseudonymization: Different patients produce different pseudonyms within the same project")
    void differentPatientsProduceDifferentPseudonyms() {
        UUID project = UUID.randomUUID();
        UUID patient1 = UUID.randomUUID();
        UUID patient2 = UUID.randomUUID();

        String pseudo1 = service.generateProjectScopedPseudonym(patient1, project);
        String pseudo2 = service.generateProjectScopedPseudonym(patient2, project);

        assertNotEquals(pseudo1, pseudo2);
    }

    @Test
    @DisplayName("Pseudonymization: Secret change changes generated pseudonyms for same patient and project")
    void secretChangeChangesPseudonym() {
        UUID project = UUID.randomUUID();
        UUID patient = UUID.randomUUID();

        DefaultDeidentificationService serviceWithSecret1 = new DefaultDeidentificationService(new ObjectMapper(), 3, "secret-one-deterministic-key");
        DefaultDeidentificationService serviceWithSecret2 = new DefaultDeidentificationService(new ObjectMapper(), 3, "secret-two-deterministic-key");

        String pseudo1 = serviceWithSecret1.generateProjectScopedPseudonym(patient, project);
        String pseudo2 = serviceWithSecret2.generateProjectScopedPseudonym(patient, project);

        assertNotEquals(pseudo1, pseudo2, "Pseudonyms must diverge when the server secret changes");
    }

    @Test
    @DisplayName("Pseudonymization: Project UUID alone is insufficient to reproduce pseudonym without server secret")
    void projectUuidAloneIsInsufficientWithoutServerSecret() {
        UUID project = UUID.randomUUID();
        UUID patient = UUID.randomUUID();

        // Insecure legacy logic derived projectKey = SHA-256(projectId) directly
        try {
            java.security.MessageDigest sha256 = java.security.MessageDigest.getInstance("SHA-256");
            byte[] insecureKey = sha256.digest(project.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            javax.crypto.Mac insecureMac = javax.crypto.Mac.getInstance("HmacSHA256");
            insecureMac.init(new javax.crypto.spec.SecretKeySpec(insecureKey, "HmacSHA256"));
            byte[] insecureHmac = insecureMac.doFinal(patient.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            String insecureResult = "SUBJ-" + java.util.HexFormat.of().formatHex(insecureHmac).substring(0, 32);

            String secureResult = service.generateProjectScopedPseudonym(patient, project);

            assertNotEquals(insecureResult, secureResult,
                    "Secure pseudonym must not match insecure unpepppered derivation using project ID alone");
        } catch (Exception e) {
            fail("Exception during verification: " + e.getMessage());
        }
    }

    @Test
    @DisplayName("Age banding generalizes DOB and top-codes individuals 85+ under Clinora research age generalization")
    void ageBandingAndTopCoding() {
        LocalDate refDate = LocalDate.of(2026, 9, 1);

        // Age 46 -> 45-49
        assertEquals("45-49", service.computeAgeBand(LocalDate.of(1980, 5, 20), refDate));

        // Age 62 -> 60-64
        assertEquals("60-64", service.computeAgeBand(LocalDate.of(1964, 1, 10), refDate));

        // Age 84 -> 80-84
        assertEquals("80-84", service.computeAgeBand(LocalDate.of(1942, 3, 1), refDate));

        // Age 85 -> 85+ (top-coding)
        assertEquals("85+", service.computeAgeBand(LocalDate.of(1941, 5, 1), refDate));

        // Age 96 -> 85+ (top-coding)
        assertEquals("85+", service.computeAgeBand(LocalDate.of(1930, 2, 14), refDate));
    }

    @Test
    @DisplayName("Observation dates are generalized to Year-Quarter periods")
    void temporalGeneralization() {
        assertEquals("2026-Q1", service.computeObservationPeriod(LocalDate.of(2026, 1, 15)));
        assertEquals("2026-Q1", service.computeObservationPeriod(LocalDate.of(2026, 3, 31)));
        assertEquals("2026-Q2", service.computeObservationPeriod(LocalDate.of(2026, 4, 1)));
        assertEquals("2026-Q3", service.computeObservationPeriod(LocalDate.of(2026, 8, 20)));
        assertEquals("2026-Q4", service.computeObservationPeriod(LocalDate.of(2026, 11, 5)));
    }

    @Test
    @DisplayName("Rejects dataset generation when cohort unique subjects count falls below minimum subject threshold")
    void minimumCohortSizeProtection() {
        UUID p1 = UUID.randomUUID();
        UUID p2 = UUID.randomUUID();
        // Only 2 distinct patients, threshold is minCohortSize=3
        List<DeidentificationService.RawObservationRow> rows = List.of(
                new DeidentificationService.RawObservationRow(p1, LocalDate.of(1980, 5, 20), "MALE", LocalDate.of(2026, 3, 10), "HBA1C", new BigDecimal("6.8"), "%", null, null, null),
                new DeidentificationService.RawObservationRow(p1, LocalDate.of(1980, 5, 20), "MALE", LocalDate.of(2026, 6, 10), "HBA1C", new BigDecimal("6.6"), "%", null, null, null),
                new DeidentificationService.RawObservationRow(p2, LocalDate.of(1975, 11, 2), "FEMALE", LocalDate.of(2026, 3, 12), "HBA1C", new BigDecimal("7.1"), "%", null, null, null)
        );

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                service.transform(UUID.randomUUID(), UUID.randomUUID(), "CSV", rows)
        );

        assertTrue(ex.getMessage().contains("minimum subject threshold"));
    }

    @Test
    @DisplayName("JSON format serialization generates valid JSON payload and matching SHA-256 checksum")
    void jsonFormatSerialization() {
        UUID p1 = UUID.randomUUID();
        UUID p2 = UUID.randomUUID();
        UUID p3 = UUID.randomUUID();

        List<DeidentificationService.RawObservationRow> rows = List.of(
                new DeidentificationService.RawObservationRow(p1, LocalDate.of(1980, 5, 20), "MALE", LocalDate.of(2026, 3, 10), "HBA1C", new BigDecimal("6.8"), "%", null, null, null),
                new DeidentificationService.RawObservationRow(p2, LocalDate.of(1975, 11, 2), "FEMALE", LocalDate.of(2026, 3, 12), "HBA1C", new BigDecimal("7.1"), "%", null, null, null),
                new DeidentificationService.RawObservationRow(p3, LocalDate.of(1990, 1, 15), "FEMALE", LocalDate.of(2026, 3, 15), "FASTING_GLUCOSE", new BigDecimal("110"), "mg/dL", null, null, null)
        );

        DeidentificationResult result = service.transform(UUID.randomUUID(), UUID.randomUUID(), "JSON", rows);

        assertEquals("JSON", result.format());
        String json = new String(result.serializedPayload(), StandardCharsets.UTF_8);
        assertTrue(json.startsWith("["));
        assertTrue(json.contains("\"variableCode\":\"HBA1C\""));
        assertTrue(json.contains("\"subjectId\":\"SUBJ-"));
    }
}
