package com.clinora.patients.service;

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
import com.clinora.users.domain.UserAccount;
import com.clinora.users.domain.UserRole;
import com.clinora.users.repository.UserAccountRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PatientProfileService {

    private final UserAccountRepository users;
    private final PatientProfileRepository profiles;
    private final PatientAllergyRepository allergies;
    private final PatientChronicConditionRepository conditions;
    private final PatientMedicationRepository medications;
    private final AuthAuditService audit;
    private final Clock clock;

    public PatientProfileService(
        UserAccountRepository users,
        PatientProfileRepository profiles,
        PatientAllergyRepository allergies,
        PatientChronicConditionRepository conditions,
        PatientMedicationRepository medications,
        AuthAuditService audit,
        Clock clock
    ) {
        this.users = users;
        this.profiles = profiles;
        this.allergies = allergies;
        this.conditions = conditions;
        this.medications = medications;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PatientProfileView profile(UUID userId) {
        UserAccount user = requireActivePatient(userId);
        return profiles.findByUserId(userId)
            .map(profile -> view(user, profile))
            .orElseGet(() -> PatientProfileView.empty(user));
    }

    @Transactional(readOnly = true)
    public PatientDashboardView dashboard(UUID userId) {
        PatientProfileView profile = profile(userId);
        return new PatientDashboardView(
            profile.firstName(),
            profile.lastName(),
            profile.profileCreated(),
            profile.completenessPercent(),
            profile.missingProfileFields(),
            profile.bloodGroup(),
            profile.dateOfBirth(),
            profile.heightCm(),
            profile.weightKg(),
            bmi(profile.heightCm(), profile.weightKg()),
            profile.allergies().size(),
            profile.chronicConditions().size(),
            profile.currentMedications().size(),
            profile.emergencyContact().configured(),
            profile.updatedAt()
        );
    }

    @Transactional
    public PatientProfileView update(UUID userId, UpdatePatientProfileCommand command, String ipAddress, String userAgent) {
        UserAccount user = requireActivePatient(userId);
        validateDateOfBirth(command.dateOfBirth());

        Instant now = clock.instant();
        PatientProfile profile = profiles.findByUserId(userId).orElse(null);
        boolean created = profile == null;
        if (profile == null) {
            profile = profiles.save(new PatientProfile(userId, now));
        }

        profile.update(
            command.dateOfBirth(),
            command.gender(),
            command.bloodGroup(),
            command.phone(),
            command.address(),
            command.heightCm(),
            command.weightKg(),
            command.familyMedicalHistory(),
            command.lifestyleInformation(),
            command.emergencyContactName(),
            command.emergencyContactPhone(),
            command.emergencyContactRelationship(),
            now
        );
        profiles.save(profile);

        replaceClinicalLists(
            profile.getId(),
            cleanItems(command.allergies()),
            cleanItems(command.chronicConditions()),
            cleanItems(command.currentMedications()),
            now
        );

        audit.record(
            userId,
            created ? AuthAuditAction.PATIENT_PROFILE_CREATED : AuthAuditAction.PATIENT_PROFILE_UPDATED,
            AuthAuditOutcome.SUCCESS,
            ipAddress,
            userAgent,
            profile.getId().toString(),
            null
        );

        return view(user, profile);
    }

    private void replaceClinicalLists(
        UUID profileId,
        List<String> allergyNames,
        List<String> conditionNames,
        List<String> medicationNames,
        Instant now
    ) {
        allergies.deleteAllByPatientProfileId(profileId);
        conditions.deleteAllByPatientProfileId(profileId);
        medications.deleteAllByPatientProfileId(profileId);

        // Derived deletes are scheduled in the persistence context. Flush them before
        // inserting replacements so unchanged normalized names cannot hit the unique indexes.
        allergies.flush();

        allergies.saveAll(allergyNames.stream().map(name -> new PatientAllergy(profileId, name, now)).toList());
        conditions.saveAll(conditionNames.stream().map(name -> new PatientChronicCondition(profileId, name, now)).toList());
        medications.saveAll(medicationNames.stream().map(name -> new PatientMedication(profileId, name, now)).toList());
    }

    private PatientProfileView view(UserAccount user, PatientProfile profile) {
        List<String> allergyNames = allergies.findAllByPatientProfileIdOrderByNameAsc(profile.getId()).stream()
            .map(PatientAllergy::getName)
            .toList();
        List<String> conditionNames = conditions.findAllByPatientProfileIdOrderByNameAsc(profile.getId()).stream()
            .map(PatientChronicCondition::getName)
            .toList();
        List<String> medicationNames = medications.findAllByPatientProfileIdOrderByNameAsc(profile.getId()).stream()
            .map(PatientMedication::getName)
            .toList();
        ProfileReadiness readiness = readiness(profile);

        return new PatientProfileView(
            profile.getId(),
            true,
            user.getFirstName(),
            user.getLastName(),
            user.getEmail(),
            profile.getDateOfBirth(),
            profile.getGender(),
            profile.getBloodGroup(),
            profile.getPhone(),
            profile.getAddress(),
            profile.getHeightCm(),
            profile.getWeightKg(),
            profile.getFamilyMedicalHistory(),
            profile.getLifestyleInformation(),
            new EmergencyContactView(
                profile.getEmergencyContactName(),
                profile.getEmergencyContactPhone(),
                profile.getEmergencyContactRelationship(),
                hasText(profile.getEmergencyContactName()) && hasText(profile.getEmergencyContactPhone())
            ),
            allergyNames,
            conditionNames,
            medicationNames,
            readiness.percent(),
            readiness.missingFields(),
            profile.getUpdatedAt()
        );
    }

    private UserAccount requireActivePatient(UUID userId) {
        UserAccount user = users.findById(userId).orElseThrow(() -> new PatientApiException(
            HttpStatus.UNAUTHORIZED,
            "PATIENT_ACCOUNT_NOT_FOUND",
            "The authenticated Patient account is unavailable."
        ));
        if (user.getRole() != UserRole.PATIENT) {
            throw new PatientApiException(HttpStatus.FORBIDDEN, "PATIENT_ROLE_REQUIRED", "Patient access is required.");
        }
        if (!user.isLoginAllowed()) {
            throw new PatientApiException(
                HttpStatus.FORBIDDEN,
                "PATIENT_ACCOUNT_INACTIVE",
                "This Patient account is not currently active."
            );
        }
        return user;
    }

    private void validateDateOfBirth(LocalDate dateOfBirth) {
        if (dateOfBirth != null && dateOfBirth.isAfter(LocalDate.now(clock))) {
            throw new PatientApiException(
                HttpStatus.BAD_REQUEST,
                "INVALID_DATE_OF_BIRTH",
                "Date of birth cannot be in the future."
            );
        }
    }

    private List<String> cleanItems(List<String> values) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        Map<String, String> distinct = new LinkedHashMap<>();
        for (String value : values) {
            if (value == null) {
                continue;
            }
            String trimmed = value.trim().replaceAll("\\s+", " ");
            if (!trimmed.isEmpty()) {
                distinct.putIfAbsent(trimmed.toLowerCase(Locale.ROOT), trimmed);
            }
        }
        return List.copyOf(distinct.values());
    }

    private ProfileReadiness readiness(PatientProfile profile) {
        List<String> missing = new ArrayList<>();
        if (profile.getDateOfBirth() == null) missing.add("Date of birth");
        if (profile.getGender() == null) missing.add("Gender");
        if (profile.getBloodGroup() == null) missing.add("Blood group");
        if (!hasText(profile.getPhone())) missing.add("Phone");
        if (!hasText(profile.getAddress())) missing.add("Address");
        if (profile.getHeightCm() == null) missing.add("Height");
        if (profile.getWeightKg() == null) missing.add("Weight");
        if (!hasText(profile.getEmergencyContactName()) || !hasText(profile.getEmergencyContactPhone())) {
            missing.add("Emergency contact");
        }
        int total = 8;
        int completed = total - missing.size();
        return new ProfileReadiness((int) Math.round((completed * 100.0) / total), List.copyOf(missing));
    }

    private BigDecimal bmi(BigDecimal heightCm, BigDecimal weightKg) {
        if (heightCm == null || weightKg == null || heightCm.signum() <= 0) {
            return null;
        }
        BigDecimal meters = heightCm.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
        return weightKg.divide(meters.multiply(meters), 1, RoundingMode.HALF_UP);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private record ProfileReadiness(int percent, List<String> missingFields) {
    }

    public record UpdatePatientProfileCommand(
        LocalDate dateOfBirth,
        PatientGender gender,
        BloodGroup bloodGroup,
        String phone,
        String address,
        BigDecimal heightCm,
        BigDecimal weightKg,
        String familyMedicalHistory,
        String lifestyleInformation,
        String emergencyContactName,
        String emergencyContactPhone,
        String emergencyContactRelationship,
        List<String> allergies,
        List<String> chronicConditions,
        List<String> currentMedications
    ) {
    }

    public record EmergencyContactView(String name, String phone, String relationship, boolean configured) {
    }

    public record PatientProfileView(
        UUID id,
        boolean profileCreated,
        String firstName,
        String lastName,
        String email,
        LocalDate dateOfBirth,
        PatientGender gender,
        BloodGroup bloodGroup,
        String phone,
        String address,
        BigDecimal heightCm,
        BigDecimal weightKg,
        String familyMedicalHistory,
        String lifestyleInformation,
        EmergencyContactView emergencyContact,
        List<String> allergies,
        List<String> chronicConditions,
        List<String> currentMedications,
        int completenessPercent,
        List<String> missingProfileFields,
        Instant updatedAt
    ) {
        static PatientProfileView empty(UserAccount user) {
            return new PatientProfileView(
                null,
                false,
                user.getFirstName(),
                user.getLastName(),
                user.getEmail(),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                new EmergencyContactView(null, null, null, false),
                List.of(),
                List.of(),
                List.of(),
                0,
                List.of("Date of birth", "Gender", "Blood group", "Phone", "Address", "Height", "Weight", "Emergency contact"),
                null
            );
        }
    }

    public record PatientDashboardView(
        String firstName,
        String lastName,
        boolean profileCreated,
        int profileCompletenessPercent,
        List<String> missingProfileFields,
        BloodGroup bloodGroup,
        LocalDate dateOfBirth,
        BigDecimal heightCm,
        BigDecimal weightKg,
        BigDecimal bmi,
        int allergyCount,
        int chronicConditionCount,
        int medicationCount,
        boolean emergencyContactConfigured,
        Instant profileUpdatedAt
    ) {
    }
}
