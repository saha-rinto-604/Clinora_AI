export type PatientReportExtractionStatus = 'NOT_REQUESTED' | 'QUEUED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
export type PatientReportExtractionReviewStatus = 'REVIEW_REQUIRED' | 'READY_FOR_CONFIRMATION' | 'VERIFIED' | null;
export type PatientReportObservationVerification =
  'UNREVIEWED' | 'PATIENT_CONFIRMED' | 'PATIENT_CORRECTED' | 'DOCTOR_VERIFIED';

export interface PatientReportBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PatientReportObservation {
  id: string;
  sourceLabel: string;
  label: string;
  valueType: 'NUMERIC' | 'TEXT' | 'QUALITATIVE';
  numericValue: number | null;
  textValue: string | null;
  comparator: string | null;
  unit: string | null;
  referenceRangeRaw: string | null;
  referenceLow: number | null;
  referenceHigh: number | null;
  sourceFlag: string | null;
  derivedRangeFlag: string | null;
  pageNumber: number;
  boundingBox: PatientReportBoundingBox | null;
  confidence: number | null;
  reviewRequired: boolean;
  verificationStatus: PatientReportObservationVerification;
}

export interface PatientReportExtraction {
  reportId: string;
  jobId: string | null;
  status: PatientReportExtractionStatus;
  resultId: string | null;
  documentType: string | null;
  pageCount: number | null;
  overallConfidence: number | null;
  reviewStatus: PatientReportExtractionReviewStatus;
  observations: PatientReportObservation[];
  failureCode: string | null;
  requestedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface PatientReportObservationCorrectionInput {
  label: string;
  valueType: 'NUMERIC' | 'TEXT' | 'QUALITATIVE';
  numericValue: number | null;
  textValue: string | null;
  comparator: string | null;
  unit: string | null;
  referenceRangeRaw: string | null;
  referenceLow: number | null;
  referenceHigh: number | null;
  sourceFlag: string | null;
}
