import { describe, expect, it } from 'vitest';
import { looksLikeOpaqueReportName, patientReportDisplayName, patientReportSecondaryContext } from './patient-report-types';

describe('patient report display names', () => {
  const report = {
    reportName: 'Annual blood panel',
    originalFilename: 'source.pdf',
    reportType: 'LAB_RESULTS' as const,
    reportDate: '2026-09-04',
    providerLaboratory: 'City Lab',
    createdAt: '2026-09-05T08:00:00Z',
  };

  it('preserves a patient supplied recognizable title', () => {
    expect(patientReportDisplayName(report)).toBe('Annual blood panel');
  });

  it('uses a readable source filename instead of an internal identifier', () => {
    expect(
      patientReportDisplayName({
        ...report,
        reportName: '22222222-2222-2222-2222-222222222222',
        originalFilename: 'annual_blood-panel.pdf',
      }),
    ).toBe('annual blood panel');
  });

  it('does not make a screenshot filename the primary medical identity', () => {
    expect(
      patientReportDisplayName({
        ...report,
        reportName: '33806e7015fbfcaf33806e7015fbfcaf',
        originalFilename: 'Screenshot 2026-09-07 113913.png',
      }),
    ).toMatch(/^Laboratory results · /);
  });

  it('falls back to a provider when no report date is available', () => {
    expect(
      patientReportDisplayName({
        ...report,
        reportName: '',
        originalFilename: 'scan0001.pdf',
        reportDate: null,
      }),
    ).toBe('Laboratory results · City Lab');
  });

  it('recognizes common technical and capture names', () => {
    expect(looksLikeOpaqueReportName('22222222-2222-2222-2222-222222222222')).toBe(true);
    expect(looksLikeOpaqueReportName('Screenshot 2026 09 07 113913')).toBe(true);
    expect(looksLikeOpaqueReportName('Dengue follow-up')).toBe(false);
  });

  it('does not repeat missing-date noise and uses upload date only as secondary context', () => {
    const context = patientReportSecondaryContext({
      ...report,
      reportDate: null,
      providerLaboratory: null,
    });
    expect(context).toHaveLength(1);
    expect(context[0]).toMatch(/^Uploaded /);
  });
  it('treats common phone/scanner capture names and timestamp-only names as technical provenance', () => {
    expect(looksLikeOpaqueReportName('WhatsApp Image 20260907 113913')).toBe(true);
    expect(looksLikeOpaqueReportName('CamScanner 20260907 113913')).toBe(true);
    expect(looksLikeOpaqueReportName('20260907_113913')).toBe(true);
    expect(looksLikeOpaqueReportName('Thyroid follow-up')).toBe(false);
  });

  it('does not repeat a clinical date that is already used in the derived title', () => {
    const technical = {
      ...report,
      reportName: '33806e7015fbfcaf33806e7015fbfcaf',
      originalFilename: 'Screenshot 2026 09 07 113913.png',
      reportDate: '2026-09-07',
      providerLaboratory: 'City Lab',
      createdAt: '2026-09-08T08:00:00Z',
    };
    expect(patientReportDisplayName(technical)).toMatch(/^Laboratory results · /);
    expect(patientReportSecondaryContext(technical)).toEqual(['City Lab']);
  });

});
