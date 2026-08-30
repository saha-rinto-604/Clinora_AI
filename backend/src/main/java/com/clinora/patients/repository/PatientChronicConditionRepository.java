package com.clinora.patients.repository;

import com.clinora.patients.domain.PatientChronicCondition;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PatientChronicConditionRepository extends JpaRepository<PatientChronicCondition, UUID> {
    List<PatientChronicCondition> findAllByPatientProfileIdOrderByNameAsc(UUID patientProfileId);

    void deleteAllByPatientProfileId(UUID patientProfileId);
}
