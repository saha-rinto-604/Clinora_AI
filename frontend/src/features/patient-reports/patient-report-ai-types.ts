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

export type SupportEligibility = 'VERIFIED_ABNORMAL' | 'VERIFIED_QUALITATIVE_POSITIVE'
  | 'VERIFIED_NORMAL' | 'VERIFIED_QUALITATIVE_NEGATIVE' | 'CONTEXT_ONLY' | 'UNKNOWN';

export interface PatientReportAiClusterEvidence {
  supportEligibility?: SupportEligibility | null;
  observationId: string;
  role: 'SUPPORTS' | 'CONTRADICTS' | 'CONTEXT';
  clinicalRelevance: string;
}

export interface PatientReportAiClusterCandidate {
  name: string;
  supportLevel?: PatientReportAiEvidenceSupport;
  rationale: string;
  supportingObservationIds: string[];
  contradictoryObservationIds: string[];
  missingEvidence: string[];
  alternatives: string[];
}

export interface PatientReportAiClinicalCluster {
  displayTitle?: string | null;
  title: string;
  interpretation: string;
  evidence: PatientReportAiClusterEvidence[];
  candidates: PatientReportAiClusterCandidate[];
  missingEvidence: string[];
  alternatives: string[];
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
  /** Absent on saved results produced before the cluster-first contract. */
  clinicalClusters?: PatientReportAiClinicalCluster[] | null;
  overallInterpretation?: string | null;
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
