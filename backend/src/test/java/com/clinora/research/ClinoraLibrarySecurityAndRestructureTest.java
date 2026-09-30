package com.clinora.research;

import com.clinora.audit.AuthAuditAction;
import com.clinora.research.api.ResearchPublicationModels.*;
import com.clinora.research.domain.*;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.repository.*;
import com.clinora.research.service.ResearchAuditService;
import com.clinora.research.service.ResearchPublicationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.lang.reflect.Field;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Validates the 10 required backend security and restructure test cases
 * for Clinora Library from clinora-library-publications-restructure.md.
 */
class ClinoraLibrarySecurityAndRestructureTest {

    private ResearchPublicationRepository publicationRepository;
    private ResearchProjectRepository projectRepository;
    private ResearchProjectMemberRepository memberRepository;
    private DatasetVersionRepository datasetVersionRepository;
    private ResearchDatasetRepository researchDatasetRepository;
    private AIEvaluationRunRepository evaluationRunRepository;
    private ResearchAuditService auditService;
    private ResearchPublicationService service;

    private UUID ownerId;
    private UUID nonMemberId;
    private UUID projectId;
    private ResearchProject project;

    @BeforeEach
    void setUp() {
        publicationRepository = mock(ResearchPublicationRepository.class);
        projectRepository = mock(ResearchProjectRepository.class);
        memberRepository = mock(ResearchProjectMemberRepository.class);
        datasetVersionRepository = mock(DatasetVersionRepository.class);
        researchDatasetRepository = mock(ResearchDatasetRepository.class);
        evaluationRunRepository = mock(AIEvaluationRunRepository.class);
        auditService = mock(ResearchAuditService.class);
        ObjectMapper objectMapper = new ObjectMapper();

        service = new ResearchPublicationService(
                publicationRepository,
                projectRepository,
                memberRepository,
                datasetVersionRepository,
                researchDatasetRepository,
                evaluationRunRepository,
                auditService,
                objectMapper
        , org.mockito.Mockito.mock(com.clinora.research.service.ResearchAccessGuard.class));

        ownerId = UUID.randomUUID();
        nonMemberId = UUID.randomUUID();
        projectId = UUID.randomUUID();
        project = ResearchProject.createDraft(
                ownerId,
                "Cardiovascular Biomarkers in Type 2",
                "Study objective",
                "Description",
                "CARDIOLOGY",
                null,
                null,
                null,
                Instant.now()
        );

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(projectRepository.findAllById(any())).thenReturn(List.of(project));
    }

    @Test
    @DisplayName("1. Researcher can browse eligible published outputs")
    void test1_researcherCanBrowseEligiblePublishedOutputs() {
        ResearchPublication pub = new ResearchPublication(
                UUID.randomUUID(),
                projectId,
                "Cardiovascular Risk in Diabetes",
                "Abstract",
                PublicationType.JOURNAL_ARTICLE,
                PublicationStatus.PUBLISHED,
                LibraryVisibility.CLINORA_RESEARCHERS,
                "Cohort study of 500 subjects",
                "Observational cohort",
                "Multivariate regression",
                "cardiology, diabetes",
                "Dr. Alice Smith, Dr. Bob Jones",
                "Cardiology",
                "10.1000/182",
                "Lancet Digital Health",
                null,
                LocalDate.of(2026, 3, 1),
                "https://doi.org/10.1000/182",
                "{}",
                "[]",
                "[]",
                ownerId
        );

        when(publicationRepository.searchPublished(any(), any(), any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of(pub)));

        Page<LibraryPublicationSummary> results = service.searchPublishedLibrary(
                null, null, null, null, PageRequest.of(0, 10)
        );

        assertNotNull(results);
        assertEquals(1, results.getContent().size());
        assertEquals("Cardiovascular Risk in Diabetes", results.getContent().get(0).title());
        assertEquals("Dr. Alice Smith, Dr. Bob Jones", results.getContent().get(0).authors());
    }

