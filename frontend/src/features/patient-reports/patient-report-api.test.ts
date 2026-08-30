import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiEnvelope } from '../auth/auth-types';
import type { PatientReport } from './patient-report-types';

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock('../auth/auth-api', () => ({
  apiClient: { post: mocks.post },
  apiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

import { patientReportApi } from './patient-report-api';

const report: PatientReport = {
  id: '22222222-2222-2222-2222-222222222222',
  reportName: 'Annual blood panel',
  reportType: 'LAB_RESULTS',
  reportDate: '2026-08-25',
  providerLaboratory: 'City Diagnostic Centre',
  originalFilename: 'annual-blood-panel.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 14,
  archived: false,
  archivedAt: null,
  createdAt: '2026-08-30T08:00:00Z',
  updatedAt: '2026-08-30T08:00:00Z',
};

describe('Patient report API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.post.mockResolvedValue({ data: { success: true, message: 'Uploaded.', data: report } } satisfies {
      data: ApiEnvelope<PatientReport>;
    });
  });

  it('preserves report uploads as browser multipart data instead of the shared JSON default', async () => {
    const file = new File(['%PDF-1.7\n%%EOF'], 'annual-blood-panel.pdf', { type: 'application/pdf' });
    const uploaded = await patientReportApi.upload({
      reportName: report.reportName,
      reportType: report.reportType,
      reportDate: report.reportDate,
      providerLaboratory: report.providerLaboratory,
      file,
    });

    expect(uploaded).toEqual(report);
    expect(mocks.post).toHaveBeenCalledTimes(1);
    const [path, body, config] = mocks.post.mock.calls[0] as [string, FormData, { headers: Record<string, unknown> }];
    expect(path).toBe('/patient/reports');
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('reportName')).toBe(report.reportName);
    expect(body.get('reportType')).toBe(report.reportType);
    expect(body.get('file')).toBe(file);
    expect(config.headers).toEqual({ 'Content-Type': undefined });
  });
});
