import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientPortalPage } from '../../pages/patient/patient-portal-page';
import type { TimelineEvent } from '../patient-record/patient-record-api';
import { MedicalReportsHero, RecentHealthActivity } from './patient-home';
import type { PatientDashboard } from './patient-types';

const mocks = vi.hoisted(() => ({
  dashboard: vi.fn(),
  profile: vi.fn(),
  appointments: vi.fn(),
  timeline: vi.fn(),
  history: vi.fn(),
  portal: vi.fn(),
}));

vi.mock('../../components/landing/biomedical-background', () => ({
  BiomedicalBackground: () => <div data-testid="patient-report-visual" aria-hidden="true" />,
}));

vi.mock('../patient/patient-api', () => ({
  patientApi: { dashboard: mocks.dashboard, profile: mocks.profile },
  patientErrorMessage: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
}));

vi.mock('../appointments/appointment-api', () => ({
  appointmentApi: { list: mocks.appointments },
}));

vi.mock('../patient-record/patient-record-api', () => ({
  patientRecordApi: { timeline: mocks.timeline, history: mocks.history },
}));

vi.mock('../patient/patient-portal-api', () => ({
  patientPortalApi: { summary: mocks.portal },
}));

vi.mock('../patient-reports/patient-report-upload-dialog', () => ({
  PatientReportUploadDialog: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" aria-label="Upload medical report" /> : null,
}));

const dashboard: PatientDashboard = {
  firstName: 'Pia',
  lastName: 'Patient',
  profileCreated: true,
  profileCompletenessPercent: 100,
  missingProfileFields: [],
  bloodGroup: 'O_POSITIVE',
  dateOfBirth: '1998-05-10',
  heightCm: 165,
  weightKg: 60,
  bmi: 22,
  allergyCount: 1,
  chronicConditionCount: 1,
  medicationCount: 1,
  emergencyContactConfigured: true,
  profileUpdatedAt: '2026-08-26T12:00:00Z',
  activeReportCount: 4,
  latestReport: {
    id: '33333333-3333-3333-3333-333333333333',
    reportName: '33806e7015fbcaff211',
    reportType: 'LAB_RESULTS',
    reportDate: null,
    providerLaboratory: null,
    uploadedAt: '2026-09-02T08:00:00Z',
  },
};

function section<T>(data: T) {
  return { data, loading: false, error: '', retry: vi.fn(async () => undefined) };
}

function renderReports(input: PatientDashboard = dashboard) {
  render(
    <MemoryRouter>
      <MedicalReportsHero section={section(input)} reducedMotion onUpload={vi.fn()} />
    </MemoryRouter>,
  );
}

