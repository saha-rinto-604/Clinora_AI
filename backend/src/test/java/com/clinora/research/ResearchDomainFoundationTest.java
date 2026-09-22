package com.clinora.research;

import com.clinora.research.domain.ResearchProject;
import com.clinora.research.domain.ResearchProjectStatus;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.exception.ResearchErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ResearchDomainFoundationTest {

    private final UUID researcherUserId = UUID.randomUUID();
    private final UUID adminUserId = UUID.randomUUID();
    private final Instant now = Instant.parse("2026-09-21T10:00:00Z");

    @Test
    @DisplayName("Create project initialized in DRAFT status with zero clinical privileges")
    void createProjectInDraft() {
        ResearchProject project = ResearchProject.createDraft(
                researcherUserId,
                "Cardiovascular Risk Study",
                "Assess longitudinal risk markers",
                "Detailed study description",
                "Cardiology",
                "Observational cohort analysis",
                "General Hospital Research Center",
                "IRB-2026-0901",
                now
        );

        assertThat(project.getId()).isNotNull();
        assertThat(project.getOwnerUserId()).isEqualTo(researcherUserId);
        assertThat(project.getTitle()).isEqualTo("Cardiovascular Risk Study");
        assertThat(project.getStatus()).isEqualTo(ResearchProjectStatus.DRAFT);
        assertThat(project.getStatus().isEditableByResearcher()).isTrue();
        assertThat(project.getCreatedAt()).isEqualTo(now);
        assertThat(project.getUpdatedAt()).isEqualTo(now);
        assertThat(project.getApprovedAt()).isNull();
        assertThat(project.getReviewedBy()).isNull();
        assertThat(project.getVersion()).isEqualTo(0L);
    }

    @Test
    @DisplayName("Editing draft updates fields and touches updatedAt")
    void editDraftProject() {
        ResearchProject project = ResearchProject.createDraft(
                researcherUserId,
                "Original Title",
                "Original Objective",
                "Original Description",
                "Oncology",
                "Genomic sequencing",
                "Cancer Institute",
                "IRB-100",
                now
        );

        Instant updateTime = now.plusSeconds(3600);
        project.updateDraft(
                "Updated Title",
                "Updated Objective",
                "Updated Description",
                "Precision Oncology",
                "Genomic and biomarker analysis",
                "Cancer Institute",
                "IRB-100-REV1",
                updateTime
        );

        assertThat(project.getTitle()).isEqualTo("Updated Title");
        assertThat(project.getObjective()).isEqualTo("Updated Objective");
        assertThat(project.getResearchField()).isEqualTo("Precision Oncology");
        assertThat(project.getUpdatedAt()).isEqualTo(updateTime);
    }

    @Test
    @DisplayName("Submit transitions DRAFT to SUBMITTED and sets submittedAt")
    void submitDraftProject() {
        ResearchProject project = ResearchProject.createDraft(
                researcherUserId,
                "Title",
                "Objective",
                "Description",
                "Immunology",
                "Cohort study",
                null,
                null,
                now
        );

        Instant submitTime = now.plusSeconds(1800);
        project.submit(submitTime);

        assertThat(project.getStatus()).isEqualTo(ResearchProjectStatus.SUBMITTED);
        assertThat(project.getSubmittedAt()).isEqualTo(submitTime);
        assertThat(project.getStatus().isEditableByResearcher()).isFalse();
    }

    @Test
    @DisplayName("Cannot edit project once SUBMITTED")
    void cannotEditSubmittedProject() {
        ResearchProject project = ResearchProject.createDraft(
                researcherUserId,
                "Title",
                "Objective",
                "Description",
                "Immunology",
                "Cohort study",
                null,
                null,
                now
        );
        project.submit(now.plusSeconds(100));

        assertThatThrownBy(() -> project.updateDraft(
                "New Title",
                "New Objective",
                "New Description",
                "Immunology",
                "Cohort study",
                null,
                null,
                now.plusSeconds(200)
        ))
                .isInstanceOf(ResearchApiException.class)
                .hasFieldOrPropertyWithValue("status", HttpStatus.CONFLICT)
                .hasFieldOrPropertyWithValue("errorCode", ResearchErrorCode.PROJECT_NOT_EDITABLE);
    }

    @Test
    @DisplayName("Withdraw submitted project")
    void withdrawProject() {
        ResearchProject project = ResearchProject.createDraft(
                researcherUserId,
                "Title",
                "Objective",
                "Description",
                "Immunology",
                "Cohort study",
                null,
                null,
                now
        );
        project.submit(now.plusSeconds(100));

        Instant withdrawTime = now.plusSeconds(300);
        project.withdraw(withdrawTime);

        assertThat(project.getStatus()).isEqualTo(ResearchProjectStatus.WITHDRAWN);
        assertThat(project.getStatus().isTerminal()).isTrue();
    }

    @Test
    @DisplayName("Admin review workflow: start review -> request more info -> resubmit -> approve")
    void adminReviewWorkflow() {
        ResearchProject project = ResearchProject.createDraft(
                researcherUserId,
                "Clinical AI Benchmark",
                "Benchmark diagnostic accuracy",
                "Observational study",
                "Informatics",
                "Retrospective model validation",
                "University Hospital",
                "IRB-456",
                now
        );
        project.submit(now.plusSeconds(100));

        // Admin starts review
        Instant reviewStart = now.plusSeconds(200);
        project.startReview(adminUserId, reviewStart);
        assertThat(project.getStatus()).isEqualTo(ResearchProjectStatus.UNDER_REVIEW);
        assertThat(project.getReviewedBy()).isEqualTo(adminUserId);

        // Admin requests more info
        Instant moreInfoTime = now.plusSeconds(300);
        project.requestMoreInfo(adminUserId, "Please clarify the ethics approval reference.", moreInfoTime);
        assertThat(project.getStatus()).isEqualTo(ResearchProjectStatus.MORE_INFO_REQUIRED);
        assertThat(project.getStatus().isEditableByResearcher()).isTrue();
        assertThat(project.getReviewDecisionReason()).isEqualTo("Please clarify the ethics approval reference.");

        // Researcher edits and resubmits
        project.updateDraft(
                "Clinical AI Benchmark",
                "Benchmark diagnostic accuracy",
                "Observational study with ethics approval",
                "Informatics",
                "Retrospective model validation",
                "University Hospital",
                "IRB-456-VERIFIED",
                now.plusSeconds(400)
        );
        project.submit(now.plusSeconds(500));
        assertThat(project.getStatus()).isEqualTo(ResearchProjectStatus.SUBMITTED);

        // Admin approves
        Instant approveTime = now.plusSeconds(600);
        project.approve(adminUserId, "Governance and ethics requirements verified.", approveTime);
        assertThat(project.getStatus()).isEqualTo(ResearchProjectStatus.APPROVED);
        assertThat(project.getApprovedAt()).isEqualTo(approveTime);
        assertThat(project.getStatus().isApprovedOrActive()).isTrue();
    }

    @Test
    @DisplayName("Admin rejects project with reason")
    void adminRejectsProject() {
        ResearchProject project = ResearchProject.createDraft(
                researcherUserId,
                "Study Title",
                "Study Objective",
                "Study Description",
                "General",
                "Summary",
                null,
                null,
                now
        );
        project.submit(now.plusSeconds(100));

        Instant rejectTime = now.plusSeconds(200);
        project.reject(adminUserId, "Insufficient methodology justification.", rejectTime);

        assertThat(project.getStatus()).isEqualTo(ResearchProjectStatus.REJECTED);
        assertThat(project.getReviewDecisionReason()).isEqualTo("Insufficient methodology justification.");
        assertThat(project.getStatus().isTerminal()).isTrue();
    }

    @Test
    @DisplayName("Lifecycle: APPROVED -> ACTIVE -> COMPLETED -> ARCHIVED")
    void fullApprovedLifecycle() {
        ResearchProject project = ResearchProject.createDraft(
                researcherUserId,
                "Study Title",
                "Study Objective",
                "Study Description",
                "General",
                "Summary",
                null,
                null,
                now
        );
        project.submit(now.plusSeconds(100));
        project.approve(adminUserId, "Approved", now.plusSeconds(200));

        // Activate
        Instant activateTime = now.plusSeconds(300);
        project.activate(activateTime);
        assertThat(project.getStatus()).isEqualTo(ResearchProjectStatus.ACTIVE);

        // Complete
        Instant completeTime = now.plusSeconds(1000);
        project.complete(completeTime);
        assertThat(project.getStatus()).isEqualTo(ResearchProjectStatus.COMPLETED);
        assertThat(project.getCompletedAt()).isEqualTo(completeTime);

        // Archive
        Instant archiveTime = now.plusSeconds(2000);
        project.archive(archiveTime);
        assertThat(project.getStatus()).isEqualTo(ResearchProjectStatus.ARCHIVED);
        assertThat(project.getArchivedAt()).isEqualTo(archiveTime);
    }

    @Test
    @DisplayName("Cannot archive project while under active review")
    void cannotArchiveUnderReviewProject() {
        ResearchProject project = ResearchProject.createDraft(
                researcherUserId,
                "Study Title",
                "Study Objective",
                "Study Description",
                "General",
                "Summary",
                null,
                null,
                now
        );
        project.submit(now.plusSeconds(100));

        assertThatThrownBy(() -> project.archive(now.plusSeconds(200)))
                .isInstanceOf(ResearchApiException.class)
                .hasFieldOrPropertyWithValue("status", HttpStatus.CONFLICT)
                .hasFieldOrPropertyWithValue("errorCode", ResearchErrorCode.INVALID_PROJECT_STATE);
    }
}
