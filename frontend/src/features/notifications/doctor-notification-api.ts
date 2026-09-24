import { apiClient, apiErrorMessage } from '../auth/auth-api';
import type { ApiEnvelope } from '../auth/auth-types';
import type { NotificationPage, PatientNotification } from './notification-api';

export type DoctorNotification = PatientNotification;

export const doctorNotificationApi = {
  async list(input: { unreadOnly?: boolean; before?: string; beforeId?: string; limit?: number } = {}) {
    const response = await apiClient.get<ApiEnvelope<NotificationPage>>('/doctor/notifications', { params: input });
    return response.data.data;
  },
  async unreadCount() {
    const response = await apiClient.get<ApiEnvelope<number>>('/doctor/notifications/unread-count');
    return response.data.data;
  },
  async read(id: string) {
    const response = await apiClient.post<ApiEnvelope<DoctorNotification>>(`/doctor/notifications/${id}/read`);
    return response.data.data;
  },
  async readAll() {
    await apiClient.post('/doctor/notifications/read-all');
  },
};

export function doctorNotificationError(error: unknown, fallback: string) {
  return apiErrorMessage(error, fallback);
}
