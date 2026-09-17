import { apiClient } from '../auth/auth-api';
import type { ApiEnvelope } from '../auth/auth-types';

export const doctorSupportTaskIds = [
  'BRIEF_PATIENT',
  'CONNECT_EVIDENCE',
  'COMPARE_EVIDENCE',
  'CROSS_CHECK_ASSESSMENT',
  'FIND_GAPS',
  'EXPLORE_EXPLANATIONS',
  'STRUCTURE_NOTES',
  'FOCUSED_EVIDENCE_QUESTION',
] as const;

export type DoctorSupportTaskId = (typeof doctorSupportTaskIds)[number];
export type DoctorSupportRoutingStatus = 'ROUTED' | 'CLARIFICATION_REQUIRED' | 'UNSUPPORTED';
export type DoctorSupportClarificationReason = 'AMBIGUOUS_INTENT' | 'MISSING_REQUIRED_CONTEXT';
export type DoctorSupportRequiredContext =
  'APPOINTMENT' | 'AUTHORIZED_EVIDENCE' | 'COMPARABLE_REPORTS' | 'DOCTOR_ASSESSMENT' | 'DOCTOR_NOTES';
export type DoctorSupportScreen = 'DOCTOR_HOME' | 'APPOINTMENT' | 'REPORT_REVIEW' | 'REPORT_COMPARE' | 'UNKNOWN';
export type DoctorSupportSelectionType = 'NONE' | 'REPORT' | 'REPORTS' | 'OBSERVATIONS' | 'MIXED';

export interface DoctorSupportRoutingRequest {
  message: string;
  explicitTaskId?: DoctorSupportTaskId | null;
  currentScreen: DoctorSupportScreen;
  currentReportId?: string | null;
  selectedReportIds?: string[];
  selectedObservationIds?: string[];
  doctorAssessmentPresent?: boolean;
  doctorNotesPresent?: boolean;
}

export interface DoctorSupportReferencedContext {
  currentScreen: DoctorSupportScreen;
  currentReportType: string | null;
  authorizedReportCount: number;
  authorizedObservationCount: number;
  doctorAssessmentPresent: boolean;
  doctorNotesPresent: boolean;
  comparableAuthorizedReportsAvailable: boolean;
  selectionType: DoctorSupportSelectionType;
}

export interface DoctorSupportClarificationOption {
  taskId: DoctorSupportTaskId;
  label: string;
  shortDescription: string;
}

export interface DoctorSupportRoutingDecision {
  status: DoctorSupportRoutingStatus;
  taskIds: DoctorSupportTaskId[];
  referencedContext: DoctorSupportReferencedContext;
  clarificationOptions: DoctorSupportClarificationOption[];
  clarificationReason: DoctorSupportClarificationReason | null;
  missingRequiredContext: DoctorSupportRequiredContext[];
}

export type DoctorSupportExecutionStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'PARTIAL_SUCCESS' | 'FAILED_SAFE';
export type DoctorSupportTaskExecutionStatus = 'SUCCEEDED' | 'FAILED_SAFE' | 'EVIDENCE_SELECTION_REQUIRED';
export type ExecutableDoctorSupportTaskId =
  'CONNECT_EVIDENCE' | 'COMPARE_EVIDENCE' | 'CROSS_CHECK_ASSESSMENT' | 'FIND_GAPS';

export interface DoctorSupportExecutionRequest {
  taskIds: ExecutableDoctorSupportTaskId[];
  originalQuestion: string;
  currentReportId?: string | null;
  selectedReportIds?: string[];
  selectedObservationIds?: string[];
  doctorAssessment?: string | null;
  clientExecutionKey?: string | null;
}

export interface DoctorSupportEvidenceReference {
  observationId: string;
  label: string;
}

export interface ConnectEvidenceResult {
  taskId: 'CONNECT_EVIDENCE';
  summary: string;
  patterns: Array<{
    title: string;
    relationship: string;
    evidence: DoctorSupportEvidenceReference[];
    limitations: string[];
    referenceChunkIds: string[];
  }>;
  limitations: string[];
  summaryReferenceChunkIds: string[];
}

export interface CompareEvidenceResult {
  taskId: 'COMPARE_EVIDENCE';
  summary: string;
  comparisons: Array<{
    canonicalCode: string;
    direction: 'INCREASED' | 'DECREASED' | 'UNCHANGED';
    explanation: string;
    evidence: DoctorSupportEvidenceReference[];
  }>;
  nonComparable: string[];
  limitations: string[];
}

export interface CrossCheckAssessmentResult {
  taskId: 'CROSS_CHECK_ASSESSMENT';
  evidenceFit:
    | 'CONSISTENT_WITH_AVAILABLE_EVIDENCE'
    | 'MIXED_OR_LIMITED_EVIDENCE'
    | 'NOT_SUPPORTED_BY_AVAILABLE_EVIDENCE'
    | 'INSUFFICIENT_EVIDENCE';
  summary: string;
  points: Array<{
    statement: string;
    relation: 'SUPPORTS' | 'CONTRADICTS' | 'UNCERTAIN';
    evidence: DoctorSupportEvidenceReference[];
    referenceChunkIds: string[];
  }>;
  alternativeConsiderations: Array<{
    name: string;
    rationale: string;
    evidence: DoctorSupportEvidenceReference[];
    missingInformation: string[];
    referenceChunkIds: string[];
  }>;
  limitations: string[];
  summaryReferenceChunkIds: string[];
}

