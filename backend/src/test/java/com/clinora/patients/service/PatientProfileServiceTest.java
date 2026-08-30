package com.clinora.patients.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.patients.api.PatientApiException;
import com.clinora.patients.domain.BloodGroup;
import com.clinora.patients.domain.PatientAllergy;
import com.clinora.patients.domain.PatientChronicCondition;
import com.clinora.patients.domain.PatientGender;
import com.clinora.patients.domain.PatientMedication;
import com.clinora.patients.domain.PatientProfile;
import com.clinora.patients.repository.PatientAllergyRepository;
import com.clinora.patients.repository.PatientChronicConditionRepository;
import com.clinora.patients.repository.PatientMedicationRepository;
import com.clinora.patients.repository.PatientProfileRepository;
import com.clinora.users.domain.AccountStatus;
import com.clinora.users.domain.UserAccount;
import com.clinora.users.domain.UserRole;
import com.clinora.users.repository.UserAccountRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.test.util.ReflectionTestUtils;

class PatientProfileServiceTest {

    private static final Instant NOW = Instant.parse("2026-08-26T12:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID PROFILE_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @Test
    void profileReturnsSafeEmptyFoundationBeforeFirstSave() {
        Fixture fixture = new Fixture();
        UserAccount patient = patientUser();
        when(fixture.users.findById(USER_ID)).thenReturn(Optional.of(patient));
        when(fixture.profiles.findByUserId(USER_ID)).thenReturn(Optional.empty());

        var view = fixture.service.profile(USER_ID);

        assertFalse(view.profileCreated());
        assertEquals(0, view.completenessPercent());
        assertEquals("patient@example.test", view.email());
        assertEquals(8, view.missingProfileFields().size());
        assertTrue(view.allergies().isEmpty());
        assertNull(view.id());
    }

    @Test
    void updateCreatesPatientProfileNormalizesClinicalListsAndAudits() {
        Fixture fixture = new Fixture();
        UserAccount patient = patientUser();
        when(fixture.users.findById(USER_ID)).thenReturn(Optional.of(patient));
        when(fixture.profiles.findByUserId(USER_ID)).thenReturn(Optional.empty());
        when(fixture.profiles.save(any(PatientProfile.class))).thenAnswer(invocation -> {
            PatientProfile profile = invocation.getArgument(0);
            if (profile.getId() == null) {
                ReflectionTestUtils.setField(profile, "id", PROFILE_ID);
            }
            return profile;
        });
        when(fixture.allergies.findAllByPatientProfileIdOrderByNameAsc(PROFILE_ID))
            .thenReturn(List.of(new PatientAllergy(PROFILE_ID, "Penicillin", NOW)));
        when(fixture.conditions.findAllByPatientProfileIdOrderByNameAsc(PROFILE_ID))
            .thenReturn(List.of(new PatientChronicCondition(PROFILE_ID, "Asthma", NOW)));
        when(fixture.medications.findAllByPatientProfileIdOrderByNameAsc(PROFILE_ID))
            .thenReturn(List.of(new PatientMedication(PROFILE_ID, "Inhaler", NOW)));

        var command = new PatientProfileService.UpdatePatientProfileCommand(
            LocalDate.of(1998, 5, 10),
            PatientGender.FEMALE,
            BloodGroup.O_POSITIVE,
            "+880 1700 000000",
            "Dhaka, Bangladesh",
            new BigDecimal("165.0"),
            new BigDecimal("60.0"),
            "Family history of hypertension",
            "Exercises three times weekly",
            "Rina Patient",
            "+880 1800 000000",
            "Sibling",
            List.of(" Penicillin ", "penicillin", "Dust"),
            List.of("Asthma"),
            List.of("Inhaler")
        );

        var view = fixture.service.update(USER_ID, command, "127.0.0.1", "JUnit");

        assertTrue(view.profileCreated());
        assertEquals(PROFILE_ID, view.id());
        assertEquals(BloodGroup.O_POSITIVE, view.bloodGroup());
        assertEquals(100, view.completenessPercent());
        assertEquals(List.of("Penicillin"), view.allergies());
        assertTrue(view.emergencyContact().configured());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<PatientAllergy>> allergyCaptor = ArgumentCaptor.forClass(List.class);
        verify(fixture.allergies).saveAll(allergyCaptor.capture());
        assertEquals(2, allergyCaptor.getValue().size());
        assertEquals(List.of("Penicillin", "Dust"), allergyCaptor.getValue().stream().map(PatientAllergy::getName).toList());

        InOrder replacementOrder = inOrder(fixture.allergies, fixture.conditions, fixture.medications);
        replacementOrder.verify(fixture.allergies).deleteAllByPatientProfileId(PROFILE_ID);
        replacementOrder.verify(fixture.conditions).deleteAllByPatientProfileId(PROFILE_ID);
        replacementOrder.verify(fixture.medications).deleteAllByPatientProfileId(PROFILE_ID);
        replacementOrder.verify(fixture.allergies).flush();
        replacementOrder.verify(fixture.allergies).saveAll(any());

        verify(fixture.audit).record(
            USER_ID,
            AuthAuditAction.PATIENT_PROFILE_CREATED,
            AuthAuditOutcome.SUCCESS,
            "127.0.0.1",
            "JUnit",
            PROFILE_ID.toString(),
            null
        );
    }

    @Test
    void updateExistingProfileUsesUpdatedAuditAction() {
        Fixture fixture = new Fixture();
        UserAccount patient = patientUser();
        PatientProfile profile = profile();
        when(fixture.users.findById(USER_ID)).thenReturn(Optional.of(patient));
        when(fixture.profiles.findByUserId(USER_ID)).thenReturn(Optional.of(profile));
        when(fixture.profiles.save(profile)).thenReturn(profile);
        when(fixture.allergies.findAllByPatientProfileIdOrderByNameAsc(PROFILE_ID)).thenReturn(List.of());
        when(fixture.conditions.findAllByPatientProfileIdOrderByNameAsc(PROFILE_ID)).thenReturn(List.of());
        when(fixture.medications.findAllByPatientProfileIdOrderByNameAsc(PROFILE_ID)).thenReturn(List.of());

        fixture.service.update(USER_ID, emptyCommand(), null, null);

        verify(fixture.audit).record(
            USER_ID,
            AuthAuditAction.PATIENT_PROFILE_UPDATED,
            AuthAuditOutcome.SUCCESS,
            null,
            null,
            PROFILE_ID.toString(),
            null
        );
    }

    @Test
    void dashboardCalculatesBmiAndClinicalContextCounts() {
        Fixture fixture = new Fixture();
        UserAccount patient = patientUser();
        PatientProfile profile = profile();
        profile.update(
            LocalDate.of(1990, 1, 1),
            PatientGender.MALE,
            BloodGroup.A_POSITIVE,
            "+8801700000000",
            "Dhaka",
            new BigDecimal("180"),
            new BigDecimal("81"),
            null,
            null,
            "Emergency Person",
            "+8801800000000",
            "Sibling",
            NOW
        );
        when(fixture.users.findById(USER_ID)).thenReturn(Optional.of(patient));
        when(fixture.profiles.findByUserId(USER_ID)).thenReturn(Optional.of(profile));
        when(fixture.allergies.findAllByPatientProfileIdOrderByNameAsc(PROFILE_ID))
            .thenReturn(List.of(new PatientAllergy(PROFILE_ID, "Dust", NOW)));
        when(fixture.conditions.findAllByPatientProfileIdOrderByNameAsc(PROFILE_ID))
            .thenReturn(List.of(new PatientChronicCondition(PROFILE_ID, "Asthma", NOW)));
        when(fixture.medications.findAllByPatientProfileIdOrderByNameAsc(PROFILE_ID))
            .thenReturn(List.of(new PatientMedication(PROFILE_ID, "Inhaler", NOW)));

        var dashboard = fixture.service.dashboard(USER_ID);

        assertEquals(new BigDecimal("25.0"), dashboard.bmi());
        assertEquals(1, dashboard.allergyCount());
        assertEquals(1, dashboard.chronicConditionCount());
        assertEquals(1, dashboard.medicationCount());
        assertTrue(dashboard.emergencyContactConfigured());
    }

    @Test
    void nonPatientAndInactiveAccountsCannotUsePatientDomain() {
        Fixture fixture = new Fixture();
        UserAccount doctor = user(UserRole.DOCTOR, AccountStatus.ACTIVE);
        when(fixture.users.findById(USER_ID)).thenReturn(Optional.of(doctor));

        assertThrows(PatientApiException.class, () -> fixture.service.profile(USER_ID));
        verify(fixture.profiles, never()).findByUserId(USER_ID);

        UserAccount inactive = user(UserRole.PATIENT, AccountStatus.SUSPENDED);
        when(fixture.users.findById(USER_ID)).thenReturn(Optional.of(inactive));
        assertThrows(PatientApiException.class, () -> fixture.service.profile(USER_ID));
    }

    @Test
    void futureDateOfBirthIsRejectedBeforeProfileMutation() {
        Fixture fixture = new Fixture();
        when(fixture.users.findById(USER_ID)).thenReturn(Optional.of(patientUser()));
        PatientProfileService.UpdatePatientProfileCommand command = new PatientProfileService.UpdatePatientProfileCommand(
            LocalDate.of(2026, 8, 27),
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            List.of(),
            List.of(),
            List.of()
        );

        assertThrows(PatientApiException.class, () -> fixture.service.update(USER_ID, command, null, null));
        verify(fixture.profiles, never()).save(any());
    }

    private static PatientProfileService.UpdatePatientProfileCommand emptyCommand() {
        return new PatientProfileService.UpdatePatientProfileCommand(
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            List.of(),
            List.of(),
            List.of()
        );
    }

    private static UserAccount patientUser() {
        return user(UserRole.PATIENT, AccountStatus.ACTIVE);
    }

    private static UserAccount user(UserRole role, AccountStatus status) {
        UserAccount user = new UserAccount(
            "Pia",
            "Patient",
            "patient@example.test",
            "patient@example.test",
            "hash",
            role,
            status,
            NOW.minusSeconds(3600)
        );
        ReflectionTestUtils.setField(user, "id", USER_ID);
        if (status == AccountStatus.ACTIVE) {
            user.markEmailVerified(NOW.minusSeconds(3000));
        }
        return user;
    }

    private static PatientProfile profile() {
        PatientProfile profile = new PatientProfile(USER_ID, NOW.minusSeconds(1200));
        ReflectionTestUtils.setField(profile, "id", PROFILE_ID);
        return profile;
    }

    private static class Fixture {
        private final UserAccountRepository users = mock(UserAccountRepository.class);
        private final PatientProfileRepository profiles = mock(PatientProfileRepository.class);
        private final PatientAllergyRepository allergies = mock(PatientAllergyRepository.class);
        private final PatientChronicConditionRepository conditions = mock(PatientChronicConditionRepository.class);
        private final PatientMedicationRepository medications = mock(PatientMedicationRepository.class);
        private final AuthAuditService audit = mock(AuthAuditService.class);
        private final PatientProfileService service = new PatientProfileService(
            users,
            profiles,
            allergies,
            conditions,
            medications,
            audit,
            CLOCK
        );
    }
}
