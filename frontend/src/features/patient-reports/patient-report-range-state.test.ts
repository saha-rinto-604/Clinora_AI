import { describe, expect, it } from 'vitest';
import type { PatientReportObservation } from './patient-report-extraction-types';
import { patientObservationRangeState } from './patient-report-range-state';

function numericObservation(overrides: Partial<PatientReportObservation>): PatientReportObservation {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    sourceLabel: 'Verified test',
    label: 'Verified test',
    valueType: 'NUMERIC',
    numericValue: 1,
    textValue: null,
    comparator: null,
    unit: null,
    referenceRangeRaw: null,
    referenceLow: null,
    referenceHigh: null,
    derivedRangeFlag: null,
    sourceFlag: null,
    pageNumber: 1,
    boundingBox: null,
    confidence: 0.99,
    reviewRequired: false,
    verificationStatus: 'PATIENT_CONFIRMED',
    ...overrides,
  };
}

describe('patientObservationRangeState', () => {
  it('preserves R4 ranges with scientific unit exponents and verified short flags', () => {
    expect(patientObservationRangeState(numericObservation({ numericValue: 90, referenceRangeRaw: '150-400 x10^9/L' }))).toBe('LOW');
    expect(patientObservationRangeState(numericObservation({ numericValue: 5, referenceRangeRaw: '4-11 10³/uL' }))).toBe('IN_RANGE');
    expect(patientObservationRangeState(numericObservation({ sourceFlag: 'H' }))).toBe('HIGH');
    expect(patientObservationRangeState(numericObservation({ sourceFlag: 'L' }))).toBe('LOW');
    expect(patientObservationRangeState(numericObservation({ numericValue: 5, referenceRangeRaw: '4-11 18 years' }))).toBe('REPORTED');
  });
  it('understands one-sided upper reference expressions without inventing assay semantics', () => {
    expect(patientObservationRangeState(numericObservation({ numericValue: 2.95, referenceRangeRaw: '< 1.00 Ratio' }))).toBe(
      'HIGH',
    );
    expect(patientObservationRangeState(numericObservation({ numericValue: 0.15, referenceRangeRaw: '< 1.00 Ratio' }))).toBe(
      'IN_RANGE',
    );
  });

  it('understands ordinary numeric intervals with thousands separators', () => {
    expect(
      patientObservationRangeState(numericObservation({ numericValue: 3700, referenceRangeRaw: '4,000 - 11,000 /cmm' })),
    ).toBe('LOW');
    expect(
      patientObservationRangeState(numericObservation({ numericValue: 6000, referenceRangeRaw: '4,000–11,000 /cmm' })),
    ).toBe('IN_RANGE');
  });

  it('understands lower-threshold references', () => {
    expect(patientObservationRangeState(numericObservation({ numericValue: 3, referenceRangeRaw: '> 5' }))).toBe('LOW');
    expect(patientObservationRangeState(numericObservation({ numericValue: 6, referenceRangeRaw: '> 5' }))).toBe('IN_RANGE');
  });

  it('leaves complex qualitative multi-cutoff references reported rather than guessing', () => {
    expect(
      patientObservationRangeState(
        numericObservation({
          numericValue: 1.1,
          referenceRangeRaw: 'Negative <1.0; equivocal 1.0-1.2; positive >1.2',
        }),
      ),
    ).toBe('REPORTED');
  });

  it('allows scientific unit powers without treating them as additional range cutoffs', () => {
    for (const referenceRangeRaw of ['4-11 x10^9/L', '4-11 ×10⁹/L', '4-11 10^3/uL']) {
      expect(patientObservationRangeState(numericObservation({ numericValue: 3, referenceRangeRaw }))).toBe('LOW');
      expect(patientObservationRangeState(numericObservation({ numericValue: 6, referenceRangeRaw }))).toBe('IN_RANGE');
    }
  });

  it('honors verified derived flags before conflicting source flags and accepts short source flags', () => {
    expect(patientObservationRangeState(numericObservation({ derivedRangeFlag: 'WITHIN_REPORTED_RANGE', sourceFlag: 'HIGH' }))).toBe('IN_RANGE');
    expect(patientObservationRangeState(numericObservation({ sourceFlag: 'H' }))).toBe('HIGH');
    expect(patientObservationRangeState(numericObservation({ sourceFlag: 'L' }))).toBe('LOW');
  });

  it('keeps structured bounds and verified flags authoritative over raw text', () => {
    expect(
      patientObservationRangeState(
        numericObservation({ numericValue: 7, referenceHigh: 10, referenceRangeRaw: '< 5' }),
      ),
    ).toBe('IN_RANGE');
    expect(
      patientObservationRangeState(
        numericObservation({ numericValue: 7, derivedRangeFlag: 'ABOVE_REPORTED_RANGE', referenceRangeRaw: '< 10' }),
      ),
    ).toBe('HIGH');
  });
});
