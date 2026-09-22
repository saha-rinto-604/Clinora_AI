package com.clinora.research;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.research.api.ResearchPublicationModels.*;
import com.clinora.research.domain.PublicationType;
import com.clinora.research.domain.ResearchProject;
import com.clinora.research.domain.ResearchPublication;
import com.clinora.research.repository.ResearchProjectMemberRepository;
import com.clinora.research.repository.ResearchProjectRepository;
import com.clinora.research.repository.ResearchPublicationRepository;
import com.clinora.research.service.ResearchAuditService;
import com.clinora.research.service.ResearchPublicationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class ResearchPublicationServiceTest {

    private ResearchPublicationRepository publicationRepository;
    private ResearchProjectRepository projectRepository;
    private ResearchProjectMemberRepository memberRepository;
    private ResearchAuditService auditService;
    private ResearchPublicationService service;

    private UUID ownerId;
    private UUID projectId;
    private ResearchProject project;

    @BeforeEach
    void setUp() {
        publicationRepository = mock(ResearchPublicationRepository.class);
        projectRepository = mock(ResearchProjectRepository.class);
        memberRepository = mock(ResearchProjectMemberRepository.class);
        auditService = mock(ResearchAuditService.class);
        ObjectMapper objectMapper = new ObjectMapper();

        service = new ResearchPublicationService(
                publicationRepository,
                projectRepository,
                memberRepository,
                auditService,
                objectMapper
        );

        ownerId = UUID.randomUUID();
        projectId = UUID.randomUUID();
        project = ResearchProject.createDraft(
                ownerId,
                "Cardiovascular Risk Study",
                "Study objective",
                "Description",
                "CARDIOLOGY",
                null,
                null,
                null,
                java.time.Instant.now()
        );

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
    }

    @Test
    @DisplayName("Phase R15: Project owner can register a publication and generate APA, IEEE, and BibTeX citations")
    void registersPublicationAndGeneratesCitations() {
        when(publicationRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        CreatePublicationRequest request = new CreatePublicationRequest(
                "Machine Learning in Early Sepsis Detection",
                "Abstract of sepsis biomarker research",
                PublicationType.JOURNAL_ARTICLE,
                "10.1016/j.clinora.2026.04.012",
                "Journal of Clinical AI",
                null,
                LocalDate.of(2026, 4, 15),
                "https://doi.org/10.1016/j.clinora.2026.04.012",
                Map.of("volume", "14", "issue", "2")
        );

        PublicationResponse response = service.createPublication(projectId, ownerId, request, "127.0.0.1", "TestAgent");

        assertNotNull(response);
        assertEquals("Machine Learning in Early Sepsis Detection", response.title());
        assertEquals(PublicationType.JOURNAL_ARTICLE, response.publicationType());
        assertNotNull(response.citations());

        // Check APA citation contains year, title, journal, and DOI
        assertTrue(response.citations().apa().contains("2026"));
        assertTrue(response.citations().apa().contains("Machine Learning in Early Sepsis Detection"));
        assertTrue(response.citations().apa().contains("Journal of Clinical AI"));
        assertTrue(response.citations().apa().contains("10.1016/j.clinora.2026.04.012"));

        // Check IEEE citation
        assertTrue(response.citations().ieee().contains("\"Machine Learning in Early Sepsis Detection,\""));

        // Check BibTeX citation
        assertTrue(response.citations().bibtex().contains("@article{clinora_"));
        assertTrue(response.citations().bibtex().contains("title = {Machine Learning in Early Sepsis Detection}"));

        verify(auditService).recordEvent(
                eq(ownerId),
                eq(AuthAuditAction.PUBLICATION_REGISTERED),
                eq(AuthAuditOutcome.SUCCESS),
                eq(projectId.toString()),
                any(),
                any(),
                any()
        );
    }
}
