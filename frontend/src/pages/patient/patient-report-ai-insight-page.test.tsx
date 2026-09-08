import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PatientReportAiAnalysis, PatientReportAiClinicalCluster } from '../../features/patient-reports/patient-report-ai-types';
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
    expect(screen.getByText('Verified report')).toBeInTheDocument();
    expect(screen.getByText('Clinical correlation')).toBeInTheDocument();
    expect(screen.getByText('Evidence grounding')).toBeInTheDocument();
    expect(screen.getByText('Safety checked result')).toBeInTheDocument();
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

const thyroidObservations = [
  { ...extraction.observations[1], id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', label: 'TSH', numericValue: 0.1, unit: 'mIU/L', referenceLow: 0.4, referenceHigh: 4, referenceRangeRaw: '0.4 - 4' },
  { ...extraction.observations[1], id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', label: 'Free T4', numericValue: 2.8, unit: 'ng/dL', referenceLow: 0.8, referenceHigh: 1.8, referenceRangeRaw: '0.8 - 1.8' },
];

const redCellCluster: PatientReportAiClinicalCluster = {
  title: 'Red-cell pattern',
  interpretation: 'These findings may reflect reduced iron availability for red-cell production.',
  evidence: [
    { observationId: extraction.observations[1].id, role: 'SUPPORTS', clinicalRelevance: 'Reduced hemoglobin can reflect impaired oxygen-carrying capacity.' },
    { observationId: extraction.observations[2].id, role: 'SUPPORTS', clinicalRelevance: 'Smaller red cells help characterize the pattern.' },
    { observationId: extraction.observations[0].id, role: 'CONTEXT', clinicalRelevance: 'The lymphocyte count provides context without supporting a red-cell cause.' },
  ],
  candidates: [{
    name: 'Iron-deficiency anemia',
    rationale: 'Reduced hemoglobin with small red cells may fit limited iron availability.',
    supportingObservationIds: [extraction.observations[1].id, extraction.observations[2].id],
    contradictoryObservationIds: [],
    missingEvidence: ['Ferritin and iron studies'],
    alternatives: ['Thalassemia trait'],
  }],
  missingEvidence: [],
  alternatives: [],
};

const thyroidCluster: PatientReportAiClinicalCluster = {
  title: 'Thyroid hormone pattern',
  interpretation: 'The reduced TSH and raised Free T4 may reflect thyroid hormone excess.',
  evidence: [
    { observationId: thyroidObservations[0].id, role: 'SUPPORTS', clinicalRelevance: 'Reduced TSH can accompany feedback from thyroid hormone excess.' },
    { observationId: thyroidObservations[1].id, role: 'SUPPORTS', clinicalRelevance: 'Raised free hormone provides a related finding.' },
  ],
  candidates: [{
    name: 'Thyroid hormone excess',
    rationale: 'These related hormone findings may fit an independent thyroid process.',
    supportingObservationIds: thyroidObservations.map((observation) => observation.id),
    contradictoryObservationIds: [],
    missingEvidence: ['Symptoms and thyroid medication history'],
    alternatives: ['Assay interference'],
  }],
  missingEvidence: [],
  alternatives: [],
};

function useClusters(clinicalClusters: PatientReportAiClinicalCluster[]) {
  mocks.getAi.mockResolvedValue({
    ...conditionSucceeded,
    result: {
      ...conditionSucceeded.result!,
      clinicalClusters,
      overallInterpretation: 'There may be independent clinical processes in this report; each needs its own clinical context.',
      promptVersion: 'patient-lab-report-v5',
      schemaVersion: '1.1',
    },
  });
}

describe('Phase 10P-R5 cluster-first interpretation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.detail.mockResolvedValue(report);
    mocks.getExtraction.mockResolvedValue({ ...extraction, observations: [...extraction.observations, ...thyroidObservations] });
  });

  it('shows independent clinical clusters before the verified report summary and keeps their evidence separate', async () => {
    useClusters([redCellCluster, thyroidCluster]);
    const { container } = renderPage();
    expect(await screen.findByRole('heading', { name: 'Your report contains 2 clinically related patterns.' })).toBeInTheDocument();
    const redCell = screen.getByRole('article', { name: 'Clinical cluster 1: Red-cell pattern' });
    const thyroid = screen.getByRole('article', { name: 'Clinical cluster 2: Thyroid hormone pattern' });
    expect(within(redCell).getByText('Hemoglobin')).toBeInTheDocument();
    expect(within(redCell).queryByText('TSH')).not.toBeInTheDocument();
    expect(within(thyroid).getByText('TSH')).toBeInTheDocument();
    expect(within(thyroid).queryByText('Hemoglobin')).not.toBeInTheDocument();
    expect(within(thyroid).getByText('0.1 mIU/L')).toBeInTheDocument();
    expect(within(thyroid).getByText('Reference 0.4 - 4')).toBeInTheDocument();
    expect(within(thyroid).getByText('Lower than expected')).toBeInTheDocument();
    const summary = screen.getByRole('heading', { name: 'Verified report summary' });
    expect(thyroid.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container).not.toHaveTextContent(/MedGemma/i);
    expect(container).not.toHaveTextContent(/Â|â€|Ã‚/);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('represents two candidates within one cluster with their own missing context', async () => {
    useClusters([{
      ...redCellCluster,
      candidates: [redCellCluster.candidates[0], {
        ...redCellCluster.candidates[0],
        name: 'Thalassemia trait',
        rationale: 'An inherited red-cell process is another possible explanation.',
        missingEvidence: ['Family history and hemoglobin studies'],
        alternatives: [],
      }],
    }]);
    renderPage();
    const cluster = await screen.findByRole('article', { name: 'Clinical cluster 1: Red-cell pattern' });
    const alternatives = within(cluster).getAllByRole('region', { name: /^Possible condition:/ });
    expect(alternatives).toHaveLength(2);
    expect(within(alternatives[0]).getByText('Ferritin and iron studies')).toBeInTheDocument();
    expect(within(alternatives[1]).getByText('Family history and hemoglobin studies')).toBeInTheDocument();
  });

  it('preserves a pattern-only clinical interpretation without adding a condition', async () => {
    useClusters([{ ...redCellCluster, candidates: [], missingEvidence: ['Previous comparable results'] }]);
    renderPage();
    const cluster = await screen.findByRole('article', { name: 'Clinical cluster 1: Red-cell pattern' });
    expect(within(cluster).getByText(redCellCluster.interpretation)).toBeInTheDocument();
    expect(within(cluster).getByText('Verified support')).toBeInTheDocument();
    expect(within(cluster).queryByText('Possible condition')).not.toBeInTheDocument();
    expect(screen.queryByText('Iron-deficiency anemia')).not.toBeInTheDocument();
  });

  it('keeps normal context separate from support and hides references missing from the verified report', async () => {
    useClusters([{
      ...redCellCluster,
      evidence: [...redCellCluster.evidence, { observationId: 'unknown-id', role: 'SUPPORTS', clinicalRelevance: 'This unknown evidence must not be rendered.' }],
      candidates: [{ ...redCellCluster.candidates[0], supportingObservationIds: [...redCellCluster.candidates[0].supportingObservationIds, 'unknown-id'] }],
    }]);
    renderPage();
    const cluster = await screen.findByRole('article', { name: 'Clinical cluster 1: Red-cell pattern' });
    expect(within(cluster).getByText('Iron-deficiency anemia')).toBeInTheDocument();
    expect(within(cluster).getByText('Other verified context')).toBeInTheDocument();
    expect(within(cluster).getByText('Within expected range')).toBeInTheDocument();
    expect(within(cluster).queryByText(/unknown evidence/)).not.toBeInTheDocument();
  });

  it('shows contradictory evidence only when provided and grounded', async () => {
    useClusters([{
      ...redCellCluster,
      evidence: redCellCluster.evidence.map((item) => item.role === 'CONTEXT' ? { ...item, role: 'CONTRADICTS' } : item),
      candidates: [{ ...redCellCluster.candidates[0], contradictoryObservationIds: [extraction.observations[0].id] }],
    }]);
    renderPage();
    const cluster = await screen.findByRole('article', { name: 'Clinical cluster 1: Red-cell pattern' });
    expect(within(cluster).getByText('What does not fully match')).toBeInTheDocument();
    expect(within(cluster).getByText('Absolute Lymphocytes')).toBeInTheDocument();
    expect(within(cluster).getByText('Within expected range')).toBeInTheDocument();
  });

  it('treats explicit empty clusters as authoritative and does not revive legacy candidates', async () => {
    useClusters([]);
    renderPage();
    expect(await screen.findByRole('heading', { name: 'More context is needed to interpret these findings.' })).toBeInTheDocument();
    expect(screen.queryByText('Iron-deficiency anemia')).not.toBeInTheDocument();
    expect(screen.queryByRole('article', { name: /^Clinical cluster/ })).not.toBeInTheDocument();
  });

  it('shows a no-clear-pattern result for a mostly normal verified report without inventing a condition', async () => {
    mocks.getExtraction.mockResolvedValue({ ...extraction, observations: [extraction.observations[0]] });
    mocks.getAi.mockResolvedValue({ ...noConditionSucceeded, result: { ...noConditionSucceeded.result!, schemaVersion: '1.1', clinicalClusters: [], overallInterpretation: 'No coherent abnormal pattern is apparent in the verified findings.' } });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'No clear abnormal pattern stands out in this verified report.' })).toBeInTheDocument();
    expect(screen.queryByText('Possible condition')).not.toBeInTheDocument();
    expect(screen.getByText('2000 /cumm')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Verified report summary' })).toBeInTheDocument();
  });

  it('preserves historical conditions when backend serializes absent v1.0 clusters as an empty list', async () => {
    mocks.getAi.mockResolvedValue({
      ...conditionSucceeded,
      result: { ...conditionSucceeded.result!, schemaVersion: '1.0', clinicalClusters: [], overallInterpretation: null },
    });
    renderPage();
    expect(await screen.findByText('Iron-deficiency anemia')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Possible conditions to discuss' })).toBeInTheDocument();
  });
});


