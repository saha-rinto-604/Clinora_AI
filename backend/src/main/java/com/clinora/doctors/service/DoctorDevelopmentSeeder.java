package com.clinora.doctors.service;

import com.clinora.access.storage.ApplicationDocumentStoragePort;
import com.clinora.patients.storage.PatientReportStoragePort;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@Profile("dev")
@ConditionalOnProperty(name = "clinora.dev.doctors.enabled", havingValue = "true")
public class DoctorDevelopmentSeeder implements ApplicationRunner {
    private static final Logger LOGGER = LoggerFactory.getLogger(DoctorDevelopmentSeeder.class);
    private static final String TEST_DOMAIN = "@clinora.test";
    private static final String DOCUMENT_NOTICE = "Development fixture - not valid as a professional credential";

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final ApplicationDocumentStoragePort applicationStorage;
    private final PatientReportStoragePort reportStorage;
    private final Clock clock;
    private final String doctorPassword;
    private final String patientPassword;

    public DoctorDevelopmentSeeder(
        JdbcTemplate jdbc,
        PasswordEncoder passwordEncoder,
        ApplicationDocumentStoragePort applicationStorage,
        PatientReportStoragePort reportStorage,
        Clock clock,
        @Value("${clinora.dev.doctors.password:}") String doctorPassword,
        @Value("${clinora.dev.patients.password:}") String patientPassword
    ) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.applicationStorage = applicationStorage;
        this.reportStorage = reportStorage;
        this.clock = clock;
        this.doctorPassword = doctorPassword == null ? "" : doctorPassword;
        this.patientPassword = patientPassword == null ? "" : patientPassword;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (doctorPassword.isBlank()) {
            LOGGER.info("Clinora Doctor development fixtures are enabled but no Doctor password is configured; fixture seeding was skipped.");
            return;
        }
        Instant now = clock.instant();
        String doctorPasswordHash = passwordEncoder.encode(doctorPassword);

        List<DoctorFixture> doctors = doctors();
        for (DoctorFixture doctor : doctors) {
            assertFixtureAccount(doctor.email(), "DOCTOR");
            seedDoctor(doctor, doctorPasswordHash, now);
        }

        if (patientPassword.isBlank()) {
            LOGGER.warn("Doctor fixtures are ready, but supporting Patient fixtures were skipped because CLINORA_DEV_PATIENTS_PASSWORD is blank.");
            return;
        }

        String patientPasswordHash = passwordEncoder.encode(patientPassword);
        List<PatientFixture> patients = patients();
        for (PatientFixture patient : patients) {
            assertFixtureAccount(patient.email(), "PATIENT");
            seedPatient(patient, patientPasswordHash, now);
        }

