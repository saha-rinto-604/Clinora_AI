import { apiClient, apiErrorMessage } from '../auth/auth-api';
import type { ApiEnvelope } from '../auth/auth-types';

export interface DoctorSummary {
  id: string;
  displayName: string;
  professionalTitle: string | null;
  specialization: string;
  yearsExperience: number | null;
  currentOrganization: string | null;
  currentPosition: string | null;
  registrationJurisdiction: string | null;
  registrationAuthority: string | null;
  registrationType: string | null;
  registrationValidUntil: string | null;
  nextAvailableAt: string | null;
}
export interface AvailabilitySlot {
  id: string;
  doctorId: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: 'AVAILABLE' | 'BOOKED' | 'BLOCKED';
}
export interface DoctorDetail {
  doctor: DoctorSummary;
  availability: AvailabilitySlot[];
}
export interface Appointment {
  id: string;
  status: 'BOOKED' | 'CANCELLED' | 'COMPLETED';
  reasonForVisit: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  bookingTimezone: string;
  bookedAt: string;
  cancelledAt: string | null;
  doctorId: string;
  doctorName: string;
  specialization: string;
  sharedReportCount: number;
}
export interface ReportShare {
  reportId: string;
  reportName: string;
  reportType: string;
  reportDate: string | null;
  sharedAt: string;
  revokedAt: string | null;
}

export const appointmentApi = {
  async doctors(params: { query?: string; specialty?: string; limit?: number } = {}) {
    const response = await apiClient.get<ApiEnvelope<{ items: DoctorSummary[] }>>('/patient/doctors', { params });
    return response.data.data.items;
  },
  async doctor(id: string) {
    const response = await apiClient.get<ApiEnvelope<DoctorDetail>>(`/patient/doctors/${id}`);
    return response.data.data;
  },
  async availability(doctorId: string) {
    const response = await apiClient.get<ApiEnvelope<AvailabilitySlot[]>>(`/patient/doctors/${doctorId}/availability`);
    return response.data.data;
  },
  async book(
    input: { slotId: string; reasonForVisit?: string; timezone: string; reportIds: string[] },
    idempotencyKey: string,
  ) {
    const response = await apiClient.post<ApiEnvelope<Appointment>>('/patient/appointments', input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    return response.data.data;
  },
  async list(collection: 'UPCOMING' | 'PAST') {
    const response = await apiClient.get<ApiEnvelope<Appointment[]>>('/patient/appointments', {
      params: { collection },
    });
    return response.data.data;
  },
  async detail(id: string) {
    const response = await apiClient.get<ApiEnvelope<Appointment>>(`/patient/appointments/${id}`);
    return response.data.data;
  },
  async cancel(id: string, reason?: string) {
    const response = await apiClient.post<ApiEnvelope<Appointment>>(`/patient/appointments/${id}/cancel`, { reason });
    return response.data.data;
  },
  async reschedule(id: string, slotId: string, timezone: string) {
    const response = await apiClient.post<ApiEnvelope<Appointment>>(`/patient/appointments/${id}/reschedule`, {
      slotId,
      timezone,
    });
    return response.data.data;
  },
  async shares(id: string) {
    const response = await apiClient.get<ApiEnvelope<ReportShare[]>>(`/patient/appointments/${id}/report-shares`);
    return response.data.data;
  },
  async share(id: string, reportId: string) {
    const response = await apiClient.post<ApiEnvelope<ReportShare>>(`/patient/appointments/${id}/report-shares`, {
      reportId,
    });
    return response.data.data;
  },
  async revokeShare(id: string, reportId: string) {
    await apiClient.delete(`/patient/appointments/${id}/report-shares/${reportId}`);
  },
};

export const doctorAvailabilityApi = {
  async list() {
    const response = await apiClient.get<ApiEnvelope<AvailabilitySlot[]>>('/doctor/availability');
    return response.data.data;
  },
  async create(input: { startsAt: string; endsAt: string; slotMinutes: number; timezone: string }) {
    const response = await apiClient.post<ApiEnvelope<AvailabilitySlot[]>>('/doctor/availability', input);
    return response.data.data;
  },
  async remove(id: string) {
    await apiClient.delete(`/doctor/availability/${id}`);
  },
};

export function appointmentError(error: unknown, fallback: string) {
  return apiErrorMessage(error, fallback);
}
