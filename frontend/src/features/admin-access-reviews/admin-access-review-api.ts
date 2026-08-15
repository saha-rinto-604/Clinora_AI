import { apiClient, apiErrorMessage } from '../auth/auth-api';
import type { AccessReviewDetail, AccessReviewQueueItem, PageView } from './admin-access-review-types';
import type { ApplicationStatus, ApplicationType } from '../access-applications/application-types';
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
  async downloadDocument(applicationId: string, documentId: string) {
    const response = await apiClient.get<Blob>(
      `/admin/access-applications/${applicationId}/documents/${documentId}/content`,
      { responseType: 'blob' },
    );
    return response.data;
  },
};

export function reviewErrorMessage(error: unknown, fallback: string) {
  return apiErrorMessage(error, fallback);
}
