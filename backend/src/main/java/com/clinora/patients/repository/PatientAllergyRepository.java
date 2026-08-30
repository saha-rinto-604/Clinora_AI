package com.clinora.patients.repository;

import com.clinora.patients.domain.PatientAllergy;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PatientAllergyRepository extends JpaRepository<PatientAllergy, UUID> {
    List<PatientAllergy> findAllByPatientProfileIdOrderByNameAsc(UUID patientProfileId);

    void deleteAllByPatientProfileId(UUID patientProfileId);
}
