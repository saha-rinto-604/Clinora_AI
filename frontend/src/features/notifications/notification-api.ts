import { apiClient, apiErrorMessage } from '../auth/auth-api';
import type { ApiEnvelope } from '../auth/auth-types';

export interface PatientNotification {
  id: string;
  type: string;
  category: 'APPOINTMENTS' | 'SECURITY' | 'REPORTS' | 'SYSTEM';
  title: string;
  body: string;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
  readAt: string | null;
}
export interface NotificationPage {
  items: PatientNotification[];
  unreadCount: number;
  hasMore: boolean;
  nextBefore: string | null;
  nextBeforeId: string | null;
}
export interface NotificationPreferences {
  appointmentsInApp: boolean;
  reportsInApp: boolean;
  securityInApp: boolean;
  appointmentsEmail: boolean;
  reportsEmail: boolean;
}

export const notificationApi = {
  async list(input: { unreadOnly?: boolean; before?: string; beforeId?: string; limit?: number } = {}) {
    const response = await apiClient.get<ApiEnvelope<NotificationPage>>('/patient/notifications', { params: input });
    return response.data.data;
  },
  async unreadCount() {
    const response = await apiClient.get<ApiEnvelope<number>>('/patient/notifications/unread-count');
    return response.data.data;
  },
  async read(id: string) {
    const response = await apiClient.post<ApiEnvelope<PatientNotification>>(`/patient/notifications/${id}/read`);
    return response.data.data;
  },
  async readAll() {
    await apiClient.post('/patient/notifications/read-all');
  },
  async preferences() {
    const response = await apiClient.get<ApiEnvelope<NotificationPreferences>>('/patient/notifications/preferences');
    return response.data.data;
  },
  async updatePreferences(input: NotificationPreferences) {
    const response = await apiClient.patch<ApiEnvelope<NotificationPreferences>>(
      '/patient/notifications/preferences',
      input,
    );
    return response.data.data;
  },
};

export function notificationError(error: unknown, fallback: string) {
  return apiErrorMessage(error, fallback);
}
