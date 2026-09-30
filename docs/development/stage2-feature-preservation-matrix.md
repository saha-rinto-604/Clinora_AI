# Stage 2 feature preservation matrix

Branch: `integration/clinora-unified-2026`. Clinical source: `7a9f453c73a05085e661c06fea72f8defb35c3ca`; research source: `3fa876032d74b8022ba980983b777d0fc976a289`.

Protected clinical changes: 58 paths verified against Stage 1, backed up with content/patches and restored in checkpoint `1edf70a`. Original checkout unchanged.

| Feature | Source | Integrated implementation | Verification | Status |
|---|---|---|---|---|
| Patient | Clinical + protected work / Shahed as mapped in audit | In progress | Pending integrated checks | Pending |
| Doctor | Clinical + protected work / Shahed as mapped in audit | In progress | Pending integrated checks | Pending |
| Authentication | Clinical + protected work / Shahed as mapped in audit | In progress | Pending integrated checks | Pending |
| Doctor approval | Clinical + protected work / Shahed as mapped in audit | In progress | Pending integrated checks | Pending |
| Researcher approval | Clinical + protected work / Shahed as mapped in audit | In progress | Pending integrated checks | Pending |
| Researcher workspace | Clinical + protected work / Shahed as mapped in audit | In progress | Pending integrated checks | Pending |
| Admin Research | Clinical + protected work / Shahed as mapped in audit | In progress | Pending integrated checks | Pending |
| Research datasets | Clinical + protected work / Shahed as mapped in audit | In progress | Pending integrated checks | Pending |
| AI evaluation | Clinical + protected work / Shahed as mapped in audit | In progress | Pending integrated checks | Pending |
| Clinora Library | Clinical + protected work / Shahed as mapped in audit | In progress | Pending integrated checks | Pending |
| Research Notepad | Clinical + protected work / Shahed as mapped in audit | In progress | Pending integrated checks | Pending |
| OCR | Clinical + protected work / Shahed as mapped in audit | In progress | Pending integrated checks | Pending |
| AI reports | Clinical + protected work / Shahed as mapped in audit | In progress | Pending integrated checks | Pending |
| Notifications | Clinical + protected work / Shahed as mapped in audit | In progress | Pending integrated checks | Pending |

## Shahed path dispositions

Every audited path appears below. Pending entries must be resolved before handover.

