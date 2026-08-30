import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PatientReport, PatientReportPage } from '../../features/patient-reports/patient-report-types';
import { PatientReportDetailPage } from './patient-report-detail-page';
import { PatientReportsPage } from './patient-reports-page';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  upload: vi.fn(),
  update: vi.fn(),
  archive: vi.fn(),
  restore: vi.fn(),
  content: vi.fn(),
  download: vi.fn(),
}));

vi.mock('../../features/patient-reports/patient-report-api', () => ({
  patientReportApi: mocks,
  patientReportErrorMessage: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
}));

const report: PatientReport = {
  id: '22222222-2222-2222-2222-222222222222',
  reportName: 'Annual blood panel',
  reportType: 'LAB_RESULTS',
  reportDate: '2026-08-25',
  providerLaboratory: 'City Diagnostic Centre',
  originalFilename: 'annual-blood-panel.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 245760,
  archived: false,
  archivedAt: null,
  createdAt: '2026-08-30T08:00:00Z',
  updatedAt: '2026-08-30T08:00:00Z',
};

const reportPage: PatientReportPage = {
  items: [report],
  page: 1,
  size: 12,
  totalItems: 1,
  totalPages: 1,
  hasPrevious: false,
  hasNext: false,
  activeCount: 1,
  archivedCount: 0,
};

function renderReportsPage() {
  return render(
    <MemoryRouter>
      <PatientReportsPage />
    </MemoryRouter>,
  );
}

