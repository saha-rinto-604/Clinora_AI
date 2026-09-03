import { apiClient, apiErrorMessage } from '../auth/auth-api';
import type { ApiEnvelope } from '../auth/auth-types';
import type { PatientReportAiAnalysis } from './patient-report-ai-types';

export const patientReportAiApi = {
  async get(reportId: string) {
    const response = await apiClient.get<ApiEnvelope<PatientReportAiAnalysis>>(
      `/patient/reports/${reportId}/ai-analysis`,
    );
    return response.data.data;
  },
  async request(reportId: string) {
    const response = await apiClient.post<ApiEnvelope<PatientReportAiAnalysis>>(
      `/patient/reports/${reportId}/ai-analysis`,
    );
    return response.data.data;
  },
};

export function patientReportAiErrorMessage(error: unknown, fallback: string) {
  return apiErrorMessage(error, fallback);
}
