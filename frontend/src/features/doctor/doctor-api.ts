import { apiClient, apiErrorMessage } from '../auth/auth-api';
import type { ApiEnvelope } from '../auth/auth-types';

export type AppointmentScope = 'today' | 'upcoming' | 'history';

export interface DoctorIdentity {
  id: string;
  displayName: string;
  professionalTitle: string | null;
  specialization: string | null;
  currentOrganization: string | null;
  currentPosition: string | null;
}

export interface DoctorAppointmentSummary {
  id: string;
  patientId: string;
  patientName: string;
  scheduledStart: string;
  scheduledEnd: string;
  timezone: string;
  status: 'BOOKED' | 'CANCELLED' | 'COMPLETED';
  reason: string | null;
  sharedReportCount: number;
}

export interface DoctorMissingSetupItem {
  key: string;
  label: string;
  destination: string;
}

export interface DoctorDashboard {
  doctor: DoctorIdentity;
  profileCompletion: number;
  profileCompletedItems?: number;
  profileTotalItems?: number;
  profileMissingItems?: DoctorMissingSetupItem[];
  todayCount: number;
  upcomingCount: number;
  sharedReportsForUpcomingCare: number;
  availableSlotCount: number;
  nextAvailableAt: string | null;
  nextAppointment: DoctorAppointmentSummary | null;
  today: DoctorAppointmentSummary[];
}

export interface DoctorAppointmentPage {
  items: DoctorAppointmentSummary[];
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface DoctorPatientContext {
  id: string;
  displayName: string;
  dateOfBirth: string | null;
  gender: string | null;
  bloodGroup: string | null;
  allergies: string[];
  chronicConditions: string[];
  currentMedications: string[];
}

export interface DoctorSharedReport {
  reportId: string;
  displayName: string;
  reportType: string | null;
  reportDate: string | null;
  providerLaboratory: string | null;
  mimeType: string | null;
  sharedAt: string;
}

export interface DoctorAppointmentDetail {
  id: string;
  status: 'BOOKED' | 'CANCELLED' | 'COMPLETED';
  reason: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  timezone: string;
  canModify: boolean;
  reportAccessActive: boolean;
  patient: DoctorPatientContext;
  sharedReports: DoctorSharedReport[];
}

export type ObservationResultStatus = 'OUTSIDE_RANGE' | 'WITHIN_RANGE' | 'NOT_CLASSIFIED';
export type DoctorObservationDecision = 'CONFIRMED' | 'DISAGREES' | 'NEEDS_SOURCE_REVIEW';

export interface DoctorReportObservation {
  id: string;
  label: string;
  valueType: string;
  displayValue: string;
  comparator: string | null;
  unit: string | null;
  referenceRange: string | null;
  sourceFlag: string | null;
  derivedRangeFlag: string | null;
  pageNumber: number | null;
  patientVerification: string | null;
  doctorDecision: DoctorObservationDecision | null;
  doctorComment: string | null;
  resultStatus: ObservationResultStatus;
}

export interface DoctorReportReview {
  appointmentId: string;
  reportId: string;
  displayName: string;
  reportType: string | null;
  reportDate: string | null;
  providerLaboratory: string | null;
  mimeType: string | null;
  extractionReviewStatus: 'VERIFIED' | 'NOT_VERIFIED' | 'NOT_AVAILABLE';
  sharedAt: string;
  observations: DoctorReportObservation[];
}

export interface DoctorReportComparison {
  left: DoctorReportReview;
  right: DoctorReportReview;
}

export const doctorApi = {
  async dashboard() {
    const response = await apiClient.get<ApiEnvelope<DoctorDashboard>>('/doctor/dashboard');
    return response.data.data;
  },

  async appointments(scope: AppointmentScope, limit = 20, offset = 0) {
    const response = await apiClient.get<ApiEnvelope<DoctorAppointmentPage>>('/doctor/appointments', {
      params: { scope, limit, offset },
    });
    return response.data.data;
  },

  async appointment(appointmentId: string) {
    const response = await apiClient.get<ApiEnvelope<DoctorAppointmentDetail>>(
      `/doctor/appointments/${encodeURIComponent(appointmentId)}`,
    );
    return response.data.data;
  },

  async cancelAppointment(appointmentId: string, reason?: string) {
    const response = await apiClient.post<ApiEnvelope<DoctorAppointmentDetail>>(
      `/doctor/appointments/${encodeURIComponent(appointmentId)}/cancel`,
      { reason: reason?.trim() || null },
    );
    return response.data.data;
  },

  async rescheduleAppointment(appointmentId: string, slotId: string, timezone: string) {
    const response = await apiClient.post<ApiEnvelope<DoctorAppointmentDetail>>(
      `/doctor/appointments/${encodeURIComponent(appointmentId)}/reschedule`,
      { slotId, timezone },
    );
    return response.data.data;
  },

  async reportReview(appointmentId: string, reportId: string) {
    const response = await apiClient.get<ApiEnvelope<DoctorReportReview>>(
      `/doctor/appointments/${encodeURIComponent(appointmentId)}/reports/${encodeURIComponent(reportId)}/review`,
    );
    return response.data.data;
  },

  async compareReports(appointmentId: string, leftReportId: string, rightReportId: string) {
    const response = await apiClient.get<ApiEnvelope<DoctorReportComparison>>(
      `/doctor/appointments/${encodeURIComponent(appointmentId)}/reports/compare`,
      { params: { leftReportId, rightReportId } },
    );
    return response.data.data;
  },

  async reviewObservation(
    appointmentId: string,
    reportId: string,
    observationId: string,
    decision: DoctorObservationDecision,
    comment?: string,
  ) {
    const response = await apiClient.put<
      ApiEnvelope<{
        observationId: string;
        decision: DoctorObservationDecision;
        comment: string | null;
        reviewedAt: string;
      }>
    >(
      `/doctor/appointments/${encodeURIComponent(appointmentId)}/reports/${encodeURIComponent(reportId)}/review/observations/${encodeURIComponent(observationId)}`,
      { decision, comment: comment?.trim() || null },
    );
    return response.data.data;
  },

  async reportContent(appointmentId: string, reportId: string) {
    const response = await apiClient.get<Blob>(
      `/doctor/appointments/${encodeURIComponent(appointmentId)}/reports/${encodeURIComponent(reportId)}/content`,
      { responseType: 'blob' },
    );
    const contentType = response.headers['content-type'];
    return {
      blob: response.data,
      contentType: typeof contentType === 'string' ? contentType : 'application/octet-stream',
    };
  },

  async downloadReport(appointmentId: string, reportId: string) {
    const response = await apiClient.get<Blob>(
      `/doctor/appointments/${encodeURIComponent(appointmentId)}/reports/${encodeURIComponent(reportId)}/download`,
      { responseType: 'blob' },
    );
    return response.data;
  },
};

export function doctorError(error: unknown, fallback: string) {
  return apiErrorMessage(error, fallback);
}
