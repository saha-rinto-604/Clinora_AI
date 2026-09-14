import { apiClient, apiErrorMessage } from '../auth/auth-api';
import type { ApiEnvelope } from '../auth/auth-types';

export type HealthRangeStatus = 'LOW' | 'IN_RANGE' | 'HIGH' | 'REPORTED';
export type HealthTrendDirection =
  'INCREASING' | 'DECREASING' | 'STABLE' | 'MIXED' | 'INSUFFICIENT_DATA' | 'NOT_COMPARABLE';

export interface LongitudinalHealthSnapshot {
  reportsIncluded: number;
  reliablyDatedReports: number;
  dateUncertainReports: number;
  trackedMeasurements: number;
  healthAreas: number;
  coverageFrom: string | null;
  coverageTo: string | null;
}

export interface LongitudinalObservation {
  observationId: string;
  sourceType: 'MEDICAL_REPORT' | 'PATIENT_PROFILE';
  sourceId: string;
  reportId: string | null;
  reportName: string;
  reportType: string;
  providerLaboratory: string | null;
  date: string | null;
  displayDate: string;
  dateReliable: boolean;
  dateBasis: 'REPORT_DATE' | 'UPLOAD_FALLBACK' | 'PROFILE_RECORDED_AT';
  sourceLabel: string | null;
  valueType: string;
  numericValue: number | null;
  textValue: string | null;
  comparator: string | null;
  unit: string | null;
  normalizedValue: number | null;
  normalizedUnit: string | null;
  comparisonKey: string | null;
  referenceRangeRaw: string | null;
  referenceLow: number | null;
  referenceHigh: number | null;
  status: HealthRangeStatus;
  verificationStatus: string;
  unitConvertedForTrend: boolean;
  updatedAt: string;
}

export interface HealthGraphPoint {
  date: string;
  value: number;
  unit: string | null;
  sourceType: 'MEDICAL_REPORT' | 'PATIENT_PROFILE';
  sourceId: string;
  reportId: string | null;
  reportName: string;
  status: HealthRangeStatus;
  referenceRangeRaw: string | null;
}

export interface HealthMeasurement {
  code: string;
  name: string;
  category: string;
  latest: LongitudinalObservation;
  trend: {
    direction: HealthTrendDirection;
    absoluteChange: number | null;
    percentageChange: number | null;
    comparableDataPoints: number;
    trendQualified: boolean;
    chartUnit: string | null;
  };
  graph: {
    available: boolean;
    fullGraphAvailable: boolean;
    normalizedUnits: boolean;
    reason: string | null;
    points: HealthGraphPoint[];
  };
  historyCount: number;
}

export interface HealthArea {
  code: string;
  title: string;
  measurements: HealthMeasurement[];
}

export interface HealthRecordHighlight {
  type: string;
  measurementCode: string;
  title: string;
  status: HealthRangeStatus;
  detail: string;
}

export interface HealthSourceReport {
  reportId: string;
  reportName: string;
  reportType: string;
  clinicalDate: string | null;
  displayDate: string;
  dateBasis: 'REPORT_DATE' | 'UPLOAD_FALLBACK';
  providerLaboratory: string | null;
}

export interface LongitudinalHealthRecord {
  snapshot: LongitudinalHealthSnapshot;
  areas: HealthArea[];
  highlights: HealthRecordHighlight[];
  sourceReports: HealthSourceReport[];
  lastUpdatedAt: string | null;
}

export type HealthSummaryPeriodPreset = 'LAST_3_MONTHS' | 'LAST_6_MONTHS' | 'LAST_12_MONTHS' | 'ALL_HISTORY' | 'CUSTOM';

export interface HealthSummaryRequest {
  period: HealthSummaryPeriodPreset;
  from?: string;
  to?: string;
  forceRefresh?: boolean;
}

export type GeminiProviderReason =
  | 'NOT_CONFIGURED'
  | 'AUTH_FAILED'
  | 'PERMISSION_DENIED'
  | 'MODEL_NOT_AVAILABLE'
  | 'RATE_LIMITED'
  | 'REQUEST_REJECTED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'INVALID_RESPONSE'
  | 'EMPTY_RESPONSE'
  | 'SAFETY_BLOCKED'
  | 'INSUFFICIENT_DATA'
  | null;

