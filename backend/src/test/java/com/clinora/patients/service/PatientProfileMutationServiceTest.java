package com.clinora.patients.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.clinora.patients.domain.BloodGroup;
import com.clinora.patients.domain.PatientGender;
import com.clinora.patients.service.PatientProfileService.EmergencyContactView;
import com.clinora.patients.service.PatientProfileService.PatientProfileView;
import com.clinora.patients.service.PatientProfileService.UpdatePatientProfileCommand;
import com.clinora.patients.service.PatientTimelineService.TimelineCategory;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class PatientProfileMutationServiceTest {
    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID PROFILE_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final Instant NOW = Instant.parse("2026-08-30T12:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    @Test
    void recordsOnlyMeaningfulClinicalCollectionChangesWithCompactDedupeKeys() {
        PatientProfileService profiles = mock(PatientProfileService.class);
        PatientTimelineService timeline = mock(PatientTimelineService.class);
        PatientBodyMeasurementService measurements = mock(PatientBodyMeasurementService.class);
        PatientProfileMutationService service = new PatientProfileMutationService(profiles, timeline, measurements, CLOCK);
        String longMedication = "M".repeat(200);

        PatientProfileView before = profile(
            List.of("Penicillin"),
            List.of("Asthma"),
            List.of("Inhaler")
        );
        PatientProfileView after = profile(
            List.of("Dust"),
            List.of("Asthma", "Hypertension"),
            List.of("Inhaler", longMedication)
        );
        UpdatePatientProfileCommand command = new UpdatePatientProfileCommand(
            before.dateOfBirth(), before.gender(), before.bloodGroup(), before.phone(), before.address(),
            before.heightCm(), before.weightKg(), before.familyMedicalHistory(), before.lifestyleInformation(),
            before.emergencyContact().name(), before.emergencyContact().phone(), before.emergencyContact().relationship(),
            after.allergies(), after.chronicConditions(), after.currentMedications()
        );

        when(profiles.profile(USER_ID)).thenReturn(before);
        when(profiles.update(USER_ID, command, "127.0.0.1", "JUnit")).thenReturn(after);

        PatientProfileView result = service.update(USER_ID, command, "127.0.0.1", "JUnit");

        assertEquals(after, result);
        ArgumentCaptor<String> eventTypes = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> dedupeKeys = ArgumentCaptor.forClass(String.class);
        verify(timeline, times(4)).append(
            eq(USER_ID),
            eventTypes.capture(),
            eq(TimelineCategory.CONDITIONS_MEDICATIONS),
            anyString(),
            isNull(),
            anyString(),
            anyString(),
            eq(NOW),
            dedupeKeys.capture()
        );
        assertEquals(
            List.of("ALLERGY_ADDED", "ALLERGY_REMOVED", "CONDITION_ADDED", "MEDICATION_ADDED"),
            eventTypes.getAllValues()
        );
        assertTrue(dedupeKeys.getAllValues().stream().allMatch(key -> key.length() <= 220));
        assertEquals(4, dedupeKeys.getAllValues().stream().distinct().count());
    }


    @Test
    void recordsProfileCompletionAsAStableMilestoneInsteadOfGenericProfileNoise() {
        PatientProfileService profiles = mock(PatientProfileService.class);
        PatientTimelineService timeline = mock(PatientTimelineService.class);
        PatientBodyMeasurementService measurements = mock(PatientBodyMeasurementService.class);
        PatientProfileMutationService service = new PatientProfileMutationService(profiles, timeline, measurements, CLOCK);
        PatientProfileView before = profile(List.of(), List.of(), List.of(), 88);
        PatientProfileView after = profile(List.of(), List.of(), List.of(), 100);
        UpdatePatientProfileCommand command = new UpdatePatientProfileCommand(
            after.dateOfBirth(), after.gender(), after.bloodGroup(), after.phone(), after.address(),
            after.heightCm(), after.weightKg(), after.familyMedicalHistory(), after.lifestyleInformation(),
            after.emergencyContact().name(), after.emergencyContact().phone(), after.emergencyContact().relationship(),
            after.allergies(), after.chronicConditions(), after.currentMedications()
        );
        when(profiles.profile(USER_ID)).thenReturn(before);
        when(profiles.update(USER_ID, command, null, null)).thenReturn(after);

        service.update(USER_ID, command, null, null);

        verify(timeline).append(
            eq(USER_ID), eq("PROFILE_COMPLETED"), eq(TimelineCategory.PROFILE), eq("PATIENT_PROFILE"), eq(PROFILE_ID),
            eq("Health profile completed"), anyString(), eq(NOW), eq("profile-completed:" + PROFILE_ID)
        );
    }

    @Test
    void doesNotCreateTimelineNoiseWhenNothingMeaningfulChanges() {
        PatientProfileService profiles = mock(PatientProfileService.class);
        PatientTimelineService timeline = mock(PatientTimelineService.class);
        PatientBodyMeasurementService measurements = mock(PatientBodyMeasurementService.class);
        PatientProfileMutationService service = new PatientProfileMutationService(profiles, timeline, measurements, CLOCK);
        PatientProfileView view = profile(List.of("Dust"), List.of("Asthma"), List.of("Inhaler"));
        UpdatePatientProfileCommand command = new UpdatePatientProfileCommand(
            view.dateOfBirth(), view.gender(), view.bloodGroup(), view.phone(), view.address(),
            view.heightCm(), view.weightKg(), view.familyMedicalHistory(), view.lifestyleInformation(),
            view.emergencyContact().name(), view.emergencyContact().phone(), view.emergencyContact().relationship(),
            view.allergies(), view.chronicConditions(), view.currentMedications()
        );
        when(profiles.profile(USER_ID)).thenReturn(view);
        when(profiles.update(USER_ID, command, null, null)).thenReturn(view);

        service.update(USER_ID, command, null, null);

        verifyNoInteractions(timeline);
    }

    @Test
    void changedMeasurementCreatesOneSnapshotAndOnePatientFacingEvent() {
        PatientProfileService profiles = mock(PatientProfileService.class);
        PatientTimelineService timeline = mock(PatientTimelineService.class);
        PatientBodyMeasurementService measurements = mock(PatientBodyMeasurementService.class);
        PatientProfileMutationService service = new PatientProfileMutationService(profiles, timeline, measurements, CLOCK);
        PatientProfileView before = profile(List.of(), List.of(), List.of());
        PatientProfileView after = changed(before, before.phone(), before.bloodGroup(), new BigDecimal("63"),
            before.familyMedicalHistory(), before.lifestyleInformation());
        UpdatePatientProfileCommand command = command(after);
        when(profiles.profile(USER_ID)).thenReturn(before);
        when(profiles.update(USER_ID, command, null, null)).thenReturn(after);
        when(measurements.appendProfileSnapshotIfChanged(
            eq(USER_ID), eq(PROFILE_ID), eq(before.heightCm()), eq(before.weightKg()), eq(after.heightCm()),
            eq(after.weightKg()), eq(NOW), anyString()
        )).thenReturn(true);

        service.update(USER_ID, command, null, null);

        verify(measurements).appendProfileSnapshotIfChanged(
            eq(USER_ID), eq(PROFILE_ID), eq(before.heightCm()), eq(before.weightKg()), eq(after.heightCm()),
            eq(after.weightKg()), eq(NOW), anyString()
        );
        verify(timeline).append(
            eq(USER_ID), eq("BODY_MEASUREMENT_RECORDED"), eq(TimelineCategory.PROFILE), eq("PATIENT_PROFILE"),
            eq(PROFILE_ID), eq("Measurements updated"), eq("Height: 165 cm · Weight: 63 kg · BMI: 23.1"),
            eq(NOW), anyString()
        );
    }

    @Test
    void bloodGroupAndBackgroundChangesUseGranularEventsWithoutGenericClinicalNoise() {
        PatientProfileService profiles = mock(PatientProfileService.class);
        PatientTimelineService timeline = mock(PatientTimelineService.class);
        PatientBodyMeasurementService measurements = mock(PatientBodyMeasurementService.class);
        PatientProfileMutationService service = new PatientProfileMutationService(profiles, timeline, measurements, CLOCK);
        PatientProfileView before = profile(List.of(), List.of(), List.of());
        PatientProfileView after = changed(before, before.phone(), BloodGroup.A_POSITIVE, before.weightKg(),
            "Updated family context", "Updated lifestyle context");
        UpdatePatientProfileCommand command = command(after);
        when(profiles.profile(USER_ID)).thenReturn(before);
        when(profiles.update(USER_ID, command, null, null)).thenReturn(after);

        service.update(USER_ID, command, null, null);

        ArgumentCaptor<String> types = ArgumentCaptor.forClass(String.class);
        verify(timeline, times(3)).append(
            eq(USER_ID), types.capture(), eq(TimelineCategory.PROFILE), eq("PATIENT_PROFILE"), eq(PROFILE_ID),
            anyString(), anyString(), eq(NOW), anyString()
        );
        assertEquals(List.of("BLOOD_GROUP_UPDATED", "FAMILY_HISTORY_UPDATED", "LIFESTYLE_UPDATED"), types.getAllValues());
        verifyNoInteractions(measurements);
    }

    @Test
    void contactOnlyChangeCreatesOneSafeGenericEventWithoutOldContactValues() {
        PatientProfileService profiles = mock(PatientProfileService.class);
        PatientTimelineService timeline = mock(PatientTimelineService.class);
        PatientBodyMeasurementService measurements = mock(PatientBodyMeasurementService.class);
        PatientProfileMutationService service = new PatientProfileMutationService(profiles, timeline, measurements, CLOCK);
        PatientProfileView before = profile(List.of(), List.of(), List.of());
        PatientProfileView after = changed(before, "+8801999999999", before.bloodGroup(), before.weightKg(),
            before.familyMedicalHistory(), before.lifestyleInformation());
        UpdatePatientProfileCommand command = command(after);
        when(profiles.profile(USER_ID)).thenReturn(before);
        when(profiles.update(USER_ID, command, null, null)).thenReturn(after);

        service.update(USER_ID, command, null, null);

        verify(timeline).append(
            eq(USER_ID), eq("PROFILE_DETAILS_UPDATED"), eq(TimelineCategory.PROFILE), eq("PATIENT_PROFILE"),
            eq(PROFILE_ID), eq("Profile details updated"), eq("Your saved profile details changed."), eq(NOW), anyString()
        );
        verifyNoInteractions(measurements);
    }

    private static PatientProfileView profile(
        List<String> allergies,
        List<String> conditions,
        List<String> medications
    ) {
        return profile(allergies, conditions, medications, 100);
    }

    private static UpdatePatientProfileCommand command(PatientProfileView view) {
        return new UpdatePatientProfileCommand(
            view.dateOfBirth(), view.gender(), view.bloodGroup(), view.phone(), view.address(), view.heightCm(),
            view.weightKg(), view.familyMedicalHistory(), view.lifestyleInformation(), view.emergencyContact().name(),
            view.emergencyContact().phone(), view.emergencyContact().relationship(), view.allergies(),
            view.chronicConditions(), view.currentMedications()
        );
    }

    private static PatientProfileView changed(
        PatientProfileView source,
        String phone,
        BloodGroup bloodGroup,
        BigDecimal weight,
        String familyHistory,
        String lifestyle
    ) {
        return new PatientProfileView(
            source.id(), source.profileCreated(), source.firstName(), source.lastName(), source.email(),
            source.dateOfBirth(), source.gender(), bloodGroup, phone, source.address(), source.heightCm(), weight,
            familyHistory, lifestyle, source.emergencyContact(), source.allergies(), source.chronicConditions(),
            source.currentMedications(), source.completenessPercent(), source.missingProfileFields(), NOW
        );
    }

    private static PatientProfileView profile(
        List<String> allergies,
        List<String> conditions,
        List<String> medications,
        int completenessPercent
    ) {
        return new PatientProfileView(
            PROFILE_ID,
            true,
            "Pia",
            "Patient",
            "patient@example.test",
            LocalDate.of(1990, 1, 1),
            PatientGender.FEMALE,
            BloodGroup.O_POSITIVE,
            "+8801700000000",
            "Dhaka, Bangladesh",
            new BigDecimal("165.0"),
            new BigDecimal("60.0"),
            "Family history recorded",
            "Exercises regularly",
            new EmergencyContactView("Rina Patient", "+8801800000000", "Sibling", true),
            allergies,
            conditions,
            medications,
            completenessPercent,
            completenessPercent == 100 ? List.of() : List.of("Emergency contact"),
            NOW.minusSeconds(60)
        );
    }
}
