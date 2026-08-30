package com.clinora.patients.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "patient_profiles")
public class PatientProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, unique = true)
    private UUID userId;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Enumerated(EnumType.STRING)
    @Column(length = 32)
    private PatientGender gender;

    @Enumerated(EnumType.STRING)
    @Column(name = "blood_group", length = 16)
    private BloodGroup bloodGroup;

    @Column(length = 32)
    private String phone;

    @Column(length = 500)
    private String address;

    @Column(name = "height_cm", precision = 5, scale = 2)
    private BigDecimal heightCm;

    @Column(name = "weight_kg", precision = 6, scale = 2)
    private BigDecimal weightKg;

    @Column(name = "family_medical_history", length = 2000)
    private String familyMedicalHistory;

    @Column(name = "lifestyle_information", length = 2000)
    private String lifestyleInformation;

    @Column(name = "emergency_contact_name", length = 160)
    private String emergencyContactName;

    @Column(name = "emergency_contact_phone", length = 32)
    private String emergencyContactPhone;

    @Column(name = "emergency_contact_relationship", length = 100)
    private String emergencyContactRelationship;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(nullable = false)
    private long version;

    protected PatientProfile() {
    }

    public PatientProfile(UUID userId, Instant now) {
        this.userId = userId;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void update(
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
        Instant now
    ) {
        this.dateOfBirth = dateOfBirth;
        this.gender = gender;
        this.bloodGroup = bloodGroup;
        this.phone = normalize(phone);
        this.address = normalize(address);
        this.heightCm = heightCm;
        this.weightKg = weightKg;
        this.familyMedicalHistory = normalize(familyMedicalHistory);
        this.lifestyleInformation = normalize(lifestyleInformation);
        this.emergencyContactName = normalize(emergencyContactName);
        this.emergencyContactPhone = normalize(emergencyContactPhone);
        this.emergencyContactRelationship = normalize(emergencyContactRelationship);
        this.updatedAt = now;
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public PatientGender getGender() {
        return gender;
    }

    public BloodGroup getBloodGroup() {
        return bloodGroup;
    }

    public String getPhone() {
        return phone;
    }

    public String getAddress() {
        return address;
    }

    public BigDecimal getHeightCm() {
        return heightCm;
    }

    public BigDecimal getWeightKg() {
        return weightKg;
    }

    public String getFamilyMedicalHistory() {
        return familyMedicalHistory;
    }

    public String getLifestyleInformation() {
        return lifestyleInformation;
    }

    public String getEmergencyContactName() {
        return emergencyContactName;
    }

    public String getEmergencyContactPhone() {
        return emergencyContactPhone;
    }

    public String getEmergencyContactRelationship() {
        return emergencyContactRelationship;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
