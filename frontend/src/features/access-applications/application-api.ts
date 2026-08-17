import axios from 'axios';
import type {
  AccessApplication,
  ApiEnvelope,
  ApplicationDocument,
  ApplicationDocumentType,
  ApplicationEvent,
  ApplicationType,
  Qualification,
} from './application-types';
import type { DoctorInterview } from './doctor-interview-types';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

// Applicant access deliberately uses its own cookie-scoped client. It does not
// share the normal User JWT/refresh interceptor from Phase 4B.
const applicantClient = axios.create({
  baseURL,
  withCredentials: true,
});

export interface ApplicationUpdate {
  firstName?: string;
  lastName?: string;
  phone?: string;
  countryCode?: string;
  professionalTitle?: string;
  specialization?: string;
  yearsExperience?: number;
  currentOrganization?: string;
  currentPosition?: string;
  professionalProfileUrl?: string;
  registrationJurisdiction?: string;
  registrationAuthority?: string;
  registrationNumber?: string;
  registrationType?: string;
  registrationIssuedAt?: string;
  registrationValidUntil?: string;
  qualifications?: Qualification[];
  institution?: string;
  department?: string;
  institutionalProfileUrl?: string;
  researchField?: string;
  researchPurpose?: string;
  researchSummary?: string;
  orcid?: string;
  researchProfileUrl?: string;
  publicationProfileUrl?: string;
  ethicsReference?: string;
  projectApprovalReference?: string;
}

export interface VerificationResult {
  continuationToken: string;
}

export const applicationApi = {
  create(
    type: ApplicationType,
    input: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      countryCode: string;
      consentToApplicationProcessing: boolean;
    },
  ) {
    return applicantClient.post<ApiEnvelope<null>>(
      type === 'DOCTOR' ? '/access-applications/doctor' : '/access-applications/researcher',
      input,
    );
  },
  async verifyEmail(token: string) {
    const response = await applicantClient.post<ApiEnvelope<VerificationResult>>('/access-applications/verify-email', {
      token,
    });
    return response.data.data;
  },
  resendVerification(token: string) {
    return applicantClient.post<ApiEnvelope<null>>('/access-applications/verify-email/resend', { token });
  },
  requestAccessLink(email: string) {
    return applicantClient.post<ApiEnvelope<null>>('/access-applications/access-link', { email });
  },
  establishSession(token: string) {
    return applicantClient.post<ApiEnvelope<null>>('/access-applications/session', { token });
  },
  async me() {
    const response = await applicantClient.get<ApiEnvelope<AccessApplication>>('/access-applications/me');
    return response.data.data;
  },
  async update(input: ApplicationUpdate) {
    const response = await applicantClient.patch<ApiEnvelope<AccessApplication>>('/access-applications/me', input);
    return response.data.data;
  },
  async events() {
    const response = await applicantClient.get<ApiEnvelope<ApplicationEvent[]>>('/access-applications/me/events');
    return response.data.data;
  },
  async interview() {
    const response = await applicantClient.get<ApiEnvelope<DoctorInterview | null>>(
      '/access-applications/me/interview',
    );
    return response.data.data;
  },
  async requestInterviewReschedule(message: string) {
    const response = await applicantClient.post<ApiEnvelope<DoctorInterview>>(
      '/access-applications/me/interview/reschedule-request',
      { message },
    );
    return response.data.data;
  },
  async upload(documentType: ApplicationDocumentType, file: File) {
    const body = new FormData();
    body.append('file', file);
    const response = await applicantClient.post<ApiEnvelope<ApplicationDocument>>(
      '/access-applications/me/documents',
      body,
      { params: { documentType } },
    );
    return response.data.data;
  },
  deleteDocument(documentId: string) {
    return applicantClient.delete<ApiEnvelope<null>>(`/access-applications/me/documents/${documentId}`);
  },
  documentUrl(documentId: string) {
    return `${baseURL}/access-applications/me/documents/${documentId}/content`;
  },
  async submit(confirmedAccurate: boolean) {
    const response = await applicantClient.post<ApiEnvelope<AccessApplication>>('/access-applications/me/submit', {
      confirmedAccurate,
    });
    return response.data.data;
  },
  async withdraw() {
    const response = await applicantClient.post<ApiEnvelope<AccessApplication>>('/access-applications/me/withdraw');
    return response.data.data;
  },
  logout() {
    return applicantClient.post<ApiEnvelope<null>>('/access-applications/logout');
  },
  logoutAll() {
    return applicantClient.post<ApiEnvelope<null>>('/access-applications/logout-all');
  },
};

export function applicationErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { message?: string } | undefined)?.message ?? fallback;
  }
  return fallback;
}

export function applicationErrorCode(error: unknown) {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { errorCode?: string } | undefined)?.errorCode;
  }
  return undefined;
}
