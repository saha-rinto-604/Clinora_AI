export type ApplicationType = 'DOCTOR' | 'RESEARCHER';
export type ApplicationStatus =
  | 'EMAIL_PENDING'
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'MORE_INFO_REQUIRED'
  | 'INTERVIEW_REQUIRED'
  | 'INTERVIEW_SCHEDULED'
  | 'INTERVIEW_COMPLETED'
  | 'APPROVED'
  | 'REJECTED'
  | 'ACTIVATION_PENDING'
  | 'ACTIVATED'
  | 'WITHDRAWN';

export type ApplicationDocumentType =
  'CV' | 'MEDICAL_LICENSE' | 'QUALIFICATION' | 'OTHER' | 'INSTITUTIONAL_EVIDENCE' | 'ETHICS_OR_PROJECT_APPROVAL';

export interface Qualification {
  id?: string;
  qualificationName: string;
  institution: string;
  countryCode: string;
  completionYear?: number | null;
}

export interface ApplicationDocument {
  id: string;
  documentType: ApplicationDocumentType;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface DoctorDetail {
  professionalTitle?: string | null;
  specialization?: string | null;
  yearsExperience?: number | null;
  currentOrganization?: string | null;
  currentPosition?: string | null;
  professionalProfileUrl?: string | null;
  registrationJurisdiction?: string | null;
  registrationAuthority?: string | null;
  registrationNumber?: string | null;
  registrationType?: string | null;
  registrationIssuedAt?: string | null;
  registrationValidUntil?: string | null;
}

export interface ResearcherDetail {
  institution?: string | null;
  department?: string | null;
  professionalTitle?: string | null;
  institutionalProfileUrl?: string | null;
  researchField?: string | null;
  researchPurpose?: string | null;
  researchSummary?: string | null;
  orcid?: string | null;
  researchProfileUrl?: string | null;
  publicationProfileUrl?: string | null;
  ethicsReference?: string | null;
  projectApprovalReference?: string | null;
}

export interface AccessApplication {
  id: string;
  applicationType: ApplicationType;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  countryCode?: string | null;
  status: ApplicationStatus;
  emailVerifiedAt?: string | null;
  submittedAt?: string | null;
  doctor?: DoctorDetail | null;
  researcher?: ResearcherDetail | null;
  qualifications: Qualification[];
  documents: ApplicationDocument[];
}

export interface ApplicationEvent {
  type: string;
  message: string;
  createdAt: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}
