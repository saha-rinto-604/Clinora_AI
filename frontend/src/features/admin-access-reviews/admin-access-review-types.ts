import type {
  ApplicationDocument,
  ApplicationStatus,
  ApplicationType,
  DoctorDetail,
  Qualification,
  ResearcherDetail,
} from '../access-applications/application-types';

export interface PageView<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

export interface AccessReviewQueueItem {
  id: string;
  applicationType: ApplicationType;
  firstName: string;
  lastName: string;
  email: string;
  status: ApplicationStatus;
  submittedAt?: string | null;
  updatedAt: string;
}

export interface AccessReviewEvent {
  type: string;
  message: string;
  createdAt: string;
}

export interface AccessReviewNote {
  id: string;
  reviewerUserId: string;
  text: string;
  createdAt: string;
}

export interface AccessReviewDetail extends AccessReviewQueueItem {
  phone?: string | null;
  countryCode?: string | null;
  emailVerifiedAt?: string | null;
  doctor?: DoctorDetail | null;
  researcher?: ResearcherDetail | null;
  qualifications: Qualification[];
  documents: ApplicationDocument[];
  events: AccessReviewEvent[];
  internalNotes: AccessReviewNote[];
  allowedNextStatuses: ApplicationStatus[];
}
