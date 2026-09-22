package com.clinora.research.service;

import com.clinora.research.domain.CohortEligibilityReport;
import com.clinora.research.domain.EligibilityCandidate;
import com.clinora.research.domain.EligibilityDecision;
import com.clinora.research.domain.ResearchConsentStatus;

import java.util.List;
import java.util.UUID;

/**
 * Core governance boundary responsible for answering whether clinical observations
 * are legally, clinically, and product-wise eligible to participate in research datasets.
 *
 * <p>Guiding principles:
 * <ul>
 *   <li>Never assume: {@code report exists == eligible}</li>
 *   <li>Isolate {@code OTHER} subject reports from the patient's research contribution</li>
 *   <li>Exclude raw unreviewed OCR results; prefer patient- or doctor-verified observations</li>
 *   <li>Fail-closed: {@code UNKNOWN ELIGIBILITY = NOT EXPORTABLE}</li>
 * </ul>
 */
public interface ResearchDataEligibilityService {

    /**
     * Evaluates a single candidate clinical observation.
     */
    EligibilityDecision evaluate(EligibilityCandidate candidate);

    /**
     * Evaluates a collection of candidate observations in batch.
     */
    List<EligibilityDecision> evaluateAll(List<EligibilityCandidate> candidates);

    /**
     * Evaluates a cohort of candidates and produces an aggregate audit report.
     */
    CohortEligibilityReport evaluateCohort(List<EligibilityCandidate> candidates);

    /**
     * Retrieves all candidate observations belonging to a patient from the database.
     */
    List<EligibilityCandidate> fetchCandidatesForPatient(UUID patientUserId, ResearchConsentStatus consentStatus);

    /**
     * Evaluates all candidate observations for a given patient.
     */
    CohortEligibilityReport evaluatePatientEligibility(UUID patientUserId, ResearchConsentStatus consentStatus);
}