export interface PersonalHealthSummary {
  period: {
    preset: HealthSummaryPeriodPreset;
    label: string;
    from: string | null;
    to: string | null;
  };
  snapshot: {
    verifiedReportsAvailable: number;
    reliablyDatedReports: number;
    dateUncertainVerifiedReports: number;
    trackedVerifiedMeasurements: number;
    healthAreasRepresented: number;
    measurementsWithComparableHistory: number;
    observationsExcludedByValidation: number;
    measurementsWithIncompatibleHistory: number;
    coverageFrom: string | null;
    coverageTo: string | null;
  };
  healthPicture: string;
  keyThemes: SummaryTheme[];
  changes: SummaryChange[];
  stableContext: SummaryBriefingItem[];
  followUpItems: SummaryBriefingItem[];
  visitQuestions: SummaryBriefingItem[];
  limitations: SummaryLimitation[];
  evidence: SummaryEvidence[];
  aiSummary: {
    status:
      | 'AVAILABLE'
      | 'NOT_CONFIGURED'
      | 'AUTH_FAILED'
      | 'PERMISSION_DENIED'
      | 'MODEL_NOT_AVAILABLE'
      | 'RATE_LIMITED'
      | 'REQUEST_REJECTED'
      | 'NETWORK_ERROR'
      | 'TIMEOUT'
      | 'INVALID_RESPONSE'
      | 'EMPTY_RESPONSE'
      | 'SAFETY_BLOCKED'
      | 'INSUFFICIENT_DATA';
    overallHealthView: string | null;
    keyThemes: Array<{ themeId: string; description: string; evidenceIds: string[] }>;
    stableContext: Array<{ itemId: string; text: string; evidenceIds: string[] }>;
    followUpItems: Array<{ itemId: string; text: string; evidenceIds: string[] }>;
    visitQuestions: Array<{ itemId: string; text: string; evidenceIds: string[] }>;
    limitations: string[];
    reason: GeminiProviderReason;
    cached: boolean;
  };
  disclaimer: string;
  generatedAt: string;
}

export interface SummaryTheme {
  id: string;
  title: string;
  description: string;
  evidenceIds: string[];
}

export interface SummaryChange {
  id: string;
  title: string;
  description: string;
  fromValue: string;
  toValue: string;
  fromDate: string;
  toDate: string;
  direction: HealthTrendDirection;
  trendQualified: boolean;
  evidenceIds: string[];
}

export interface SummaryBriefingItem {
  id: string;
  text: string;
  evidenceIds: string[];
}

export interface SummaryLimitation {
  title: string;
  description: string;
}

export interface SummaryEvidence {
  evidenceId: string;
  measurementCode: string;
  measurementName: string;
  healthAreaCode: string;
  healthAreaTitle: string;
  displayValue: string;
  unit: string | null;
  suppliedRange: string | null;
  status: HealthRangeStatus;
  clinicalDate: string | null;
  displayDate: string | null;
  dateReliable: boolean;
  chronologyEligible: boolean;
  dateBasis: string;
  sourceReportId: string | null;
  sourceReportName: string;
  verificationStatus: string;
  sourceType: 'MEDICAL_REPORT' | 'PATIENT_PROFILE';
}

export interface HealthSummaryProviderStatus {
  status: 'CONFIGURED' | 'NOT_CONFIGURED';
  model: string;
  configured: boolean;
}

export const longitudinalHealthApi = {
  async load() {
    const response = await apiClient.get<ApiEnvelope<LongitudinalHealthRecord>>('/patient/health-record/labs');
    return response.data.data;
  },

  async generateSummary(input: HealthSummaryRequest) {
    const response = await apiClient.post<ApiEnvelope<PersonalHealthSummary>>('/patient/health-record/summary', input);
    return response.data.data;
  },

  async providerStatus() {
    const response = await apiClient.get<ApiEnvelope<HealthSummaryProviderStatus>>(
      '/patient/health-record/summary/provider',
    );
    return response.data.data;
  },

  async downloadSummaryPdf(input: HealthSummaryRequest) {
    const response = await apiClient.post<Blob>('/patient/health-record/summary/pdf', input, { responseType: 'blob' });
    return response.data;
  },
};

export function longitudinalHealthError(error: unknown, fallback: string) {
  return apiErrorMessage(error, fallback);
}
