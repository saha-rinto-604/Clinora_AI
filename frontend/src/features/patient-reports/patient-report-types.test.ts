import { describe, expect, it } from 'vitest';
import { patientReportDisplayName } from './patient-report-types';

describe('patient report display names', () => {
  const report = { reportName: 'Annual blood panel', originalFilename: 'source.pdf', reportType: 'LAB_RESULTS' as const };

  it('preserves the patient supplied name', () => {
    expect(patientReportDisplayName(report)).toBe('Annual blood panel');
  });

  it('uses a readable source filename instead of an internal identifier', () => {
    expect(patientReportDisplayName({ ...report, reportName: '22222222-2222-2222-2222-222222222222', originalFilename: 'annual_blood-panel.pdf' })).toBe('annual blood panel');
  });

  it('falls back to the report type when both names are internal identifiers', () => {
    expect(patientReportDisplayName({ ...report, reportName: '', originalFilename: '22222222-2222-2222-2222-222222222222.pdf' })).toBe('Laboratory results');
  });
});