| Source path | Disposition | Destination / reason |
|---|---|---|
| `.env.example` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/admin/researcher/AdminResearcherAccountController.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/admin/researcher/AdminResearcherAccountModels.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/admin/researcher/AdminResearcherAccountService.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/admin/researcher/AdminResearcherApiException.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/audit/AuthAuditAction.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/audit/AuthAuditEvent.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/audit/AuthAuditEventRepository.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/common/api/ApiExceptionHandler.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/config/ResearchStorageConfig.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/config/ResearchStorageProperties.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/notifications/api/PatientNotificationController.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/notifications/config/ClinoraWebSocketConfig.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/notifications/service/NotificationDeliveryConsumer.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/notifications/service/PatientNotificationService.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/patients/api/PatientProfileController.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/patients/api/PatientResearchConsentController.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/patients/service/PatientBodyMeasurementService.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/patients/service/PatientProfileService.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/patients/service/PatientTimelineService.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/profile/api/ProfileImageController.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/profile/service/ProfileImageService.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/api/AIEvaluationController.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/api/AIEvaluationModels.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/api/AdminDatasetRequestReviewController.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/api/AdminResearchProjectModels.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/api/AdminResearchProjectReviewController.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/api/CohortQueryModels.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/api/DatasetRequestModels.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/api/DatasetStatisticsController.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/api/DatasetStatisticsModels.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/api/ResearchAuditController.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/api/ResearchCollaborationController.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/api/ResearchCollaborationModels.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/api/ResearchDatasetController.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/api/ResearchDatasetModels.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/api/ResearchDocumentCollaborationController.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/api/ResearchDocumentController.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/api/ResearchDocumentModels.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/api/ResearchLibraryController.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/api/ResearchProjectController.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/api/ResearchProjectModels.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/api/ResearchPublicationController.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/api/ResearchPublicationModels.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/api/ResearchWorkspaceController.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/api/ResearchWorkspaceModels.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/api/ResearcherCohortController.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/api/ResearcherCredentialController.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/api/ResearcherCredentialModels.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/api/ResearcherDatasetRequestController.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/config/ResearchMessagingConfig.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/deid/DefaultDeidentificationService.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/deid/DeidentificationResult.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/deid/DeidentificationService.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/deid/DeidentifiedRecord.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/AIEvaluationRun.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/CohortEligibilityReport.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/CredentialVerificationStatus.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/DatasetAccessGrant.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/DatasetFormat.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/DatasetGenerationJob.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/DatasetRequest.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/DatasetRequestStatus.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/DatasetVersion.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/EligibilityCandidate.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/EligibilityDecision.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/EligibilityIneligibilityReason.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/EligibilityStatus.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/EvaluationRunStatus.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/EvaluationTaskType.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/InvitationStatus.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/LibraryVisibility.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/PatientResearchConsent.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/ProjectMemberRole.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/PublicationStatus.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/PublicationType.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/ResearchConsentStatus.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/ResearchDataset.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/ResearchDocument.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/ResearchDocumentComment.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/ResearchDocumentRevision.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/ResearchDocumentType.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/ResearchNote.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/ResearchNoteComment.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/ResearchNoteStatus.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/ResearchProject.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/ResearchProjectFile.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/ResearchProjectFileVersion.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/ResearchProjectInvitation.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/ResearchProjectMember.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/ResearchProjectReview.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/ResearchProjectReviewAction.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/ResearchProjectStatus.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/ResearchPublication.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/ResearcherCredentialVerification.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/catalog/ResearchCatalogVariable.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/domain/catalog/ResearchDataCatalog.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/exception/ResearchApiException.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/exception/ResearchErrorCode.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/repository/AIEvaluationRunRepository.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/repository/DatasetAccessGrantRepository.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/repository/DatasetGenerationJobRepository.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/repository/DatasetRequestRepository.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/repository/DatasetVersionRepository.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/repository/PatientResearchConsentRepository.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/repository/ResearchDatasetRepository.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/repository/ResearchDocumentCommentRepository.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/repository/ResearchDocumentRepository.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/repository/ResearchDocumentRevisionRepository.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/repository/ResearchNoteCommentRepository.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/repository/ResearchNoteRepository.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/repository/ResearchProjectFileRepository.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/repository/ResearchProjectFileVersionRepository.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/repository/ResearchProjectInvitationRepository.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/repository/ResearchProjectMemberRepository.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/repository/ResearchProjectRepository.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/repository/ResearchProjectReviewRepository.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/repository/ResearchPublicationRepository.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/repository/ResearcherCredentialVerificationRepository.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/service/AIEvaluationService.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/service/AdminDatasetRequestReviewService.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/service/AdminResearchProjectReviewService.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/service/CohortBuilderService.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/service/DatasetGenerationService.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/service/DatasetGenerationWorker.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/service/DatasetRequestService.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/service/DatasetStatisticsService.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/service/DefaultCohortBuilderService.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/service/DefaultResearchDataEligibilityService.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/service/DiseaseAnalyticsPolicy.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/service/PatientResearchConsentService.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/service/ResearchAuditService.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/service/ResearchAuthorizationService.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/service/ResearchCollaborationService.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/service/ResearchDataEligibilityService.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/service/ResearchDocumentService.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/service/ResearchProjectService.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/service/ResearchPublicationService.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/service/ResearchWorkspaceService.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/service/ResearcherCredentialService.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/service/evaluation/AbnormalityDetectionMetricsCalculator.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/service/evaluation/ClassificationMetricsCalculator.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/service/evaluation/ExtractionMetricsCalculator.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/storage/ResearchDatasetStoragePort.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/research/storage/S3ResearchDatasetStorageAdapter.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/users/domain/UserAccount.java` | Pending | To inspect and integrate |
| `backend/src/main/java/com/clinora/users/repository/UserAccountRepository.java` | Pending | To inspect and integrate |
| `backend/src/main/resources/application.yml` | Pending | To inspect and integrate |
| `backend/src/main/resources/db/migration/V27__create_research_domain_foundation.sql` | Pending | To inspect and integrate |
| `backend/src/main/resources/db/migration/V28__create_research_project_reviews.sql` | Pending | To inspect and integrate |
| `backend/src/main/resources/db/migration/V29__create_research_dataset_requests.sql` | Pending | To inspect and integrate |
| `backend/src/main/resources/db/migration/V30__create_research_dataset_generation_and_versions.sql` | Pending | To inspect and integrate |
| `backend/src/main/resources/db/migration/V31__create_ai_evaluation_runs.sql` | Pending | To inspect and integrate |
| `backend/src/main/resources/db/migration/V32__create_research_project_members.sql` | Pending | To inspect and integrate |
| `backend/src/main/resources/db/migration/V33__create_research_publications.sql` | Pending | To inspect and integrate |
| `backend/src/main/resources/db/migration/V34__create_patient_research_consents.sql` | Pending | To inspect and integrate |
| `backend/src/main/resources/db/migration/V35__research_collaboration_invitation_lifecycle.sql` | Pending | To inspect and integrate |
| `backend/src/main/resources/db/migration/V36__research_collaboration_workspace.sql` | Pending | To inspect and integrate |
| `backend/src/main/resources/db/migration/V37__researcher_credential_verification.sql` | Pending | To inspect and integrate |
| `backend/src/main/resources/db/migration/V38__clinora_library_publications_restructure.sql` | Pending | To inspect and integrate |
| `backend/src/main/resources/db/migration/V39__create_research_notepad_documents.sql` | Pending | To inspect and integrate |
| `backend/src/test/java/com/clinora/admin/researcher/AdminResearcherAccountControllerSecurityTest.java` | Pending | To inspect and integrate |
| `backend/src/test/java/com/clinora/admin/researcher/AdminResearcherAccountServiceTest.java` | Pending | To inspect and integrate |
| `backend/src/test/java/com/clinora/patients/service/PatientProfileServiceTest.java` | Pending | To inspect and integrate |
| `backend/src/test/java/com/clinora/research/AIEvaluationServiceTest.java` | Pending | To inspect and integrate |
| `backend/src/test/java/com/clinora/research/AdminDatasetRequestReviewServiceTest.java` | Pending | To inspect and integrate |
| `backend/src/test/java/com/clinora/research/AdminResearchProjectReviewServiceTest.java` | Pending | To inspect and integrate |
| `backend/src/test/java/com/clinora/research/ClinoraLibrarySecurityAndRestructureTest.java` | Pending | To inspect and integrate |
| `backend/src/test/java/com/clinora/research/CohortBuilderServiceTest.java` | Pending | To inspect and integrate |
| `backend/src/test/java/com/clinora/research/DatasetGenerationServiceTest.java` | Pending | To inspect and integrate |
| `backend/src/test/java/com/clinora/research/DatasetRequestServiceTest.java` | Pending | To inspect and integrate |
| `backend/src/test/java/com/clinora/research/DeidentificationServiceTest.java` | Pending | To inspect and integrate |
| `backend/src/test/java/com/clinora/research/PatientResearchConsentServiceTest.java` | Pending | To inspect and integrate |
| `backend/src/test/java/com/clinora/research/ResearchAuditServiceTest.java` | Pending | To inspect and integrate |
| `backend/src/test/java/com/clinora/research/ResearchCollaborationServiceTest.java` | Pending | To inspect and integrate |
| `backend/src/test/java/com/clinora/research/ResearchDataEligibilityServiceTest.java` | Pending | To inspect and integrate |
| `backend/src/test/java/com/clinora/research/ResearchDocumentServiceTest.java` | Pending | To inspect and integrate |
| `backend/src/test/java/com/clinora/research/ResearchDomainFoundationTest.java` | Pending | To inspect and integrate |
| `backend/src/test/java/com/clinora/research/ResearchProjectServiceTest.java` | Pending | To inspect and integrate |
| `backend/src/test/java/com/clinora/research/ResearchPublicationServiceTest.java` | Pending | To inspect and integrate |
| `backend/src/test/java/com/clinora/research/ResearchSecurityLifecycleMatrixTest.java` | Pending | To inspect and integrate |
| `backend/src/test/java/com/clinora/research/ResearchWorkspaceServiceTest.java` | Pending | To inspect and integrate |
| `docker-compose.yml` | Pending | To inspect and integrate |
| `docs/development/admin-researcher-account-management-plan.md` | Pending | To inspect and integrate |
| `docs/development/clinora-library-publications-restructure.md` | Pending | To inspect and integrate |
| `docs/development/remove-deidentified-ui-badges-plan.md` | Pending | To inspect and integrate |
| `docs/development/research-ai-evaluation-implementation-plan.md` | Pending | To inspect and integrate |
| `docs/development/research-notepad-collaborative-editor-plan.md` | Pending | To inspect and integrate |
| `enable-docker-prerequisites.bat` | Pending | To inspect and integrate |
| `enable-features.ps1` | Pending | To inspect and integrate |
| `frontend/index.html` | Pending | To inspect and integrate |
| `frontend/package-lock.json` | Pending | To inspect and integrate |
| `frontend/public/assets/biomedical/researcher_3D_home_design.mp4` | Pending | To inspect and integrate |
| `frontend/src/App.tsx` | Pending | To inspect and integrate |
| `frontend/src/components/app/cinematic-background.tsx` | Pending | To inspect and integrate |
| `frontend/src/features/admin/admin-layout.tsx` | Pending | To inspect and integrate |
| `frontend/src/features/admin/admin-researchers-api.ts` | Pending | To inspect and integrate |
| `frontend/src/features/auth/auth-navigation.ts` | Pending | To inspect and integrate |
| `frontend/src/features/auth/auth-store.ts` | Pending | To inspect and integrate |
| `frontend/src/features/auth/protected-route.test.tsx` | Pending | To inspect and integrate |
| `frontend/src/features/notifications/notification-target.ts` | Pending | To inspect and integrate |
| `frontend/src/features/notifications/patient-notification-bell.tsx` | Pending | To inspect and integrate |
| `frontend/src/features/patient/patient-api.ts` | Pending | To inspect and integrate |
| `frontend/src/features/patient/patient-home.tsx` | Pending | To inspect and integrate |
| `frontend/src/features/patient/patient-profile-state.ts` | Pending | To inspect and integrate |
| `frontend/src/features/patient/patient-profile-ui.tsx` | Pending | To inspect and integrate |
| `frontend/src/features/patient/patient-types.ts` | Pending | To inspect and integrate |
| `frontend/src/features/research/research-api.ts` | Pending | To inspect and integrate |
| `frontend/src/features/research/research-credentials-api.ts` | Pending | To inspect and integrate |
| `frontend/src/features/research/research-layout.tsx` | Pending | To inspect and integrate |
| `frontend/src/features/research/research-status-badge.tsx` | Pending | To inspect and integrate |
| `frontend/src/features/research/research-types.ts` | Pending | To inspect and integrate |
| `frontend/src/pages/admin/access-reviews-page.test.tsx` | Pending | To inspect and integrate |
| `frontend/src/pages/admin/access-reviews-page.tsx` | Pending | To inspect and integrate |
| `frontend/src/pages/admin/admin-research-dataset-requests-page.tsx` | Pending | To inspect and integrate |
| `frontend/src/pages/admin/admin-research-projects-page.tsx` | Pending | To inspect and integrate |
| `frontend/src/pages/admin/admin-researcher-detail-page.tsx` | Pending | To inspect and integrate |
| `frontend/src/pages/admin/admin-researchers-page.tsx` | Pending | To inspect and integrate |
| `frontend/src/pages/auth/login-page.test.tsx` | Pending | To inspect and integrate |
| `frontend/src/pages/patient/patient-notifications-page.tsx` | Pending | To inspect and integrate |
| `frontend/src/pages/patient/patient-profile-page.tsx` | Pending | To inspect and integrate |
| `frontend/src/pages/research/ai-evaluation-section.tsx` | Pending | To inspect and integrate |
| `frontend/src/pages/research/dataset-detail-page.tsx` | Pending | To inspect and integrate |
| `frontend/src/pages/research/dataset-request-detail-page.tsx` | Pending | To inspect and integrate |
| `frontend/src/pages/research/dataset-request-form-page.tsx` | Pending | To inspect and integrate |
| `frontend/src/pages/research/datasets-page.tsx` | Pending | To inspect and integrate |
| `frontend/src/pages/research/project-audit-trail-section.tsx` | Pending | To inspect and integrate |
| `frontend/src/pages/research/project-collaborators-section.tsx` | Pending | To inspect and integrate |
| `frontend/src/pages/research/project-notepad-section.test.tsx` | Pending | To inspect and integrate |
| `frontend/src/pages/research/project-notepad-section.tsx` | Pending | To inspect and integrate |
| `frontend/src/pages/research/research-credentials-page.tsx` | Pending | To inspect and integrate |
| `frontend/src/pages/research/research-dashboard-page.tsx` | Pending | To inspect and integrate |
| `frontend/src/pages/research/research-library-page.tsx` | Pending | To inspect and integrate |
| `frontend/src/pages/research/research-project-detail-page.tsx` | Pending | To inspect and integrate |
| `frontend/src/pages/research/research-project-form-page.tsx` | Pending | To inspect and integrate |
| `frontend/src/pages/research/research-projects-page.tsx` | Pending | To inspect and integrate |
| `frontend/vite.config.ts` | Pending | To inspect and integrate |
| `run-enable-features.bat` | Pending | To inspect and integrate |