describe('Patient Home professional refinement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dashboard.mockResolvedValue(dashboard);
    mocks.profile.mockResolvedValue(null);
    mocks.appointments.mockResolvedValue([]);
    mocks.timeline.mockResolvedValue({ items: [], hasMore: false, nextBefore: null, nextBeforeId: null });
    mocks.history.mockResolvedValue(null);
    mocks.portal.mockResolvedValue(null);
  });

  it('replaces an opaque identifier with real report metadata and a truthful upload date', () => {
    renderReports();

    expect(screen.queryByText('33806e7015fbcaff211')).not.toBeInTheDocument();
    expect(screen.getByText('Laboratory results')).toBeInTheDocument();
    expect(screen.getByText(/Uploaded.*Sep.*2.*2026/i)).toBeInTheDocument();
    expect(screen.queryByText(/complete blood count/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('patient-report-visual')).toBeInTheDocument();
  });

  it('preserves a meaningful report title and identifies a genuine report date', () => {
    renderReports({
      ...dashboard,
      latestReport: {
        ...dashboard.latestReport!,
        reportName: 'Annual blood panel',
        reportDate: '2026-08-25',
        providerLaboratory: 'City Diagnostic Centre',
      },
    });

    expect(screen.getByText('Annual blood panel')).toBeInTheDocument();
    expect(screen.getByText(/City Diagnostic Centre.*Report date.*Aug.*25.*2026/i)).toBeInTheDocument();
    expect(screen.queryByText(/Uploaded/i)).not.toBeInTheDocument();
  });

  it.each(['33333333-3333-4333-8333-333333333333', 'report_01hzy8q0m4yp7d2f9k6c'])(
    'replaces the generated report name %s without inventing a clinical classification',
    (reportName) => {
      renderReports({
        ...dashboard,
        latestReport: { ...dashboard.latestReport!, reportName, reportType: 'OTHER' },
      });

      expect(screen.queryByText(reportName)).not.toBeInTheDocument();
      expect(screen.getByText('Other medical report')).toBeInTheDocument();
      expect(screen.queryByText(/complete blood count|laboratory results/i)).not.toBeInTheDocument();
    },
  );

  it('removes transient extraction noise and links completed extraction to analysis', () => {
    const events: TimelineEvent[] = [
      {
        id: 'event-ready',
        eventType: 'REPORT_EXTRACTION_COMPLETED',
        category: 'REPORTS',
        sourceType: 'MEDICAL_REPORT',
        sourceId: 'report-1',
        title: 'Report data ready for review',
        detail: 'Some extracted values should be checked against the original report.',
        occurredAt: '2026-09-02T08:20:00Z',
      },
      {
        id: 'event-requested',
        eventType: 'REPORT_EXTRACTION_REQUESTED',
        category: 'REPORTS',
        sourceType: 'MEDICAL_REPORT',
        sourceId: 'report-1',
        title: 'Report data extraction requested',
        detail: 'Clinora queued this report for secure information extraction.',
        occurredAt: '2026-09-02T08:10:00Z',
      },
    ];

    render(
      <MemoryRouter>
        <RecentHealthActivity section={section(events)} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Report data ready for review')).toBeInTheDocument();
    expect(screen.queryByText('Report data extraction requested')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open analysis/i })).toHaveAttribute('href', '/patient/analyze/report-1');
  });

  it('does not create an analysis action without a report identifier', () => {
    render(
      <MemoryRouter>
        <RecentHealthActivity
          section={section([
            {
              id: 'event-ready',
              eventType: 'REPORT_EXTRACTION_COMPLETED',
              category: 'REPORTS',
              sourceType: 'MEDICAL_REPORT',
              sourceId: null,
              title: 'Report data ready for review',
              detail: null,
              occurredAt: '2026-09-02T08:20:00Z',
            },
          ])}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: /open analysis/i })).not.toBeInTheDocument();
  });

  it('does not expose an opaque report identifier in Recent Health Activity', () => {
    render(
      <MemoryRouter>
        <RecentHealthActivity
          section={section([
            {
              id: 'event-uploaded',
              eventType: 'REPORT_UPLOADED',
              category: 'REPORTS',
              sourceType: 'MEDICAL_REPORT',
              sourceId: 'report-1',
              title: 'Medical report uploaded',
              detail: '33806e7015fbcaff211',
              occurredAt: '2026-09-02T08:00:00Z',
            },
          ])}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Medical report uploaded')).toBeInTheDocument();
    expect(screen.getByText('Medical report')).toBeInTheDocument();
    expect(screen.queryByText('33806e7015fbcaff211')).not.toBeInTheDocument();
  });

  it('shows only the three most recent meaningful Home events', () => {
    const events: TimelineEvent[] = Array.from({ length: 4 }, (_, index) => ({
      id: `event-${index + 1}`,
      eventType: 'REPORT_UPLOADED',
      category: 'REPORTS',
      sourceType: 'MEDICAL_REPORT',
      sourceId: `report-${index + 1}`,
      title: `Meaningful event ${index + 1}`,
      detail: null,
      occurredAt: `2026-09-0${4 - index}T08:00:00Z`,
    }));

    render(
      <MemoryRouter>
        <RecentHealthActivity section={section(events)} />
      </MemoryRouter>,
    );

    const activity = screen.getByRole('list', { name: 'Recent health activity' });
    expect(within(activity).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByText('Meaningful event 4')).not.toBeInTheDocument();
  });

  it('keeps the primary analysis route and opens the existing upload dialog', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <PatientPortalPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Analyze a report' })).toHaveAttribute('href', '/patient/analyze');
    await user.click(screen.getByRole('button', { name: 'Upload new report' }));
    expect(screen.getByRole('dialog', { name: 'Upload medical report' })).toBeInTheDocument();
    expect(mocks.timeline).toHaveBeenCalledWith({ limit: 6 });
  });
});