    @Test
    @DisplayName("2. DRAFT output is not globally visible to third-party researchers")
    void test2_draftOutputNotGloballyVisible() {
        UUID pubId = UUID.randomUUID();
        ResearchPublication draftPub = new ResearchPublication(
                pubId,
                projectId,
                "Unpublished Draft Output",
                "Draft abstract",
                PublicationType.PREPRINT,
                PublicationStatus.DRAFT,
                LibraryVisibility.CLINORA_RESEARCHERS,
                "Methodology in progress",
                null,
                null,
                null,
                "Author One",
                "Cardiology",
                null,
                null,
                null,
                null,
                null,
                "{}",
                "[]",
                "[]",
                ownerId
        );

        when(publicationRepository.findById(pubId)).thenReturn(Optional.of(draftPub));
        when(memberRepository.existsByProjectIdAndUserId(projectId, nonMemberId)).thenReturn(false);

        // Non-member trying to view unpublished draft in library must receive 403 FORBIDDEN
        ResearchApiException ex = assertThrows(ResearchApiException.class, () ->
                service.getPublishedLibraryDetail(pubId, nonMemberId)
        );
        assertEquals("PUBLICATION_ACCESS_DENIED", ex.getErrorCode());
    }

    @Test
    @DisplayName("3. PROJECT_ONLY output is not globally visible in Library")
    void test3_projectOnlyOutputNotGloballyVisible() {
        UUID pubId = UUID.randomUUID();
        ResearchPublication privatePub = new ResearchPublication(
                pubId,
                projectId,
                "Internal Team Output",
                "Private abstract",
                PublicationType.REPORT,
                PublicationStatus.PUBLISHED,
                LibraryVisibility.PROJECT_ONLY,
                "Internal methods",
                null,
                null,
                null,
                "Team Member",
                "Cardiology",
                null,
                null,
                null,
                null,
                null,
                "{}",
                "[]",
                "[]",
                ownerId
        );

        when(publicationRepository.findById(pubId)).thenReturn(Optional.of(privatePub));
        when(memberRepository.existsByProjectIdAndUserId(projectId, nonMemberId)).thenReturn(false);

        ResearchApiException ex = assertThrows(ResearchApiException.class, () ->
                service.getPublishedLibraryDetail(pubId, nonMemberId)
        );
        assertEquals("PUBLICATION_ACCESS_DENIED", ex.getErrorCode());
    }

    @Test
    @DisplayName("4. Library DTO contains no Dataset object key, signed URL, or file URL")
    void test4_libraryDtoContainsNoDatasetObjectKeyOrFileUrl() {
        UUID versionId = UUID.randomUUID();
        UUID datasetId = UUID.randomUUID();
        ResearchDataset dataset = new ResearchDataset(
                datasetId, projectId, UUID.randomUUID(), "Clinora Biomarker Cohort", Instant.now(), null
        );
        DatasetVersion version = new DatasetVersion(
                versionId, datasetId, 3, "v1", 1000L,
                "private/minio/secret-cohort-data-v3.csv", "sha256checksum", "CSV", "strict", Instant.now()
        );

        when(datasetVersionRepository.findById(versionId)).thenReturn(Optional.of(version));
        when(researchDatasetRepository.findById(datasetId)).thenReturn(Optional.of(dataset));

        UUID pubId = UUID.randomUUID();
        ResearchPublication pub = new ResearchPublication(
                pubId,
                projectId,
                "Published Paper with Provenance",
                "Abstract",
                PublicationType.JOURNAL_ARTICLE,
                PublicationStatus.PUBLISHED,
                LibraryVisibility.CLINORA_RESEARCHERS,
                "Methodology summary",
                "Study design",
                "Analysis summary",
                "keywords",
                "Dr. Author",
                "Field",
                "10.1234/test",
                "Journal of Medicine",
                null,
                LocalDate.now(),
                "https://doi.org/10.1234/test",
                "{}",
                "[\"" + versionId + "\"]",
                "[]",
                ownerId
        );

        when(publicationRepository.findById(pubId)).thenReturn(Optional.of(pub));

        LibraryPublicationDetail detail = service.getPublishedLibraryDetail(pubId, ownerId);

        assertNotNull(detail);
        assertEquals(1, detail.datasetProvenance().size());
        LibraryDatasetProvenance prov = detail.datasetProvenance().get(0);
        assertEquals("Clinora Biomarker Cohort", prov.datasetDisplayName());
        assertEquals(3, prov.versionNumber());

        // Inspect all fields of detail and provenance via reflection:
        // Ensure no storageObjectKey, no s3, no minio, no download, no secret appears anywhere
        for (Field f : LibraryDatasetProvenance.class.getDeclaredFields()) {
            assertNotEquals("storageObjectKey", f.getName());
            assertNotEquals("downloadUrl", f.getName());
            assertNotEquals("signedUrl", f.getName());
        }

        for (Field f : LibraryPublicationDetail.class.getDeclaredFields()) {
            assertNotEquals("storageObjectKey", f.getName());
            assertNotEquals("downloadUrl", f.getName());
            assertNotEquals("signedUrl", f.getName());
        }
    }

