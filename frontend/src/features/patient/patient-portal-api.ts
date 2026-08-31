import { apiClient, apiErrorMessage } from '../auth/auth-api';
import type { ApiEnvelope } from '../auth/auth-types';
import type { Appointment } from '../appointments/appointment-api';
import type { TimelineEvent } from '../patient-record/patient-record-api';

export interface PatientPortalSummary {
  care: {
    nextAppointment: Appointment | null;
    activeReportShareCount: number;
    doctorCount: number;
  };
  recentHealthActivity: TimelineEvent[];
  unreadNotifications: number;
}

export const patientPortalApi = {
  async summary() {
    const response = await apiClient.get<ApiEnvelope<PatientPortalSummary>>('/patient/portal-summary');
    return response.data.data;
  },
};

export function patientPortalError(error: unknown, fallback: string) {
  return apiErrorMessage(error, fallback);
}
