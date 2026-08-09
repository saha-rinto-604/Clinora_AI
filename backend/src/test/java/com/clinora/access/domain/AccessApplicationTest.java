package com.clinora.access.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import org.junit.jupiter.api.Test;

class AccessApplicationTest {

    @Test
    void emailVerificationOpensDraftWithoutCreatingAUserRole() {
        Instant created = Instant.parse("2026-08-09T12:00:00Z");
        AccessApplication application = new AccessApplication(
            ApplicationType.DOCTOR,
            "Amina",
            "Rahman",
            "amina@example.com",
            "amina@example.com",
            "+8801700000000",
            "Bangladesh",
            created
        );

        assertEquals(ApplicationStatus.EMAIL_PENDING, application.getStatus());
        assertFalse(application.isEditable());

        application.markEmailVerified(created.plusSeconds(60));

        assertEquals(ApplicationStatus.DRAFT, application.getStatus());
        assertNotNull(application.getEmailVerifiedAt());
        assertTrue(application.isEditable());
    }

    @Test
    void submittedApplicationStopsNormalEditing() {
        Instant created = Instant.parse("2026-08-09T12:00:00Z");
        AccessApplication application = new AccessApplication(
            ApplicationType.RESEARCHER,
            "Nadia",
            "Islam",
            "nadia@example.com",
            "nadia@example.com",
            "+8801800000000",
            "Bangladesh",
            created
        );
        application.markEmailVerified(created.plusSeconds(30));
        application.submit(created.plusSeconds(120));

        assertEquals(ApplicationStatus.SUBMITTED, application.getStatus());
        assertFalse(application.isEditable());
        assertNotNull(application.getSubmittedAt());
        assertNotNull(application.getAttestedAt());
    }

    @Test
    void researcherCannotEnterInterviewStates() {
        Instant created = Instant.parse("2026-08-09T12:00:00Z");
        AccessApplication application = new AccessApplication(
            ApplicationType.RESEARCHER,
            "Nadia",
            "Islam",
            "nadia@example.com",
            "nadia@example.com",
            "+8801800000000",
            "Bangladesh",
            created
        );

        assertThrows(
            IllegalStateException.class,
            () -> application.moveToReviewStatus(ApplicationStatus.INTERVIEW_REQUIRED, created.plusSeconds(300))
        );
    }

    @Test
    void doctorCanEnterFutureInterviewStates() {
        Instant created = Instant.parse("2026-08-09T12:00:00Z");
        AccessApplication application = new AccessApplication(
            ApplicationType.DOCTOR,
            "Amina",
            "Rahman",
            "amina@example.com",
            "amina@example.com",
            "+8801700000000",
            "Bangladesh",
            created
        );

        application.moveToReviewStatus(ApplicationStatus.INTERVIEW_REQUIRED, created.plusSeconds(300));

        assertEquals(ApplicationStatus.INTERVIEW_REQUIRED, application.getStatus());
    }
}
