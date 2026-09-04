import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PatientReportAiAnalysis } from '../../features/patient-reports/patient-report-ai-types';
import type { PatientReportExtraction } from '../../features/patient-reports/patient-report-extraction-types';
import type { PatientReport } from '../../features/patient-reports/patient-report-types';
import { PatientReportAiInsightPage } from './patient-report-ai-insight-page';

const mocks = vi.hoisted(() => ({
  detail: vi.fn(),
  getExtraction: vi.fn(),
  getAi: vi.fn(),
  requestAi: vi.fn(),
}));

vi.mock('../../features/patient-reports/patient-report-api', () => ({
  patientReportApi: { detail: mocks.detail },
}));

vi.mock('../../features/patient-reports/patient-report-extraction-api', () => ({
  patientReportExtractionApi: { get: mocks.getExtraction },
}));

vi.mock('../../features/patient-reports/patient-report-ai-api', () => ({
  patientReportAiApi: { get: mocks.getAi, request: mocks.requestAi },
  patientReportAiErrorMessage: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
}));

const report: PatientReport = {
  id: '22222222-2222-2222-2222-222222222222',
  reportName: 'CBC report',
  reportType: 'LAB_RESULTS',
  reportDate: '2026-08-25',
  providerLaboratory: 'City Diagnostic Centre',
  originalFilename: 'cbc-report.png',
  mimeType: 'image/png',
  sizeBytes: 245760,
  archived: false,
  archivedAt: null,
  createdAt: '2026-08-30T08:00:00Z',
  updatedAt: '2026-08-30T08:00:00Z',
};

const extraction: PatientReportExtraction = {
  reportId: report.id,
  jobId: '33333333-3333-3333-3333-333333333333',
  status: 'SUCCEEDED',
  resultId: '44444444-4444-4444-4444-444444444444',
  documentType: 'LAB_REPORT',
  pageCount: 1,
  overallConfidence: 0.94,
  reviewStatus: 'VERIFIED',
  failureCode: null,
  requestedAt: '2026-08-30T08:01:00Z',
  startedAt: '2026-08-30T08:01:01Z',
  completedAt: '2026-08-30T08:01:03Z',
  observations: [
    {
      id: '55555555-5555-5555-5555-555555555555',
      sourceLabel: 'Absolute Lymphocytes',
      label: 'Absolute Lymphocytes',
      valueType: 'NUMERIC',
      numericValue: 2000,
      textValue: null,
      comparator: null,
      unit: '/cumm',
      referenceRangeRaw: '1000 - 3000',
      referenceLow: 1000,
      referenceHigh: 3000,
      sourceFlag: null,
      derivedRangeFlag: 'WITHIN_REPORTED_RANGE',
      pageNumber: 1,
      boundingBox: null,
      confidence: 0.99,
      reviewRequired: false,
      verificationStatus: 'PATIENT_CONFIRMED',
    },
    {
      id: '66666666-6666-4666-8666-666666666666',
      sourceLabel: 'Hemoglobin',
      label: 'Hemoglobin',
      valueType: 'NUMERIC',
      numericValue: 9.8,
      textValue: null,
      comparator: null,
      unit: 'g/dL',
      referenceRangeRaw: '12.0 - 15.5',
      referenceLow: 12,
      referenceHigh: 15.5,
      sourceFlag: 'L',
      derivedRangeFlag: 'BELOW_REPORTED_RANGE',
      pageNumber: 1,
      boundingBox: null,
      confidence: 0.99,
      reviewRequired: false,
      verificationStatus: 'PATIENT_CONFIRMED',
    },
    {
      id: '99999999-9999-4999-8999-999999999999',
      sourceLabel: 'MCV',
      label: 'MCV',
      valueType: 'NUMERIC',
      numericValue: 76,
      textValue: null,
      comparator: null,
      unit: 'fL',
      referenceRangeRaw: '80 - 100',
      referenceLow: 80,
      referenceHigh: 100,
      sourceFlag: 'L',
      derivedRangeFlag: 'BELOW_REPORTED_RANGE',
      pageNumber: 1,
      boundingBox: null,
      confidence: 0.98,
      reviewRequired: false,
      verificationStatus: 'PATIENT_CONFIRMED',
    },
  ],
};

const notRequested: PatientReportAiAnalysis = {
  reportId: report.id,
  readyForAnalysis: true,
  readinessCode: null,
  jobId: null,
  status: 'NOT_REQUESTED',
  analysisId: null,
  analysisStatus: null,
  stale: false,
  result: null,
  failureCode: null,
  modelName: null,
  modelRevision: null,
  promptVersion: null,
  schemaVersion: null,
  requestedAt: null,
  startedAt: null,
  completedAt: null,
};

const queued: PatientReportAiAnalysis = {
  ...notRequested,
  jobId: '77777777-7777-7777-7777-777777777777',
  status: 'QUEUED',
  requestedAt: new Date().toISOString(),
};

