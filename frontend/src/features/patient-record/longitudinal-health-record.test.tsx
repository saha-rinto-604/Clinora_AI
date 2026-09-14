import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HealthMeasurement, LongitudinalHealthRecord } from './longitudinal-health-api';
import { LongitudinalHealthRecordSection } from './longitudinal-health-record';

const mocks = vi.hoisted(() => ({ load: vi.fn() }));

vi.mock('./longitudinal-health-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./longitudinal-health-api')>();
  return {
    ...actual,
    longitudinalHealthApi: {
      ...actual.longitudinalHealthApi,
      load: mocks.load,
    },
  };
});

const record: LongitudinalHealthRecord = {
  snapshot: {
    reportsIncluded: 2,
    reliablyDatedReports: 1,
    dateUncertainReports: 1,
    trackedMeasurements: 9,
    healthAreas: 3,
    coverageFrom: '2026-01-10',
    coverageTo: '2026-09-10',
  },
  areas: [
    {
      code: 'BODY',
      title: 'Body & Vitals',
      measurements: [measurement('WEIGHT', 'Weight', 'BODY', 63, 'kg', { sourceType: 'PATIENT_PROFILE' })],
    },
    {
      code: 'HEMATOLOGY',
      title: 'Blood & Hematology',
      measurements: [
        measurement('PLATELET_COUNT', 'Platelet Count', 'HEMATOLOGY', 160, '10^9/L', { comparable: 3 }),
        measurement('HEMOGLOBIN', 'Hemoglobin', 'HEMATOLOGY', 13.8, 'g/dL'),
        measurement('WBC', 'White Blood Cell Count', 'HEMATOLOGY', 7.2, '10^9/L'),
        measurement('MCV', 'MCV', 'HEMATOLOGY', 82, 'fL'),
        measurement('MCH', 'MCH', 'HEMATOLOGY', 27, 'pg'),
        measurement('MCHC', 'MCHC', 'HEMATOLOGY', 36.5, 'g/dL', { comparable: 2 }),
        measurement('RDW', 'RDW', 'HEMATOLOGY', 13.2, '%'),
      ],
    },
    {
      code: 'GLUCOSE',
      title: 'Glucose & Metabolic',
      measurements: [measurement('HBA1C', 'HbA1c', 'GLUCOSE', 5.5, '%')],
    },
  ],
  highlights: [],
  sourceReports: [
    {
      reportId: 'report-1',
      reportName: 'CBC',
      reportType: 'LAB_REPORT',
      clinicalDate: '2026-09-10',
      displayDate: '2026-09-10',
      dateBasis: 'REPORT_DATE',
      providerLaboratory: 'Example Lab',
    },
  ],
  lastUpdatedAt: '2026-09-10T08:00:00Z',
};