function renderDetailPage() {
  return render(
    <MemoryRouter initialEntries={[`/patient/reports/${report.id}`]}>
      <Routes>
        <Route path="/patient/reports/:reportId" element={<PatientReportDetailPage />} />
        <Route path="/patient/reports" element={<div>Medical report library</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Phase 5B Patient report vault', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue(reportPage);
    mocks.detail.mockResolvedValue(report);
    mocks.upload.mockResolvedValue(report);
    mocks.update.mockResolvedValue(report);
    mocks.archive.mockResolvedValue({ ...report, archived: true, archivedAt: '2026-08-30T09:00:00Z' });
    mocks.restore.mockResolvedValue(report);
    mocks.content.mockResolvedValue(new Blob(['%PDF-1.7\n%%EOF'], { type: 'application/pdf' }));
    mocks.download.mockResolvedValue(new Blob(['%PDF-1.7\n%%EOF'], { type: 'application/pdf' }));
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:secure-report') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  });

  it('presents a useful report library with real metadata, filters, and open action', async () => {
    renderReportsPage();

    expect(await screen.findByRole('heading', { name: 'Medical reports' })).toBeInTheDocument();
    expect(await screen.findByText('Annual blood panel')).toBeInTheDocument();
    expect(screen.getAllByText('Laboratory results').length).toBeGreaterThan(1);
    expect(screen.getByText('City Diagnostic Centre')).toBeInTheDocument();
    expect(screen.getByText(/PDF · 240 KB/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open/i })).toHaveAttribute('href', `/patient/reports/${report.id}`);
    expect(screen.getByRole('searchbox', { name: /search medical reports/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/filter by report type/i)).toBeInTheDocument();
    expect(screen.queryByText(/AI analysis|OCR result|doctor review/i)).not.toBeInTheDocument();
  });

  it('uses a focused first-use experience without empty library controls or duplicate upload actions', async () => {
    mocks.list.mockResolvedValue({
      ...reportPage,
      items: [],
      totalItems: 0,
      totalPages: 0,
      activeCount: 0,
      archivedCount: 0,
    });
    renderReportsPage();

    expect(await screen.findByRole('heading', { name: 'Add your first medical report' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Choose a report' })).toHaveLength(1);
    expect(screen.queryByRole('searchbox', { name: /search medical reports/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/filter by report type/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /current/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/report library|private report vault/i)).not.toBeInTheDocument();
  });

  it('provides distinct no-results and archived-empty states after reports exist', async () => {
    const user = userEvent.setup();
    mocks.list.mockImplementation(async ({ query, collection }) => ({
      ...reportPage,
      items: query || collection === 'ARCHIVED' ? [] : [report],
      totalItems: query || collection === 'ARCHIVED' ? 0 : 1,
      totalPages: query || collection === 'ARCHIVED' ? 0 : 1,
    }));
    renderReportsPage();

    await screen.findByText('Annual blood panel');
    await user.type(screen.getByRole('searchbox', { name: /search medical reports/i }), 'missing');
    expect(await screen.findByText('No matching reports')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await screen.findByText('Annual blood panel');
    await user.click(screen.getByRole('tab', { name: /Archived/i }));
    expect(await screen.findByText('Archive is empty')).toBeInTheDocument();
  });

  it('uploads only useful metadata with genuine progress and refreshes the library', async () => {
    const user = userEvent.setup();
    mocks.list.mockResolvedValue({
      ...reportPage,
      items: [],
      totalItems: 0,
      totalPages: 0,
      activeCount: 0,
      archivedCount: 0,
    });
    mocks.upload.mockImplementation(async (_input, onProgress?: (percent: number) => void) => {
      onProgress?.(42);
      onProgress?.(100);
      return report;
    });
    renderReportsPage();

    await user.click(await screen.findByRole('button', { name: 'Choose a report' }));
    const dialog = screen.getByRole('dialog', { name: 'Upload medical report' });
    const file = new File(['%PDF-1.7\n%%EOF'], 'annual-blood-panel.pdf', { type: 'application/pdf' });
    await user.upload(within(dialog).getByLabelText('Report file'), file);
    expect(within(dialog).getByLabelText('Report name')).toHaveValue('annual blood panel');
    await user.selectOptions(within(dialog).getByLabelText('Report type'), 'LAB_RESULTS');
    await user.type(within(dialog).getByLabelText(/provider or laboratory/i), 'City Diagnostic Centre');
    await user.click(within(dialog).getByRole('button', { name: 'Upload report' }));

    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(1));
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        reportName: 'annual blood panel',
        reportType: 'LAB_RESULTS',
        providerLaboratory: 'City Diagnostic Centre',
        file,
      }),
      expect.any(Function),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Upload medical report' })).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(mocks.list.mock.calls.length).toBeGreaterThan(1));
  });

  it('keeps the document preview primary and metadata/actions secondary', async () => {
    renderDetailPage();

    expect(await screen.findByRole('heading', { name: 'Annual blood panel' })).toBeInTheDocument();
    expect(await screen.findByTitle('Preview of Annual blood panel')).toHaveAttribute(
      'src',
      expect.stringContaining('blob:secure-report'),
    );
    expect(screen.getByRole('heading', { name: 'Document preview' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Report details' })).toBeInTheDocument();
    expect(screen.getAllByText('annual-blood-panel.pdf').length).toBeGreaterThan(1);
    expect(mocks.content).toHaveBeenCalledWith(report.id);
    expect(screen.queryByText(/AI analysis|doctor review|share with/i)).not.toBeInTheDocument();
  });

  it('edits metadata and archives through clear confirmation without deleting the file', async () => {
    const user = userEvent.setup();
    const updated = { ...report, reportName: 'Updated blood panel' };
    mocks.update.mockResolvedValue(updated);
    renderDetailPage();
    await screen.findByRole('heading', { name: 'Annual blood panel' });

    await user.click(screen.getByRole('button', { name: 'Edit details' }));
    const editDialog = screen.getByRole('dialog', { name: 'Edit report details' });
    const name = within(editDialog).getByLabelText('Report name');
    await user.clear(name);
    await user.type(name, 'Updated blood panel');
    await user.click(within(editDialog).getByRole('button', { name: 'Save details' }));
    expect(await screen.findByRole('heading', { name: 'Updated blood panel' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'More report actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Archive report' }));
    const archiveDialog = screen.getByRole('dialog', { name: 'Archive this report?' });
    await user.click(within(archiveDialog).getByRole('button', { name: 'Archive report' }));
    expect(await screen.findByText(/preserved in your archive/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument();
    expect(mocks.archive).toHaveBeenCalledWith(report.id);
  });

  it('renders the report library without automated accessibility violations', async () => {
    const { container } = renderReportsPage();
    await screen.findByText('Annual blood panel');
    expect(await axe(container)).toHaveNoViolations();
  });
});
