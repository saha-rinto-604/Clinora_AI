import { apiClient, apiErrorMessage } from '../auth/auth-api';
import type { ApiEnvelope } from '../auth/auth-types';
import type {
  PatientReport,
  PatientReportListQuery,
  PatientReportMetadataInput,
  PatientReportPage,
  PatientReportUploadInput,
} from './patient-report-types';

export const patientReportApi = {
  async list(query: PatientReportListQuery) {
    const response = await apiClient.get<ApiEnvelope<PatientReportPage>>('/patient/reports', {
      params: query,
    });
    return response.data.data;
  },

  async detail(reportId: string) {
    const response = await apiClient.get<ApiEnvelope<PatientReport>>(`/patient/reports/${reportId}`);
    return response.data.data;
  },

  async upload(input: PatientReportUploadInput, onProgress?: (percent: number) => void) {
    const form = new FormData();
    form.append('reportName', input.reportName);
    form.append('reportType', input.reportType);
    if (input.reportDate) form.append('reportDate', input.reportDate);
    if (input.providerLaboratory) form.append('providerLaboratory', input.providerLaboratory);
    form.append('file', input.file);

    const response = await apiClient.post<ApiEnvelope<PatientReport>>('/patient/reports', form, {
      // Override the shared JSON default so Axios preserves FormData and lets the browser add the multipart boundary.
      headers: { 'Content-Type': undefined },
      onUploadProgress: (event) => {
        if (!event.total || !onProgress) return;
        onProgress(Math.min(100, Math.round((event.loaded * 100) / event.total)));
      },
    });
    return response.data.data;
  },

  async update(reportId: string, input: PatientReportMetadataInput) {
    const response = await apiClient.patch<ApiEnvelope<PatientReport>>(`/patient/reports/${reportId}`, input);
    return response.data.data;
  },

  async archive(reportId: string) {
    const response = await apiClient.post<ApiEnvelope<PatientReport>>(`/patient/reports/${reportId}/archive`);
    return response.data.data;
  },

  async restore(reportId: string) {
    const response = await apiClient.post<ApiEnvelope<PatientReport>>(`/patient/reports/${reportId}/restore`);
    return response.data.data;
  },

  async content(reportId: string) {
    const response = await apiClient.get<Blob>(`/patient/reports/${reportId}/content`, { responseType: 'blob' });
    return response.data;
  },

  async download(reportId: string) {
    const response = await apiClient.get<Blob>(`/patient/reports/${reportId}/download`, { responseType: 'blob' });
    return response.data;
  },
};

export function patientReportErrorMessage(error: unknown, fallback: string) {
  return apiErrorMessage(error, fallback);
}
