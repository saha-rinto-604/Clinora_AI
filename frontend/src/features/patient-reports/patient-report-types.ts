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

function looksLikeInternalReportName(value: string) {
  const compact = value.replace(/[\s_-]/g, '');
  return compact.length >= 24 && /^[0-9a-f]+$/i.test(compact);
}

function filenameStem(value: string) {
  const filename = value.replace(/\\/g, '/').split('/').pop() ?? value;
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function patientReportDisplayName(
  report: Pick<PatientReport, 'reportName' | 'originalFilename' | 'reportType'>,
) {
  const storedName = report.reportName.trim();
  if (storedName && !looksLikeInternalReportName(storedName)) return storedName;

  const sourceName = filenameStem(report.originalFilename);
  if (sourceName && !looksLikeInternalReportName(sourceName) && sourceName.toLowerCase() !== 'medical report') {
    return sourceName;
  }

  return patientReportTypeLabels[report.reportType];
}
