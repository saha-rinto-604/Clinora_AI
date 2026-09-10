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

type PatientReportIdentity = Pick<PatientReport, 'reportName' | 'originalFilename' | 'reportType'> &
  Partial<Pick<PatientReport, 'reportDate' | 'providerLaboratory' | 'createdAt'>>;

const captureFilenamePattern =
  /^(?:(?:screen\s*shot|screenshot|img|image|photo|pxl|scan|scanned|document|doc|report|file|medical\s*report|whatsapp\s+image|adobe\s+scan|camscanner)[\s_-]*(?:\d|$)|\d{8,}(?:[\s_-]\d{4,})?$)/i;
const genericFilenamePattern = /^(?:medical\s*report|report|document|image|photo|scan|file)$/i;

export function looksLikeOpaqueReportName(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return true;
  const compact = cleaned.replace(/[\s_-]/g, '');
  if (compact.length >= 24 && /^[0-9a-f]+$/i.test(compact)) return true;
  return captureFilenamePattern.test(cleaned) || genericFilenamePattern.test(cleaned);
}

function filenameStem(value: string) {
  const filename = value.replace(/\\/g, '/').split('/').pop() ?? value;
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readableFilename(value: string) {
  const stem = filenameStem(value);
  if (!stem || looksLikeOpaqueReportName(stem)) return null;
  return stem;
}

function compactDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function patientReportDisplayName(report: PatientReportIdentity) {
  const storedName = report.reportName.trim();
  if (storedName && !looksLikeOpaqueReportName(storedName)) return storedName;

  const sourceName = readableFilename(report.originalFilename);
  if (sourceName) return sourceName;

  const typeLabel = patientReportTypeLabels[report.reportType];
  const date = compactDate(report.reportDate);
  if (date) return `${typeLabel} · ${date}`;

  const provider = report.providerLaboratory?.trim();
  if (provider) return `${typeLabel} · ${provider}`;

  return typeLabel;
}

export function patientReportSecondaryContext(report: PatientReportIdentity) {
  const parts: string[] = [];
  const date = compactDate(report.reportDate);
  const storedName = report.reportName.trim();
  const usesDerivedDateTitle =
    (!storedName || looksLikeOpaqueReportName(storedName)) &&
    !readableFilename(report.originalFilename) &&
    Boolean(date);
  if (date && !usesDerivedDateTitle) parts.push(date);
  if (report.providerLaboratory?.trim()) parts.push(report.providerLaboratory.trim());
  if (!date && report.createdAt) {
    const uploaded = new Date(report.createdAt);
    if (!Number.isNaN(uploaded.getTime())) {
      parts.push(
        `Uploaded ${uploaded.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`,
      );
    }
  }
  return parts;
}