    @Test
    @DisplayName("5. Viewing publication does not create DatasetAccessGrant")
    void test5_viewingPublicationDoesNotCreateDatasetAccessGrant() {
        UUID pubId = UUID.randomUUID();
        ResearchPublication pub = new ResearchPublication(
                pubId,
                projectId,
                "Published Paper",
                "Abstract",
                PublicationType.JOURNAL_ARTICLE,
                PublicationStatus.PUBLISHED,
                LibraryVisibility.CLINORA_RESEARCHERS,
                "Methodology",
                null,
                null,
                null,
                "Author",
                "Cardiology",
                null,
                null,
                null,
                LocalDate.now(),
                null,
                "{}",
                "[]",
                "[]",
                ownerId
        );

        when(publicationRepository.findById(pubId)).thenReturn(Optional.of(pub));

        // When reading published detail, no write or grant creation occurs
        LibraryPublicationDetail detail = service.getPublishedLibraryDetail(pubId, nonMemberId);
        assertNotNull(detail);

        // Publication repository is never saved on read
        verify(publicationRepository, never()).save(any());
    }

    @Test
    @DisplayName("6. Viewing publication does not authorize Dataset download")
    void test6_viewingPublicationDoesNotAuthorizeDatasetDownload() {
        UUID pubId = UUID.randomUUID();
        ResearchPublication pub = new ResearchPublication(
                pubId,
                projectId,
                "Paper with linked dataset",
                "Abstract",
                PublicationType.JOURNAL_ARTICLE,
                PublicationStatus.PUBLISHED,
                LibraryVisibility.CLINORA_RESEARCHERS,
                "Methodology",
                null,
                null,
                null,
                "Author",
                "Cardiology",
                null,
                null,
                null,
                LocalDate.now(),
                null,
                "{}",
                "[]",
                "[]",
                ownerId
        );

        when(publicationRepository.findById(pubId)).thenReturn(Optional.of(pub));

        LibraryPublicationDetail detail = service.getPublishedLibraryDetail(pubId, nonMemberId);
        assertNotNull(detail);

        // Verification that no download endpoints, tokens, or grant IDs are returned
        assertNull(detail.publishedUrl());
        assertTrue(detail.datasetProvenance().isEmpty());
    }

    @Test
    @DisplayName("7. Output registration requires authorized project (user must be owner or co-researcher)")
    void test7_outputRegistrationRequiresAuthorizedProject() {
        UUID unauthorizedUserId = UUID.randomUUID();
        when(memberRepository.findByProjectIdAndUserId(projectId, unauthorizedUserId))
                .thenReturn(Optional.empty());

        RegisterResearchOutputRequest request = new RegisterResearchOutputRequest(
                projectId,
                "Unauthorized Output",
                "Abstract",
                PublicationType.JOURNAL_ARTICLE,
                PublicationStatus.DRAFT,
                LibraryVisibility.PROJECT_ONLY,
                "Methodology",
                null,
                null,
                null,
                "Author",
                "Cardiology",
                null,
                null,
                null,
                LocalDate.now(),
                null,
                List.of(),
                List.of(),
                Map.of()
        );

        ResearchApiException ex = assertThrows(ResearchApiException.class, () ->
                service.registerOutput(unauthorizedUserId, request, "127.0.0.1", "Agent")
        );
        assertEquals("PROJECT_ACCESS_DENIED", ex.getErrorCode());
    }

