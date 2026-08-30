package com.clinora.patients.repository;

import com.clinora.patients.domain.PatientMedication;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PatientMedicationRepository extends JpaRepository<PatientMedication, UUID> {
    List<PatientMedication> findAllByPatientProfileIdOrderByNameAsc(UUID patientProfileId);

    void deleteAllByPatientProfileId(UUID patientProfileId);
}
