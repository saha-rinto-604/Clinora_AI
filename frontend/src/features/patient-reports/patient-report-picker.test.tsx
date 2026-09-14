import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { PatientReportPicker } from './patient-report-picker';
import type { PatientReport } from './patient-report-types';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  content: vi.fn(),
  update: vi.fn(),
}));

vi.mock('./patient-report-api', () => ({
  patientReportApi: mocks,
  patientReportErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

const reports: PatientReport[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    reportName: '33806e7015fbfcaf33806e7015fbfcaf',
    reportType: 'LAB_RESULTS',
    reportDate: '2026-09-07',
    providerLaboratory: 'City Lab',
    originalFilename: 'Screenshot 2026 09 07 113913.png',
    mimeType: 'image/png',
    sizeBytes: 2048,
    archived: false,
    archivedAt: null,
    createdAt: '2026-09-08T08:00:00Z',
    updatedAt: '2026-09-08T08:00:00Z',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    reportName: 'Thyroid follow-up',
    reportType: 'LAB_RESULTS',
    reportDate: '2026-08-18',
    providerLaboratory: 'Square Hospital',
    originalFilename: 'thyroid-results.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 4096,
    archived: false,
    archivedAt: null,
    createdAt: '2026-08-19T08:00:00Z',
    updatedAt: '2026-08-19T08:00:00Z',
  },
];

function Harness({ initialSelected = [] }: { initialSelected?: PatientReport[] }) {
  const [selected, setSelected] = useState<PatientReport[]>(initialSelected);
  return <PatientReportPicker selectedReports={selected} onChange={setSelected} />;
}

describe('PatientReportPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue({
      items: reports,
      page: 1,
      size: 12,
      totalItems: 2,
      totalPages: 1,
      hasPrevious: false,
      hasNext: false,
      activeCount: 2,
      archivedCount: 0,
    });
  });

  it('presents medical context instead of requiring the Patient to recognize a hash or screenshot filename', async () => {
    render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Choose reports' }));

    expect(await screen.findByText(/Laboratory results ·/)).toBeInTheDocument();
    expect(screen.getByText('Thyroid follow-up')).toBeInTheDocument();
    expect(screen.queryByText('33806e7015fbfcaf33806e7015fbfcaf')).not.toBeInTheDocument();
    expect(screen.queryByText('Screenshot 2026 09 07 113913.png')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Preview' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Edit title' })).toHaveLength(2);
  });

  it('keeps selection human-readable outside the picker', async () => {
    render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Choose reports' }));
    const selectButtons = await screen.findAllByRole('button', { name: 'Select' });
    fireEvent.click(selectButtons[1]);
    fireEvent.click(screen.getByRole('button', { name: /Done · 1 selected/ }));

    expect(screen.getByText('1 report selected')).toBeInTheDocument();
    expect(screen.getByText('Thyroid follow-up')).toBeInTheDocument();
  });

  it('searches the server-side report collection instead of filtering only the currently rendered page', async () => {
    render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Choose reports' }));
    await screen.findByText('Thyroid follow-up');
    fireEvent.change(screen.getByLabelText('Search medical reports'), { target: { value: 'thyroid' } });

    await waitFor(() =>
      expect(mocks.list).toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'ACTIVE', page: 1, size: 12, query: 'thyroid' }),
      ),
    );
  });

  it('mirrors the API limit instead of letting the Patient select an invalid twenty-first report', async () => {
    const fullSelection = Array.from({ length: 20 }, (_, index) => ({
      ...reports[1],
      id: `selected-${index}`,
      reportName: `Report ${index + 1}`,
    }));
    render(
      <MemoryRouter>
        <Harness initialSelected={fullSelection} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Change reports' }));
    expect(await screen.findByText('20 of 20 selected for this appointment')).toBeInTheDocument();
    await screen.findByText('Thyroid follow-up');
    const limitButtons = screen.getAllByRole('button', { name: 'Limit reached' });
    expect(limitButtons.length).toBeGreaterThan(0);
    limitButtons.forEach((button) => expect(button).toBeDisabled());
  });

});