        if (shouldRefreshCareScenarios()) {
            seedCareScenarios(doctors, patients, now);
        } else {
            LOGGER.info("Existing Doctor care fixtures were preserved so local appointment/report edits are not overwritten.");
        }
        LOGGER.info("Clinora Doctor development fixtures ready: {} verified Doctor accounts.", doctors.size());
    }

    private void seedDoctor(DoctorFixture doctor, String passwordHash, Instant now) {
        UUID userId = id(doctor.email(), "user");
        UUID applicationId = id(doctor.email(), "application");
        Instant createdAt = now.minus(Duration.ofDays(120));
        Instant verifiedAt = now.minus(Duration.ofDays(116));
        Instant interviewAt = now.minus(Duration.ofDays(105));
        Instant activatedAt = now.minus(Duration.ofDays(100));

        upsertUser(userId, doctor.firstName(), doctor.lastName(), doctor.email(), passwordHash, "DOCTOR", createdAt, activatedAt, now);
        jdbc.update(
            """
            INSERT INTO access_applications
                (id, application_type, first_name, last_name, email, normalized_email, phone, country_code,
                 status, processing_consent_at, email_verified_at, attested_at, submitted_at, created_at, updated_at, version)
            VALUES (?, 'DOCTOR', ?, ?, ?, ?, ?, 'BD', 'ACTIVATED', ?, ?, ?, ?, ?, ?, 0)
            ON CONFLICT (id) DO UPDATE SET
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                email = EXCLUDED.email,
                normalized_email = EXCLUDED.normalized_email,
                phone = EXCLUDED.phone,
                country_code = EXCLUDED.country_code,
                status = 'ACTIVATED',
                email_verified_at = EXCLUDED.email_verified_at,
                submitted_at = EXCLUDED.submitted_at,
                updated_at = EXCLUDED.updated_at
            """,
            applicationId,
            doctor.firstName(),
            doctor.lastName(),
            doctor.email(),
            doctor.email().toLowerCase(Locale.ROOT),
            doctor.phone(),
            Timestamp.from(createdAt.plus(Duration.ofHours(1))),
            Timestamp.from(verifiedAt),
            Timestamp.from(verifiedAt.plus(Duration.ofHours(1))),
            Timestamp.from(verifiedAt.plus(Duration.ofDays(1))),
            Timestamp.from(createdAt),
            Timestamp.from(now)
        );

        jdbc.update(
            """
            INSERT INTO doctor_application_details
                (application_id, professional_title, specialization, years_experience, current_organization,
                 current_position, professional_profile_url, registration_jurisdiction, registration_authority,
                 registration_number, registration_type, registration_issued_at, registration_valid_until)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Bangladesh', 'Bangladesh Medical and Dental Council', ?, ?, ?, ?)
            ON CONFLICT (application_id) DO UPDATE SET
                professional_title = EXCLUDED.professional_title,
                specialization = EXCLUDED.specialization,
                years_experience = EXCLUDED.years_experience,
                current_organization = EXCLUDED.current_organization,
                current_position = EXCLUDED.current_position,
                professional_profile_url = EXCLUDED.professional_profile_url,
                registration_jurisdiction = EXCLUDED.registration_jurisdiction,
                registration_authority = EXCLUDED.registration_authority,
                registration_number = EXCLUDED.registration_number,
                registration_type = EXCLUDED.registration_type,
                registration_issued_at = EXCLUDED.registration_issued_at,
                registration_valid_until = EXCLUDED.registration_valid_until
            """,
            applicationId,
            doctor.professionalTitle(),
            doctor.specialization(),
            doctor.yearsExperience(),
            doctor.organization(),
            doctor.position(),
            doctor.hasProfileUrl() ? "https://profiles.clinora.test/doctors/" + doctor.slug() : null,
            "CLINORA-TEST-" + doctor.registrationCode(),
            doctor.hasRegistrationType() ? "Full registration" : null,
            doctor.hasRegistrationIssuedAt() ? Date.valueOf(LocalDate.now(clock).minusYears(Math.max(3, doctor.yearsExperience()))) : null,
            doctor.hasRegistrationValidUntil() ? Date.valueOf(LocalDate.now(clock).plusYears(3)) : null
        );

        jdbc.update("DELETE FROM doctor_qualifications WHERE application_id = ?", applicationId);
        seedQualification(applicationId, doctor, 1, doctor.primaryQualification(), doctor.primaryInstitution(), doctor.qualificationYear());
        if (doctor.secondaryQualification() != null) {
            seedQualification(applicationId, doctor, 2, doctor.secondaryQualification(), doctor.secondaryInstitution(), doctor.qualificationYear() + 4);
        }

        seedApplicationDocument(applicationId, doctor, "CV", "cv-" + doctor.slug() + ".pdf", "Curriculum Vitae", now);
        seedApplicationDocument(applicationId, doctor, "MEDICAL_LICENSE", "registration-" + doctor.slug() + ".pdf", "Medical Registration", now);
        seedApplicationDocument(applicationId, doctor, "QUALIFICATION", "qualification-" + doctor.slug() + ".pdf", "Professional Qualification", now);
        if (doctor.hasAdditionalDocument()) {
            seedApplicationDocument(applicationId, doctor, "OTHER", "professional-development-" + doctor.slug() + ".pdf", "Professional Development", now);
        }

        seedCompletedInterview(applicationId, doctor, interviewAt, now);
        seedApplicationEvents(applicationId, doctor, createdAt, verifiedAt, interviewAt, activatedAt);
        seedBookingProfile(userId, applicationId, doctor, createdAt, now);
        seedDoctorAvailability(userId, doctor, now);
    }

    private void seedCompletedInterview(UUID applicationId, DoctorFixture doctor, Instant interviewAt, Instant now) {
        UUID interviewId = id(doctor.email(), "interview");
        jdbc.update(
            """
            INSERT INTO doctor_interviews
                (id, application_id, scheduled_start_utc, timezone, duration_minutes, status,
                 meeting_provider, applicant_instructions, completed_at, created_at, updated_at, version)
            VALUES (?, ?, ?, 'Asia/Dhaka', 30, 'COMPLETED', 'GOOGLE_MEET', ?, ?, ?, ?, 0)
            ON CONFLICT (application_id) DO UPDATE SET
                scheduled_start_utc = EXCLUDED.scheduled_start_utc,
                timezone = EXCLUDED.timezone,
                duration_minutes = EXCLUDED.duration_minutes,
                status = 'COMPLETED',
                completed_at = EXCLUDED.completed_at,
                updated_at = EXCLUDED.updated_at
            """,
            interviewId,
            applicationId,
            Timestamp.from(interviewAt),
            "Professional access interview completed and approved.",
            Timestamp.from(interviewAt.plus(Duration.ofMinutes(30))),
            Timestamp.from(interviewAt.minus(Duration.ofDays(7))),
            Timestamp.from(now)
        );
    }

    private void seedApplicationEvents(
        UUID applicationId,
        DoctorFixture doctor,
        Instant createdAt,
        Instant verifiedAt,
        Instant interviewAt,
        Instant activatedAt
    ) {
        seedApplicationEvent(applicationId, doctor, "APPLICATION_CREATED", "Professional access application started.", createdAt);
        seedApplicationEvent(applicationId, doctor, "EMAIL_VERIFIED", "Application email verified.", verifiedAt);
        seedApplicationEvent(applicationId, doctor, "SUBMITTED", "Professional access application submitted for review.", verifiedAt.plus(Duration.ofDays(1)));
        seedApplicationEvent(applicationId, doctor, "REVIEW_STARTED", "Application review started.", verifiedAt.plus(Duration.ofDays(3)));
        seedApplicationEvent(applicationId, doctor, "DOCTOR_INTERVIEW_REQUIRED", "Professional interview required.", verifiedAt.plus(Duration.ofDays(5)));
        seedApplicationEvent(applicationId, doctor, "DOCTOR_INTERVIEW_SCHEDULED", "Professional interview scheduled.", interviewAt.minus(Duration.ofDays(7)));
        seedApplicationEvent(applicationId, doctor, "DOCTOR_INTERVIEW_COMPLETED", "Professional interview completed.", interviewAt.plus(Duration.ofMinutes(30)));
        seedApplicationEvent(applicationId, doctor, "APPLICATION_APPROVED", "Professional access application approved.", interviewAt.plus(Duration.ofDays(1)));
        seedApplicationEvent(applicationId, doctor, "ACCOUNT_ACTIVATION_SENT", "Account activation instructions sent.", activatedAt.minus(Duration.ofHours(2)));
        seedApplicationEvent(applicationId, doctor, "ACCOUNT_ACTIVATED", "Professional account activated.", activatedAt);
    }

    private void seedApplicationEvent(
        UUID applicationId,
        DoctorFixture doctor,
        String eventType,
        String message,
        Instant createdAt
    ) {
        jdbc.update(
            """
            INSERT INTO application_events (id, application_id, event_type, public_message, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (id) DO NOTHING
            """,
            id(doctor.email(), "application-event-" + eventType.toLowerCase(Locale.ROOT)),
            applicationId,
            eventType,
            message,
            Timestamp.from(createdAt)
        );
    }

    private void seedBookingProfile(UUID userId, UUID applicationId, DoctorFixture doctor, Instant createdAt, Instant now) {
        jdbc.update(
            """
            INSERT INTO doctor_booking_profiles
                (doctor_user_id, application_id, display_name, professional_title, specialization, years_experience,
                 current_organization, current_position, registration_jurisdiction, registration_authority,
                 registration_type, registration_valid_until, booking_enabled,
                 professional_bio, professional_profile_url, display_title, preferred_timezone,
                 default_consultation_minutes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Bangladesh', 'Bangladesh Medical and Dental Council', ?, ?, TRUE, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (doctor_user_id) DO UPDATE SET
                application_id = EXCLUDED.application_id,
                display_name = EXCLUDED.display_name,
                professional_title = EXCLUDED.professional_title,
                specialization = EXCLUDED.specialization,
                years_experience = EXCLUDED.years_experience,
                current_organization = CASE WHEN doctor_booking_profiles.profile_version = 0 THEN EXCLUDED.current_organization ELSE doctor_booking_profiles.current_organization END,
                current_position = CASE WHEN doctor_booking_profiles.profile_version = 0 THEN EXCLUDED.current_position ELSE doctor_booking_profiles.current_position END,
                registration_jurisdiction = EXCLUDED.registration_jurisdiction,
                registration_authority = EXCLUDED.registration_authority,
                registration_type = EXCLUDED.registration_type,
                registration_valid_until = EXCLUDED.registration_valid_until,
                professional_bio = CASE WHEN doctor_booking_profiles.profile_version = 0 THEN EXCLUDED.professional_bio ELSE doctor_booking_profiles.professional_bio END,
                professional_profile_url = CASE WHEN doctor_booking_profiles.profile_version = 0 THEN EXCLUDED.professional_profile_url ELSE doctor_booking_profiles.professional_profile_url END,
                display_title = CASE WHEN doctor_booking_profiles.profile_version = 0 THEN EXCLUDED.display_title ELSE doctor_booking_profiles.display_title END,
                preferred_timezone = CASE WHEN doctor_booking_profiles.profile_version = 0 THEN EXCLUDED.preferred_timezone ELSE doctor_booking_profiles.preferred_timezone END,
                default_consultation_minutes = CASE WHEN doctor_booking_profiles.profile_version = 0 THEN EXCLUDED.default_consultation_minutes ELSE doctor_booking_profiles.default_consultation_minutes END,
                updated_at = EXCLUDED.updated_at
            """,
            userId,
            applicationId,
            "Dr. " + doctor.firstName() + " " + doctor.lastName(),
            doctor.professionalTitle(),
            doctor.specialization(),
            doctor.yearsExperience(),
            doctor.organization(),
            doctor.position(),
            doctor.hasRegistrationType() ? "Full registration" : null,
            doctor.hasRegistrationValidUntil() ? Date.valueOf(LocalDate.now(clock).plusYears(3)) : null,
            doctor.hasRegistrationValidUntil()
                ? doctor.professionalTitle() + " in " + doctor.specialization() + " with " + doctor.yearsExperience()
                    + " years of clinical experience, currently practicing at " + doctor.organization() + "."
                : null,
            doctor.hasProfileUrl() ? "https://clinora.test/doctors/" + doctor.slug() : null,
            doctor.hasRegistrationType() ? doctor.professionalTitle() : null,
            doctor.hasRegistrationIssuedAt() ? "Asia/Dhaka" : null,
            doctor.hasAvailability() ? 30 : null,
            Timestamp.from(createdAt),
            Timestamp.from(now)
        );
    }

    private void seedDoctorAvailability(UUID doctorId, DoctorFixture doctor, Instant now) {
        if (!doctor.hasAvailability()) return;
        Integer futureSlots = jdbc.queryForObject(
            "SELECT COUNT(*)::int FROM doctor_availability_slots WHERE doctor_user_id = ? AND starts_at > CURRENT_TIMESTAMP",
            Integer.class,
            doctorId
        );
        if (futureSlots != null && futureSlots > 0) return;

        for (int index = 0; index < 4; index++) {
            Instant startsAt = roundToQuarterHour(now.plus(Duration.ofHours(30L + doctor.ordinal() * 2L + index * 24L)));
            Instant endsAt = startsAt.plus(Duration.ofMinutes(30));
            upsertSlot(id(doctor.email(), "available-slot-" + index), doctorId, startsAt, endsAt, "AVAILABLE", now);
        }
    }

    private void seedQualification(UUID applicationId, DoctorFixture doctor, int ordinal, String name, String institution, int year) {
        jdbc.update(
            """
            INSERT INTO doctor_qualifications (id, application_id, qualification_name, institution, country_code, completion_year)
            VALUES (?, ?, ?, ?, 'Bangladesh', ?)
            """,
            id(doctor.email(), "qualification-" + ordinal),
            applicationId,
            name,
            institution,
            year
        );
    }

    private void seedApplicationDocument(
        UUID applicationId,
        DoctorFixture doctor,
        String type,
        String filename,
        String title,
        Instant now
    ) {
        String objectKey = "applications/" + applicationId + "/development/" + filename;
        byte[] bytes = professionalDocumentPdf(title, doctor);
        applicationStorage.put(objectKey, bytes, "application/pdf");
        jdbc.update(
            """
            INSERT INTO application_documents
                (id, application_id, document_type, object_key, original_filename, mime_type, size_bytes, sha256_checksum, created_at)
            VALUES (?, ?, ?, ?, ?, 'application/pdf', ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET
                object_key = EXCLUDED.object_key,
                original_filename = EXCLUDED.original_filename,
                mime_type = EXCLUDED.mime_type,
                size_bytes = EXCLUDED.size_bytes,
                sha256_checksum = EXCLUDED.sha256_checksum
            """,
            id(doctor.email(), "document-" + type),
            applicationId,
            type,
            objectKey,
            filename,
            bytes.length,
            sha256(bytes),
            Timestamp.from(now.minus(Duration.ofDays(114)))
        );
    }

    private void seedPatient(PatientFixture patient, String passwordHash, Instant now) {
        UUID userId = id(patient.email(), "user");
        UUID profileId = id(patient.email(), "profile");
        upsertUser(
            userId,
            patient.firstName(),
            patient.lastName(),
            patient.email(),
            passwordHash,
            "PATIENT",
            now.minus(Duration.ofDays(180)),
            now.minus(Duration.ofDays(179)),
            now
        );

        Integer existingProfiles = jdbc.queryForObject(
            "SELECT COUNT(*)::int FROM patient_profiles WHERE user_id = ?",
            Integer.class,
            userId
        );
        if (existingProfiles != null && existingProfiles > 0) {
            return;
        }

        jdbc.update(
            """
            INSERT INTO patient_profiles
                (id, user_id, date_of_birth, gender, blood_group, phone, created_at, updated_at, version)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
            ON CONFLICT (user_id) DO NOTHING
            """,
            profileId,
            userId,
            Date.valueOf(patient.dateOfBirth()),
            patient.gender(),
            patient.bloodGroup(),
            patient.phone(),
            Timestamp.from(now.minus(Duration.ofDays(180))),
            Timestamp.from(now)
        );
        seedClinicalList("patient_allergies", profileId, patient.email(), "allergy", patient.allergies(), now);
        seedClinicalList("patient_chronic_conditions", profileId, patient.email(), "condition", patient.conditions(), now);
        seedClinicalList("patient_current_medications", profileId, patient.email(), "medication", patient.medications(), now);
    }

    private void seedClinicalList(String table, UUID profileId, String email, String key, List<String> values, Instant now) {
        for (int index = 0; index < values.size(); index++) {
            jdbc.update(
                "INSERT INTO " + table + " (id, patient_profile_id, name, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING",
                id(email, key + "-" + index),
                profileId,
                values.get(index),
                Timestamp.from(now.minus(Duration.ofDays(90)))
            );
        }
    }

    private boolean shouldRefreshCareScenarios() {
        Integer activeFuture = jdbc.queryForObject(
            """
            SELECT COUNT(*)::int
            FROM appointments
            WHERE idempotency_key LIKE 'phase6-dev-%'
              AND status = 'BOOKED'
              AND scheduled_end >= CURRENT_TIMESTAMP
            """,
            Integer.class
        );
        if (activeFuture != null && activeFuture > 0) return false;

        Instant startOfDay = LocalDate.now(clock).atStartOfDay(java.time.ZoneId.of("Asia/Dhaka")).toInstant();
        Integer touchedToday = jdbc.queryForObject(
            """
            SELECT COUNT(*)::int
            FROM appointments
            WHERE idempotency_key LIKE 'phase6-dev-%'
              AND updated_at >= ?
            """,
            Integer.class,
            Timestamp.from(startOfDay)
        );
        return touchedToday == null || touchedToday == 0;
    }

    private void seedCareScenarios(List<DoctorFixture> doctors, List<PatientFixture> patients, Instant now) {
        // A small, realistic spread gives the Doctor UI meaningful states without granting broad Patient access.
        ReportFixture rumanaCbc = seedReport(
            patients.get(0),
            "cbc-august",
            "Complete Blood Count",
            "LAB_RESULTS",
            LocalDate.now(clock).minusDays(18),
            "Dhaka Central Diagnostic Laboratory",
            List.of(
                observation("Hemoglobin", "11.2", "g/dL", "12.0 - 15.0", "12.0", "15.0", "L", "BELOW_REPORTED_RANGE", "PATIENT_CONFIRMED"),
                observation("WBC", "5.8", "10^9/L", "4.0 - 11.0", "4.0", "11.0", null, "WITHIN_REPORTED_RANGE", "PATIENT_CONFIRMED"),
                observation("Platelet Count", "245", "10^9/L", "150 - 450", "150", "450", null, "WITHIN_REPORTED_RANGE", "PATIENT_CONFIRMED")
            ),
            now
        );
        ReportFixture rumanaMetabolic = seedReport(
            patients.get(0),
            "metabolic-september",
            "Metabolic & Glucose Profile",
            "LAB_RESULTS",
            LocalDate.now(clock).minusDays(4),
            "Dhaka Central Diagnostic Laboratory",
            List.of(
                observation("Fasting Glucose", "6.4", "mmol/L", "3.9 - 5.5", "3.9", "5.5", "H", "ABOVE_REPORTED_RANGE", "PATIENT_CORRECTED"),
                observation("Creatinine", "0.9", "mg/dL", "0.6 - 1.1", "0.6", "1.1", null, "WITHIN_REPORTED_RANGE", "PATIENT_CONFIRMED"),
                observation("ALT", "31", "U/L", "7 - 35", "7", "35", null, "WITHIN_REPORTED_RANGE", "PATIENT_CONFIRMED")
            ),
            now
        );
        ReportFixture fahimLipid = seedReport(
            patients.get(1),
            "lipid-profile",
            "Lipid Profile",
            "LAB_RESULTS",
            LocalDate.now(clock).minusDays(11),
            "Uttara Clinical Laboratory",
            List.of(
                observation("Total Cholesterol", "212", "mg/dL", "< 200", null, "200", "H", "ABOVE_REPORTED_RANGE", "PATIENT_CONFIRMED"),
                observation("LDL Cholesterol", "138", "mg/dL", "< 100", null, "100", "H", "ABOVE_REPORTED_RANGE", "PATIENT_CONFIRMED"),
                observation("HDL Cholesterol", "52", "mg/dL", "> 40", "40", null, null, "WITHIN_REPORTED_RANGE", "PATIENT_CONFIRMED")
            ),
            now
        );

        AppointmentFixture first = seedAppointment(doctors.get(0), patients.get(0), "today-rumana", now.plus(Duration.ofHours(2)), "Follow-up for fatigue and recent blood tests", now);
        share(first, rumanaCbc, false, now);

        AppointmentFixture second = seedAppointment(doctors.get(1), patients.get(0), "compare-rumana", now.plus(Duration.ofHours(27)), "Review recent laboratory results", now);
        share(second, rumanaCbc, false, now);
        share(second, rumanaMetabolic, false, now);

        seedAppointment(doctors.get(2), patients.get(2), "no-report", now.plus(Duration.ofHours(50)), "Thyroid follow-up consultation", now);

        AppointmentFixture revoked = seedAppointment(doctors.get(3), patients.get(1), "revoked-report", now.plus(Duration.ofHours(74)), "Cardiovascular risk review", now);
        share(revoked, fahimLipid, true, now);

        seedAppointment(doctors.get(4), patients.get(3), "paediatric-follow-up", now.plus(Duration.ofHours(5)), "Recurring cough and follow-up", now);

        seedPastAppointment(doctors.get(0), patients.get(4), "completed-history", now.minus(Duration.ofDays(14)), "Routine medicine follow-up", "COMPLETED", now);
        seedPastAppointment(doctors.get(5), patients.get(5), "cancelled-history", now.minus(Duration.ofDays(9)), "Neurology review", "CANCELLED", now);
    }

    private AppointmentFixture seedAppointment(
        DoctorFixture doctor,
        PatientFixture patient,
        String key,
        Instant startsAt,
        String reason,
        Instant now
    ) {
        UUID doctorId = id(doctor.email(), "user");
        UUID patientId = id(patient.email(), "user");
        UUID slotId = id(doctor.email(), "appointment-slot-" + key);
        UUID appointmentId = id(doctor.email() + ":" + patient.email(), "appointment-" + key);
        Instant start = roundToQuarterHour(startsAt);
        Instant end = start.plus(Duration.ofMinutes(30));
        upsertSlot(slotId, doctorId, start, end, "BOOKED", now);
        jdbc.update(
            """
            INSERT INTO appointments
                (id, patient_user_id, doctor_user_id, slot_id, status, reason_for_visit,
                 scheduled_start, scheduled_end, booking_timezone, idempotency_key,
                 booked_at, created_at, updated_at, version)
            VALUES (?, ?, ?, ?, 'BOOKED', ?, ?, ?, 'Asia/Dhaka', ?, ?, ?, ?, 0)
            ON CONFLICT (id) DO UPDATE SET
                patient_user_id = EXCLUDED.patient_user_id,
                doctor_user_id = EXCLUDED.doctor_user_id,
                slot_id = EXCLUDED.slot_id,
                status = 'BOOKED',
                reason_for_visit = EXCLUDED.reason_for_visit,
                scheduled_start = EXCLUDED.scheduled_start,
                scheduled_end = EXCLUDED.scheduled_end,
                booking_timezone = EXCLUDED.booking_timezone,
                cancelled_at = NULL,
                cancellation_reason = NULL,
                updated_at = EXCLUDED.updated_at
            """,
            appointmentId,
            patientId,
            doctorId,
            slotId,
            reason,
            Timestamp.from(start),
            Timestamp.from(end),
            "phase6-dev-" + key + "-" + patient.email(),
            Timestamp.from(now.minus(Duration.ofDays(2))),
            Timestamp.from(now.minus(Duration.ofDays(2))),
            Timestamp.from(now)
        );
        return new AppointmentFixture(appointmentId, patientId, doctorId);
    }

    private void seedPastAppointment(
        DoctorFixture doctor,
        PatientFixture patient,
        String key,
        Instant startsAt,
        String reason,
        String status,
        Instant now
    ) {
        UUID doctorId = id(doctor.email(), "user");
        UUID patientId = id(patient.email(), "user");
        UUID slotId = id(doctor.email(), "appointment-slot-" + key);
        UUID appointmentId = id(doctor.email() + ":" + patient.email(), "appointment-" + key);
        Instant start = roundToQuarterHour(startsAt);
        Instant end = start.plus(Duration.ofMinutes(30));
        upsertSlot(slotId, doctorId, start, end, "CANCELLED".equals(status) ? "AVAILABLE" : "BOOKED", now);
        jdbc.update(
            """
            INSERT INTO appointments
                (id, patient_user_id, doctor_user_id, slot_id, status, reason_for_visit,
                 scheduled_start, scheduled_end, booking_timezone, idempotency_key,
                 booked_at, cancelled_at, cancellation_reason, created_at, updated_at, version)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Asia/Dhaka', ?, ?, ?, ?, ?, ?, 0)
            ON CONFLICT (id) DO UPDATE SET
                status = EXCLUDED.status,
                scheduled_start = EXCLUDED.scheduled_start,
                scheduled_end = EXCLUDED.scheduled_end,
                cancelled_at = EXCLUDED.cancelled_at,
                cancellation_reason = EXCLUDED.cancellation_reason,
                updated_at = EXCLUDED.updated_at
            """,
            appointmentId,
            patientId,
            doctorId,
            slotId,
            status,
            reason,
            Timestamp.from(start),
            Timestamp.from(end),
            "phase6-dev-" + key + "-" + patient.email(),
            Timestamp.from(start.minus(Duration.ofDays(4))),
            "CANCELLED".equals(status) ? Timestamp.from(start.minus(Duration.ofDays(2))) : null,
            "CANCELLED".equals(status) ? "Schedule changed" : null,
            Timestamp.from(start.minus(Duration.ofDays(4))),
            Timestamp.from(now)
        );
    }

    private void upsertSlot(UUID slotId, UUID doctorId, Instant startsAt, Instant endsAt, String status, Instant now) {
        jdbc.update(
            """
            INSERT INTO doctor_availability_slots
                (id, doctor_user_id, starts_at, ends_at, timezone, status, created_at, updated_at, version)
            VALUES (?, ?, ?, ?, 'Asia/Dhaka', ?, ?, ?, 0)
            ON CONFLICT (id) DO UPDATE SET
                doctor_user_id = EXCLUDED.doctor_user_id,
                starts_at = EXCLUDED.starts_at,
                ends_at = EXCLUDED.ends_at,
                timezone = EXCLUDED.timezone,
                status = EXCLUDED.status,
                updated_at = EXCLUDED.updated_at,
                version = doctor_availability_slots.version + 1
            """,
            slotId,
            doctorId,
            Timestamp.from(startsAt),
            Timestamp.from(endsAt),
            status,
            Timestamp.from(now.minus(Duration.ofDays(3))),
            Timestamp.from(now)
        );
    }

    private ReportFixture seedReport(
        PatientFixture patient,
        String key,
        String reportName,
        String reportType,
        LocalDate reportDate,
        String laboratory,
        List<ObservationFixture> observations,
        Instant now
    ) {
        UUID patientId = id(patient.email(), "user");
        UUID reportId = id(patient.email(), "report-" + key);
        String objectKey = "patients/" + patientId + "/development/" + key + ".pdf";
        String filename = key + ".pdf";
        byte[] bytes = reportPdf(reportName, patient, laboratory, reportDate, observations);
        String checksum = sha256(bytes);
        reportStorage.put(objectKey, bytes, "application/pdf");
        jdbc.update(
            """
            INSERT INTO patient_medical_reports
                (id, patient_user_id, report_name, report_type, report_date, provider_laboratory,
                 object_key, original_filename, mime_type, size_bytes, sha256_checksum,
                 created_at, updated_at, version)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'application/pdf', ?, ?, ?, ?, 0)
            ON CONFLICT (id) DO UPDATE SET
                report_name = EXCLUDED.report_name,
                report_type = EXCLUDED.report_type,
                report_date = EXCLUDED.report_date,
                provider_laboratory = EXCLUDED.provider_laboratory,
                object_key = EXCLUDED.object_key,
                original_filename = EXCLUDED.original_filename,
                mime_type = EXCLUDED.mime_type,
                size_bytes = EXCLUDED.size_bytes,
                sha256_checksum = EXCLUDED.sha256_checksum,
                archived_at = NULL,
                updated_at = EXCLUDED.updated_at
            """,
            reportId,
            patientId,
            reportName,
            reportType,
            Date.valueOf(reportDate),
            laboratory,
            objectKey,
            filename,
            bytes.length,
            checksum,
            Timestamp.from(now.minus(Duration.ofDays(5))),
            Timestamp.from(now)
        );
        seedVerifiedExtraction(patient, reportId, key, checksum, observations, now);
        return new ReportFixture(reportId, patientId);
    }

    private void seedVerifiedExtraction(
        PatientFixture patient,
        UUID reportId,
        String key,
        String checksum,
        List<ObservationFixture> observations,
        Instant now
    ) {
        UUID patientId = id(patient.email(), "user");
        UUID jobId = id(patient.email(), "ocr-job-" + key);
        UUID resultId = id(patient.email(), "ocr-result-" + key);
        jdbc.update(
            """
            INSERT INTO medical_report_extraction_jobs
                (id, report_id, patient_user_id, source_checksum, status, engine, engine_version,
                 pipeline_profile, attempt_count, requested_at, started_at, completed_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'SUCCEEDED', 'PaddleOCR', '3.3.0', 'clinora-lab-v1', 1, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO NOTHING
            """,
            jobId,
            reportId,
            patientId,
            checksum,
            Timestamp.from(now.minus(Duration.ofDays(4))),
            Timestamp.from(now.minus(Duration.ofDays(4)).plusSeconds(2)),
            Timestamp.from(now.minus(Duration.ofDays(4)).plusSeconds(7)),
            Timestamp.from(now.minus(Duration.ofDays(4))),
            Timestamp.from(now)
        );
        jdbc.update(
            """
            INSERT INTO medical_report_extraction_results
                (id, job_id, report_id, document_type, page_count, overall_confidence,
                 parser_version, normalizer_version, review_status, confirmed_at, created_at, updated_at)
            VALUES (?, ?, ?, 'LAB_RESULTS', 1, 0.985, 'clinora-lab-parser-v1', 'clinora-lab-normalizer-v1',
                    'VERIFIED', ?, ?, ?)
            ON CONFLICT (id) DO NOTHING
            """,
            resultId,
            jobId,
            reportId,
            Timestamp.from(now.minus(Duration.ofDays(3))),
            Timestamp.from(now.minus(Duration.ofDays(4))),
            Timestamp.from(now)
        );

        for (int index = 0; index < observations.size(); index++) {
            ObservationFixture observation = observations.get(index);
            UUID observationId = id(patient.email(), "ocr-observation-" + key + "-" + index);
            jdbc.update(
                """
                INSERT INTO medical_report_observations
                    (id, extraction_result_id, source_label, normalized_label, effective_label,
                     ocr_value_type, effective_value_type, ocr_numeric_value, effective_numeric_value,
                     ocr_unit, effective_unit, reference_range_raw, reference_low, reference_high,
                     source_flag, derived_range_flag, page_number, ocr_confidence, review_required,
                     verification_status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'NUMERIC', 'NUMERIC', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0.99, FALSE, ?, ?, ?)
                ON CONFLICT (id) DO NOTHING
                """,
                observationId,
                resultId,
                observation.label(),
                observation.label().toLowerCase(Locale.ROOT),
                observation.label(),
                new BigDecimal(observation.value()),
                new BigDecimal(observation.value()),
                observation.unit(),
                observation.unit(),
                observation.referenceRange(),
                decimal(observation.referenceLow()),
                decimal(observation.referenceHigh()),
                observation.sourceFlag(),
                observation.derivedRangeFlag(),
                observation.verificationStatus(),
                Timestamp.from(now.minus(Duration.ofDays(4))),
                Timestamp.from(now)
            );
        }
    }

    private void share(AppointmentFixture appointment, ReportFixture report, boolean revoked, Instant now) {
        UUID shareId = id(appointment.appointmentId() + ":" + report.reportId(), "share");
        Instant sharedAt = now.minus(Duration.ofHours(12));
        jdbc.update(
            """
            INSERT INTO appointment_report_shares
                (id, appointment_id, report_id, patient_user_id, doctor_user_id, shared_at, revoked_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (appointment_id, report_id) DO UPDATE SET
                patient_user_id = EXCLUDED.patient_user_id,
                doctor_user_id = EXCLUDED.doctor_user_id,
                shared_at = EXCLUDED.shared_at,
                revoked_at = EXCLUDED.revoked_at
            """,
            shareId,
            appointment.appointmentId(),
            report.reportId(),
            appointment.patientId(),
            appointment.doctorId(),
            Timestamp.from(sharedAt),
            revoked ? Timestamp.from(now.minus(Duration.ofHours(1))) : null,
            Timestamp.from(sharedAt)
        );
    }

    private void upsertUser(
        UUID userId,
        String firstName,
        String lastName,
        String email,
        String passwordHash,
        String role,
        Instant createdAt,
        Instant verifiedAt,
        Instant now
    ) {
        jdbc.update(
            """
            INSERT INTO users
                (id, first_name, last_name, email, normalized_email, password_hash, role, account_status,
                 email_verified_at, created_at, updated_at, version)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, 0)
            ON CONFLICT (normalized_email) DO UPDATE SET
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                email = EXCLUDED.email,
                password_hash = EXCLUDED.password_hash,
                updated_at = EXCLUDED.updated_at
            """,
            userId,
            firstName,
            lastName,
            email,
            email.toLowerCase(Locale.ROOT),
            passwordHash,
            role,
            Timestamp.from(verifiedAt),
            Timestamp.from(createdAt),
            Timestamp.from(now)
        );
    }

    private void assertFixtureAccount(String email, String expectedRole) {
        if (!email.toLowerCase(Locale.ROOT).endsWith(TEST_DOMAIN)) {
            throw new IllegalStateException("Development fixture email must use @clinora.test");
        }
        UUID expectedId = id(email, "user");
        var rows = jdbc.query(
            "SELECT id, role FROM users WHERE normalized_email = lower(?)",
            (rs, rowNum) -> new ExistingUser(rs.getObject("id", UUID.class), rs.getString("role")),
            email
        );
        if (!rows.isEmpty() && (!expectedId.equals(rows.getFirst().id()) || !expectedRole.equals(rows.getFirst().role()))) {
            throw new IllegalStateException("Refusing to overwrite a non-fixture account for " + email);
        }
    }

    private static Instant roundToQuarterHour(Instant value) {
        long quarter = 15L * 60L;
        long seconds = value.getEpochSecond();
        long rounded = ((seconds + quarter - 1) / quarter) * quarter;
        return Instant.ofEpochSecond(rounded);
    }

    private static BigDecimal decimal(String value) {
        return value == null ? null : new BigDecimal(value);
    }

    private static ObservationFixture observation(
        String label,
        String value,
        String unit,
        String referenceRange,
        String referenceLow,
        String referenceHigh,
        String sourceFlag,
        String derivedRangeFlag,
        String verificationStatus
    ) {
        return new ObservationFixture(label, value, unit, referenceRange, referenceLow, referenceHigh, sourceFlag, derivedRangeFlag, verificationStatus);
    }

    private static UUID id(String namespace, String purpose) {
        return UUID.nameUUIDFromBytes(
            ("clinora-phase6-development:" + namespace.toLowerCase(Locale.ROOT) + ":" + purpose)
                .getBytes(StandardCharsets.UTF_8)
        );
    }

    private static String sha256(byte[] bytes) {
        try {
            return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to hash development fixture", exception);
        }
    }

    private static byte[] professionalDocumentPdf(String title, DoctorFixture doctor) {
        List<String> lines = new ArrayList<>();
        lines.add("Dr. " + doctor.firstName() + " " + doctor.lastName());
        if (title.equals("Curriculum Vitae")) {
            lines.add(doctor.professionalTitle() + " | " + doctor.specialization());
            lines.add("Current appointment: " + doctor.position() + ", " + doctor.organization());
            lines.add("Clinical experience: " + doctor.yearsExperience() + " years");
            lines.add("Primary qualification: " + doctor.primaryQualification());
            lines.add("Institution: " + doctor.primaryInstitution() + " | " + doctor.qualificationYear());
            if (doctor.secondaryQualification() != null) {
                lines.add("Postgraduate qualification: " + doctor.secondaryQualification());
                lines.add("Institution: " + doctor.secondaryInstitution());
            }
            lines.add("Professional focus: outpatient assessment, longitudinal care and evidence-based follow-up.");
        } else if (title.equals("Medical Registration")) {
            lines.add("Jurisdiction: Bangladesh");
            lines.add("Registration authority: Bangladesh Medical and Dental Council");
            lines.add("Verification reference: CLINORA-TEST-" + doctor.registrationCode());
            lines.add("Professional field: " + doctor.specialization());
            lines.add("Current organization: " + doctor.organization());
        } else if (title.equals("Professional Qualification")) {
            lines.add(doctor.primaryQualification() + " | " + doctor.primaryInstitution());
            lines.add("Completion year: " + doctor.qualificationYear());
            if (doctor.secondaryQualification() != null) {
                lines.add(doctor.secondaryQualification() + " | " + doctor.secondaryInstitution());
                lines.add("Postgraduate completion year: " + (doctor.qualificationYear() + 4));
            }
            lines.add("Clinical specialty: " + doctor.specialization());
        } else {
            lines.add("Continuing professional development record");
            lines.add("Clinical specialty: " + doctor.specialization());
            lines.add("Current role: " + doctor.position() + ", " + doctor.organization());
            lines.add("Evidence maintained for professional profile review.");
        }
        lines.add(" ");
        lines.add(DOCUMENT_NOTICE);
        return simplePdf(title, lines);
    }

    private static byte[] reportPdf(
        String reportName,
        PatientFixture patient,
        String laboratory,
        LocalDate reportDate,
        List<ObservationFixture> observations
    ) {
        List<String> lines = new ArrayList<>();
        lines.add("Patient: " + patient.firstName() + " " + patient.lastName());
        lines.add("Report date: " + reportDate);
        lines.add("Laboratory: " + laboratory);
        lines.add(" ");
        for (ObservationFixture observation : observations) {
            lines.add(observation.label() + ": " + observation.value() + " " + observation.unit() + "   Ref: " + observation.referenceRange());
        }
        lines.add(" ");
        return simplePdf(reportName, lines);
    }

    private static byte[] simplePdf(String title, List<String> lines) {
        try {
            StringBuilder stream = new StringBuilder("BT\n/F1 15 Tf\n72 750 Td\n");
            stream.append('(').append(pdfEscape(title)).append(") Tj\n0 -28 Td\n/F1 10 Tf\n");
            for (String line : lines) {
                stream.append('(').append(pdfEscape(line)).append(") Tj\n0 -18 Td\n");
            }
            stream.append("ET\n");
            byte[] streamBytes = stream.toString().getBytes(StandardCharsets.US_ASCII);
            List<String> objects = List.of(
                "<< /Type /Catalog /Pages 2 0 R >>",
                "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
                "<< /Length " + streamBytes.length + " >>\nstream\n" + stream + "endstream",
                "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
            );
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            out.write("%PDF-1.4\n".getBytes(StandardCharsets.US_ASCII));
            List<Integer> offsets = new ArrayList<>();
            for (int index = 0; index < objects.size(); index++) {
                offsets.add(out.size());
                out.write(((index + 1) + " 0 obj\n" + objects.get(index) + "\nendobj\n").getBytes(StandardCharsets.US_ASCII));
            }
            int xref = out.size();
            out.write(("xref\n0 " + (objects.size() + 1) + "\n").getBytes(StandardCharsets.US_ASCII));
            out.write("0000000000 65535 f \n".getBytes(StandardCharsets.US_ASCII));
            for (Integer offset : offsets) {
                out.write(String.format(Locale.ROOT, "%010d 00000 n \n", offset).getBytes(StandardCharsets.US_ASCII));
            }
            out.write(("trailer\n<< /Size " + (objects.size() + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n")
                .getBytes(StandardCharsets.US_ASCII));
            return out.toByteArray();
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to build development PDF", exception);
        }
    }

    private static String pdfEscape(String value) {
        return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)");
    }

    private static List<DoctorFixture> doctors() {
        return List.of(
            doctor(0, "Arafat", "Hossain", "arafat.hossain.doctor@clinora.test", "01711001001", "Consultant Physician", "Internal Medicine", 9, "Dhaka Central Medical Centre", "Consultant", "MBBS", "Dhaka Central Medical College", 2012, "FCPS (Medicine)", "Bangladesh College of Physicians and Surgeons", "1001", false, false, false, false, false, false),
            doctor(1, "Nusrat", "Jahan", "nusrat.jahan.doctor@clinora.test", "01711001002", "Consultant", "Obstetrics & Gynaecology", 8, "Dhanmondi Women's Health Centre", "Consultant", "MBBS", "Metropolitan Medical College", 2013, "FCPS (Obstetrics & Gynaecology)", "Bangladesh College of Physicians and Surgeons", "1002", false, true, false, false, false, false),
            doctor(2, "Farzana", "Rahman", "farzana.rahman.doctor@clinora.test", "01711001003", "Consultant", "Endocrinology", 11, "Green Crescent Specialist Centre", "Senior Consultant", "MBBS", "Mymensingh Clinical College", 2010, "MD (Endocrinology)", "Bangladesh Postgraduate Medical Institute", "1003", true, false, false, false, false, false),
            doctor(3, "Tanvir", "Ahmed", "tanvir.ahmed.doctor@clinora.test", "01711001004", "Consultant Cardiologist", "Cardiology", 12, "Uttara Heart & Medical Centre", "Consultant Cardiologist", "MBBS", "Chattogram Central Medical College", 2009, "MD (Cardiology)", "National Cardiac Training Institute", "1004", true, true, false, false, false, false),
            doctor(4, "Samira", "Islam", "samira.islam.doctor@clinora.test", "01711001005", "Consultant", "Paediatrics", 7, "Dhaka Child & Family Clinic", "Consultant", "MBBS", "Metropolitan Medical College", 2014, "FCPS (Paediatrics)", "Bangladesh College of Physicians and Surgeons", "1005", true, true, true, false, false, false),
            doctor(5, "Mahmudul", "Hasan", "mahmudul.hasan.doctor@clinora.test", "01711001006", "Senior Consultant", "Neurology", 13, "Dhaka Neuroscience Clinic", "Senior Consultant", "MBBS", "Rajshahi Central Medical College", 2008, "MD (Neurology)", "Bangladesh Postgraduate Medical Institute", "1006", false, false, false, true, true, false),
            doctor(6, "Sadia", "Karim", "sadia.karim.doctor@clinora.test", "01711001007", "Consultant", "Dermatology", 6, "Gulshan Skin & Wellness Centre", "Consultant", "MBBS", "Sylhet Metropolitan Medical College", 2015, "DDV", "Bangladesh Postgraduate Medical Institute", "1007", true, true, false, false, true, false),
            doctor(7, "Imran", "Hossain", "imran.hossain.doctor@clinora.test", "01711001008", "Consultant", "Nephrology", 10, "Dhaka Kidney Care Centre", "Consultant", "MBBS", "Dhaka Central Medical College", 2011, "MD (Nephrology)", "Bangladesh Postgraduate Medical Institute", "1008", false, true, false, true, true, false),
            doctor(8, "Tasnim", "Akter", "tasnim.akter.doctor@clinora.test", "01711001009", "Consultant Haematologist", "Haematology", 9, "Central Haematology Clinic", "Consultant", "MBBS", "Rangpur Metropolitan Medical College", 2012, "MD (Haematology)", "Bangladesh Postgraduate Medical Institute", "1009", true, true, true, false, true, false),
            doctor(9, "Farhan", "Kabir", "farhan.kabir.doctor@clinora.test", "01711001010", "Consultant", "Gastroenterology", 10, "Dhanmondi Digestive Health Centre", "Consultant", "MBBS", "Barishal Central Medical College", 2011, "MD (Gastroenterology)", "Bangladesh Postgraduate Medical Institute", "1010", true, false, false, true, true, true),
            doctor(10, "Nabila", "Sultana", "nabila.sultana.doctor@clinora.test", "01711001011", "Consultant", "Respiratory Medicine", 8, "Uttara Respiratory Care Centre", "Consultant", "MBBS", "Cumilla Metropolitan Medical College", 2013, "MD (Respiratory Medicine)", "National Respiratory Training Institute", "1011", true, true, false, true, true, true),
            doctor(11, "Rafiul", "Islam", "rafiul.islam.doctor@clinora.test", "01711001012", "Senior Consultant", "General Medicine", 15, "Dhaka Community Specialist Centre", "Senior Consultant", "MBBS", "Dhaka Central Medical College", 2006, "FCPS (Medicine)", "Bangladesh College of Physicians and Surgeons", "1012", true, true, true, true, true, true)
        );
    }

    private static DoctorFixture doctor(
        int ordinal,
        String firstName,
        String lastName,
        String email,
        String phone,
        String professionalTitle,
        String specialization,
        int yearsExperience,
        String organization,
        String position,
        String primaryQualification,
        String primaryInstitution,
        int qualificationYear,
        String secondaryQualification,
        String secondaryInstitution,
        String registrationCode,
        boolean profileUrl,
        boolean registrationType,
        boolean registrationIssuedAt,
        boolean registrationValidUntil,
        boolean availability,
        boolean additionalDocument
    ) {
        return new DoctorFixture(
            ordinal, firstName, lastName, email, phone, professionalTitle, specialization, yearsExperience,
            organization, position, primaryQualification, primaryInstitution, qualificationYear,
            secondaryQualification, secondaryInstitution, registrationCode,
            profileUrl, registrationType, registrationIssuedAt, registrationValidUntil, availability,
            additionalDocument, (firstName + "-" + lastName).toLowerCase(Locale.ROOT)
        );
    }


    static List<String> fixtureDoctorEmails() {
        return doctors().stream().map(DoctorFixture::email).toList();
    }

    static List<Integer> fixtureCompletionTargets() {
        return doctors().stream().map(DoctorDevelopmentSeeder::fixtureCompletionTarget).toList();
    }

    private static int fixtureCompletionTarget(DoctorFixture doctor) {
        int score = 60;
        if (doctor.hasProfileUrl()) score += 10;
        if (doctor.hasRegistrationType()) score += 5;
        if (doctor.hasRegistrationIssuedAt()) score += 5;
        if (doctor.hasRegistrationValidUntil()) score += 10;
        if (doctor.hasAvailability()) score += 10;
        return Math.min(100, score);
    }

    private List<PatientFixture> patients() {
        return List.of(
            new PatientFixture("Rumana", "Akter", "rumana.akter.patient@clinora.test", "01712002001", LocalDate.of(1992, 4, 18), "FEMALE", "B_POSITIVE", List.of("Penicillin"), List.of("Iron-deficiency anaemia"), List.of("Ferrous sulfate")),
            new PatientFixture("Fahim", "Rahman", "fahim.rahman.patient@clinora.test", "01712002002", LocalDate.of(1985, 11, 2), "MALE", "O_POSITIVE", List.of(), List.of("Hypertension"), List.of("Amlodipine 5 mg")),
            new PatientFixture("Maliha", "Sultana", "maliha.sultana.patient@clinora.test", "01712002003", LocalDate.of(1997, 7, 9), "FEMALE", "A_POSITIVE", List.of(), List.of("Hypothyroidism"), List.of("Levothyroxine")),
            new PatientFixture("Tahmid", "Hasan", "tahmid.hasan.patient@clinora.test", "01712002004", LocalDate.of(2017, 2, 14), "MALE", "O_POSITIVE", List.of(), List.of(), List.of()),
            new PatientFixture("Nafisa", "Jahan", "nafisa.jahan.patient@clinora.test", "01712002005", LocalDate.of(1978, 9, 25), "FEMALE", "AB_POSITIVE", List.of("Sulfonamides"), List.of("Type 2 diabetes"), List.of("Metformin")),
            new PatientFixture("Sabbir", "Ahmed", "sabbir.ahmed.patient@clinora.test", "01712002006", LocalDate.of(1989, 1, 30), "MALE", "A_NEGATIVE", List.of(), List.of("Migraine"), List.of())
        );
    }

    private record ExistingUser(UUID id, String role) {}
    private record AppointmentFixture(UUID appointmentId, UUID patientId, UUID doctorId) {}
    private record ReportFixture(UUID reportId, UUID patientId) {}
    private record ObservationFixture(
        String label,
        String value,
        String unit,
        String referenceRange,
        String referenceLow,
        String referenceHigh,
        String sourceFlag,
        String derivedRangeFlag,
        String verificationStatus
    ) {}
    private record PatientFixture(
        String firstName,
        String lastName,
        String email,
        String phone,
        LocalDate dateOfBirth,
        String gender,
        String bloodGroup,
        List<String> allergies,
        List<String> conditions,
        List<String> medications
    ) {}
    private record DoctorFixture(
        int ordinal,
        String firstName,
        String lastName,
        String email,
        String phone,
        String professionalTitle,
        String specialization,
        int yearsExperience,
        String organization,
        String position,
        String primaryQualification,
        String primaryInstitution,
        int qualificationYear,
        String secondaryQualification,
        String secondaryInstitution,
        String registrationCode,
        boolean hasProfileUrl,
        boolean hasRegistrationType,
        boolean hasRegistrationIssuedAt,
        boolean hasRegistrationValidUntil,
        boolean hasAvailability,
        boolean hasAdditionalDocument,
        String slug
    ) {}
}
