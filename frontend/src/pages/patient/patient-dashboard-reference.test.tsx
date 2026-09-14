import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientPortalPage } from './patient-portal-r3-page';

const mocks = vi.hoisted(() => ({
  dashboard: vi.fn(),
  profile: vi.fn(),
  care: vi.fn(),
  timeline: vi.fn(),
  record: vi.fn(),
  sharing: vi.fn(),
  trends: vi.fn(),
}));
vi.mock('../../features/patient/patient-api', () => ({
  patientApi: { dashboard: mocks.dashboard, profile: mocks.profile },
  patientErrorMessage: (_: unknown, fallback: string) => fallback,
}));
vi.mock('../../features/appointments/appointment-api', () => ({ appointmentApi: { list: mocks.care } }));
vi.mock('../../features/patient-record/patient-record-api', () => ({
  patientRecordApi: { timeline: mocks.timeline, history: mocks.record, healthTrends: mocks.trends },
}));
vi.mock('../../features/patient/patient-portal-api', () => ({ patientPortalApi: { summary: mocks.sharing } }));
vi.mock('../../features/patient-reports/patient-report-upload-dialog', () => ({
  PatientReportUploadDialog: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" aria-label="Upload report" /> : null,
}));

describe('Patient reference dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dashboard.mockResolvedValue({ firstName: 'Test Patient', activeReportCount: 7 });
    mocks.profile.mockResolvedValue({ firstName: 'Test Patient', completenessPercent: 60 });
    mocks.care.mockResolvedValue([]);
    mocks.timeline.mockResolvedValue({ items: [] });
    mocks.record.mockResolvedValue({
      currentMeasurements: { heightCm: null, weightKg: null, bmi: null },
      clinicalEssentials: { allergies: [], conditions: [], medications: [] },
    });
    mocks.sharing.mockResolvedValue({ unreadNotifications: 0, care: { activeReportShareCount: 0, doctorCount: 0 } });
    mocks.trends.mockResolvedValue({ points: [] });
  });

  it('renders one cinematic video, four API metrics, and a single heading per dashboard card', async () => {
    const view = render(
      <MemoryRouter>
        <PatientPortalPage />
      </MemoryRouter>,
    );
    await screen.findByText('7');
    expect(view.container.querySelectorAll('video')).toHaveLength(1);
    expect(view.container.querySelectorAll('img')).toHaveLength(0);
    expect(view.container.querySelector('video source')).toHaveAttribute(
      'src',
      '/assets/biomedical/clinora-core-home-cinematic.mp4',
    );
    expect(view.container.querySelector('video')).toHaveAttribute(
      'poster',
      '/assets/biomedical/clinora-core-home-cinematic-poster.webp',
    );
    const metrics = screen.getByRole('region', { name: 'Patient home overview' });
    expect(within(metrics).getAllByRole('link')).toHaveLength(4);
    expect(within(metrics).getByText('60%')).toBeInTheDocument();
    for (const name of [
      'Upcoming Care',
      'Recent Health Activity',
      'Next Appointment',
      'Quick Actions',
      'Health Insights',
      'Privacy & Sharing',
    ])
      expect(screen.getAllByRole('heading', { name })).toHaveLength(1);
    expect(screen.queryByRole('img', { name: /observations/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/blood pressure|sleep|heart rate|AI insights ready/i)).not.toBeInTheDocument();
  });

  it('keeps the existing actions and keyboard search functional', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <PatientPortalPage />
      </MemoryRouter>,
    );
    await screen.findByText('7');
    expect(screen.getByRole('link', { name: 'Analyze a report' })).toHaveAttribute('href', '/patient/analyze');
    expect(screen.getByRole('link', { name: 'Explore Blood Network' })).toHaveAttribute(
      'href',
      '/patient/blood-network',
    );
    await user.click(screen.getByRole('button', { name: 'Upload a report' }));
    expect(screen.getByRole('dialog', { name: 'Upload report' })).toBeInTheDocument();
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('does not show failed counts as real zeros or manufacture a graph when history fails', async () => {
    mocks.dashboard.mockRejectedValue(new Error('offline'));
    mocks.trends.mockRejectedValue(new Error('offline'));
    render(
      <MemoryRouter>
        <PatientPortalPage />
      </MemoryRouter>,
    );
    const metric = screen.getByRole('link', { name: /Active Reports/ });
    await waitFor(() => expect(metric).toHaveTextContent('Currently unavailable'));
    expect(within(metric).getByText('—')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /observations/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Measurement history unavailable/ })).toBeInTheDocument();
  });
});