describe('Phase 10P-R5.1 grounded display', () => {
  it('uses the neutral display title and keeps all 17 unclassified context cards visible after downgrade', async () => {
    vi.clearAllMocks();
    mocks.detail.mockResolvedValue(report);
    const pdw = { ...extraction.observations[1], id: 'pdw-verified', label: 'PDW', numericValue: 19, unit: 'fL', referenceLow: 9, referenceHigh: 17, referenceRangeRaw: '9 - 17', derivedRangeFlag: 'HIGH' };
    const context = Array.from({ length: 17 }, (_, index) => ({
      ...extraction.observations[1], id: `context-${index}`, label: `Context measurement ${index + 1}`,
      numericValue: 8.2 + index, referenceLow: null, referenceHigh: null, referenceRangeRaw: null,
      derivedRangeFlag: null, sourceFlag: null,
    }));
    mocks.getExtraction.mockResolvedValue({ ...extraction, observations: [pdw, ...context] });
    useClusters([{
      title: 'Old unvalidated model title', displayTitle: 'PDW + related findings pattern',
      interpretation: 'These hematology findings warrant review together, but unavailable reference information limits their classification.',
      evidence: [
        { observationId: pdw.id, role: 'SUPPORTS', supportEligibility: 'VERIFIED_ABNORMAL', clinicalRelevance: 'Size variation warrants clinical correlation.' },
        ...context.map((item) => ({ observationId: item.id, role: 'CONTEXT' as const, supportEligibility: 'UNKNOWN' as const, clinicalRelevance: 'Report-specific range status is unavailable.' })),
      ], candidates: [], missingEvidence: ['Usable report-specific references'], alternatives: [],
    }]);
    renderPage();
    const group = await screen.findByRole('article', { name: 'Clinical cluster 1: PDW + related findings pattern' });
    expect(within(group).getByRole('heading', { name: 'PDW + related findings pattern' })).toBeInTheDocument();
    expect(screen.queryByText('Old unvalidated model title')).not.toBeInTheDocument();
    expect(within(group).getAllByText('Range status unavailable')).toHaveLength(17);
    expect(within(group).getByText('Other verified context')).toBeInTheDocument();
    expect(within(group).getByText('19 fL')).toBeInTheDocument();
    expect(within(group).getByText('Reference 9 - 17')).toBeInTheDocument();
    expect(within(group).queryByText('Possible condition')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Verified report summary' })).toBeInTheDocument();
  });
});
