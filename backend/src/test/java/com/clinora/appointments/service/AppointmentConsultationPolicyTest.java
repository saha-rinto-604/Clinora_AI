package com.clinora.appointments.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.clinora.patients.api.PatientApiException;
import org.junit.jupiter.api.Test;

class AppointmentConsultationPolicyTest {
    @Test
    void legacyAvailabilityDefaultsToBothWhileNewAppointmentsRequireAnExplicitMode() {
        assertEquals("BOTH", PatientAppointmentService.requireAvailabilityMode(null));
        assertEquals("ONLINE", PatientAppointmentService.requireAppointmentMode("online"));
        assertEquals("IN_PERSON", PatientAppointmentService.requireAppointmentMode("in_person"));

        PatientApiException missing = assertThrows(
            PatientApiException.class,
            () -> PatientAppointmentService.requireAppointmentMode(null)
        );
        assertEquals("CONSULTATION_MODE_INVALID", missing.getErrorCode());
    }

    @Test
    void bothSlotsAcceptEitherModeAndSingleModeSlotsRejectMismatch() {
        PatientAppointmentService.requireSlotSupportsMode("BOTH", "ONLINE");
        PatientAppointmentService.requireSlotSupportsMode("BOTH", "IN_PERSON");
        PatientAppointmentService.requireSlotSupportsMode("ONLINE", "ONLINE");

        PatientApiException mismatch = assertThrows(
            PatientApiException.class,
            () -> PatientAppointmentService.requireSlotSupportsMode("ONLINE", "IN_PERSON")
        );
        assertEquals("CONSULTATION_MODE_UNAVAILABLE", mismatch.getErrorCode());
    }

    @Test
    void inPersonRequiresARealPracticeLocationWhileOnlineStoresNoLocation() {
        assertEquals(
            "House 10, Road 4, Dhanmondi, Dhaka",
            PatientAppointmentService.requirePracticeLocation(
                "IN_PERSON",
                " House 10, Road 4, Dhanmondi, Dhaka "
            )
        );
        assertEquals(null, PatientAppointmentService.requirePracticeLocation("ONLINE", "Ignored location"));

        PatientApiException missing = assertThrows(
            PatientApiException.class,
            () -> PatientAppointmentService.requirePracticeLocation("IN_PERSON", " ")
        );
        assertEquals("PRACTICE_LOCATION_REQUIRED", missing.getErrorCode());
    }

    @Test
    void meetingLinksRequireSafeHttpsUrlsWithoutEmbeddedCredentials() {
        assertEquals(
            "https://meet.example.test/room?id=patient-visit",
            PatientAppointmentService.requireSafeMeetingUrl("https://meet.example.test/room?id=patient-visit")
        );
        for (String unsafe : new String[] {
            "http://meet.example.test/room",
            "javascript:alert(1)",
            "data:text/html,unsafe",
            "https://user:password@meet.example.test/room",
            "not a url"
        }) {
            PatientApiException error = assertThrows(
                PatientApiException.class,
                () -> PatientAppointmentService.requireSafeMeetingUrl(unsafe)
            );
            assertEquals("MEETING_URL_UNSAFE", error.getErrorCode());
        }
    }
}
