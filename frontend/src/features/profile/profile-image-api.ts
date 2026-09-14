import { apiClient, apiErrorMessage } from '../auth/auth-api';
import type { ApiEnvelope } from '../auth/auth-types';
import { useAuthStore } from '../auth/auth-store';

export interface ProfileImageMetadata {
  contentType: string;
  width: number;
  height: number;
  version: number;
  updatedAt: string;
}

export type ProfileImageSource =
  | { kind: 'self' }
  | { kind: 'patient-doctor'; doctorId: string }
  | { kind: 'doctor-patient'; appointmentId: string };

function contentPath(source: ProfileImageSource) {
  switch (source.kind) {
    case 'self':
      return '/profile-images/me/content';
    case 'patient-doctor':
      return `/profile-images/patient/doctors/${encodeURIComponent(source.doctorId)}`;
    case 'doctor-patient':
      return `/profile-images/doctor/appointments/${encodeURIComponent(source.appointmentId)}/patient`;
  }
}

export const profileImageApi = {
  async metadata() {
    if (!useAuthStore.getState().accessToken) return null;
    const response = await apiClient.get<ApiEnvelope<ProfileImageMetadata | null>>('/profile-images/me');
    return response.data.data;
  },

  async content(source: ProfileImageSource) {
    if (!useAuthStore.getState().accessToken) return null;
    const response = await apiClient.get<Blob>(contentPath(source), {
      responseType: 'blob',
      validateStatus: (status) => (status >= 200 && status < 300) || status === 404,
    });
    if (response.status === 204 || response.status === 404 || !response.data?.size) return null;
    return response.data;
  },

  async replace(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.put<ApiEnvelope<ProfileImageMetadata>>('/profile-images/me', formData);
    return response.data.data;
  },

  async remove() {
    await apiClient.delete('/profile-images/me');
  },
};

export function profileImageError(error: unknown, fallback: string) {
  return apiErrorMessage(error, fallback);
}
