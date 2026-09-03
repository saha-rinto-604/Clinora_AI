export type PatientReportAiJobStatus = 'NOT_READY' | 'NOT_REQUESTED' | 'QUEUED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
export type PatientReportAiAnalysisStatus =
  'POSSIBLE_CLINICAL_PATTERN' | 'NO_CLEAR_ABNORMAL_PATTERN' | 'INSUFFICIENT_EVIDENCE';
export type PatientReportAiEvidenceSupport = 'LIMITED' | 'MODERATE' | 'STRONG';

export interface PatientReportAiFinding {
  observationId: string;
  title: string;
  interpretation: string;
}

export interface PatientReportAiClinicalPattern {
  name: string;
  supportLevel: PatientReportAiEvidenceSupport;
  reasoning: string;
  supportingObservationIds: string[];
  contradictoryObservationIds: string[];
  missingEvidence: string[];
  possibleCauses: string[];
}

export interface PatientReportAiDiscussionPoint {
  type: 'POSSIBLE_TEST' | 'CLINICAL_QUESTION' | 'FOLLOW_UP';
  title: string;
  reason: string;
}

export interface PatientReportAiResult {
  analysisStatus: PatientReportAiAnalysisStatus;
  summary: string;
  notableFindings: PatientReportAiFinding[];
  clinicalPatterns: PatientReportAiClinicalPattern[];
  discussionPoints: PatientReportAiDiscussionPoint[];
  patientExplanation: string;
  limitations: string[];
  modelName: string;
  modelRevision: string;
  promptVersion: string;
  schemaVersion: string;
}

export interface PatientReportAiAnalysis {
  reportId: string;
  readyForAnalysis: boolean;
  readinessCode: string | null;
  jobId: string | null;
  status: PatientReportAiJobStatus;
  analysisId: string | null;
  analysisStatus: PatientReportAiAnalysisStatus | null;
  stale: boolean;
  result: PatientReportAiResult | null;
  failureCode: string | null;
  modelName: string | null;
  modelRevision: string | null;
  promptVersion: string | null;
  schemaVersion: string | null;
  requestedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
}
