package com.clinora.patients.service;

import com.clinora.patients.service.PatientProfileService.PatientProfileView;
import com.clinora.patients.service.PatientProfileService.UpdatePatientProfileCommand;
import com.clinora.patients.service.PatientTimelineService.TimelineCategory;
import java.nio.charset.StandardCharsets;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PatientProfileMutationService {
    private final PatientProfileService profiles;
    private final PatientTimelineService timeline;
    private final PatientBodyMeasurementService measurements;
    private final Clock clock;

    public PatientProfileMutationService(
        PatientProfileService profiles,
        PatientTimelineService timeline,
        PatientBodyMeasurementService measurements,
        Clock clock
    ) {
        this.profiles = profiles;
        this.timeline = timeline;
        this.measurements = measurements;
        this.clock = clock;
    }

    @Transactional
    public PatientProfileView update(
        UUID patientUserId,
        UpdatePatientProfileCommand command,
        String ipAddress,
        String userAgent
    ) {
        PatientProfileView before = profiles.profile(patientUserId);
        PatientProfileView after = profiles.update(patientUserId, command, ipAddress, userAgent);
        Instant now = clock.instant();
        String mutationKey = "profile-mutation:" + UUID.randomUUID();

        boolean measurementChanged = !same(before.heightCm(), after.heightCm())
            || !same(before.weightKg(), after.weightKg());
        boolean measurementRecorded = measurementChanged && measurements.appendProfileSnapshotIfChanged(
            patientUserId,
            after.id(),
            before.heightCm(),
            before.weightKg(),
            after.heightCm(),
            after.weightKg(),
            now,
            mutationKey + ":body-measurement"
        );

        boolean createdNow = !before.profileCreated() && after.profileCreated();
        boolean completedNow = before.completenessPercent() < 100 && after.completenessPercent() == 100;
        if (createdNow) {
            timeline.append(
                patientUserId, "PROFILE_CREATED", TimelineCategory.PROFILE, "PATIENT_PROFILE", after.id(),
                "Health profile created", "Your Clinora health record was started.", now,
                "profile-created:" + after.id()
            );
        }

        if (completedNow) {
            timeline.append(
                patientUserId, "PROFILE_COMPLETED", TimelineCategory.PROFILE, "PATIENT_PROFILE", after.id(),
                "Health profile completed", "Your essential Clinora health profile information is complete.", now,
                "profile-completed:" + after.id()
            );
        }

        if (!createdNow && personalDetailsChanged(before, after)) {
            timeline.append(
                patientUserId, "PROFILE_DETAILS_UPDATED", TimelineCategory.PROFILE, "PATIENT_PROFILE", after.id(),
                "Profile details updated", "Your saved profile details changed.", now,
                mutationKey + ":profile-details"
            );
        }

        if (!createdNow && !Objects.equals(before.bloodGroup(), after.bloodGroup())) {
            timeline.append(
                patientUserId, "BLOOD_GROUP_UPDATED", TimelineCategory.PROFILE, "PATIENT_PROFILE", after.id(),
                "Blood group updated", bloodGroupDetail(after), now,
                mutationKey + ":blood-group"
            );
        }
        if (!createdNow && !Objects.equals(before.familyMedicalHistory(), after.familyMedicalHistory())) {
            timeline.append(
                patientUserId, "FAMILY_HISTORY_UPDATED", TimelineCategory.PROFILE, "PATIENT_PROFILE", after.id(),
                "Family medical history updated", "Your current Health Profile background was updated.", now,
                mutationKey + ":family-history"
            );
        }
        if (!createdNow && !Objects.equals(before.lifestyleInformation(), after.lifestyleInformation())) {
            timeline.append(
                patientUserId, "LIFESTYLE_UPDATED", TimelineCategory.PROFILE, "PATIENT_PROFILE", after.id(),
                "Lifestyle information updated", "Your current Health Profile background was updated.", now,
                mutationKey + ":lifestyle"
            );
        }
        if (measurementChanged) {
            timeline.append(
                patientUserId,
                measurementRecorded ? "BODY_MEASUREMENT_RECORDED" : "BODY_MEASUREMENT_UPDATED",
                TimelineCategory.PROFILE,
                "PATIENT_PROFILE",
                after.id(),
                "Measurements updated",
                measurementDetail(after, measurementRecorded),
                now,
                mutationKey + ":body-measurement-event"
            );
        }

        appendCollectionChanges(patientUserId, mutationKey, "ALLERGY", before.allergies(), after.allergies(), 160, now);
        appendCollectionChanges(
            patientUserId, mutationKey, "CONDITION", before.chronicConditions(), after.chronicConditions(), 160, now
        );
        appendCollectionChanges(
            patientUserId, mutationKey, "MEDICATION", before.currentMedications(), after.currentMedications(), 200, now
        );
        return after;
    }

    private void appendCollectionChanges(
        UUID patientUserId,
        String mutationKey,
        String type,
        List<String> before,
        List<String> after,
        int maxDetail,
        Instant now
    ) {
        Map<String, String> beforeValues = normalized(before);
        Map<String, String> afterValues = normalized(after);
        afterValues.forEach((key, displayValue) -> {
            if (!beforeValues.containsKey(key)) {
                timeline.append(
                    patientUserId,
                    type + "_ADDED",
                    TimelineCategory.CONDITIONS_MEDICATIONS,
                    type,
                    null,
                    label(type) + " added",
                    truncate(displayValue, maxDetail),
                    now,
                    mutationKey + ":" + type + ":added:" + compactKey(key)
                );
            }
        });
        beforeValues.forEach((key, displayValue) -> {
            if (!afterValues.containsKey(key)) {
                timeline.append(
                    patientUserId,
                    type + "_REMOVED",
                    TimelineCategory.CONDITIONS_MEDICATIONS,
                    type,
                    null,
                    label(type) + " removed",
                    truncate(displayValue, maxDetail),
                    now,
                    mutationKey + ":" + type + ":removed:" + compactKey(key)
                );
            }
        });
    }

    private static Map<String, String> normalized(List<String> values) {
        Map<String, String> result = new LinkedHashMap<>();
        if (values == null) return result;
        for (String value : values) {
            if (value == null) continue;
            String display = value.trim().replaceAll("\\s+", " ");
            if (!display.isEmpty()) result.put(display.toLowerCase(Locale.ROOT), display);
        }
        return result;
    }

    private static boolean personalDetailsChanged(PatientProfileView before, PatientProfileView after) {
        return !Objects.equals(before.dateOfBirth(), after.dateOfBirth())
            || !Objects.equals(before.gender(), after.gender())
            || !Objects.equals(before.phone(), after.phone())
            || !Objects.equals(before.address(), after.address())
            || !Objects.equals(before.emergencyContact(), after.emergencyContact());
    }

    private static String bloodGroupDetail(PatientProfileView after) {
        if (after.bloodGroup() == null) return "Blood group was removed from your Health Profile.";
        String label = switch (after.bloodGroup()) {
            case A_POSITIVE -> "A+";
            case A_NEGATIVE -> "A−";
            case B_POSITIVE -> "B+";
            case B_NEGATIVE -> "B−";
            case AB_POSITIVE -> "AB+";
            case AB_NEGATIVE -> "AB−";
            case O_POSITIVE -> "O+";
            case O_NEGATIVE -> "O−";
        };
        return "Current value: " + label;
    }

    private static String measurementDetail(PatientProfileView after, boolean recorded) {
        if (!recorded) return "Current measurements were removed from your Health Profile.";
        java.util.ArrayList<String> values = new java.util.ArrayList<>();
        if (after.heightCm() != null) values.add("Height: " + display(after.heightCm()) + " cm");
        if (after.weightKg() != null) values.add("Weight: " + display(after.weightKg()) + " kg");
        BigDecimal bmi = PatientBodyMeasurementService.bmi(after.heightCm(), after.weightKg());
        if (bmi != null) values.add("BMI: " + bmi.toPlainString());
        return String.join(" · ", values);
    }

    private static String display(BigDecimal value) {
        return value.stripTrailingZeros().toPlainString();
    }

    private static boolean same(BigDecimal first, BigDecimal second) {
        return Objects.equals(first, second) || (first != null && second != null && first.compareTo(second) == 0);
    }

    private static String compactKey(String value) {
        return UUID.nameUUIDFromBytes(value.getBytes(StandardCharsets.UTF_8)).toString();
    }

    private static String label(String type) {
        return switch (type) {
            case "ALLERGY" -> "Allergy";
            case "CONDITION" -> "Health condition";
            case "MEDICATION" -> "Medication";
            default -> "Health record item";
        };
    }

    private static String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }
}
