import { apiClient, apiErrorMessage } from '../auth/auth-api';
import type { ApiEnvelope } from '../auth/auth-types';
import type { PatientDashboard, PatientProfile, UpdatePatientProfileInput } from './patient-types';

export const patientApi = {
  async profile() {
    const response = await apiClient.get<ApiEnvelope<PatientProfile>>('/patient/profile');
    return response.data.data;
  },
  async updateProfile(input: UpdatePatientProfileInput) {
    const response = await apiClient.patch<ApiEnvelope<PatientProfile>>('/patient/profile', input);
    return response.data.data;
  },
  async dashboard() {
    const response = await apiClient.get<ApiEnvelope<PatientDashboard>>('/patient/dashboard');
    return response.data.data;
  },
};

export function patientErrorMessage(error: unknown, fallback: string) {
  return apiErrorMessage(error, fallback);
}
