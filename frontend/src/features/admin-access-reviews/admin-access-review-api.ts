import { apiClient, apiErrorMessage } from '../auth/auth-api';
import type { AccessReviewDetail, AccessReviewQueueItem, PageView } from './admin-access-review-types';
import type { ApplicationStatus, ApplicationType } from '../access-applications/application-types';
import type { DoctorInterview, DoctorInterviewScheduleInput } from '../access-applications/doctor-interview-types';
import type { ApiEnvelope } from '../auth/auth-types';

export interface ReviewQueueParams {
  applicationType?: ApplicationType;
  status?: ApplicationStatus;
  page?: number;
  size?: number;
}

export const adminAccessReviewApi = {
  async queue(params: ReviewQueueParams) {
    const response = await apiClient.get<ApiEnvelope<PageView<AccessReviewQueueItem>>>('/admin/access-applications', {
      params,
    });
    return response.data.data;
  },
  async detail(applicationId: string) {
    const response = await apiClient.get<ApiEnvelope<AccessReviewDetail>>(
      `/admin/access-applications/${applicationId}`,
    );
    return response.data.data;
  },
  async startReview(applicationId: string) {
    const response = await apiClient.post<ApiEnvelope<AccessReviewDetail>>(
      `/admin/access-applications/${applicationId}/start-review`,
    );
    return response.data.data;
  },
  async addNote(applicationId: string, text: string) {
    const response = await apiClient.post<ApiEnvelope<AccessReviewDetail>>(
      `/admin/access-applications/${applicationId}/notes`,
      { text },
    );
    return response.data.data;
  },
  async requestMoreInformation(applicationId: string, message: string) {
    const response = await apiClient.post<ApiEnvelope<AccessReviewDetail>>(
      `/admin/access-applications/${applicationId}/request-more-information`,
      { message },
    );
    return response.data.data;
  },
  async approve(applicationId: string) {
    const response = await apiClient.post<ApiEnvelope<AccessReviewDetail>>(
      `/admin/access-applications/${applicationId}/approve`,
    );
    return response.data.data;
  },
  async reject(applicationId: string, reason: string) {
    const response = await apiClient.post<ApiEnvelope<AccessReviewDetail>>(
      `/admin/access-applications/${applicationId}/reject`,
      { reason },
    );
    return response.data.data;
  },
  async downloadDocument(applicationId: string, documentId: string) {
    const response = await apiClient.get<Blob>(
      `/admin/access-applications/${applicationId}/documents/${documentId}/content`,
      { responseType: 'blob' },
    );
    return response.data;
  },
  async interview(applicationId: string) {
    const response = await apiClient.get<ApiEnvelope<DoctorInterview | null>>(
      `/admin/access-applications/${applicationId}/interview`,
    );
    return response.data.data;
  },
  requireInterview(applicationId: string) {
    return apiClient.post<ApiEnvelope<null>>(`/admin/access-applications/${applicationId}/interview/require`);
  },
  async scheduleInterview(applicationId: string, input: DoctorInterviewScheduleInput) {
    const response = await apiClient.post<ApiEnvelope<DoctorInterview>>(
      `/admin/access-applications/${applicationId}/interview/schedule`,
      input,
    );
    return response.data.data;
  },
  async rescheduleInterview(applicationId: string, input: DoctorInterviewScheduleInput) {
    const response = await apiClient.put<ApiEnvelope<DoctorInterview>>(
      `/admin/access-applications/${applicationId}/interview/reschedule`,
      input,
    );
    return response.data.data;
  },
  async cancelInterview(applicationId: string, reason?: string) {
    const response = await apiClient.post<ApiEnvelope<DoctorInterview>>(
      `/admin/access-applications/${applicationId}/interview/cancel`,
      { reason },
    );
    return response.data.data;
  },
  async completeInterview(applicationId: string) {
    const response = await apiClient.post<ApiEnvelope<DoctorInterview>>(
      `/admin/access-applications/${applicationId}/interview/complete`,
    );
    return response.data.data;
  },
  async markInterviewNoShow(applicationId: string) {
    const response = await apiClient.post<ApiEnvelope<DoctorInterview>>(
      `/admin/access-applications/${applicationId}/interview/no-show`,
    );
    return response.data.data;
  },
};

export function reviewErrorMessage(error: unknown, fallback: string) {
  return apiErrorMessage(error, fallback);
}
