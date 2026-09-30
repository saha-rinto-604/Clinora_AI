package com.clinora.research.service;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.research.domain.PatientResearchConsent;
import com.clinora.research.domain.ResearchConsentStatus;
import com.clinora.research.repository.PatientResearchConsentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

@Service
public class PatientResearchConsentService {

    private static final Logger LOGGER = LoggerFactory.getLogger(PatientResearchConsentService.class);

    private final PatientResearchConsentRepository consentRepository;
    private final AuthAuditService auditService;
    private final Clock clock;

    public PatientResearchConsentService(
            PatientResearchConsentRepository consentRepository,
            AuthAuditService auditService,
            Clock clock
    ) {
        this.consentRepository = consentRepository;
        this.auditService = auditService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PatientResearchConsentDto getConsent(UUID patientUserId) {
        return consentRepository.findByPatientUserId(patientUserId)
                .map(PatientResearchConsentDto::from)
                .orElseGet(() -> new PatientResearchConsentDto(
                        patientUserId,
                        ResearchConsentStatus.UNKNOWN,
                        false,
                        PatientResearchConsent.DEFAULT_POLICY_VERSION,
                        null,
                        null
                ));
    }

    @Transactional
    public PatientResearchConsentDto updateConsent(
            UUID patientUserId,
            boolean grantConsent,
            String ip,
            String userAgent
    ) {
        Instant now = clock.instant();
        PatientResearchConsent consent = consentRepository.findByPatientUserId(patientUserId)
                .orElseGet(() -> new PatientResearchConsent(
                        UUID.randomUUID(),
                        patientUserId,
                        ResearchConsentStatus.UNKNOWN,
                        PatientResearchConsent.DEFAULT_POLICY_VERSION,
                        null,
                        null,
                        now,
                        now
                ));

        if (grantConsent) {
            consent.grantConsent(PatientResearchConsent.DEFAULT_POLICY_VERSION, now);
            consentRepository.save(consent);

            auditService.record(
                    patientUserId,
                    AuthAuditAction.PATIENT_RESEARCH_CONSENT_GRANTED,
                    AuthAuditOutcome.SUCCESS,
                    ip,
                    userAgent,
                    consent.getId().toString(),
                    "policy=" + consent.getPolicyVersion()
            );
            LOGGER.info("Patient {} GRANTED research consent under policy {}", patientUserId, consent.getPolicyVersion());
        } else {
            consent.revokeConsent(now);
            consentRepository.save(consent);

            auditService.record(
                    patientUserId,
                    AuthAuditAction.PATIENT_RESEARCH_CONSENT_REVOKED,
                    AuthAuditOutcome.SUCCESS,
                    ip,
                    userAgent,
                    consent.getId().toString(),
                    "policy=" + consent.getPolicyVersion()
            );
            LOGGER.info("Patient {} REVOKED research consent", patientUserId);
        }

        return PatientResearchConsentDto.from(consent);
    }

    public record PatientResearchConsentDto(
            UUID patientUserId,
            ResearchConsentStatus consentStatus,
            boolean isConsented,
            String policyVersion,
            Instant consentedAt,
            Instant revokedAt
    ) {
        public static PatientResearchConsentDto from(PatientResearchConsent c) {
            return new PatientResearchConsentDto(
                    c.getPatientUserId(),
                    c.getConsentStatus(),
                    c.isCurrentlyConsented(),
                    c.getPolicyVersion(),
                    c.getConsentedAt(),
                    c.getRevokedAt()
            );
        }
    }
}
