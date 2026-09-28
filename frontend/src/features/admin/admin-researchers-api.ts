import { apiClient } from '../auth/auth-api';
import type { ApiEnvelope } from '../auth/auth-types';

export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | 'PENDING_VERIFICATION';

export type ApplicationStatus =
  | 'DRAFT'
  | 'EMAIL_PENDING'
  | 'SUBMITTED'
  | 'MORE_INFO_REQUIRED'
  | 'APPROVED'
  | 'ACTIVATION_PENDING'
  | 'ACTIVATED'
  | 'REJECTED'
  | 'WITHDRAWN';

export type ApplicationDocumentType =
  | 'MEDICAL_LICENSE'
  | 'GOVERNMENT_ID'
  | 'EMPLOYMENT_PROOF'
  | 'STUDENT_ID'
  | 'INSTITUTIONAL_ID'
  | 'ETHICS_APPROVAL'
  | 'OTHER';

export interface ResearcherSummaryView {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'RESEARCHER';
  accountStatus: AccountStatus;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  deactivatedAt: string | null;
  applicationId: string | null;
  applicationStatus: ApplicationStatus | null;
  institution: string | null;
  department: string | null;
  professionalTitle: string | null;
  researchField: string | null;
  hasProfileImage: boolean;
  credentialVerificationStatus?: 'PENDING_SUBMISSION' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED' | 'EXPIRED' | null;
}

export interface ResearcherAccountView {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'RESEARCHER';
  accountStatus: AccountStatus;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  deactivatedAt: string | null;
  hasProfileImage: boolean;
}

export interface ResearcherApplicationView {
  applicationId: string;
  status: ApplicationStatus;
  submittedAt: string | null;
  emailVerifiedAt: string | null;
  attestedAt: string | null;
  createdAt: string;
  updatedAt: string;
  phone: string | null;
  countryCode: string | null;
  institution: string | null;
  department: string | null;
  professionalTitle: string | null;
  institutionalProfileUrl: string | null;
  researchField: string | null;
  researchPurpose: string | null;
  researchSummary: string | null;
  orcid: string | null;
  researchProfileUrl: string | null;
  publicationProfileUrl: string | null;
  ethicsReference: string | null;
  projectApprovalReference: string | null;
}

export interface ResearcherSecuritySummaryView {
  activeSessionsCount: number;
  lastLoginAt: string | null;
  accountStatus: AccountStatus;
  emailVerified: boolean;
}

export interface ResearcherDetailView {
  account: ResearcherAccountView;
  application: ResearcherApplicationView | null;
  securitySummary: ResearcherSecuritySummaryView;
}

