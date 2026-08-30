export const patientReportTypes = [
  'LAB_RESULTS',
  'IMAGING',
  'CARDIOLOGY',
  'PATHOLOGY',
  'DISCHARGE_SUMMARY',
  'OTHER',
] as const;

export type PatientReportType = (typeof patientReportTypes)[number];
export type PatientReportCollection = 'ACTIVE' | 'ARCHIVED';

export interface PatientReport {
  id: string;
  reportName: string;
  reportType: PatientReportType;
  reportDate: string | null;
  providerLaboratory: string | null;
  originalFilename: string;
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  sizeBytes: number;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PatientReportPage {
  items: PatientReport[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
  activeCount: number;
  archivedCount: number;
}

export interface PatientReportListQuery {
  query?: string;
  reportType?: PatientReportType;
  collection: PatientReportCollection;
  page: number;
  size?: number;
}

export interface PatientReportMetadataInput {
  reportName: string;
  reportType: PatientReportType;
  reportDate: string | null;
  providerLaboratory: string | null;
}

export interface PatientReportUploadInput extends PatientReportMetadataInput {
  file: File;
}

export const patientReportTypeLabels: Record<PatientReportType, string> = {
  LAB_RESULTS: 'Laboratory results',
  IMAGING: 'Imaging',
  CARDIOLOGY: 'Cardiology',
  PATHOLOGY: 'Pathology',
  DISCHARGE_SUMMARY: 'Discharge summary',
  OTHER: 'Other medical report',
};
