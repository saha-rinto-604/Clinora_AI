# Stage 2 feature preservation matrix

Branch: `integration/clinora-unified-2026`. Clinical: `7a9f453c73a05085e661c06fea72f8defb35c3ca`. Shahed: `3fa876032d74b8022ba980983b777d0fc976a289`.

All 58 protected working-tree paths were replayed in checkpoint `1edf70a`. Original files and governing DOCX are independently hash-verified. See the validation report for the limits of each result.

| Feature | Source | Integrated implementation | Verification | Status |
|---|---|---|---|---|
| Patient | Clinical + protected work | Premium home, reports, SELF/OTHER boundaries, profile, appointments, care and blood modules retained; consent separated from health-profile completion | Patient component/service suites; live synthetic upload/OCR/verification | Verified synthetic upload → OCR → review → MedGemma analysis |
| Doctor | Clinical + protected work | Accepted Doctor layouts, schedules, approvals, clinical evidence, consultation and prescriptions retained | Clinical service and component tests; 16 PostgreSQL weekly-care integration tests | Integrated; external provider/email workflows conditional |
| Authentication | Clinical | Login, verification, refresh, sessions and role boundaries retained; active Researcher/token-cutoff checks added | Auth/security suites; live role logins and denial tests | Verified |
| Doctor approval | Clinical | Application, review, interview and activation services/routes retained | Access application, Admin review, interview tests; Admin browser queue | Verified in automated tests; live email activation not executed |
| Researcher approval | Clinical + Shahed | Clinical onboarding retained separately from project governance and account credential lifecycle | Admin account, access review and security tests; browser navigation | Verified in automated tests; live email activation not executed |
| Researcher workspace | Shahed | Projects, invitations, memberships, notes, files, comments, audit and credentials retained | Research workspace/collaboration/project suites; live project approval workflow | Integrated and tested |
| Admin Research | Shahed + clinical | Shahed shell includes clinical access reviews and research account/project/dataset governance | Admin suites and browser navigation; live project approval and suspension | Verified |
| Research datasets | Shahed + privacy repairs | Central grant/account/project/consent guard; five distinct patients; approved filters; provenance and withdrawal suspension | Real PostgreSQL privacy tests; live five-patient generation/download/withdrawal/restore; clean and clone migrations | Integrated and tested; production upgrades remain gated |
| AI evaluation | Shahed + integrity repairs | Evaluation workflows retained with explicit unavailable execution and withheld unverified historical metrics | AI evaluation tests and unavailable-state UI | Execution unavailable; no fabricated performance |
| Clinora Library | Shahed + privacy repairs | Metadata, citations, private drafts, authorship, methodology and authorized dataset links retained | Library/privacy lifecycle tests; live library request | Integrated and tested |
| Research Notepad | Shahed + safety repairs | TipTap revision-based editor, serialized saves, conflicts, local draft recovery, history and comments; presence guarded | 6 frontend tests; document tests; live concurrent saves produce 200/409 | Verified revision mode; CRDT editing disabled |
| OCR | Clinical + protected work | Private OCR service, extraction queues, verification, capacity and parser behavior retained | 51 Python tests; live PDF upload, malware scan, storage and extraction of three synthetic observations | Verified |
| AI reports | Clinical + protected work | MedGemma Patient runtime and approved Doctor provider boundary retained | 383 Python tests + 6 subtests; queued live MedGemma analysis SUCCEEDED | Verified Patient inference; optional knowledge corpus and Doctor provider configuration unavailable |
| Notifications | Combined | Patient/Doctor notifications plus Researcher events; STOMP relay and resource/account checks | Notification/security suites; real broker tests for identity, membership removal and suspension | Verified, including long-lived delivery revocation |

## All 238 audited Shahed path dispositions

Unchanged means Git blob equality after Git line-ending normalization; adaptation reasons identify the governing integration decision. Migrations retain their source provenance while using an isolated, collision-free namespace.

