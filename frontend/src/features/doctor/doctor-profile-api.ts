import { apiClient, apiErrorMessage } from '../auth/auth-api';
import type { ApiEnvelope } from '../auth/auth-types';

export interface DoctorEditableProfile {
  professionalBio: string | null;
  professionalProfileUrl: string | null;
  displayTitle: string | null;
  currentOrganization: string | null;
  currentPosition: string | null;
  preferredTimezone: string | null;
  defaultConsultationMinutes: number | null;
}

export interface DoctorQualification {
  id: string;
  qualificationName: string;
  institution: string;
  countryCode: string;
  completionYear: number;
}

export interface DoctorCredentialDocument {
  id: string;
  documentType: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface DoctorVerifiedCredentials {
  verifiedProfessionalTitle: string | null;
  verifiedCurrentOrganization: string | null;
  verifiedCurrentPosition: string | null;
  registrationJurisdiction: string | null;
  registrationAuthority: string | null;
  registrationNumber: string | null;
  registrationType: string | null;
  registrationIssuedAt: string | null;
  registrationValidUntil: string | null;
  qualifications: DoctorQualification[];
  documents: DoctorCredentialDocument[];
}

export interface DoctorMissingSetupItem {
  key: string;
  label: string;
  destination: string;
}

export interface DoctorProfileReadiness {
  percent: number;
  completedItems: number;
  totalItems: number;
  missingItems: DoctorMissingSetupItem[];
}

export interface DoctorProfessionalProfile {
  doctorId: string;
  displayName: string;
  verifiedFirstName: string;
  verifiedLastName: string;
  specialization: string;
  approvedYearsExperience: number | null;
  editable: DoctorEditableProfile;
  credentials: DoctorVerifiedCredentials;
  readiness: DoctorProfileReadiness;
  version: number;
  updatedAt: string;
}

export interface UpdateDoctorProfessionalProfile extends DoctorEditableProfile {
  version: number;
}

export interface PatientFacingDoctorProfile {
  doctorId: string;
  displayName: string;
  displayTitle: string | null;
  specialization: string;
  yearsExperience: number | null;
  currentOrganization: string | null;
  currentPosition: string | null;
  professionalBio: string | null;
  professionalProfileUrl: string | null;
  preferredTimezone: string | null;
  defaultConsultationMinutes: number | null;
  nextAvailableAt: string | null;
  clinoraVerified: boolean;
}

export const doctorProfileApi = {
  async profile() {
    const response = await apiClient.get<ApiEnvelope<DoctorProfessionalProfile>>('/doctor/profile');
    return response.data.data;
  },

  async update(input: UpdateDoctorProfessionalProfile) {
    const response = await apiClient.put<ApiEnvelope<DoctorProfessionalProfile>>('/doctor/profile', input);
    return response.data.data;
  },

  async credentialContent(documentId: string) {
    const response = await apiClient.get<Blob>(
      `/doctor/profile/credentials/documents/${encodeURIComponent(documentId)}/content`,
      { responseType: 'blob' },
    );
    return response.data;
  },

  async credentialDownload(documentId: string) {
    const response = await apiClient.get<Blob>(
      `/doctor/profile/credentials/documents/${encodeURIComponent(documentId)}/download`,
      { responseType: 'blob' },
    );
    return response.data;
  },
};

export async function patientFacingDoctorProfile(doctorId: string) {
  const response = await apiClient.get<ApiEnvelope<PatientFacingDoctorProfile>>(
    `/patient/doctors/${encodeURIComponent(doctorId)}/professional-profile`,
  );
  return response.data.data;
}

export function doctorProfileError(error: unknown, fallback: string) {
  return apiErrorMessage(error, fallback);
}
