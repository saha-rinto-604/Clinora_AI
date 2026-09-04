import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PatientReportExtraction } from '../../features/patient-reports/patient-report-extraction-types';
import type { PatientReport, PatientReportPage } from '../../features/patient-reports/patient-report-types';
import { PatientReportAnalysisPage } from './patient-report-analysis-page';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  content: vi.fn(),
  getExtraction: vi.fn(),
  startExtraction: vi.fn(),
  correctExtraction: vi.fn(),
  confirmObservation: vi.fn(),
  confirmExtraction: vi.fn(),
}));

vi.mock('../../features/patient-reports/patient-report-api', () => ({
  patientReportApi: { list: mocks.list, detail: mocks.detail, content: mocks.content },
  patientReportErrorMessage: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
}));

vi.mock('../../features/patient-reports/patient-report-extraction-api', () => ({
  patientReportExtractionApi: {
    get: mocks.getExtraction,
    start: mocks.startExtraction,
    correct: mocks.correctExtraction,
    confirmObservation: mocks.confirmObservation,
    confirm: mocks.confirmExtraction,
  },
  patientReportExtractionErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

vi.mock('../../features/patient-reports/patient-report-upload-dialog', () => ({
  PatientReportUploadDialog: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" aria-label="Upload medical report" /> : null,
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

const reportPage: PatientReportPage = {
  items: [report],
  page: 1,
  size: 8,
  totalItems: 1,
  totalPages: 1,
  hasPrevious: false,
  hasNext: false,
  activeCount: 1,
  archivedCount: 0,
};

const extraction: PatientReportExtraction = {
  reportId: report.id,
  jobId: '33333333-3333-3333-3333-333333333333',
  status: 'SUCCEEDED',
  resultId: '44444444-4444-4444-4444-444444444444',
  documentType: 'LAB_REPORT',
  pageCount: 1,
  overallConfidence: 0.94,
  reviewStatus: 'REVIEW_REQUIRED',
  failureCode: null,
  requestedAt: '2026-08-30T08:01:00Z',
  startedAt: '2026-08-30T08:01:01Z',
  completedAt: '2026-08-30T08:01:03Z',
  observations: [
    {
      id: '55555555-5555-5555-5555-555555555555',
      sourceLabel: 'MCHC',
      label: 'MCHC',
      valueType: 'NUMERIC',
      numericValue: 37.5,
      textValue: null,
      comparator: null,
      unit: 'g/dL',
      referenceRangeRaw: '31.5 - 34.5',
      referenceLow: 31.5,
      referenceHigh: 34.5,
      sourceFlag: null,
      derivedRangeFlag: 'ABOVE_REPORTED_RANGE',
      pageNumber: 1,
      boundingBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.04 },
      confidence: 0.99,
      reviewRequired: false,
      verificationStatus: 'UNREVIEWED',
    },
    {
      id: '66666666-6666-6666-6666-666666666666',
      sourceLabel: 'MPV',
      label: 'MPV',
      valueType: 'NUMERIC',
      numericValue: 8,
      textValue: null,
      comparator: null,
      unit: 'fL',
      referenceRangeRaw: null,
      referenceLow: null,
      referenceHigh: null,
      sourceFlag: null,
      derivedRangeFlag: null,
      pageNumber: 1,
      boundingBox: { x: 0.1, y: 0.3, width: 0.3, height: 0.04 },
      confidence: 0.81,
      reviewRequired: true,
      verificationStatus: 'UNREVIEWED',
    },
  ],
};

function renderStart() {
  return render(
    <MemoryRouter initialEntries={['/patient/analyze']}>
      <Routes>
        <Route path="/patient/analyze" element={<PatientReportAnalysisPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderWorkspace() {
  return render(
    <MemoryRouter initialEntries={[`/patient/analyze/${report.id}`]}>
      <Routes>
        <Route path="/patient/analyze/:reportId" element={<PatientReportAnalysisPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Phase 9P-R2 Patient report analysis UX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue(reportPage);
    mocks.detail.mockResolvedValue(report);
    mocks.content.mockResolvedValue(new Blob(['image'], { type: 'image/png' }));
    mocks.getExtraction.mockResolvedValue(extraction);
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:cbc-report') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  });

  it('offers one compact start surface with working upload and existing-report actions', async () => {
    const user = userEvent.setup();
    renderStart();

    expect(await screen.findByRole('heading', { name: 'Analyze a medical report' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Start with your report' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Choose existing/i })).toHaveAttribute('href', '#existing-reports');
    expect(await screen.findByText('CBC report')).toBeInTheDocument();
    expect(screen.queryByText(report.id)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Upload report' }));
    expect(screen.getByRole('dialog', { name: 'Upload medical report' })).toBeInTheDocument();
  });

  it('keeps compact observations selectable, editable, and connected to the source', async () => {
    const user = userEvent.setup();
    renderWorkspace();

    expect(await screen.findByRole('heading', { name: 'Review what Clinora read' })).toBeInTheDocument();
    expect(screen.getAllByText('Reference on report')).toHaveLength(3);
    expect(screen.getByText('Not confidently captured — compare with source')).toBeInTheDocument();
    expect(screen.queryByText('Reference range not available on this report')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Result 37.5; report reference range/i)).not.toBeInTheDocument();

    await user.click(screen.getByText('MCHC').closest('button')!);
    expect(screen.getByText('Source for MCHC · page 1')).toBeInTheDocument();
    expect(screen.getByLabelText(/Result 37.5; report reference range 31.5 to 34.5/i)).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Edit result' })[0]);
    expect(screen.getByText('What Clinora originally extracted')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save correction' })).toBeInTheDocument();
  });

  it('keeps unresolved review requirements visible and blocks confirmation', async () => {
    renderWorkspace();

    expect(await screen.findByText('1 needs review')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Looks correct' })).toBeInTheDocument();
    expect(screen.getByText('Needs review')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm extracted results' })).toBeDisabled();
    await waitFor(() => expect(mocks.getExtraction).toHaveBeenCalledWith(report.id));
  });

  it('confirms a flagged value unchanged and updates the unresolved count without reloading', async () => {
    const user = userEvent.setup();
    const flagged = Array.from({ length: 4 }, (_, index) => ({
      ...extraction.observations[1],
      id: `${index + 1}6666666-6666-6666-6666-666666666666`,
    }));
    const fourUnresolved = { ...extraction, observations: [extraction.observations[0], ...flagged] };
    const threeUnresolved: PatientReportExtraction = {
      ...fourUnresolved,
      observations: [
        extraction.observations[0],
        { ...flagged[0], reviewRequired: false, verificationStatus: 'PATIENT_CONFIRMED' },
        ...flagged.slice(1),
      ],
    };
    let resolveConfirmation!: (value: PatientReportExtraction) => void;
    mocks.getExtraction.mockResolvedValue(fourUnresolved);
    mocks.confirmObservation.mockReturnValue(
      new Promise<PatientReportExtraction>((resolve) => {
        resolveConfirmation = resolve;
      }),
    );
    renderWorkspace();

    expect(await screen.findByText('4 need review')).toBeInTheDocument();
    const looksCorrect = screen.getAllByRole('button', { name: 'Looks correct' })[0];
    await user.click(looksCorrect);
    expect(screen.getByRole('button', { name: 'Confirming…' })).toBeDisabled();
    expect(mocks.confirmObservation).toHaveBeenCalledWith(report.id, flagged[0].id);

    resolveConfirmation(threeUnresolved);
    expect(await screen.findByText('3 need review')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.queryByText('4 need review')).not.toBeInTheDocument();
  });

  it('enables final confirmation when every flagged value has been reviewed', async () => {
    mocks.getExtraction.mockResolvedValue({
      ...extraction,
      reviewStatus: 'READY_FOR_CONFIRMATION',
      observations: extraction.observations.map((observation) => ({
        ...observation,
        reviewRequired: false,
        verificationStatus: 'PATIENT_CONFIRMED',
      })),
    });
    renderWorkspace();

    expect(await screen.findByText('All flagged values have been reviewed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm extracted results' })).toBeEnabled();
  });

  it('opens the dedicated AI insight experience only after report verification', async () => {
    mocks.getExtraction.mockResolvedValue({
      ...extraction,
      reviewStatus: 'VERIFIED',
      observations: extraction.observations.map((observation) => ({
        ...observation,
        reviewRequired: false,
        verificationStatus: 'PATIENT_CONFIRMED',
      })),
    });
    renderWorkspace();

    const link = await screen.findByRole('link', { name: /Open AI insight/i });
    expect(link).toHaveAttribute('href', `/patient/analyze/${report.id}/insight`);
    expect(screen.queryByRole('heading', { name: 'AI report insight' })).not.toBeInTheDocument();
  });

  it('renders the compact analysis start without automated accessibility violations', async () => {
    const { container } = renderStart();
    await screen.findByText('CBC report');
    expect(await axe(container)).toHaveNoViolations();
  });
});