export interface ResearcherDocumentView {
  id: string;
  applicationId: string;
  documentType: ApplicationDocumentType;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface ProjectSummaryItem {
  id: string;
  title: string;
  researchField: string;
  status: string;
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
}

export interface CollaborationSummaryItem {
  projectId: string;
  projectTitle: string;
  role: string;
  joinedAt: string;
}

export interface DatasetRequestSummaryItem {
  id: string;
  projectId: string;
  projectTitle: string;
  name: string;
  status: string;
  requestedFormat: string;
  createdAt: string;
}

export interface DatasetSummaryItem {
  id: string;
  projectId: string;
  projectTitle: string;
  name: string;
  status: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface EvaluationRunSummaryItem {
  id: string;
  projectId: string;
  projectTitle: string;
  modelId: string;
  modelVersion: string;
  taskType: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface PublicationSummaryItem {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  publicationType: string;
  doi: string | null;
  journal: string | null;
  publicationDate: string | null;
}

export interface ResearcherActivityView {
  ownedProjects: ProjectSummaryItem[];
  collaborations: CollaborationSummaryItem[];
  datasetRequests: DatasetRequestSummaryItem[];
  generatedDatasets: DatasetSummaryItem[];
  aiEvaluationRuns: EvaluationRunSummaryItem[];
  publications: PublicationSummaryItem[];
}

export interface ResearcherAuditEventView {
  id: string;
  action: string;
  outcome: string;
  occurredAt: string;
  actorUserId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  resourceId: string | null;
  metadata: string | null;
}

export interface ResearcherPageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

export interface ResearcherListParams {
  q?: string;
  accountStatus?: AccountStatus | '';
  applicationStatus?: ApplicationStatus | '';
  researchField?: string;
  institution?: string;
  page?: number;
  size?: number;
}

export const adminResearchersApi = {
  async listResearchers(params?: ResearcherListParams) {
    const response = await apiClient.get<ApiEnvelope<ResearcherPageResponse<ResearcherSummaryView>>>(
      '/admin/researchers',
      {
        params: {
          q: params?.q || undefined,
          accountStatus: params?.accountStatus || undefined,
          applicationStatus: params?.applicationStatus || undefined,
          researchField: params?.researchField || undefined,
          institution: params?.institution || undefined,
          page: params?.page ?? 0,
          size: params?.size ?? 20,
        },
      }
    );
    return response.data;
  },

  async getResearcherDetail(researcherUserId: string) {
    const response = await apiClient.get<ApiEnvelope<ResearcherDetailView>>(
      `/admin/researchers/${researcherUserId}`
    );
    return response.data;
  },

  async getResearcherDocuments(researcherUserId: string) {
    const response = await apiClient.get<ApiEnvelope<ResearcherDocumentView[]>>(
      `/admin/researchers/${researcherUserId}/documents`
    );
    return response.data;
  },

  async getResearcherActivity(researcherUserId: string) {
    const response = await apiClient.get<ApiEnvelope<ResearcherActivityView>>(
      `/admin/researchers/${researcherUserId}/research-activity`
    );
    return response.data;
  },

  async getResearcherAuditEvents(researcherUserId: string, page = 0, size = 20) {
    const response = await apiClient.get<ApiEnvelope<ResearcherPageResponse<ResearcherAuditEventView>>>(
      `/admin/researchers/${researcherUserId}/audit-events`,
      {
        params: { page, size },
      }
    );
    return response.data;
  },

  async suspendResearcher(researcherUserId: string, reason?: string) {
    const response = await apiClient.post<ApiEnvelope<void>>(
      `/admin/researchers/${researcherUserId}/suspend`,
      { reason }
    );
    return response.data;
  },

  async reactivateResearcher(researcherUserId: string, reason?: string) {
    const response = await apiClient.post<ApiEnvelope<void>>(
      `/admin/researchers/${researcherUserId}/reactivate`,
      { reason }
    );
    return response.data;
  },

  async revokeSessions(researcherUserId: string, reason?: string) {
    const response = await apiClient.post<ApiEnvelope<void>>(
      `/admin/researchers/${researcherUserId}/revoke-sessions`,
      { reason }
    );
    return response.data;
  },

  getDocumentContentUrl(researcherUserId: string, documentId: string, download = false): string {
    return `/api/v1/admin/researchers/${researcherUserId}/documents/${documentId}/content?download=${download}`;
  },

  async getCredentials(researcherUserId: string) {
    const response = await apiClient.get<ApiEnvelope<any>>(
      `/admin/researchers/${researcherUserId}/credentials`
    );
    return response.data;
  },

  async verifyCredentials(
    researcherUserId: string,
    payload: { action: 'APPROVE' | 'REJECT'; rejectionReason?: string; adminNotes?: string }
  ) {
    const response = await apiClient.post<ApiEnvelope<any>>(
      `/admin/researchers/${researcherUserId}/credentials/verify`,
      payload
    );
    return response.data;
  },

  async extendDeadline(
    researcherUserId: string,
    payload: { additionalDays: number; reason?: string }
  ) {
    const response = await apiClient.post<ApiEnvelope<any>>(
      `/admin/researchers/${researcherUserId}/credentials/extend-deadline`,
      payload
    );
    return response.data;
  },

  getCredentialDocumentUrl(researcherUserId: string, docType: 'student-id' | 'certificate'): string {
    return `/api/v1/admin/researchers/${researcherUserId}/credentials/documents/${docType}`;
  },
};