export interface FindGapsResult {
  taskId: 'FIND_GAPS';
  summary: string;
  gaps: Array<{
    category: string;
    whyRelevant: string;
    availability: 'NOT_PRESENT_IN_AUTHORIZED_EVIDENCE' | 'UNCERTAIN';
    relatedEvidence: DoctorSupportEvidenceReference[];
    referenceChunkIds: string[];
  }>;
  limitations: string[];
  summaryReferenceChunkIds: string[];
}

export type DoctorSupportClinicalResult =
  ConnectEvidenceResult | CompareEvidenceResult | CrossCheckAssessmentResult | FindGapsResult;

export interface DoctorSupportProvenance {
  reportIds: string[];
  observationIds: string[];
  evidenceSnapshotHash: string;
  modelName: string | null;
  modelRevision: string | null;
  quantization: string | null;
  promptVersion: string;
  schemaVersion: string;
  groundingStatus: 'PASSED' | 'REJECTED' | 'NOT_RUN';
  ragUsed: boolean;
  ragPolicy: 'DISABLED' | 'OPTIONAL' | 'REQUIRED_WHEN_AVAILABLE';
  retrievalStatus:
    'NOT_REQUIRED' | 'USED' | 'NO_RELEVANT_REFERENCE' | 'KNOWLEDGE_UNAVAILABLE' | 'RETRIEVAL_FAILED_SAFE';
  knowledgeIndexVersion: string | null;
  retrievedChunkIds: string[];
  citedChunkIds: string[];
  retrievalDurationMs: number;
}

export interface DoctorSupportClinicalReference {
  chunkId: string;
  sourceId: string;
  documentId: string;
  title: string;
  publisher: string;
  sourceType: string;
  clinicalDomain: string;
  publicationDate: string | null;
  version: string | null;
  jurisdiction: string | null;
  sourceReference: string | null;
  sectionPath: string;
}

export interface DoctorSupportTaskResult {
  taskId: ExecutableDoctorSupportTaskId;
  status: DoctorSupportTaskExecutionStatus;
  result: DoctorSupportClinicalResult | null;
  safeFailureCode: string | null;
  provenance: DoctorSupportProvenance;
  references: DoctorSupportClinicalReference[];
}

export interface DoctorSupportExecutionResponse {
  executionId: string;
  doctorId: string;
  appointmentId: string;
  status: DoctorSupportExecutionStatus;
  evidenceSnapshotHash: string;
  reports: Array<{
    reportId: string;
    reportType: string;
    clinicalDate: string | null;
    dateReliability: 'REPORT_DATE' | 'DATE_UNAVAILABLE';
    extractionResultId: string;
    sourceChecksum: string;
    reportVersion: number;
  }>;
  evidence: Array<{
    observationId: string;
    reportId: string;
    label: string;
    canonicalCode: string;
    valueType: string;
    numericValue: number | null;
    textValue: string | null;
    comparator: string | null;
    unit: string | null;
    referenceLow: number | null;
    referenceHigh: number | null;
    referenceRangeRaw: string | null;
    authoritativeStatus: 'LOW' | 'HIGH' | 'IN_RANGE' | 'POSITIVE' | 'NEGATIVE' | 'REPORTED';
    verificationStatus: 'PATIENT_CONFIRMED' | 'PATIENT_CORRECTED' | 'DOCTOR_VERIFIED';
  }>;
  taskResults: DoctorSupportTaskResult[];
  selectionCandidates: Array<{ reportId: string; reportType: string; clinicalDate: string }>;
  startedAt: string;
  completedAt: string;
}

export type DoctorSupportExecutionClientState =
  | { phase: 'IDLE'; executionId: null; response: null }
  | { phase: 'SUBMITTING'; executionId: null; response: null }
  | { phase: 'QUEUED' | 'RUNNING'; executionId: string; response: DoctorSupportExecutionResponse | null }
  | { phase: 'COMPLETE'; executionId: string; response: DoctorSupportExecutionResponse }
  | {
      phase: 'FAILED';
      executionId: string | null;
      response: DoctorSupportExecutionResponse | null;
      safeMessage: string;
    };

export const doctorClinicalSupportApi = {
  async route(appointmentId: string, request: DoctorSupportRoutingRequest) {
    const response = await apiClient.post<ApiEnvelope<DoctorSupportRoutingDecision>>(
      `/doctor/appointments/${encodeURIComponent(appointmentId)}/clinical-support/route`,
      {
        ...request,
        explicitTaskId: request.explicitTaskId ?? null,
        currentReportId: request.currentReportId ?? null,
        selectedReportIds: request.selectedReportIds ?? [],
        selectedObservationIds: request.selectedObservationIds ?? [],
        doctorAssessmentPresent: request.doctorAssessmentPresent ?? false,
        doctorNotesPresent: request.doctorNotesPresent ?? false,
      },
    );
    return response.data.data;
  },
  async execute(appointmentId: string, request: DoctorSupportExecutionRequest) {
    const response = await apiClient.post<ApiEnvelope<DoctorSupportExecutionResponse>>(
      `/doctor/appointments/${encodeURIComponent(appointmentId)}/clinical-support/execute`,
      {
        ...request,
        currentReportId: request.currentReportId ?? null,
        selectedReportIds: request.selectedReportIds ?? [],
        selectedObservationIds: request.selectedObservationIds ?? [],
        doctorAssessment: request.doctorAssessment ?? null,
        clientExecutionKey: request.clientExecutionKey ?? null,
      },
    );
    return response.data.data;
  },
};
