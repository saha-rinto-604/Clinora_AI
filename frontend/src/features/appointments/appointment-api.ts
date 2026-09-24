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
  practiceLocation?: string | null;
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
  consultationMode?: AvailabilityConsultationMode;
}
export type ConsultationMode = 'ONLINE' | 'IN_PERSON';
export type AvailabilityConsultationMode = ConsultationMode | 'BOTH';
export interface WeeklyAvailabilityBlock {
  weekday: number;
  start: string;
  end: string;
  consultationMode: AvailabilityConsultationMode;
  enabled: boolean;
}
export interface WeeklyRoutine {
  version: number;
  slotMinutes: number;
  timezone: string;
  defaultMeetingUrl: string | null;
  blocks: WeeklyAvailabilityBlock[];
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
  consultationMode?: ConsultationMode | null;
  meetingUrl?: string | null;
  meetingLinkUpdatedAt?: string | null;
  visitLocation?: string | null;
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

export interface ConsultationJoinStatus {
  roomReady: boolean;
  canJoin: boolean;
  state: 'UNAVAILABLE' | 'ROOM_NOT_READY' | 'TOO_EARLY' | 'ENDED' | 'READY';
  opensAt: string | null;
}

export const appointmentApi = {
  async joinStatus(id: string) {
    const response = await apiClient.get<ApiEnvelope<ConsultationJoinStatus>>(`/patient/appointments/${id}/join`);
    return response.data.data;
  },
  async join(id: string) {
    const response = await apiClient.post<ApiEnvelope<{ meetingUrl: string }>>(`/patient/appointments/${id}/join`);
    return response.data.data;
  },
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
    input: {
      slotId: string;
      reasonForVisit?: string;
      timezone: string;
      consultationMode: ConsultationMode;
      reportIds: string[];
    },
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
  async reschedule(id: string, slotId: string, timezone: string, consultationMode?: ConsultationMode) {
    const response = await apiClient.post<ApiEnvelope<Appointment>>(`/patient/appointments/${id}/reschedule`, {
      slotId,
      timezone,
      consultationMode,
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
  async saveMeetingRoom(meetingUrl: string) {
    const response = await apiClient.put<ApiEnvelope<{ defaultMeetingUrl: string; updatedAppointments: number }>>(
      '/doctor/availability/meeting-room',
      { meetingUrl },
    );
    return response.data.data;
  },
  async weekly() {
    const response = await apiClient.get<ApiEnvelope<WeeklyRoutine>>('/doctor/availability/weekly');
    return response.data.data;
  },
  async saveWeekly(input: Omit<WeeklyRoutine, 'defaultMeetingUrl'>) {
    const response = await apiClient.put<ApiEnvelope<WeeklyRoutine>>('/doctor/availability/weekly', input);
    return response.data.data;
  },
  async list() {
    const response = await apiClient.get<ApiEnvelope<AvailabilitySlot[]>>('/doctor/availability');
    return response.data.data;
  },
  async create(input: {
    startsAt: string;
    endsAt: string;
    slotMinutes: number;
    timezone: string;
    consultationMode?: AvailabilityConsultationMode;
  }) {
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

export function appointmentErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') return null;
  const response = (error as { response?: { data?: { errorCode?: unknown } } }).response;
  return typeof response?.data?.errorCode === 'string' ? response.data.errorCode : null;
}