function measurement(
  code: string,
  name: string,
  category: string,
  value: number,
  unit: string,
  options: { comparable?: number; sourceType?: 'MEDICAL_REPORT' | 'PATIENT_PROFILE' } = {},
): HealthMeasurement {
  const comparable = options.comparable ?? 1;
  const sourceType = options.sourceType ?? 'MEDICAL_REPORT';
  const points = comparable >= 2
    ? Array.from({ length: comparable }, (_, index) => ({
        date: `2026-0${index + 1}-10`,
        value: value + index,
        unit,
        sourceType,
        sourceId: `${code}-source-${index}`,
        reportId: sourceType === 'MEDICAL_REPORT' ? `report-${index + 1}` : null,
        reportName: sourceType === 'MEDICAL_REPORT' ? `Report ${index + 1}` : 'Health Profile',
        status: 'REPORTED' as const,
        referenceRangeRaw: null,
      }))
    : [];
  return {
    code,
    name,
    category,
    latest: {
      observationId: `${code}-observation`,
      sourceType,
      sourceId: `${code}-source`,
      reportId: sourceType === 'MEDICAL_REPORT' ? 'report-1' : null,
      reportName: sourceType === 'MEDICAL_REPORT' ? 'CBC' : 'Health Profile',
      reportType: sourceType === 'MEDICAL_REPORT' ? 'LAB_REPORT' : 'BODY_MEASUREMENT',
      providerLaboratory: sourceType === 'MEDICAL_REPORT' ? 'Example Lab' : null,
      date: '2026-09-10',
      displayDate: '2026-09-10',
      dateReliable: true,
      dateBasis: sourceType === 'MEDICAL_REPORT' ? 'REPORT_DATE' : 'PROFILE_RECORDED_AT',
      sourceLabel: name,
      valueType: 'NUMERIC',
      numericValue: value,
      textValue: null,
      comparator: null,
      unit,
      normalizedValue: value,
      normalizedUnit: unit,
      comparisonKey: unit,
      referenceRangeRaw: null,
      referenceLow: null,
      referenceHigh: null,
      status: 'REPORTED',
      verificationStatus: sourceType === 'MEDICAL_REPORT' ? 'PATIENT_CONFIRMED' : 'PROFILE_RECORDED',
      unitConvertedForTrend: false,
      updatedAt: '2026-09-10T08:00:00Z',
    },
    trend: {
      direction: comparable >= 2 ? 'INCREASING' : 'INSUFFICIENT_DATA',
      absoluteChange: comparable >= 2 ? comparable - 1 : null,
      percentageChange: comparable >= 2 ? 2 : null,
      comparableDataPoints: comparable,
      trendQualified: comparable >= 3,
      chartUnit: unit,
    },
    graph: {
      available: comparable >= 2,
      fullGraphAvailable: comparable >= 3,
      normalizedUnits: false,
      reason: comparable >= 2 ? null : 'Not enough comparable history yet.',
      points,
    },
    historyCount: Math.max(1, comparable),
  };
}

describe('LongitudinalHealthRecordSection', () => {
  beforeEach(() => {
    mocks.load.mockReset();
  });

  it('renders only returned health areas, integrates Body & Vitals, and starts without arbitrary selection', async () => {
    mocks.load.mockResolvedValue(record);

    render(<MemoryRouter><LongitudinalHealthRecordSection /></MemoryRouter>);

    expect(await screen.findByText('Body & Vitals')).toBeInTheDocument();
    expect(screen.getByText('Blood & Hematology')).toBeInTheDocument();
    expect(screen.getByText('Glucose & Metabolic')).toBeInTheDocument();
    expect(screen.queryByText('Kidney & Urine')).not.toBeInTheDocument();
    expect(screen.getByText('Select a measurement to view its history')).toBeInTheDocument();
  });

  it('makes trend/history selection explicit and distinguishes two-result change from qualified trend', async () => {
    const user = userEvent.setup();
    mocks.load.mockResolvedValue(record);
    render(<MemoryRouter><LongitudinalHealthRecordSection /></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: /MCHC/i }));
    expect(screen.getByText('Change between reliably dated results')).toBeInTheDocument();
    expect(screen.getByText('2 comparable results')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Platelet Count/i }));
    expect(screen.getByText('Trend across reliably dated results')).toBeInTheDocument();
  });

  it('limits dense categories until the patient chooses View all', async () => {
    const user = userEvent.setup();
    mocks.load.mockResolvedValue(record);
    render(<MemoryRouter><LongitudinalHealthRecordSection /></MemoryRouter>);

    expect(await screen.findByText('+ 1 more measurement')).toBeInTheDocument();
    expect(screen.queryByText('RDW')).not.toBeInTheDocument();
    await user.click(screen.getByText('+ 1 more measurement'));
    expect(screen.getByText('RDW')).toBeInTheDocument();
  });

  it('uses a focused automatic-record empty state instead of rendering empty categories', async () => {
    mocks.load.mockResolvedValue({
      snapshot: {
        reportsIncluded: 0,
        reliablyDatedReports: 0,
        dateUncertainReports: 0,
        trackedMeasurements: 0,
        healthAreas: 0,
        coverageFrom: null,
        coverageTo: null,
      },
      areas: [],
      highlights: [],
      sourceReports: [],
      lastUpdatedAt: null,
    } satisfies LongitudinalHealthRecord);

    render(<MemoryRouter><LongitudinalHealthRecordSection /></MemoryRouter>);

    expect(await screen.findByText('No eligible longitudinal health data yet')).toBeInTheDocument();
    expect(screen.queryByText('Blood & Hematology')).not.toBeInTheDocument();
  });
});