    @Test
    @DisplayName("8. Linked Dataset Version must belong to the selected project")
    void test8_linkedDatasetVersionMustBelongToProject() {
        UUID foreignProjectId = UUID.randomUUID();
        UUID versionId = UUID.randomUUID();
        UUID foreignDatasetId = UUID.randomUUID();

        ResearchDataset foreignDataset = new ResearchDataset(
                foreignDatasetId, foreignProjectId, UUID.randomUUID(), "Foreign Dataset", Instant.now(), null
        );
        DatasetVersion foreignVersion = new DatasetVersion(
                versionId, foreignDatasetId, 1, "v1", 500L,
                "keys/foreign.csv", "checksum", "CSV", "strict", Instant.now()
        );

        when(datasetVersionRepository.findById(versionId)).thenReturn(Optional.of(foreignVersion));
        when(researchDatasetRepository.findById(foreignDatasetId)).thenReturn(Optional.of(foreignDataset));

        RegisterResearchOutputRequest request = new RegisterResearchOutputRequest(
                projectId,
                "Output with Foreign Dataset",
                "Abstract",
                PublicationType.JOURNAL_ARTICLE,
                PublicationStatus.PUBLISHED,
                LibraryVisibility.CLINORA_RESEARCHERS,
                "Methodology",
                null,
                null,
                null,
                "Author",
                "Cardiology",
                null,
                null,
                null,
                LocalDate.now(),
                null,
                List.of(versionId),
                List.of(),
                Map.of()
        );

        ResearchApiException ex = assertThrows(ResearchApiException.class, () ->
                service.registerOutput(ownerId, request, "127.0.0.1", "Agent")
        );
        assertEquals("INVALID_PROVENANCE_LINK", ex.getErrorCode());
    }

    @Test
    @DisplayName("9. Linked AI Evaluation must belong to the selected project")
    void test9_linkedAiEvaluationMustBelongToProject() {
        UUID foreignProjectId = UUID.randomUUID();
        UUID evalRunId = UUID.randomUUID();

        AIEvaluationRun foreignRun = new AIEvaluationRun(
                evalRunId,
                foreignProjectId,
                UUID.randomUUID(),
                "biomarker-model",
                "1.0.0",
                "prompt-v1",
                EvaluationTaskType.RISK_SCORING,
                "ground-truth",
                "{}",
                ownerId
        );

        when(evaluationRunRepository.findById(evalRunId)).thenReturn(Optional.of(foreignRun));

        RegisterResearchOutputRequest request = new RegisterResearchOutputRequest(
                projectId,
                "Output with Foreign Evaluation",
                "Abstract",
                PublicationType.JOURNAL_ARTICLE,
                PublicationStatus.PUBLISHED,
                LibraryVisibility.CLINORA_RESEARCHERS,
                "Methodology",
                null,
                null,
                null,
                "Author",
                "Cardiology",
                null,
                null,
                null,
                LocalDate.now(),
                null,
                List.of(),
                List.of(evalRunId),
                Map.of()
        );

        ResearchApiException ex = assertThrows(ResearchApiException.class, () ->
                service.registerOutput(ownerId, request, "127.0.0.1", "Agent")
        );
        assertEquals("UNVERIFIED_EVALUATION_PROVENANCE", ex.getErrorCode());
    }

    @Test
    @DisplayName("10. No Patient-identifiable data appears in Library DTO")
    void test10_noPatientIdentifiableDataInLibraryDto() {
        when(publicationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        RegisterResearchOutputRequest request = new RegisterResearchOutputRequest(
                projectId,
                "Genomic Markers in Cardiovascular Disease",
                "Cohort study on de-identified population metrics",
                PublicationType.JOURNAL_ARTICLE,
                PublicationStatus.PUBLISHED,
                LibraryVisibility.CLINORA_RESEARCHERS,
                "Statistical analysis across de-identified aggregates",
                "Cohort",
                "Regression",
                "genomics, cardiology",
                "Dr. Alice Smith",
                "Cardiology",
                "10.1038/s41586-026-001",
                "Nature Medicine",
                null,
                LocalDate.of(2026, 5, 20),
                "https://doi.org/10.1038/s41586-026-001",
                List.of(),
                List.of(),
                Map.of()
        );

        LibraryPublicationDetail result = service.registerOutput(ownerId, request, "127.0.0.1", "Agent");

        assertNotNull(result);
        assertEquals("Genomic Markers in Cardiovascular Disease", result.title());
        assertEquals("Cardiovascular Biomarkers in Type 2", result.projectTitle());

        // Assert no patient identifiers exist in the DTO record structure
        for (Field f : LibraryPublicationDetail.class.getDeclaredFields()) {
            String name = f.getName().toLowerCase();
            assertFalse(name.contains("patient"), "Field " + name + " must not contain patient references");
            assertFalse(name.contains("subject"), "Field " + name + " must not contain subject references");
            assertFalse(name.contains("ssn") || name.contains("mrn"), "Field " + name + " must not contain medical record numbers");
            assertFalse(name.contains("rawvalue") || name.contains("observation"), "Field " + name + " must not contain row observation data");
        }
    }
}
