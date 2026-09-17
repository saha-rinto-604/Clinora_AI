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
};
