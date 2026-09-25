import { apiClient, apiErrorMessage } from '../auth/auth-api';
import type { ApiEnvelope } from '../auth/auth-types';

export type ConsultationStatus = 'IN_PROGRESS' | 'COMPLETED';
export type InvestigationPriority = 'ROUTINE' | 'URGENT';
export type PatientCareState = 'NEW_PATIENT' | 'ACTIVE_CARE' | 'FOLLOW_UP';

export interface PrescriptionDraft {
  medicationName: string;
  strength: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface PrescriptionView extends PrescriptionDraft {
  id: string;
}

export interface PrescriptionDocumentView {
  id: string;
  consultationId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface InvestigationDraft {
  testName: string;
  reason: string;
  instructions: string;
  priority: InvestigationPriority;
}

export interface InvestigationView extends InvestigationDraft {
  id: string;
}

export interface FollowUpDraft {
  recommendedDate: string;
  reason: string;
  instructions: string;
}

export interface FollowUpView extends FollowUpDraft {
  id: string;
}

export interface ConsultationView {
  id: string;
  appointmentId: string;
  patientId: string;
  status: ConsultationStatus;
  version: number;
  historyNotes: string | null;
  findingsNotes: string | null;
  assessment: string | null;
  plan: string | null;
  startedAt: string;
  completedAt: string | null;
  prescriptions: PrescriptionView[];
  prescriptionDocuments: PrescriptionDocumentView[];
  investigations: InvestigationView[];
  followUp: FollowUpView | null;
}

export interface ConsultationDraftRequest {
  version: number;
  historyNotes: string;
  findingsNotes: string;
  assessment: string;
  plan: string;
  prescriptions: PrescriptionDraft[];
  investigations: InvestigationDraft[];
  followUp: FollowUpDraft | null;
}

export interface PatientConsultationSummary {
  consultationId: string;
  appointmentId: string;
  doctorId: string;
  doctorName: string;
  specialization: string;
  assessment: string | null;
  plan: string | null;
  completedAt: string;
  prescriptions: PrescriptionView[];
  prescriptionDocuments: PrescriptionDocumentView[];
  investigations: InvestigationView[];
  followUp: FollowUpView | null;
}

export interface PatientDoctorCareRelationship {
  returningPatient: boolean;
  lastConsultationAt: string | null;
  followUpDate: string | null;
}

export type ClinicalInboxType = 'NEEDS_ACTION' | 'READY_NOW' | 'IN_PROGRESS' | 'EVIDENCE_READY' | 'FOLLOW_UP';

export interface ClinicalInboxItem {
  key: string;
  type: ClinicalInboxType;
  priority: 'HIGH' | 'NORMAL' | 'LOW';
  patientId: string;
  patientName: string;
  appointmentId: string | null;
  consultationId: string | null;
  title: string;
  detail: string;
  dueAt: string | null;
  dueDate: string | null;
  destination: string;
}

export interface ClinicalInboxView {
  readyNowCount: number;
  inProgressCount: number;
  evidenceReadyCount: number;
  followUpCount: number;
  needsAttentionCount: number;
  items: ClinicalInboxItem[];
}

export interface DoctorPatientListItem {
  patientId: string;
  patientName: string;
  careState: PatientCareState;
  consultationInProgress: boolean;
  latestConsultationAt: string | null;
  latestAssessment: string | null;
  latestPlan: string | null;
  requestedInvestigationCount: number;
  followUpDate: string | null;
  nextAppointmentAt: string | null;
  contextAppointmentId: string | null;
  contextAppointmentAt: string | null;
  contextAppointmentTimezone: string | null;
  contextAppointmentMode: 'ONLINE' | 'IN_PERSON' | null;
  contextAppointmentReason: string | null;
  currentlySharedReportCount: number;
}

export interface DoctorPatientCurrentCare {
  careState: PatientCareState;
  consultationInProgress: boolean;
  latestConsultationAt: string | null;
  latestAssessment: string | null;
  latestPlan: string | null;
  prescriptionCount: number;
  prescriptionDocumentCount: number;
  requestedInvestigationCount: number;
  followUpDate: string | null;
}

export interface PatientAppointmentLink {
  appointmentId: string;
  scheduledStart: string;
  scheduledEnd: string;
  timezone: string;
  consultationMode: 'ONLINE' | 'IN_PERSON' | null;
  sharedReportCount: number;
}

export interface PatientCareEpisode {
  consultationId: string;
  appointmentId: string;
  status: ConsultationStatus;
  startedAt: string;
  completedAt: string | null;
  assessment: string | null;
  plan: string | null;
  prescriptionCount: number;
  prescriptionDocumentCount: number;
  requestedInvestigationCount: number;
  followUpDate: string | null;
}

export interface DoctorPatientDetail {
  patientId: string;
  patientName: string;
  currentCare: DoctorPatientCurrentCare;
  upcomingAppointments: PatientAppointmentLink[];
  careHistory: PatientCareEpisode[];
}

export const consultationApi = {
  async byAppointment(appointmentId: string) {
    const response = await apiClient.get<ApiEnvelope<ConsultationView | null>>(
      `/doctor/appointments/${encodeURIComponent(appointmentId)}/consultation`,
    );
    return response.data.data;
  },

  async start(appointmentId: string) {
    const response = await apiClient.post<ApiEnvelope<ConsultationView>>(
      `/doctor/appointments/${encodeURIComponent(appointmentId)}/consultation/start`,
    );
    return response.data.data;
  },

  async save(consultationId: string, draft: ConsultationDraftRequest) {
    const response = await apiClient.put<ApiEnvelope<ConsultationView>>(
      `/doctor/consultations/${encodeURIComponent(consultationId)}`,
      draft,
    );
    return response.data.data;
  },

  async complete(consultationId: string, draft: ConsultationDraftRequest) {
    const response = await apiClient.post<ApiEnvelope<ConsultationView>>(
      `/doctor/consultations/${encodeURIComponent(consultationId)}/complete`,
      draft,
    );
    return response.data.data;
  },

  async uploadPrescriptionDocument(consultationId: string, file: File) {
    const body = new FormData();
    body.append('file', file);
    const response = await apiClient.post<ApiEnvelope<PrescriptionDocumentView>>(
      `/doctor/consultations/${encodeURIComponent(consultationId)}/prescription-documents`,
      body,
    );
    return response.data.data;
  },

  async removePrescriptionDocument(consultationId: string, documentId: string) {
    await apiClient.delete(
      `/doctor/consultations/${encodeURIComponent(consultationId)}/prescription-documents/${encodeURIComponent(documentId)}`,
    );
  },

  async doctorPrescriptionDocument(consultationId: string, documentId: string, disposition: 'view' | 'download') {
    const response = await apiClient.get<Blob>(
      `/doctor/consultations/${encodeURIComponent(consultationId)}/prescription-documents/${encodeURIComponent(documentId)}/content`,
      { params: { disposition }, responseType: 'blob' },
    );
    return response.data;
  },

  async patientSummary(appointmentId: string) {
    const response = await apiClient.get<ApiEnvelope<PatientConsultationSummary | null>>(
      `/patient/appointments/${encodeURIComponent(appointmentId)}/consultation-summary`,
    );
    return response.data.data;
  },

  async patientPrescriptions() {
    const response = await apiClient.get<ApiEnvelope<PatientConsultationSummary[]>>('/patient/prescriptions');
    return response.data.data;
  },

  async patientPrescriptionDocument(consultationId: string, documentId: string, disposition: 'view' | 'download') {
    const response = await apiClient.get<Blob>(
      `/patient/consultations/${encodeURIComponent(consultationId)}/prescription-documents/${encodeURIComponent(documentId)}/content`,
      { params: { disposition }, responseType: 'blob' },
    );
    return response.data;
  },

  async patientDoctorRelationship(doctorId: string) {
    const response = await apiClient.get<ApiEnvelope<PatientDoctorCareRelationship>>(
      `/patient/doctors/${encodeURIComponent(doctorId)}/care-relationship`,
    );
    return response.data.data;
  },

  async inbox() {
    const response = await apiClient.get<ApiEnvelope<ClinicalInboxView>>('/doctor/clinical-inbox');
    return response.data.data;
  },

  async patients() {
    const response = await apiClient.get<ApiEnvelope<DoctorPatientListItem[]>>('/doctor/patients');
    return response.data.data;
  },

  async patient(patientId: string) {
    const response = await apiClient.get<ApiEnvelope<DoctorPatientDetail>>(
      `/doctor/patients/${encodeURIComponent(patientId)}`,
    );
    return response.data.data;
  },
};

export function consultationError(error: unknown, fallback: string) {
  return apiErrorMessage(error, fallback);
}