| Source path | Disposition | Destination / reason |
|---|---|---|
| `.env.example` | Integrated with adaptation | `.env.example`; Preserve clinical host AI, bind mounts and polling; add research configuration with minimum five; isolated runtime override provided separately. |
| `backend/src/main/java/com/clinora/admin/researcher/AdminResearcherAccountController.java` | Integrated unchanged | `backend/src/main/java/com/clinora/admin/researcher/AdminResearcherAccountController.java` |
| `backend/src/main/java/com/clinora/admin/researcher/AdminResearcherAccountModels.java` | Integrated unchanged | `backend/src/main/java/com/clinora/admin/researcher/AdminResearcherAccountModels.java` |
| `backend/src/main/java/com/clinora/admin/researcher/AdminResearcherAccountService.java` | Integrated with adaptation | `backend/src/main/java/com/clinora/admin/researcher/AdminResearcherAccountService.java`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `backend/src/main/java/com/clinora/admin/researcher/AdminResearcherApiException.java` | Integrated unchanged | `backend/src/main/java/com/clinora/admin/researcher/AdminResearcherApiException.java` |
| `backend/src/main/java/com/clinora/audit/AuthAuditAction.java` | Integrated with adaptation | `backend/src/main/java/com/clinora/audit/AuthAuditAction.java`; Three-way reconciliation against clinical baseline, privacy/security compatibility and targeted formatting; source behavior retained. |
| `backend/src/main/java/com/clinora/audit/AuthAuditEvent.java` | Integrated unchanged | `backend/src/main/java/com/clinora/audit/AuthAuditEvent.java` |
| `backend/src/main/java/com/clinora/audit/AuthAuditEventRepository.java` | Integrated unchanged | `backend/src/main/java/com/clinora/audit/AuthAuditEventRepository.java` |
| `backend/src/main/java/com/clinora/common/api/ApiExceptionHandler.java` | Integrated unchanged | `backend/src/main/java/com/clinora/common/api/ApiExceptionHandler.java` |
| `backend/src/main/java/com/clinora/config/ResearchStorageConfig.java` | Integrated unchanged | `backend/src/main/java/com/clinora/config/ResearchStorageConfig.java` |
| `backend/src/main/java/com/clinora/config/ResearchStorageProperties.java` | Integrated unchanged | `backend/src/main/java/com/clinora/config/ResearchStorageProperties.java` |
| `backend/src/main/java/com/clinora/notifications/api/PatientNotificationController.java` | Integrated unchanged | `backend/src/main/java/com/clinora/notifications/api/PatientNotificationController.java` |
| `backend/src/main/java/com/clinora/notifications/config/ClinoraWebSocketConfig.java` | Integrated with adaptation | `backend/src/main/java/com/clinora/notifications/config/ClinoraWebSocketConfig.java`; Union Patient/Doctor/Researcher events with current clinical delivery and authenticated resource-scoped sockets. |
| `backend/src/main/java/com/clinora/notifications/service/NotificationDeliveryConsumer.java` | Integrated with adaptation | `backend/src/main/java/com/clinora/notifications/service/NotificationDeliveryConsumer.java`; Union Patient/Doctor/Researcher events with current clinical delivery and authenticated resource-scoped sockets. |
| `backend/src/main/java/com/clinora/notifications/service/PatientNotificationService.java` | Integrated unchanged | `backend/src/main/java/com/clinora/notifications/service/PatientNotificationService.java` |
| `backend/src/main/java/com/clinora/patients/api/PatientProfileController.java` | Integrated unchanged | `backend/src/main/java/com/clinora/patients/api/PatientProfileController.java` |
| `backend/src/main/java/com/clinora/patients/api/PatientResearchConsentController.java` | Integrated with adaptation | `backend/src/main/java/com/clinora/patients/api/PatientResearchConsentController.java`; Preserve current clinical behavior and account identity; add Researcher compatibility and explicit Patient consent without replacing clinical workflows. |
| `backend/src/main/java/com/clinora/patients/service/PatientBodyMeasurementService.java` | Integrated unchanged | `backend/src/main/java/com/clinora/patients/service/PatientBodyMeasurementService.java` |
| `backend/src/main/java/com/clinora/patients/service/PatientProfileService.java` | Integrated with adaptation | `backend/src/main/java/com/clinora/patients/service/PatientProfileService.java`; Preserve current clinical behavior and account identity; add Researcher compatibility and explicit Patient consent without replacing clinical workflows. |
| `backend/src/main/java/com/clinora/patients/service/PatientTimelineService.java` | Integrated unchanged | `backend/src/main/java/com/clinora/patients/service/PatientTimelineService.java` |
| `backend/src/main/java/com/clinora/profile/api/ProfileImageController.java` | Integrated unchanged | `backend/src/main/java/com/clinora/profile/api/ProfileImageController.java` |
| `backend/src/main/java/com/clinora/profile/service/ProfileImageService.java` | Integrated unchanged | `backend/src/main/java/com/clinora/profile/service/ProfileImageService.java` |
| `backend/src/main/java/com/clinora/research/api/AIEvaluationController.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/api/AIEvaluationController.java` |
| `backend/src/main/java/com/clinora/research/api/AIEvaluationModels.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/api/AIEvaluationModels.java` |
| `backend/src/main/java/com/clinora/research/api/AdminDatasetRequestReviewController.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/api/AdminDatasetRequestReviewController.java` |
| `backend/src/main/java/com/clinora/research/api/AdminResearchProjectModels.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/api/AdminResearchProjectModels.java` |
| `backend/src/main/java/com/clinora/research/api/AdminResearchProjectReviewController.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/api/AdminResearchProjectReviewController.java` |
| `backend/src/main/java/com/clinora/research/api/CohortQueryModels.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/api/CohortQueryModels.java` |
| `backend/src/main/java/com/clinora/research/api/DatasetRequestModels.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/api/DatasetRequestModels.java` |
| `backend/src/main/java/com/clinora/research/api/DatasetStatisticsController.java` | Integrated with adaptation | `backend/src/main/java/com/clinora/research/api/DatasetStatisticsController.java`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `backend/src/main/java/com/clinora/research/api/DatasetStatisticsModels.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/api/DatasetStatisticsModels.java` |
| `backend/src/main/java/com/clinora/research/api/ResearchAuditController.java` | Integrated with adaptation | `backend/src/main/java/com/clinora/research/api/ResearchAuditController.java`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `backend/src/main/java/com/clinora/research/api/ResearchCollaborationController.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/api/ResearchCollaborationController.java` |
| `backend/src/main/java/com/clinora/research/api/ResearchCollaborationModels.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/api/ResearchCollaborationModels.java` |
| `backend/src/main/java/com/clinora/research/api/ResearchDatasetController.java` | Integrated with adaptation | `backend/src/main/java/com/clinora/research/api/ResearchDatasetController.java`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `backend/src/main/java/com/clinora/research/api/ResearchDatasetModels.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/api/ResearchDatasetModels.java` |
| `backend/src/main/java/com/clinora/research/api/ResearchDocumentCollaborationController.java` | Integrated with adaptation | `backend/src/main/java/com/clinora/research/api/ResearchDocumentCollaborationController.java`; Revision-checked saves, resource authorization, conflict handling, draft preservation and matching API tests; no unsafe edit broadcasts. |
| `backend/src/main/java/com/clinora/research/api/ResearchDocumentController.java` | Integrated with adaptation | `backend/src/main/java/com/clinora/research/api/ResearchDocumentController.java`; Revision-checked saves, resource authorization, conflict handling, draft preservation and matching API tests; no unsafe edit broadcasts. |
| `backend/src/main/java/com/clinora/research/api/ResearchDocumentModels.java` | Integrated with adaptation | `backend/src/main/java/com/clinora/research/api/ResearchDocumentModels.java`; Revision-checked saves, resource authorization, conflict handling, draft preservation and matching API tests; no unsafe edit broadcasts. |
| `backend/src/main/java/com/clinora/research/api/ResearchLibraryController.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/api/ResearchLibraryController.java` |
| `backend/src/main/java/com/clinora/research/api/ResearchProjectController.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/api/ResearchProjectController.java` |
| `backend/src/main/java/com/clinora/research/api/ResearchProjectModels.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/api/ResearchProjectModels.java` |
| `backend/src/main/java/com/clinora/research/api/ResearchPublicationController.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/api/ResearchPublicationController.java` |
| `backend/src/main/java/com/clinora/research/api/ResearchPublicationModels.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/api/ResearchPublicationModels.java` |
| `backend/src/main/java/com/clinora/research/api/ResearchWorkspaceController.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/api/ResearchWorkspaceController.java` |
| `backend/src/main/java/com/clinora/research/api/ResearchWorkspaceModels.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/api/ResearchWorkspaceModels.java` |
| `backend/src/main/java/com/clinora/research/api/ResearcherCohortController.java` | Integrated with adaptation | `backend/src/main/java/com/clinora/research/api/ResearcherCohortController.java`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `backend/src/main/java/com/clinora/research/api/ResearcherCredentialController.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/api/ResearcherCredentialController.java` |
| `backend/src/main/java/com/clinora/research/api/ResearcherCredentialModels.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/api/ResearcherCredentialModels.java` |
| `backend/src/main/java/com/clinora/research/api/ResearcherDatasetRequestController.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/api/ResearcherDatasetRequestController.java` |
| `backend/src/main/java/com/clinora/research/config/ResearchMessagingConfig.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/config/ResearchMessagingConfig.java` |
| `backend/src/main/java/com/clinora/research/deid/DefaultDeidentificationService.java` | Integrated with adaptation | `backend/src/main/java/com/clinora/research/deid/DefaultDeidentificationService.java`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `backend/src/main/java/com/clinora/research/deid/DeidentificationResult.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/deid/DeidentificationResult.java` |
| `backend/src/main/java/com/clinora/research/deid/DeidentificationService.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/deid/DeidentificationService.java` |
| `backend/src/main/java/com/clinora/research/deid/DeidentifiedRecord.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/deid/DeidentifiedRecord.java` |
| `backend/src/main/java/com/clinora/research/domain/AIEvaluationRun.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/AIEvaluationRun.java` |
| `backend/src/main/java/com/clinora/research/domain/CohortEligibilityReport.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/CohortEligibilityReport.java` |
| `backend/src/main/java/com/clinora/research/domain/CredentialVerificationStatus.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/CredentialVerificationStatus.java` |
| `backend/src/main/java/com/clinora/research/domain/DatasetAccessGrant.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/DatasetAccessGrant.java` |
| `backend/src/main/java/com/clinora/research/domain/DatasetFormat.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/DatasetFormat.java` |
| `backend/src/main/java/com/clinora/research/domain/DatasetGenerationJob.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/DatasetGenerationJob.java` |
| `backend/src/main/java/com/clinora/research/domain/DatasetRequest.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/DatasetRequest.java` |
| `backend/src/main/java/com/clinora/research/domain/DatasetRequestStatus.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/DatasetRequestStatus.java` |
| `backend/src/main/java/com/clinora/research/domain/DatasetVersion.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/DatasetVersion.java` |
| `backend/src/main/java/com/clinora/research/domain/EligibilityCandidate.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/EligibilityCandidate.java` |
| `backend/src/main/java/com/clinora/research/domain/EligibilityDecision.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/EligibilityDecision.java` |
| `backend/src/main/java/com/clinora/research/domain/EligibilityIneligibilityReason.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/EligibilityIneligibilityReason.java` |
| `backend/src/main/java/com/clinora/research/domain/EligibilityStatus.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/EligibilityStatus.java` |
| `backend/src/main/java/com/clinora/research/domain/EvaluationRunStatus.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/EvaluationRunStatus.java` |
| `backend/src/main/java/com/clinora/research/domain/EvaluationTaskType.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/EvaluationTaskType.java` |
| `backend/src/main/java/com/clinora/research/domain/InvitationStatus.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/InvitationStatus.java` |
| `backend/src/main/java/com/clinora/research/domain/LibraryVisibility.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/LibraryVisibility.java` |
| `backend/src/main/java/com/clinora/research/domain/PatientResearchConsent.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/PatientResearchConsent.java` |
| `backend/src/main/java/com/clinora/research/domain/ProjectMemberRole.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/ProjectMemberRole.java` |
| `backend/src/main/java/com/clinora/research/domain/PublicationStatus.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/PublicationStatus.java` |
| `backend/src/main/java/com/clinora/research/domain/PublicationType.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/PublicationType.java` |
| `backend/src/main/java/com/clinora/research/domain/ResearchConsentStatus.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/ResearchConsentStatus.java` |
| `backend/src/main/java/com/clinora/research/domain/ResearchDataset.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/ResearchDataset.java` |
| `backend/src/main/java/com/clinora/research/domain/ResearchDocument.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/ResearchDocument.java` |
| `backend/src/main/java/com/clinora/research/domain/ResearchDocumentComment.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/ResearchDocumentComment.java` |
| `backend/src/main/java/com/clinora/research/domain/ResearchDocumentRevision.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/ResearchDocumentRevision.java` |
| `backend/src/main/java/com/clinora/research/domain/ResearchDocumentType.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/ResearchDocumentType.java` |
| `backend/src/main/java/com/clinora/research/domain/ResearchNote.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/ResearchNote.java` |
| `backend/src/main/java/com/clinora/research/domain/ResearchNoteComment.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/ResearchNoteComment.java` |
| `backend/src/main/java/com/clinora/research/domain/ResearchNoteStatus.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/ResearchNoteStatus.java` |
| `backend/src/main/java/com/clinora/research/domain/ResearchProject.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/ResearchProject.java` |
| `backend/src/main/java/com/clinora/research/domain/ResearchProjectFile.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/ResearchProjectFile.java` |
| `backend/src/main/java/com/clinora/research/domain/ResearchProjectFileVersion.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/ResearchProjectFileVersion.java` |
| `backend/src/main/java/com/clinora/research/domain/ResearchProjectInvitation.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/ResearchProjectInvitation.java` |
| `backend/src/main/java/com/clinora/research/domain/ResearchProjectMember.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/ResearchProjectMember.java` |
| `backend/src/main/java/com/clinora/research/domain/ResearchProjectReview.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/ResearchProjectReview.java` |
| `backend/src/main/java/com/clinora/research/domain/ResearchProjectReviewAction.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/ResearchProjectReviewAction.java` |
| `backend/src/main/java/com/clinora/research/domain/ResearchProjectStatus.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/ResearchProjectStatus.java` |
| `backend/src/main/java/com/clinora/research/domain/ResearchPublication.java` | Integrated with adaptation | `backend/src/main/java/com/clinora/research/domain/ResearchPublication.java`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `backend/src/main/java/com/clinora/research/domain/ResearcherCredentialVerification.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/ResearcherCredentialVerification.java` |
| `backend/src/main/java/com/clinora/research/domain/catalog/ResearchCatalogVariable.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/catalog/ResearchCatalogVariable.java` |
| `backend/src/main/java/com/clinora/research/domain/catalog/ResearchDataCatalog.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/domain/catalog/ResearchDataCatalog.java` |
| `backend/src/main/java/com/clinora/research/exception/ResearchApiException.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/exception/ResearchApiException.java` |
| `backend/src/main/java/com/clinora/research/exception/ResearchErrorCode.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/exception/ResearchErrorCode.java` |
| `backend/src/main/java/com/clinora/research/repository/AIEvaluationRunRepository.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/repository/AIEvaluationRunRepository.java` |
| `backend/src/main/java/com/clinora/research/repository/DatasetAccessGrantRepository.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/repository/DatasetAccessGrantRepository.java` |
| `backend/src/main/java/com/clinora/research/repository/DatasetGenerationJobRepository.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/repository/DatasetGenerationJobRepository.java` |
| `backend/src/main/java/com/clinora/research/repository/DatasetRequestRepository.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/repository/DatasetRequestRepository.java` |
| `backend/src/main/java/com/clinora/research/repository/DatasetVersionRepository.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/repository/DatasetVersionRepository.java` |
| `backend/src/main/java/com/clinora/research/repository/PatientResearchConsentRepository.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/repository/PatientResearchConsentRepository.java` |
| `backend/src/main/java/com/clinora/research/repository/ResearchDatasetRepository.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/repository/ResearchDatasetRepository.java` |
| `backend/src/main/java/com/clinora/research/repository/ResearchDocumentCommentRepository.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/repository/ResearchDocumentCommentRepository.java` |
| `backend/src/main/java/com/clinora/research/repository/ResearchDocumentRepository.java` | Integrated with adaptation | `backend/src/main/java/com/clinora/research/repository/ResearchDocumentRepository.java`; Revision-checked saves, resource authorization, conflict handling, draft preservation and matching API tests; no unsafe edit broadcasts. |
| `backend/src/main/java/com/clinora/research/repository/ResearchDocumentRevisionRepository.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/repository/ResearchDocumentRevisionRepository.java` |
| `backend/src/main/java/com/clinora/research/repository/ResearchNoteCommentRepository.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/repository/ResearchNoteCommentRepository.java` |
| `backend/src/main/java/com/clinora/research/repository/ResearchNoteRepository.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/repository/ResearchNoteRepository.java` |
| `backend/src/main/java/com/clinora/research/repository/ResearchProjectFileRepository.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/repository/ResearchProjectFileRepository.java` |
| `backend/src/main/java/com/clinora/research/repository/ResearchProjectFileVersionRepository.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/repository/ResearchProjectFileVersionRepository.java` |
| `backend/src/main/java/com/clinora/research/repository/ResearchProjectInvitationRepository.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/repository/ResearchProjectInvitationRepository.java` |
| `backend/src/main/java/com/clinora/research/repository/ResearchProjectMemberRepository.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/repository/ResearchProjectMemberRepository.java` |
| `backend/src/main/java/com/clinora/research/repository/ResearchProjectRepository.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/repository/ResearchProjectRepository.java` |
| `backend/src/main/java/com/clinora/research/repository/ResearchProjectReviewRepository.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/repository/ResearchProjectReviewRepository.java` |
| `backend/src/main/java/com/clinora/research/repository/ResearchPublicationRepository.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/repository/ResearchPublicationRepository.java` |
| `backend/src/main/java/com/clinora/research/repository/ResearcherCredentialVerificationRepository.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/repository/ResearcherCredentialVerificationRepository.java` |
| `backend/src/main/java/com/clinora/research/service/AIEvaluationService.java` | Integrated with adaptation | `backend/src/main/java/com/clinora/research/service/AIEvaluationService.java`; Retain workflow and contracts; reject unverifiable execution/results and apply dataset authorization. |
| `backend/src/main/java/com/clinora/research/service/AdminDatasetRequestReviewService.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/service/AdminDatasetRequestReviewService.java` |
| `backend/src/main/java/com/clinora/research/service/AdminResearchProjectReviewService.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/service/AdminResearchProjectReviewService.java` |
| `backend/src/main/java/com/clinora/research/service/CohortBuilderService.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/service/CohortBuilderService.java` |
| `backend/src/main/java/com/clinora/research/service/DatasetGenerationService.java` | Integrated with adaptation | `backend/src/main/java/com/clinora/research/service/DatasetGenerationService.java`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `backend/src/main/java/com/clinora/research/service/DatasetGenerationWorker.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/service/DatasetGenerationWorker.java` |
| `backend/src/main/java/com/clinora/research/service/DatasetRequestService.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/service/DatasetRequestService.java` |
| `backend/src/main/java/com/clinora/research/service/DatasetStatisticsService.java` | Integrated with adaptation | `backend/src/main/java/com/clinora/research/service/DatasetStatisticsService.java`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `backend/src/main/java/com/clinora/research/service/DefaultCohortBuilderService.java` | Integrated with adaptation | `backend/src/main/java/com/clinora/research/service/DefaultCohortBuilderService.java`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `backend/src/main/java/com/clinora/research/service/DefaultResearchDataEligibilityService.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/service/DefaultResearchDataEligibilityService.java` |
| `backend/src/main/java/com/clinora/research/service/DiseaseAnalyticsPolicy.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/service/DiseaseAnalyticsPolicy.java` |
| `backend/src/main/java/com/clinora/research/service/PatientResearchConsentService.java` | Integrated with adaptation | `backend/src/main/java/com/clinora/research/service/PatientResearchConsentService.java`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `backend/src/main/java/com/clinora/research/service/ResearchAuditService.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/service/ResearchAuditService.java` |
| `backend/src/main/java/com/clinora/research/service/ResearchAuthorizationService.java` | Integrated with adaptation | `backend/src/main/java/com/clinora/research/service/ResearchAuthorizationService.java`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `backend/src/main/java/com/clinora/research/service/ResearchCollaborationService.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/service/ResearchCollaborationService.java` |
| `backend/src/main/java/com/clinora/research/service/ResearchDataEligibilityService.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/service/ResearchDataEligibilityService.java` |
| `backend/src/main/java/com/clinora/research/service/ResearchDocumentService.java` | Integrated with adaptation | `backend/src/main/java/com/clinora/research/service/ResearchDocumentService.java`; Revision-checked saves, resource authorization, conflict handling, draft preservation and matching API tests; no unsafe edit broadcasts. |
| `backend/src/main/java/com/clinora/research/service/ResearchProjectService.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/service/ResearchProjectService.java` |
| `backend/src/main/java/com/clinora/research/service/ResearchPublicationService.java` | Integrated with adaptation | `backend/src/main/java/com/clinora/research/service/ResearchPublicationService.java`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `backend/src/main/java/com/clinora/research/service/ResearchWorkspaceService.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/service/ResearchWorkspaceService.java` |
| `backend/src/main/java/com/clinora/research/service/ResearcherCredentialService.java` | Integrated with adaptation | `backend/src/main/java/com/clinora/research/service/ResearcherCredentialService.java`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `backend/src/main/java/com/clinora/research/service/evaluation/AbnormalityDetectionMetricsCalculator.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/service/evaluation/AbnormalityDetectionMetricsCalculator.java` |
| `backend/src/main/java/com/clinora/research/service/evaluation/ClassificationMetricsCalculator.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/service/evaluation/ClassificationMetricsCalculator.java` |
| `backend/src/main/java/com/clinora/research/service/evaluation/ExtractionMetricsCalculator.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/service/evaluation/ExtractionMetricsCalculator.java` |
| `backend/src/main/java/com/clinora/research/storage/ResearchDatasetStoragePort.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/storage/ResearchDatasetStoragePort.java` |
| `backend/src/main/java/com/clinora/research/storage/S3ResearchDatasetStorageAdapter.java` | Integrated unchanged | `backend/src/main/java/com/clinora/research/storage/S3ResearchDatasetStorageAdapter.java` |
| `backend/src/main/java/com/clinora/users/domain/UserAccount.java` | Integrated unchanged | `backend/src/main/java/com/clinora/users/domain/UserAccount.java` |
| `backend/src/main/java/com/clinora/users/repository/UserAccountRepository.java` | Integrated unchanged | `backend/src/main/java/com/clinora/users/repository/UserAccountRepository.java` |
| `backend/src/main/resources/application.yml` | Integrated with adaptation | `backend/src/main/resources/application.yml`; Three-way reconciliation against clinical baseline, privacy/security compatibility and targeted formatting; source behavior retained. |
| `backend/src/main/resources/db/migration/V27__create_research_domain_foundation.sql` | Integrated with adaptation | `backend/src/main/resources/db/integration-clean/V33__create_research_domain_foundation.sql`; clinical V1â€“V32 unchanged; consent defaults UNKNOWN/no seed and Library defaults private where applicable. |
| `backend/src/main/resources/db/migration/V28__create_research_project_reviews.sql` | Integrated with adaptation | `backend/src/main/resources/db/integration-clean/V34__create_research_project_reviews.sql`; clinical V1â€“V32 unchanged; consent defaults UNKNOWN/no seed and Library defaults private where applicable. |
| `backend/src/main/resources/db/migration/V29__create_research_dataset_requests.sql` | Integrated with adaptation | `backend/src/main/resources/db/integration-clean/V35__create_research_dataset_requests.sql`; clinical V1â€“V32 unchanged; consent defaults UNKNOWN/no seed and Library defaults private where applicable. |
| `backend/src/main/resources/db/migration/V30__create_research_dataset_generation_and_versions.sql` | Integrated with adaptation | `backend/src/main/resources/db/integration-clean/V36__create_research_dataset_generation_and_versions.sql`; clinical V1â€“V32 unchanged; consent defaults UNKNOWN/no seed and Library defaults private where applicable. |
| `backend/src/main/resources/db/migration/V31__create_ai_evaluation_runs.sql` | Integrated with adaptation | `backend/src/main/resources/db/integration-clean/V37__create_ai_evaluation_runs.sql`; clinical V1â€“V32 unchanged; consent defaults UNKNOWN/no seed and Library defaults private where applicable. |
| `backend/src/main/resources/db/migration/V32__create_research_project_members.sql` | Integrated with adaptation | `backend/src/main/resources/db/integration-clean/V38__create_research_project_members.sql`; clinical V1â€“V32 unchanged; consent defaults UNKNOWN/no seed and Library defaults private where applicable. |
| `backend/src/main/resources/db/migration/V33__create_research_publications.sql` | Integrated with adaptation | `backend/src/main/resources/db/integration-clean/V39__create_research_publications.sql`; clinical V1â€“V32 unchanged; consent defaults UNKNOWN/no seed and Library defaults private where applicable. |
| `backend/src/main/resources/db/migration/V34__create_patient_research_consents.sql` | Integrated with adaptation | `backend/src/main/resources/db/integration-clean/V40__create_patient_research_consents.sql`; clinical V1â€“V32 unchanged; consent defaults UNKNOWN/no seed and Library defaults private where applicable. |
| `backend/src/main/resources/db/migration/V35__research_collaboration_invitation_lifecycle.sql` | Integrated with adaptation | `backend/src/main/resources/db/integration-clean/V41__research_collaboration_invitation_lifecycle.sql`; clinical V1â€“V32 unchanged; consent defaults UNKNOWN/no seed and Library defaults private where applicable. |
| `backend/src/main/resources/db/migration/V36__research_collaboration_workspace.sql` | Integrated with adaptation | `backend/src/main/resources/db/integration-clean/V42__research_collaboration_workspace.sql`; clinical V1â€“V32 unchanged; consent defaults UNKNOWN/no seed and Library defaults private where applicable. |
| `backend/src/main/resources/db/migration/V37__researcher_credential_verification.sql` | Integrated with adaptation | `backend/src/main/resources/db/integration-clean/V43__researcher_credential_verification.sql`; clinical V1â€“V32 unchanged; consent defaults UNKNOWN/no seed and Library defaults private where applicable. |
| `backend/src/main/resources/db/migration/V38__clinora_library_publications_restructure.sql` | Integrated with adaptation | `backend/src/main/resources/db/integration-clean/V44__clinora_library_publications_restructure.sql`; clinical V1â€“V32 unchanged; consent defaults UNKNOWN/no seed and Library defaults private where applicable. |
| `backend/src/main/resources/db/migration/V39__create_research_notepad_documents.sql` | Integrated with adaptation | `backend/src/main/resources/db/integration-clean/V45__create_research_notepad_documents.sql`; clinical V1â€“V32 unchanged; consent defaults UNKNOWN/no seed and Library defaults private where applicable. |
| `backend/src/test/java/com/clinora/admin/researcher/AdminResearcherAccountControllerSecurityTest.java` | Integrated with adaptation | `backend/src/test/java/com/clinora/admin/researcher/AdminResearcherAccountControllerSecurityTest.java`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `backend/src/test/java/com/clinora/admin/researcher/AdminResearcherAccountServiceTest.java` | Integrated with adaptation | `backend/src/test/java/com/clinora/admin/researcher/AdminResearcherAccountServiceTest.java`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `backend/src/test/java/com/clinora/patients/service/PatientProfileServiceTest.java` | Integrated unchanged | `backend/src/test/java/com/clinora/patients/service/PatientProfileServiceTest.java` |
| `backend/src/test/java/com/clinora/research/AIEvaluationServiceTest.java` | Integrated with adaptation | `backend/src/test/java/com/clinora/research/AIEvaluationServiceTest.java`; Retain workflow and contracts; reject unverifiable execution/results and apply dataset authorization. |
| `backend/src/test/java/com/clinora/research/AdminDatasetRequestReviewServiceTest.java` | Integrated unchanged | `backend/src/test/java/com/clinora/research/AdminDatasetRequestReviewServiceTest.java` |
| `backend/src/test/java/com/clinora/research/AdminResearchProjectReviewServiceTest.java` | Integrated unchanged | `backend/src/test/java/com/clinora/research/AdminResearchProjectReviewServiceTest.java` |
| `backend/src/test/java/com/clinora/research/ClinoraLibrarySecurityAndRestructureTest.java` | Integrated with adaptation | `backend/src/test/java/com/clinora/research/ClinoraLibrarySecurityAndRestructureTest.java`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `backend/src/test/java/com/clinora/research/CohortBuilderServiceTest.java` | Integrated unchanged | `backend/src/test/java/com/clinora/research/CohortBuilderServiceTest.java` |
| `backend/src/test/java/com/clinora/research/DatasetGenerationServiceTest.java` | Integrated with adaptation | `backend/src/test/java/com/clinora/research/DatasetGenerationServiceTest.java`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `backend/src/test/java/com/clinora/research/DatasetRequestServiceTest.java` | Integrated unchanged | `backend/src/test/java/com/clinora/research/DatasetRequestServiceTest.java` |
| `backend/src/test/java/com/clinora/research/DeidentificationServiceTest.java` | Integrated with adaptation | `backend/src/test/java/com/clinora/research/DeidentificationServiceTest.java`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `backend/src/test/java/com/clinora/research/PatientResearchConsentServiceTest.java` | Integrated with adaptation | `backend/src/test/java/com/clinora/research/PatientResearchConsentServiceTest.java`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `backend/src/test/java/com/clinora/research/ResearchAuditServiceTest.java` | Integrated unchanged | `backend/src/test/java/com/clinora/research/ResearchAuditServiceTest.java` |
| `backend/src/test/java/com/clinora/research/ResearchCollaborationServiceTest.java` | Integrated unchanged | `backend/src/test/java/com/clinora/research/ResearchCollaborationServiceTest.java` |
| `backend/src/test/java/com/clinora/research/ResearchDataEligibilityServiceTest.java` | Integrated unchanged | `backend/src/test/java/com/clinora/research/ResearchDataEligibilityServiceTest.java` |
| `backend/src/test/java/com/clinora/research/ResearchDocumentServiceTest.java` | Integrated with adaptation | `backend/src/test/java/com/clinora/research/ResearchDocumentServiceTest.java`; Revision-checked saves, resource authorization, conflict handling, draft preservation and matching API tests; no unsafe edit broadcasts. |
| `backend/src/test/java/com/clinora/research/ResearchDomainFoundationTest.java` | Integrated unchanged | `backend/src/test/java/com/clinora/research/ResearchDomainFoundationTest.java` |
| `backend/src/test/java/com/clinora/research/ResearchProjectServiceTest.java` | Integrated unchanged | `backend/src/test/java/com/clinora/research/ResearchProjectServiceTest.java` |
| `backend/src/test/java/com/clinora/research/ResearchPublicationServiceTest.java` | Integrated with adaptation | `backend/src/test/java/com/clinora/research/ResearchPublicationServiceTest.java`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `backend/src/test/java/com/clinora/research/ResearchSecurityLifecycleMatrixTest.java` | Integrated with adaptation | `backend/src/test/java/com/clinora/research/ResearchSecurityLifecycleMatrixTest.java`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `backend/src/test/java/com/clinora/research/ResearchWorkspaceServiceTest.java` | Integrated unchanged | `backend/src/test/java/com/clinora/research/ResearchWorkspaceServiceTest.java` |
| `docker-compose.yml` | Integrated with adaptation | `docker-compose.yml`; Preserve clinical host AI, bind mounts and polling; add research configuration with minimum five; isolated runtime override provided separately. |
| `docs/development/admin-researcher-account-management-plan.md` | Integrated unchanged | `docs/development/admin-researcher-account-management-plan.md` |
| `docs/development/clinora-library-publications-restructure.md` | Integrated unchanged | `docs/development/clinora-library-publications-restructure.md` |
| `docs/development/remove-deidentified-ui-badges-plan.md` | Integrated unchanged | `docs/development/remove-deidentified-ui-badges-plan.md` |
| `docs/development/research-ai-evaluation-implementation-plan.md` | Integrated unchanged | `docs/development/research-ai-evaluation-implementation-plan.md` |
| `docs/development/research-notepad-collaborative-editor-plan.md` | Integrated unchanged | `docs/development/research-notepad-collaborative-editor-plan.md` |
| `enable-docker-prerequisites.bat` | Intentionally excluded | Windows optional-feature elevation scripts are outside authorized application integration; Docker already available. Source retained in audited Git commit. |
| `enable-features.ps1` | Intentionally excluded | Windows optional-feature elevation scripts are outside authorized application integration; Docker already available. Source retained in audited Git commit. |
| `frontend/index.html` | Integrated unchanged | `frontend/index.html` |
| `frontend/package-lock.json` | Integrated with adaptation | `frontend/package-lock.json`; Clinical dependency union with approved TipTap 2.27.1 and compatible security updates; reproducible lockfile. |
| `frontend/public/assets/biomedical/researcher_3D_home_design.mp4` | Integrated unchanged | `frontend/public/assets/biomedical/researcher_3D_home_design.mp4` |
| `frontend/src/App.tsx` | Integrated with adaptation | `frontend/src/App.tsx`; Union clinical professional review/interview routes with Research Administration; preserve clinical role routes. |
| `frontend/src/components/app/cinematic-background.tsx` | Integrated unchanged | `frontend/src/components/app/cinematic-background.tsx` |
| `frontend/src/features/admin/admin-layout.tsx` | Integrated unchanged | `frontend/src/features/admin/admin-layout.tsx` |
| `frontend/src/features/admin/admin-researchers-api.ts` | Integrated with adaptation | `frontend/src/features/admin/admin-researchers-api.ts`; Union clinical professional review/interview routes with Research Administration; preserve clinical role routes. |
| `frontend/src/features/auth/auth-navigation.ts` | Integrated unchanged | `frontend/src/features/auth/auth-navigation.ts` |
| `frontend/src/features/auth/auth-store.ts` | Integrated unchanged | `frontend/src/features/auth/auth-store.ts` |
| `frontend/src/features/auth/protected-route.test.tsx` | Integrated unchanged | `frontend/src/features/auth/protected-route.test.tsx` |
| `frontend/src/features/notifications/notification-target.ts` | Integrated unchanged | `frontend/src/features/notifications/notification-target.ts` |
| `frontend/src/features/notifications/patient-notification-bell.tsx` | Integrated with adaptation | `frontend/src/features/notifications/patient-notification-bell.tsx`; Union Patient/Doctor/Researcher events with current clinical delivery and authenticated resource-scoped sockets. |
| `frontend/src/features/patient/patient-api.ts` | Integrated unchanged | `frontend/src/features/patient/patient-api.ts` |
| `frontend/src/features/patient/patient-home.tsx` | Integrated with adaptation | `frontend/src/features/patient/patient-home.tsx`; Preserve current clinical behavior and account identity; add Researcher compatibility and explicit Patient consent without replacing clinical workflows. |
| `frontend/src/features/patient/patient-profile-state.ts` | Integrated with adaptation | `frontend/src/features/patient/patient-profile-state.ts`; Preserve current clinical behavior and account identity; add Researcher compatibility and explicit Patient consent without replacing clinical workflows. |
| `frontend/src/features/patient/patient-profile-ui.tsx` | Integrated with adaptation | `frontend/src/features/patient/patient-profile-ui.tsx`; Preserve current clinical behavior and account identity; add Researcher compatibility and explicit Patient consent without replacing clinical workflows. |
| `frontend/src/features/patient/patient-types.ts` | Integrated unchanged | `frontend/src/features/patient/patient-types.ts` |
| `frontend/src/features/research/research-api.ts` | Integrated with adaptation | `frontend/src/features/research/research-api.ts`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `frontend/src/features/research/research-credentials-api.ts` | Integrated with adaptation | `frontend/src/features/research/research-credentials-api.ts`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `frontend/src/features/research/research-layout.tsx` | Integrated with adaptation | `frontend/src/features/research/research-layout.tsx`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `frontend/src/features/research/research-status-badge.tsx` | Integrated unchanged | `frontend/src/features/research/research-status-badge.tsx` |
| `frontend/src/features/research/research-types.ts` | Integrated with adaptation | `frontend/src/features/research/research-types.ts`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `frontend/src/pages/admin/access-reviews-page.test.tsx` | Integrated unchanged | `frontend/src/pages/admin/access-reviews-page.test.tsx` |
| `frontend/src/pages/admin/access-reviews-page.tsx` | Integrated unchanged | `frontend/src/pages/admin/access-reviews-page.tsx` |
| `frontend/src/pages/admin/admin-research-dataset-requests-page.tsx` | Integrated unchanged | `frontend/src/pages/admin/admin-research-dataset-requests-page.tsx` |
| `frontend/src/pages/admin/admin-research-projects-page.tsx` | Integrated unchanged | `frontend/src/pages/admin/admin-research-projects-page.tsx` |
| `frontend/src/pages/admin/admin-researcher-detail-page.tsx` | Integrated with adaptation | `frontend/src/pages/admin/admin-researcher-detail-page.tsx`; Union clinical professional review/interview routes with Research Administration; preserve clinical role routes. |
| `frontend/src/pages/admin/admin-researchers-page.tsx` | Integrated with adaptation | `frontend/src/pages/admin/admin-researchers-page.tsx`; Union clinical professional review/interview routes with Research Administration; preserve clinical role routes. |
| `frontend/src/pages/auth/login-page.test.tsx` | Integrated unchanged | `frontend/src/pages/auth/login-page.test.tsx` |
| `frontend/src/pages/patient/patient-notifications-page.tsx` | Integrated unchanged | `frontend/src/pages/patient/patient-notifications-page.tsx` |
| `frontend/src/pages/patient/patient-profile-page.tsx` | Integrated with adaptation | `frontend/src/pages/patient/patient-profile-page.tsx`; Preserve current clinical behavior and account identity; add Researcher compatibility and explicit Patient consent without replacing clinical workflows. |
| `frontend/src/pages/research/ai-evaluation-section.tsx` | Integrated with adaptation | `frontend/src/pages/research/ai-evaluation-section.tsx`; Retain workflow and contracts; reject unverifiable execution/results and apply dataset authorization. |
| `frontend/src/pages/research/dataset-detail-page.tsx` | Integrated unchanged | `frontend/src/pages/research/dataset-detail-page.tsx` |
| `frontend/src/pages/research/dataset-request-detail-page.tsx` | Integrated unchanged | `frontend/src/pages/research/dataset-request-detail-page.tsx` |
| `frontend/src/pages/research/dataset-request-form-page.tsx` | Integrated unchanged | `frontend/src/pages/research/dataset-request-form-page.tsx` |
| `frontend/src/pages/research/datasets-page.tsx` | Integrated unchanged | `frontend/src/pages/research/datasets-page.tsx` |
| `frontend/src/pages/research/project-audit-trail-section.tsx` | Integrated unchanged | `frontend/src/pages/research/project-audit-trail-section.tsx` |
| `frontend/src/pages/research/project-collaborators-section.tsx` | Integrated with adaptation | `frontend/src/pages/research/project-collaborators-section.tsx`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `frontend/src/pages/research/project-notepad-section.test.tsx` | Integrated with adaptation | `frontend/src/pages/research/project-notepad-section.test.tsx`; Revision-checked saves, resource authorization, conflict handling, draft preservation and matching API tests; no unsafe edit broadcasts. |
| `frontend/src/pages/research/project-notepad-section.tsx` | Integrated with adaptation | `frontend/src/pages/research/project-notepad-section.tsx`; Revision-checked saves, resource authorization, conflict handling, draft preservation and matching API tests; no unsafe edit broadcasts. |
| `frontend/src/pages/research/research-credentials-page.tsx` | Integrated with adaptation | `frontend/src/pages/research/research-credentials-page.tsx`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `frontend/src/pages/research/research-dashboard-page.tsx` | Integrated with adaptation | `frontend/src/pages/research/research-dashboard-page.tsx`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `frontend/src/pages/research/research-library-page.tsx` | Integrated with adaptation | `frontend/src/pages/research/research-library-page.tsx`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `frontend/src/pages/research/research-project-detail-page.tsx` | Integrated with adaptation | `frontend/src/pages/research/research-project-detail-page.tsx`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `frontend/src/pages/research/research-project-form-page.tsx` | Integrated unchanged | `frontend/src/pages/research/research-project-form-page.tsx` |
| `frontend/src/pages/research/research-projects-page.tsx` | Integrated with adaptation | `frontend/src/pages/research/research-projects-page.tsx`; Retain module; apply centralized authorization, approved privacy policy, honest provenance and compatible contracts/tests. |
| `frontend/vite.config.ts` | Integrated unchanged | `frontend/vite.config.ts` |
| `run-enable-features.bat` | Intentionally excluded | Windows optional-feature elevation scripts are outside authorized application integration; Docker already available. Source retained in audited Git commit. |

