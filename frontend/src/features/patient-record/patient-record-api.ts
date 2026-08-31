import { apiClient, apiErrorMessage } from '../auth/auth-api';
import type { ApiEnvelope } from '../auth/auth-types';
import type { PatientProfile } from '../patient/patient-types';

export type TimelineCategory = 'PROFILE' | 'CONDITIONS_MEDICATIONS' | 'REPORTS' | 'APPOINTMENTS';

export interface HealthRecordReport {
  id: string;
  reportName: string;
  reportType: string;
  reportDate: string | null;
  providerLaboratory: string | null;
  uploadedAt: string;
  sourceType: 'MEDICAL_REPORT';
}

export interface SourcedHealthValue {
  name: string;
  sourceType: 'PATIENT_PROFILE';
}

export interface HealthRecordMeasurements {
  bloodGroup: PatientProfile['bloodGroup'];
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  sourceType: 'PATIENT_PROFILE';
}

export interface HealthRecordAppointment {
  id: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  doctorName: string;
  specialization: string;
  sourceType: 'APPOINTMENT';
}

export interface HealthRecord {
  profile: PatientProfile;
  clinicalEssentials: {
    allergies: SourcedHealthValue[];
    conditions: SourcedHealthValue[];
    medications: SourcedHealthValue[];
  };
  currentMeasurements: HealthRecordMeasurements;
  recentReports: HealthRecordReport[];
  care: {
    nextAppointment: HealthRecordAppointment | null;
    recentAppointments: HealthRecordAppointment[];
  };
  background: {
    familyMedicalHistory: string | null;
    lifestyleInformation: string | null;
    sourceType: 'PATIENT_PROFILE';
  };
  lastUpdatedAt: string | null;
}

export interface BodyMeasurementPoint {
  id: string;
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  recordedAt: string;
  sourceType: 'PATIENT_PROFILE';
}

export interface HealthTrends {
  points: BodyMeasurementPoint[];
}

export interface TimelineEvent {
  id: string;
  eventType: string;
  category: TimelineCategory;
  sourceType: string | null;
  sourceId: string | null;
  title: string;
  detail: string | null;
  occurredAt: string;
}

export interface TimelinePage {
  items: TimelineEvent[];
  hasMore: boolean;
  nextBefore: string | null;
  nextBeforeId: string | null;
}

export const patientRecordApi = {
  async history() {
    const response = await apiClient.get<ApiEnvelope<HealthRecord>>('/patient/history');
    return response.data.data;
  },
  async healthTrends(input: { from?: string; to?: string } = {}) {
    const response = await apiClient.get<ApiEnvelope<HealthTrends>>('/patient/health-trends', { params: input });
    return response.data.data;
  },
  async timeline(input: { category?: TimelineCategory; before?: string; beforeId?: string; limit?: number } = {}) {
    const response = await apiClient.get<ApiEnvelope<TimelinePage>>('/patient/timeline', { params: input });
    return response.data.data;
  },
};

export function patientRecordError(error: unknown, fallback: string) {
  return apiErrorMessage(error, fallback);
}
