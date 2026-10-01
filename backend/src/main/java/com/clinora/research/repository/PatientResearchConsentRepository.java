package com.clinora.research.repository;

import com.clinora.research.domain.PatientResearchConsent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PatientResearchConsentRepository extends JpaRepository<PatientResearchConsent, UUID> {
    Optional<PatientResearchConsent> findByPatientUserId(UUID patientUserId);
}