Disposition totals: 74 Integrated with adaptation, 161 Integrated unchanged, 3 Intentionally excluded.

## All 58 protected clinical working-tree paths

Each original hash is retained in the private manifest; checkpoint `1edf70a` contains the complete replay before research integration. A final adaptation does not overwrite the protected checkpoint.

| Protected path | Final disposition |
|---|---|
| `ai-service/app/api/internal_analysis.py` | Preserved unchanged (line endings normalized). |
| `ai-service/app/model_runtime.py` | Preserved unchanged (line endings normalized). |
| `ai-service/app/services/report_analysis_service.py` | Preserved unchanged (line endings normalized). |
| `ai-service/tests/test_internal_analysis_api.py` | Preserved unchanged (line endings normalized). |
| `backend/src/main/java/com/clinora/ai/service/PatientReportAiAnalysisService.java` | Preserved unchanged (line endings normalized). |
| `backend/src/main/java/com/clinora/ai/service/PatientReportAiAnalysisWorker.java` | Preserved unchanged (line endings normalized). |
| `backend/src/main/java/com/clinora/patients/service/PatientReportExtractionService.java` | Preserved unchanged (line endings normalized). |
| `backend/src/main/java/com/clinora/patients/service/PatientReportExtractionWorker.java` | Preserved unchanged (line endings normalized). |
| `docker-compose.yml` | Preserved in checkpoint; integrated adaptation/formatting reviewed against that checkpoint. |
| `frontend/src/features/consultations/prescription-document-file.ts` | Preserved unchanged (line endings normalized). |
| `frontend/src/features/doctor/doctor-layout-r3.tsx` | Preserved unchanged (line endings normalized). |
| `frontend/src/features/patient-reports/report-processing-notice.tsx` | Preserved unchanged (line endings normalized). |
| `frontend/src/features/patient/patient-dashboard.tsx` | Preserved unchanged (line endings normalized). |
| `frontend/src/features/patient/patient-home.tsx` | Preserved in checkpoint; integrated adaptation/formatting reviewed against that checkpoint. |
| `frontend/src/features/patient/patient-layout.tsx` | Preserved unchanged (line endings normalized). |
| `frontend/src/pages/doctor/doctor-appointment-page.tsx` | Preserved in checkpoint; formatting-only changes after clinical regression validation. |
| `frontend/src/pages/doctor/doctor-clinical-inbox-page.tsx` | Preserved in checkpoint; formatting-only changes after clinical regression validation. |
| `frontend/src/pages/doctor/doctor-consultation-page.tsx` | Preserved in checkpoint; formatting-only changes after clinical regression validation. |
| `frontend/src/pages/doctor/doctor-consultation-reference-layout.test.tsx` | Preserved in checkpoint; formatting-only changes after clinical regression validation. |
| `frontend/src/pages/doctor/doctor-continuing-care-r2.test.tsx` | Preserved unchanged (line endings normalized). |
| `frontend/src/pages/doctor/doctor-dashboard-r3-page.tsx` | Preserved unchanged (line endings normalized). |
| `frontend/src/pages/doctor/doctor-patient-detail-page.test.tsx` | Preserved unchanged (line endings normalized). |
| `frontend/src/pages/doctor/doctor-patient-detail-page.tsx` | Preserved in checkpoint; formatting-only changes after clinical regression validation. |
| `frontend/src/pages/doctor/doctor-patients-page.tsx` | Preserved unchanged (line endings normalized). |
| `frontend/src/pages/doctor/doctor-report-compare-page.tsx` | Preserved unchanged (line endings normalized). |
| `frontend/src/pages/doctor/doctor-report-review-page.tsx` | Preserved unchanged (line endings normalized). |
| `frontend/src/pages/doctor/doctor-schedule-r3-page.tsx` | Preserved unchanged (line endings normalized). |
| `frontend/src/pages/patient/patient-prescriptions-page.test.tsx` | Preserved unchanged (line endings normalized). |
| `frontend/src/pages/patient/patient-prescriptions-page.tsx` | Preserved unchanged (line endings normalized). |
| `frontend/src/pages/patient/patient-report-ai-insight-page.test.tsx` | Preserved unchanged (line endings normalized). |
| `frontend/src/pages/patient/patient-report-ai-insight-page.tsx` | Preserved unchanged (line endings normalized). |
| `frontend/src/pages/patient/patient-report-analysis-page.test.tsx` | Preserved unchanged (line endings normalized). |
| `frontend/src/pages/patient/patient-report-analysis-page.tsx` | Preserved in checkpoint; formatting-only changes after clinical regression validation. |
| `frontend/src/pages/patient/patient-report-reference-workspaces.css` | Preserved unchanged (line endings normalized). |
| `frontend/src/pages/patient/patient-reports-page.tsx` | Preserved unchanged (line endings normalized). |
| `frontend/src/pages/patient/patient-reports.test.tsx` | Preserved unchanged (line endings normalized). |
| `frontend/src/styles/patient-dashboard.css` | Preserved in checkpoint; formatting-only changes after clinical regression validation. |
| `frontend/vite.config.ts` | Preserved in checkpoint; integrated adaptation/formatting reviewed against that checkpoint. |
| `ocr-service/Dockerfile` | Preserved unchanged (line endings normalized). |
| `ocr-service/app/engine_v3.py` | Preserved unchanged (line endings normalized). |
| `ocr-service/app/main.py` | Preserved unchanged (line endings normalized). |
| `ocr-service/tests/test_engine_v3_quality.py` | Preserved unchanged (line endings normalized). |
| `ai-service/app/services/patient_analysis_metrics.py` | Preserved unchanged (line endings normalized). |
| `ai-service/tests/test_patient_analysis_metrics.py` | Preserved unchanged (line endings normalized). |
| `backend/src/test/java/com/clinora/ai/service/PatientReportAiAnalysisWorkerTest.java` | Preserved unchanged (line endings normalized). |
| `backend/src/test/java/com/clinora/patients/service/PatientReportWorkerTelemetryTest.java` | Preserved unchanged (line endings normalized). |
| `docs/validation/patient-ai-latency-regression-audit.md` | Preserved unchanged (line endings normalized). |
| `docs/validation/patient-ai-single-request-tuning.md` | Preserved unchanged (line endings normalized). |
| `docs/validation/patient-ocr-ai-latency-audit.md` | Preserved unchanged (line endings normalized). |
| `frontend/src/features/consultations/prescription-document-file.test.ts` | Preserved unchanged (line endings normalized). |
| `frontend/src/features/doctor/doctor-navigation.test.ts` | Preserved in checkpoint; formatting-only changes after clinical regression validation. |
| `frontend/src/features/doctor/doctor-navigation.ts` | Preserved in checkpoint; formatting-only changes after clinical regression validation. |
| `ocr-service/app/performance.py` | Preserved unchanged (line endings normalized). |
| `ocr-service/tests/golden_cases.py` | Preserved unchanged (line endings normalized). |
| `ocr-service/tests/test_golden_fields.py` | Preserved unchanged (line endings normalized). |
| `ocr-service/tests/test_performance.py` | Preserved unchanged (line endings normalized). |
| `ocr-service/tests/test_timeout_capacity.py` | Preserved unchanged (line endings normalized). |
| `scripts/start-patient-llama.ps1` | Preserved unchanged (line endings normalized). |
