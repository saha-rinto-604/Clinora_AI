import { apiClient, apiErrorMessage } from '../auth/auth-api';
import type { ApiEnvelope } from '../auth/auth-types';
import type {
  PatientReportExtraction,
  PatientReportObservationCorrectionInput,
} from './patient-report-extraction-types';

export const patientReportExtractionApi = {
  async get(reportId: string) {
    const response = await apiClient.get<ApiEnvelope<PatientReportExtraction>>(
      `/patient/reports/${reportId}/extraction`,
    );
    return response.data.data;
  },

  async start(reportId: string) {
    const response = await apiClient.post<ApiEnvelope<PatientReportExtraction>>(
      `/patient/reports/${reportId}/extraction`,
    );
    return response.data.data;
  },

  async correct(reportId: string, observationId: string, input: PatientReportObservationCorrectionInput) {
    const response = await apiClient.patch<ApiEnvelope<PatientReportExtraction>>(
      `/patient/reports/${reportId}/extraction/observations/${observationId}`,
      input,
    );
    return response.data.data;
  },

  async confirmObservation(reportId: string, observationId: string) {
    const response = await apiClient.post<ApiEnvelope<PatientReportExtraction>>(
      `/patient/reports/${reportId}/extraction/observations/${observationId}/confirm`,
    );
    return response.data.data;
  },

  async confirm(reportId: string) {
    const response = await apiClient.post<ApiEnvelope<PatientReportExtraction>>(
      `/patient/reports/${reportId}/extraction/confirm`,
    );
    return response.data.data;
  },
};

export function patientReportExtractionErrorMessage(error: unknown, fallback: string) {
  return apiErrorMessage(error, fallback);
}