const noConditionSucceeded: PatientReportAiAnalysis = {
  ...notRequested,
  jobId: '77777777-7777-7777-7777-777777777777',
  analysisId: '88888888-8888-8888-8888-888888888888',
  status: 'SUCCEEDED',
  analysisStatus: 'NO_CLEAR_ABNORMAL_PATTERN',
  result: {
    analysisStatus: 'NO_CLEAR_ABNORMAL_PATTERN',
    summary: 'Some verified findings are outside their supplied reference ranges, but no specific condition is responsibly supported yet.',
    notableFindings: [],
    clinicalPatterns: [],
    discussionPoints: [
      {
        type: 'CLINICAL_QUESTION',
        title: 'Ask how these verified findings fit your overall health',
        reason: 'A clinician can interpret the report together with symptoms, history, and other tests.',
      },
    ],
    patientExplanation:
      'The verified findings can relate to more than one red-cell process. The available report does not distinguish one cause strongly enough to name a specific condition.',
    limitations: ['This analysis uses only the patient-confirmed laboratory observations supplied to Clinora.'],
    modelName: 'google/medgemma-1.5-4b-it',
    modelRevision: 'main',
    promptVersion: 'patient-lab-report-v1',
    schemaVersion: '1.0',
  },
};

const conditionSucceeded: PatientReportAiAnalysis = {
  ...noConditionSucceeded,
  analysisStatus: 'POSSIBLE_CLINICAL_PATTERN',
  result: {
    ...noConditionSucceeded.result!,
    analysisStatus: 'POSSIBLE_CLINICAL_PATTERN',
    summary: 'This verified report contains a pattern that may be compatible with iron-deficiency anemia. This is a possible explanation, not a diagnosis.',
    clinicalPatterns: [
      {
        name: 'Iron-deficiency anemia',
        supportLevel: 'MODERATE',
        reasoning:
          "Clinora's verified evidence for this possibility includes Hemoglobin (lower than expected) and MCV (lower than expected). This pattern can occur when iron availability is insufficient for red-cell production, and additional context is needed to distinguish the cause. This is a possible interpretation, not a diagnosis.",
        supportingObservationIds: [extraction.observations[1].id, extraction.observations[2].id],
        contradictoryObservationIds: [],
        missingEvidence: ['Ferritin or iron studies', 'Symptoms, history and previous CBC results'],
        possibleCauses: ['Thalassemia trait'],
      },
    ],
    patientExplanation:
      'Clinora considered iron-deficiency anemia because of how the verified findings fit together. This pattern can occur when iron availability is insufficient for red-cell production, but additional context is needed.',
  },
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/patient/analyze/${report.id}/insight`]}>
      <Routes>
        <Route path="/patient/analyze/:reportId/insight" element={<PatientReportAiInsightPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Phase 10P-R clean grounded AI insight refinement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.detail.mockResolvedValue(report);
    mocks.getExtraction.mockResolvedValue(extraction);
    mocks.getAi.mockResolvedValue(notRequested);
    mocks.requestAi.mockResolvedValue(queued);
  });

  it('uses a clean verified-report processing experience without fake percentage progress', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Analyze verified report' }));

    expect(await screen.findByRole('heading', { name: 'Analyzing your verified report' })).toBeInTheDocument();
    expect(screen.getByText('Verified lab report')).toBeInTheDocument();
    expect(screen.getByText('AI reasoning + evidence')).toBeInTheDocument();
    expect(screen.getByText('Safety checked before display')).toBeInTheDocument();
    expect(screen.queryByText(/\b\d{1,3}%\b/)).not.toBeInTheDocument();
  });

  it('shows exact deterministic report counts and a useful pattern explanation when no condition is strong enough', async () => {
    mocks.getAi.mockResolvedValue(noConditionSucceeded);
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Your report shows a clinical pattern worth discussing.' })).toBeInTheDocument();
    expect(screen.getByText('Clinical pattern worth discussing')).toBeInTheDocument();
    expect(screen.getByText('02')).toBeInTheDocument();
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText(/more than one red-cell process/i)).toBeInTheDocument();
    expect(screen.getByText('Hemoglobin')).toBeInTheDocument();
    expect(screen.getByText('9.8 g/dL')).toBeInTheDocument();
    expect(screen.getByText('Lower than expected')).toBeInTheDocument();
  });

  it('shows possible conditions with reasoning, exact evidence, missing information, and alternatives', async () => {
    mocks.getAi.mockResolvedValue(conditionSucceeded);
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Your verified report may fit one or more possible conditions.' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Possible conditions to discuss' })).toBeInTheDocument();
    expect(screen.getByText('Iron-deficiency anemia')).toBeInTheDocument();
    expect(screen.getByText('Why this may fit')).toBeInTheDocument();
    expect(screen.getByText('Evidence from your verified report')).toBeInTheDocument();
    expect(screen.getByText('What information is still missing')).toBeInTheDocument();
    expect(screen.getByText('Other possibilities to consider')).toBeInTheDocument();
    expect(screen.getByText('9.8 g/dL')).toBeInTheDocument();
    expect(screen.getByText('76 fL')).toBeInTheDocument();
    expect(screen.queryByText(/report support/i)).not.toBeInTheDocument();
  });

  it('keeps the ready state accessible', async () => {
    const { container } = renderPage();
    await screen.findByRole('button', { name: 'Analyze verified report' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
