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

export interface CitationFormats {
  apa: string;
  ieee: string;
  bibtex: string;
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
