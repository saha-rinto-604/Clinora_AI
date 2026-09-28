import { apiClient } from '../auth/auth-api';
import type { ApiEnvelope } from '../auth/auth-types';

export type CredentialVerificationStatus =
  | 'PENDING_SUBMISSION'
  | 'SUBMITTED'
  | 'VERIFIED'
  | 'REJECTED'
  | 'EXPIRED';

export type ResearcherCredentialView = {
  id: string;
  userId: string;
  verificationStatus: CredentialVerificationStatus;
  hasStudentId: boolean;
  studentIdFilename: string | null;
  studentIdSizeBytes: number | null;
  studentIdMimeType: string | null;
  hasCertificate: boolean;
  certificateFilename: string | null;
  certificateSizeBytes: number | null;
  certificateMimeType: string | null;
  institutionName: string | null;
  degreeProgram: string | null;
  credentialIdNumber: string | null;
  submissionDeadline: string;
  secondsRemaining: number;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  rejectionReason: string | null;
  adminNotes: string | null;
  isExpired: boolean;
  isSuspendedRisk: boolean;
};

export type SubmitCredentialsPayload = {
  institutionName: string;
  degreeProgram: string;
  credentialIdNumber: string;
};

export type AdminVerifyPayload = {
  action: 'APPROVE' | 'REJECT';
  rejectionReason?: string;
  adminNotes?: string;
};

export type AdminExtendDeadlinePayload = {
  additionalDays: number;
  reason?: string;
};

export const researchCredentialsApi = {
  async getMyCredentials(): Promise<ResearcherCredentialView> {
    const response = await apiClient.get<ApiEnvelope<ResearcherCredentialView>>('/research/credentials');
    return response.data.data;
  },

  async submitCredentials(
    payload: SubmitCredentialsPayload,
    studentIdFile: File,
    certFile: File,
  ): Promise<ResearcherCredentialView> {
    const formData = new FormData();
    formData.append(
      'data',
      new Blob([JSON.stringify(payload)], { type: 'application/json' }),
    );
    formData.append('studentId', studentIdFile);
    formData.append('certificate', certFile);

    const response = await apiClient.post<ApiEnvelope<ResearcherCredentialView>>(
      '/research/credentials',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
    return response.data.data;
  },

  getCredentialDocumentUrl(docType: 'student-id' | 'certificate', targetUserId?: string): string {
    const base = `/api/v1/research/credentials/documents/${docType}`;
    return targetUserId ? `${base}?userId=${encodeURIComponent(targetUserId)}` : base;
  },

  async getDocumentBlob(
    docType: 'student-id' | 'certificate',
    targetUserId?: string,
  ): Promise<{ blob: Blob; url: string; mimeType: string }> {
    const url = `/research/credentials/documents/${docType}${
      targetUserId ? `?userId=${encodeURIComponent(targetUserId)}` : ''
    }`;
    const response = await apiClient.get<Blob>(url, {
      responseType: 'blob',
    });
    const blob = response.data;
    const blobUrl = URL.createObjectURL(blob);
    const mimeType = (response.headers['content-type'] as string) || blob.type || 'application/octet-stream';
    return { blob, url: blobUrl, mimeType };
  },

  async downloadDocument(
    docType: 'student-id' | 'certificate',
    filename: string,
    targetUserId?: string,
  ): Promise<void> {
    const { blob } = await this.getDocumentBlob(docType, targetUserId);
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
  },

  // Admin APIs
  async getAdminResearcherCredentials(researcherUserId: string): Promise<ResearcherCredentialView> {
    const response = await apiClient.get<ApiEnvelope<ResearcherCredentialView>>(
      `/admin/researchers/${encodeURIComponent(researcherUserId)}/credentials`,
    );
    return response.data.data;
  },

  async verifyCredentials(
    researcherUserId: string,
    payload: AdminVerifyPayload,
  ): Promise<ResearcherCredentialView> {
    const response = await apiClient.post<ApiEnvelope<ResearcherCredentialView>>(
      `/admin/researchers/${encodeURIComponent(researcherUserId)}/credentials/verify`,
      payload,
    );
    return response.data.data;
  },

  async extendDeadline(
    researcherUserId: string,
    payload: AdminExtendDeadlinePayload,
  ): Promise<ResearcherCredentialView> {
    const response = await apiClient.post<ApiEnvelope<ResearcherCredentialView>>(
      `/admin/researchers/${encodeURIComponent(researcherUserId)}/credentials/extend-deadline`,
      payload,
    );
    return response.data.data;
  },

  getAdminCredentialDocumentUrl(
    researcherUserId: string,
    docType: 'student-id' | 'certificate',
  ): string {
    return `/api/v1/admin/researchers/${encodeURIComponent(researcherUserId)}/credentials/documents/${docType}`;
  },
};
