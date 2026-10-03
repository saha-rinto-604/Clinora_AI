package com.clinora.research;

import com.clinora.research.deid.DeidentificationService.RawObservationRow;
import com.clinora.research.service.evaluation.EvaluationReferenceSnapshot;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class EvaluationReferenceSnapshotTest {
    private RawObservationRow row(String value, String low, String high, String status, String flag) {
        return new RawObservationRow(UUID.randomUUID(), null, "F", null, "HGB",
            value == null ? null : new BigDecimal(value), "g/dL",
            low == null ? null : new BigDecimal(low), high == null ? null : new BigDecimal(high),
            flag, status, false, null);
    }

    @Test
    void rangesAreInclusiveAndVerificationNeverDeterminesClass() {
        for (String status : List.of("DOCTOR_VERIFIED", "PATIENT_CONFIRMED", "PATIENT_CORRECTED")) {
            var snapshot = EvaluationReferenceSnapshot.create(UUID.randomUUID(), "hash", List.of(
                row("12", "12", "16", status, "HIGH"), row("16", "12", "16", status, "LOW"),
                row("13", "12", "16", status, "HIGH"), row("11", "12", "16", status, "NORMAL"),
                row("17", "12", "16", status, "NORMAL")), Set.of("HGB"));
            assertEquals(List.of("NORMAL", "NORMAL", "NORMAL", "ABNORMAL", "ABNORMAL"),
                snapshot.observations().stream().map(EvaluationReferenceSnapshot.Observation::derivedGroundTruth).toList());
        }
    }

    @Test
    void invalidMissingUnverifiedAndQualifiedObservationsAreExcluded() {
        var valid = row("13", "12", "16", "DOCTOR_VERIFIED", "NORMAL");
        var snapshot = EvaluationReferenceSnapshot.create(UUID.randomUUID(), "hash", List.of(
            row(null, "12", "16", "DOCTOR_VERIFIED", null), row("13", null, "16", "DOCTOR_VERIFIED", null),
            row("13", "12", null, "DOCTOR_VERIFIED", null), row("13", "16", "12", "DOCTOR_VERIFIED", null),
            row("13", "12", "16", "UNVERIFIED", null),
            new RawObservationRow(valid.patientUserId(), null, null, null, "HGB", valid.numericValue(), "g/dL",
                valid.referenceLow(), valid.referenceHigh(), null, "DOCTOR_VERIFIED", false, ">"),
            new RawObservationRow(valid.patientUserId(), null, null, null, "HGB", valid.numericValue(), "g/dL",
                valid.referenceLow(), valid.referenceHigh(), null, "DOCTOR_VERIFIED", true, null)), Set.of("HGB"));
        assertEquals(7, snapshot.totalObservations());
        assertTrue(snapshot.observations().isEmpty());
    }

    @Test
    void allRepeatedObservationsSurviveWithoutIdentifiersAndAreBoundToVersion() throws Exception {
        UUID version = UUID.randomUUID();
        var row = row("13", "12", "16", "DOCTOR_VERIFIED", "NORMAL");
        var snapshot = EvaluationReferenceSnapshot.create(version, "hash", Collections.nCopies(31, row), Set.of("HGB"));
        assertEquals(31, snapshot.observations().size());
        assertEquals(31, snapshot.observations().stream().map(EvaluationReferenceSnapshot.Observation::sampleKey).distinct().count());
        snapshot.validate(version, "hash");
        assertThrows(IllegalArgumentException.class, () -> snapshot.validate(UUID.randomUUID(), "hash"));
        assertThrows(IllegalArgumentException.class, () -> snapshot.validate(version, "changed"));
        String json = new ObjectMapper().writeValueAsString(snapshot);
        assertFalse(json.contains(row.patientUserId().toString()));
        for (String field : List.of("patient", "email", "phone", "subjectId", "gender", "dateOfBirth")) assertFalse(json.contains(field));
    }
}
