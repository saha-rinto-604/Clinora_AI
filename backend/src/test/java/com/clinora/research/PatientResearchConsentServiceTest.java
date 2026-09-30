package com.clinora.research;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.research.domain.PatientResearchConsent;
import com.clinora.research.domain.ResearchConsentStatus;
import com.clinora.research.repository.PatientResearchConsentRepository;
import com.clinora.research.service.PatientResearchConsentService;
import com.clinora.research.service.PatientResearchConsentService.PatientResearchConsentDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PatientResearchConsentServiceTest {

    @Mock
    private PatientResearchConsentRepository consentRepository;

    @Mock
    private AuthAuditService auditService;

    private Clock clock;
    private PatientResearchConsentService service;

    private final Instant now = Instant.parse("2026-09-25T12:00:00Z");
    private final UUID patientId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        clock = Clock.fixed(now, ZoneOffset.UTC);
        service = new PatientResearchConsentService(consentRepository, auditService, clock);
    }

    @Test
    @DisplayName("Returns UNKNOWN and unconsented when no record exists on file")
    void testGetConsent_defaultUnknown() {
        when(consentRepository.findByPatientUserId(patientId)).thenReturn(Optional.empty());

        PatientResearchConsentDto dto = service.getConsent(patientId);

        assertThat(dto.patientUserId()).isEqualTo(patientId);
        assertThat(dto.consentStatus()).isEqualTo(ResearchConsentStatus.UNKNOWN);
        assertThat(dto.isConsented()).isFalse();
        assertThat(dto.consentedAt()).isNull();
        assertThat(dto.revokedAt()).isNull();
    }

    @Test
    @DisplayName("Granting consent sets CONSENTED status and audits action")
    void testUpdateConsent_grant() {
        when(consentRepository.findByPatientUserId(patientId)).thenReturn(Optional.empty());
        when(consentRepository.save(any(PatientResearchConsent.class))).thenAnswer(inv -> inv.getArgument(0));

        PatientResearchConsentDto dto = service.updateConsent(patientId, true, "127.0.0.1", "TestAgent");

        assertThat(dto.consentStatus()).isEqualTo(ResearchConsentStatus.CONSENTED);
        assertThat(dto.isConsented()).isTrue();
        assertThat(dto.consentedAt()).isEqualTo(now);
        assertThat(dto.revokedAt()).isNull();

        verify(auditService).record(
                eq(patientId),
                eq(AuthAuditAction.PATIENT_RESEARCH_CONSENT_GRANTED),
                eq(AuthAuditOutcome.SUCCESS),
                eq("127.0.0.1"),
                eq("TestAgent"),
                anyString(),
                contains("policy=")
        );
    }

    @Test
    @DisplayName("Revoking consent sets REVOKED status and audits revocation")
    void testUpdateConsent_revoke() {
        PatientResearchConsent existing = PatientResearchConsent.createConsented(patientId, "v1.0-2026", now.minusSeconds(86400));
        when(consentRepository.findByPatientUserId(patientId)).thenReturn(Optional.of(existing));
        when(consentRepository.save(any(PatientResearchConsent.class))).thenAnswer(inv -> inv.getArgument(0));

        PatientResearchConsentDto dto = service.updateConsent(patientId, false, "127.0.0.1", "TestAgent");

        assertThat(dto.consentStatus()).isEqualTo(ResearchConsentStatus.REVOKED);
        assertThat(dto.isConsented()).isFalse();
        assertThat(dto.revokedAt()).isEqualTo(now);

        verify(auditService).record(
                eq(patientId),
                eq(AuthAuditAction.PATIENT_RESEARCH_CONSENT_REVOKED),
                eq(AuthAuditOutcome.SUCCESS),
                eq("127.0.0.1"),
                eq("TestAgent"),
                anyString(),
                contains("policy=")
        );
    }
}
