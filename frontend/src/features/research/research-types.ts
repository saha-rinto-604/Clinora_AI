export type ResearchProjectStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'MORE_INFO_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'ARCHIVED'
  | 'WITHDRAWN';

export type DatasetRequestStatus =
  'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'MORE_INFO_REQUIRED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type DatasetFormat = 'CSV' | 'JSON' | 'PARQUET';

export interface ResearchProject {
  id: string;
  ownerUserId: string;
  title: string;
  objective: string;
  description?: string;
  researchField: string;
  methodologySummary?: string;
  institutionName?: string;
  ethicsReference?: string;
  status: ResearchProjectStatus;
  editable: boolean;
  submittable: boolean;
  withdrawable: boolean;
  submittedAt?: string;
  reviewedAt?: string;
  approvedAt?: string;
  completedAt?: string;
  archivedAt?: string;
  reviewedBy?: string;
  reviewDecisionReason?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ProjectPageResponse {
  items: ResearchProject[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface CreateProjectInput {
  title: string;
  objective: string;
  description?: string;
  researchField: string;
  methodologySummary?: string;
  institutionName?: string;
  ethicsReference?: string;
}

export interface UpdateProjectInput {
  title: string;
  objective: string;
  description?: string;
  researchField: string;
  methodologySummary?: string;
  institutionName?: string;
  ethicsReference?: string;
}

export interface DatasetRequest {
  id: string;
  projectId: string;
  name: string;
  purpose: string;
  requestedPopulation: string;
  requestedVariables: string;
  requestedFilters: string;
  requestedFormat: DatasetFormat;
  status: DatasetRequestStatus;
  editable: boolean;
  submittable: boolean;
  cancellable: boolean;
  submittedAt?: string;
  reviewedAt?: string;
  approvedAt?: string;
  expiresAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface DatasetRequestPageResponse {
  items: DatasetRequest[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface CreateDatasetRequestInput {
  name: string;
  purpose: string;
  requestedPopulation?: string;
  requestedVariables?: string;
  requestedFilters?: string;
  requestedFormat: DatasetFormat;
}

export interface UpdateDatasetRequestInput {
  name: string;
  purpose: string;
  requestedPopulation?: string;
  requestedVariables?: string;
  requestedFilters?: string;
  requestedFormat?: DatasetFormat;
}

export interface ProjectReviewRecord {
  id: string;
  projectId: string;
  reviewerUserId: string;
  action: 'REVIEW_STARTED' | 'INFORMATION_REQUESTED' | 'APPROVED' | 'REJECTED';
  comment?: string;
  createdAt: string;
}

export interface AdminProjectQueueItem {
  id: string;
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string;
  title: string;
  researchField: string;
  institutionName?: string;
  status: ResearchProjectStatus;
  submittedAt?: string;
  reviewedAt?: string;
  createdAt: string;
  version: number;
}

export interface AdminProjectDetailResponse {
  project: ResearchProject;
  ownerName: string;
  ownerEmail: string;
  reviewHistory: ProjectReviewRecord[];
}

export interface AdminProjectPageResponse {
  items: AdminProjectQueueItem[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface AdminDatasetRequestQueueItem {
  id: string;
  projectId: string;
  projectTitle: string;
  researcherName: string;
  researcherEmail: string;
  name: string;
  requestedFormat: DatasetFormat;
  status: DatasetRequestStatus;
  submittedAt?: string;
  createdAt: string;
}

export interface AdminDatasetRequestDetailResponse {
  request: DatasetRequest;
  projectTitle: string;
  researcherName: string;
  researcherEmail: string;
}

export interface CatalogVariable {
  code: string;
  displayName: string;
  category: string;
  dataType: string;
  preferredUnit?: string;
  description: string;
  supportedOperators: string[];
}

export interface CatalogCategory {
  category: string;
  variables: CatalogVariable[];
}

export interface CatalogResponse {
  categories: CatalogCategory[];
  totalVariables: number;
}

export interface ObservationCondition {
  variableCode: string;
  operator: string;
  value?: number;
  maxValue?: number;
}

export interface CohortFilterCriteria {
  ageMin?: number;
  ageMax?: number;
  sexes?: string[];
  dateFrom?: string;
  dateTo?: string;
  conditions?: ObservationCondition[];
  requestedVariables: string[];
}

export interface CohortPreviewResponse {
  eligibleRecordCount: number;
  matchingPatientCount: number;
  variables: string[];
  filtersApplied: number;
  queryExecutionMs: number;
  underPrivacyThreshold?: boolean;
  privacyNotice?: string | null;
}

export interface ResearchDataset {
  id: string;
  projectId: string;
  datasetRequestId: string;
  name: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  createdAt: string;
  expiresAt?: string;
  revokedAt?: string;
}

export interface DatasetVersion {
  id: string;
  datasetId: string;
  versionNumber: number;
  schemaVersion: string;
  recordCount: number;
  checksum: string;
  format: string;
  deidentificationProfileVersion: string;
  generatedAt: string;
  immutable: boolean;
}

export interface DatasetGenerationJob {
  id: string;
  datasetRequestId: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  failureReason?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

// ─── Phase R10: Dataset Workspace ────────────────────────────────────────────

/** Extended dataset with optional enrichment fields for the workspace list */
export interface ResearchDatasetDetail extends ResearchDataset {
  projectTitle?: string;
  requestName?: string;
  latestVersion?: DatasetVersion;
}

// ─── Phase R11: Statistical Analytics ────────────────────────────────────────

/** A single histogram bin from real observed data. Never synthesized. */
export interface FrequencyBin {
  label: string;
  lowerBound: number;
  upperBound: number;
  count: number;
}

/** Aggregate observation for one real time period (e.g. 2026-Q1). */
export interface TrendPoint {
  period: string;
  mean: number;
  count: number;
}

/** Per-group (SEX or AGE_BAND) descriptive aggregate for a variable. */
export interface GroupComparisonRow {
  group: string;
  mean: number;
  count: number;
  stdDev: number;
}

/** Descriptive statistics summary for a single variable in a dataset version. */
export interface VariableSummary {
  variableCode: string;
  displayName: string;
  unit?: string;
  count: number;
  missingCount: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  distribution: FrequencyBin[];
}

/** Top-level statistics summary for a dataset version — all variables, aggregate counts. */
export interface DatasetStatsSummary {
  datasetId: string;
  versionNumber: number;
  totalRecords: number;
  uniqueSubjects: number;
  availablePeriods: string[];
  variables: VariableSummary[];
}

// ─── Phase R13: AI Model Evaluation ──────────────────────────────────────────

export type EvaluationRunStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type EvaluationTaskType = 'EXTRACTION' | 'CLASSIFICATION' | 'ABNORMALITY_DETECTION' | 'RISK_SCORING';

export interface ConfusionMatrix {
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
}

export interface EvaluationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  balancedAccuracy: number;
  rocAuc?: number;
  confusionMatrix: ConfusionMatrix;
  falsePositiveRate: number;
  falseNegativeRate: number;
  sampleCount: number;
  exactMatchRate?: number;
  meanAbsoluteError?: number;
  toleranceMatchRate?: number;
}

export interface DatasetVersionOption {
  id: string;
  datasetId: string;
  datasetName: string;
  versionNumber: number;
  recordCount: number;
  format: string;
  checksum: string;
  generatedAt: string;
}

export interface ModelOption {
  id: string;
  name: string;
  version: string;
  promptVersion: string;
  provider: string;
  description: string;
}

export interface TaskTypeOption {
  taskType: EvaluationTaskType;
  label: string;
  description: string;
  primaryMetrics: string[];
}

export interface GroundTruthOption {
  code: string;
  label: string;
  description: string;
}

export interface AIEvaluationOptions {
  datasetVersions: DatasetVersionOption[];
  models: ModelOption[];
  taskTypes: TaskTypeOption[];
  groundTruthDefinitions: GroundTruthOption[];
}

export interface AIEvaluationRun {
  id: string;
  projectId: string;
  datasetVersionId: string;
  modelId: string;
  modelVersion: string;
  promptVersion: string;
  taskType: EvaluationTaskType;
  groundTruthDefinition: string;
  status: EvaluationRunStatus;
  startedAt?: string;
  completedAt?: string;
  configuration: string;
  metrics?: EvaluationMetrics;
  failureReason?: string;
  createdBy: string;
  createdAt: string;
}

export interface CreateEvaluationRunPayload {
  datasetVersionId: string;
  modelId: string;
  modelVersion: string;
  promptVersion: string;
  taskType: EvaluationTaskType;
  groundTruthDefinition: string;
  configuration?: Record<string, unknown>;
}

// ─── Phase R14: Collaboration ────────────────────────────────────────────────

export type ProjectMemberRole = 'OWNER' | 'CO_RESEARCHER' | 'SUPERVISOR' | 'VIEWER';

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED' | 'EXPIRED';

/** Safe professional profile returned by the researcher search endpoint. No login email exposed. */
export interface ResearcherDirectoryEntry {
  userId: string;
  displayName: string;
  initials: string;
}

export interface ResearchProjectMember {
  id: string;
  projectId: string;
  userId: string;
  userDisplayName: string;
  role: ProjectMemberRole;
  addedBy: string;
  joinedAt: string;
  updatedAt: string;
}

/** A collaboration invitation in the system. */
export interface ResearchProjectInvitation {
  id: string;
  projectId: string;
  projectTitle?: string;
  inviteeUserId: string;
  inviteeDisplayName: string;
  invitedBy: string;
  invitedByDisplayName: string;
  proposedRole: ProjectMemberRole;
  status: InvitationStatus;
  message?: string;
  invitedAt: string;
  expiresAt: string;
  respondedAt?: string;
}

export interface SendInvitationPayload {
  inviteeUserId: string;
  proposedRole: ProjectMemberRole;
  message?: string;
}

export interface AddMemberPayload {
  userId: string;
  role: ProjectMemberRole;
}

export interface UpdateMemberRolePayload {
  role: ProjectMemberRole;
}

// ─── Phase R15: Publications ─────────────────────────────────────────────────

export type PublicationType =
  'JOURNAL_ARTICLE' | 'CONFERENCE_PAPER' | 'PREPRINT' | 'BOOK_CHAPTER' | 'REPORT' | 'THESIS';

export type PublicationStatus = 'DRAFT' | 'SUBMITTED' | 'ACCEPTED' | 'PUBLISHED';

export type LibraryVisibility = 'PROJECT_ONLY' | 'CLINORA_RESEARCHERS';

export interface CitationFormats {
  apa: string;
  ieee: string;
  bibtex: string;
}

export interface LibraryDatasetProvenance {
  datasetVersionId: string;
  datasetDisplayName: string;
  versionNumber: number;
  generatedAt: string;
}

export interface LibraryEvaluationProvenance {
  evaluationRunId: string;
  modelName: string;
  modelVersion: string;
  taskType: string;
  status: string;
}

export interface LibraryPublicationSummary {
  id: string;
  title: string;
  authors: string;
  venue: string;
  publicationYear?: number;
  publicationDate?: string;
  publicationType: PublicationType;
  researchField?: string;
  keywords?: string;
  methodologySummary?: string;
  doi?: string;
  publishedUrl?: string;
  projectId: string;
  projectTitle: string;
  datasetProvenance: LibraryDatasetProvenance[];
  evaluationProvenance: LibraryEvaluationProvenance[];
}

export interface LibraryPublicationsPageResponse {
  items: LibraryPublicationSummary[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface LibraryPublicationDetail {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  abstractText?: string;
  methodologySummary?: string;
  studyDesign?: string;
  analysisSummary?: string;
  authors: string;
  publicationType: PublicationType;
  status: PublicationStatus;
  libraryVisibility: LibraryVisibility;
  researchField?: string;
  keywords?: string;
  journal?: string;
  conference?: string;
  venue: string;
  publicationDate?: string;
  publicationYear?: number;
  doi?: string;
  publishedUrl?: string;
  citations: CitationFormats;
  datasetProvenance: LibraryDatasetProvenance[];
  evaluationProvenance: LibraryEvaluationProvenance[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MyResearchOutputSummary {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  publicationType: PublicationType;
  status: PublicationStatus;
  libraryVisibility: LibraryVisibility;
  authors: string;
  venue: string;
  publicationDate?: string;
  updatedAt: string;
  createdAt: string;
}

export interface RegisterResearchOutputPayload {
  projectId: string;
  title: string;
  abstractText?: string;
  publicationType: PublicationType;
  status: PublicationStatus;
  libraryVisibility?: LibraryVisibility;
  methodologySummary: string;
  studyDesign?: string;
  analysisSummary?: string;
  keywords?: string;
  authors: string;
  researchField?: string;
  doi?: string;
  journal?: string;
  conference?: string;
  publicationDate?: string;
  publishedUrl?: string;
  linkedDatasetVersionIds?: string[];
  linkedEvaluationRunIds?: string[];
  citationMetadata?: Record<string, unknown>;
}

export interface UpdateResearchOutputPayload {
  title: string;
  abstractText?: string;
  publicationType: PublicationType;
  status: PublicationStatus;
  libraryVisibility?: LibraryVisibility;
  methodologySummary: string;
  studyDesign?: string;
  analysisSummary?: string;
  keywords?: string;
  authors: string;
  researchField?: string;
  doi?: string;
  journal?: string;
  conference?: string;
  publicationDate?: string;
  publishedUrl?: string;
  linkedDatasetVersionIds?: string[];
  linkedEvaluationRunIds?: string[];
  citationMetadata?: Record<string, unknown>;
}

export interface DatasetVersionSelectOption {
  id: string;
  datasetName: string;
  versionNumber: number;
  generatedAt: string;
}

export interface EvaluationRunSelectOption {
  id: string;
  modelId: string;
  modelVersion: string;
  taskType: string;
}

export interface ProjectSelectOption {
  id: string;
  title: string;
  status: string;
  datasetVersions: DatasetVersionSelectOption[];
  evaluationRuns: EvaluationRunSelectOption[];
}

export interface ResearchPublication {
  id: string;
  projectId: string;
  title: string;
  abstractText?: string;
  publicationType: PublicationType;
  doi?: string;
  journal?: string;
  conference?: string;
  publicationDate?: string;
  externalUrl?: string;
  citationMetadata: string;
  citations: CitationFormats;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePublicationPayload {
  title: string;
  abstractText?: string;
  publicationType: PublicationType;
  doi?: string;
  journal?: string;
  conference?: string;
  publicationDate?: string;
  externalUrl?: string;
  citationMetadata?: Record<string, unknown>;
}

export interface UpdatePublicationPayload {
  title: string;
  abstractText?: string;
  publicationType: PublicationType;
  doi?: string;
  journal?: string;
  conference?: string;
  publicationDate?: string;
  externalUrl?: string;
  citationMetadata?: Record<string, unknown>;
}

// ─── Phase R16: Audit Trail ──────────────────────────────────────────────────

export interface ResearchAuditLogEntry {
  id: string;
  actorUserId?: string;
  action: string;
  outcome: string;
  occurredAt: string;
  metadata?: string;
}

// ─── Workspace: Notes, Comments, Files, Versions, Activity ──────────────────

export type ResearchNoteStatus = 'DRAFT' | 'REVIEWED' | 'ARCHIVED';

export interface ResearchNote {
  id: string;
  projectId: string;
  authorUserId: string;
  authorDisplayName: string;
  authorInitials: string;
  title: string;
  content: string;
  status: ResearchNoteStatus;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  lastEditedBy?: string;
  commentCount: number;
}

export interface CreateNotePayload {
  title: string;
  content: string;
  pinned?: boolean;
}

export interface UpdateNotePayload {
  title?: string;
  content?: string;
  status?: ResearchNoteStatus;
  pinned?: boolean;
}

export interface ResearchNoteComment {
  id: string;
  noteId: string;
  authorUserId: string;
  authorDisplayName: string;
  authorInitials: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchProjectFile {
  id: string;
  projectId: string;
  displayName: string;
  contentType: string;
  uploadedByUserId: string;
  uploaderDisplayName: string;
  currentVersionNumber: number;
  currentSizeBytes: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface ResearchProjectFileVersion {
  id: string;
  projectFileId: string;
  versionNumber: number;
  checksum: string;
  sizeBytes: number;
  uploadedByUserId: string;
  uploaderDisplayName: string;
  uploadedAt: string;
}

export interface ProjectActivityItem {
  id: string;
  actorUserId?: string;
  actorDisplayName: string;
  actorInitials: string;
  action: string;
  description: string;
  timestamp: string;
}

// ─── Research Notepad Collaborative Documents ──────────────────────────────

export type ResearchDocumentType = 'PAPER_DRAFT' | 'METHODOLOGY' | 'ANALYSIS_NOTES' | 'GENERAL';

export interface DocumentContributor {
  userId: string;
  name: string;
  email: string;
  profileImageUrl?: string;
}

export interface ResearchDocumentSummary {
  id: string;
  projectId: string;
  title: string;
  documentType: ResearchDocumentType;
  createdByUserId: string;
  createdByName: string;
  createdByProfileImageUrl?: string;
  lastEditedByUserId: string;
  lastEditedByName: string;
  lastEditedByProfileImageUrl?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  archived: boolean;
  contributors: DocumentContributor[];
  revisionCount: number;
}

export interface ResearchDocumentDetail extends ResearchDocumentSummary {
  contentJson: string;
  crdtStateBase64?: string;
  currentRevisionNumber: number;
}

export interface ResearchDocumentRevision {
  id: string;
  documentId: string;
  revisionNumber: number;
  editedByUserId: string;
  editorName: string;
  editorProfileImageUrl?: string;
  title: string;
  contentJson: string;
  changeSummary?: string;
  createdAt: string;
}

export interface ResearchDocumentComment {
  id: string;
  documentId: string;
  authorUserId: string;
  authorName: string;
  authorProfileImageUrl?: string;
  content: string;
  selectedText?: string;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentPayload {
  title: string;
  documentType: ResearchDocumentType;
  contentJson?: string;
  crdtStateBase64?: string;
}

export interface UpdateDocumentPayload {
  title?: string;
  documentType?: ResearchDocumentType;
  contentJson?: string;
  crdtUpdateBase64?: string;
  changeSummary?: string;
  expectedRevisionNumber: number;
}

export interface RenameDocumentPayload {
  title: string;
}

export interface AddDocumentCommentPayload {
  content: string;
  selectedText?: string;
}

export interface SafeDatasetReference {
  id: string;
  name: string;
  description: string;
  version: string;
  cohortSize: string;
}

export interface SafeAIEvaluationReference {
  id: string;
  modelName: string;
  taskType: string;
  status: string;
  accuracy?: number;
  precisionScore?: number;
  recall?: number;
  f1Score?: number;
}
