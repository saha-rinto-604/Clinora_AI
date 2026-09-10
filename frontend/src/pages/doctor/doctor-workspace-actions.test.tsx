import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DoctorAppointmentSummary, DoctorReportReview } from '../../features/doctor/doctor-api';
import { DoctorDashboardPage } from './doctor-dashboard-page';
import { DoctorReportComparePage } from './doctor-report-compare-page';
import { DoctorSchedulePage } from './doctor-schedule-page';

const mocks = vi.hoisted(() => ({
  dashboard: vi.fn(),
  appointments: vi.fn(),
  compareReports: vi.fn(),
}));

vi.mock('../../features/doctor/doctor-api', () => ({
  doctorApi: {
    dashboard: mocks.dashboard,
    appointments: mocks.appointments,
    compareReports: mocks.compareReports,
  },
  doctorError: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
}));

const firstAppointment: DoctorAppointmentSummary = {
  id: '11111111-1111-1111-1111-111111111111',
  patientId: '21111111-1111-1111-1111-111111111111',
  patientName: 'Rumana Akter',
  scheduledStart: '2026-09-10T08:00:00Z',
  scheduledEnd: '2026-09-10T08:30:00Z',
  timezone: 'Asia/Dhaka',
  status: 'BOOKED',
  reason: 'Review recent blood tests',
  sharedReportCount: 1,
};

const secondAppointment: DoctorAppointmentSummary = {
  ...firstAppointment,
  id: '12222222-2222-2222-2222-222222222222',
  patientId: '22222222-2222-2222-2222-222222222222',
  patientName: 'Fahim Rahman',
  scheduledStart: '2026-09-11T08:00:00Z',
  scheduledEnd: '2026-09-11T08:30:00Z',
};

const report = (id: string, name: string): DoctorReportReview => ({
  appointmentId: firstAppointment.id,
  reportId: id,
  displayName: name,
  reportType: 'LAB_RESULTS',
  reportDate: '2026-09-01',
  providerLaboratory: 'Dhaka Central Diagnostic Laboratory',
  mimeType: 'application/pdf',
  extractionReviewStatus: 'VERIFIED',
  sharedAt: '2026-09-09T10:00:00Z',
  observations: [],
});

describe('Phase 6 Doctor workspace hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads additional schedule pages instead of silently truncating appointments', async () => {
    const user = userEvent.setup();
    mocks.appointments
      .mockResolvedValueOnce({ items: [firstAppointment], limit: 20, offset: 0, hasMore: true })
      .mockResolvedValueOnce({ items: [secondAppointment], limit: 20, offset: 1, hasMore: false });

    render(
      <MemoryRouter initialEntries={['/doctor/schedule?scope=upcoming']}>
        <DoctorSchedulePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Rumana Akter')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Fahim Rahman')).toBeInTheDocument();
    expect(mocks.appointments).toHaveBeenNthCalledWith(2, 'upcoming', 20, 1);
  });

  it('uses neutral selection labels when report dates do not prove chronology', async () => {
    mocks.compareReports.mockResolvedValue({
      left: report('44444444-4444-4444-4444-444444444444', 'Complete Blood Count'),
      right: report('55555555-5555-5555-5555-555555555555', 'Metabolic Profile'),
    });

    render(
      <MemoryRouter
        initialEntries={[
          `/doctor/appointments/${firstAppointment.id}/reports/compare?left=44444444-4444-4444-4444-444444444444&right=55555555-5555-5555-5555-555555555555`,
        ]}
      >
        <Routes>
          <Route path="/doctor/appointments/:appointmentId/reports/compare" element={<DoctorReportComparePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('First report')).toBeInTheDocument();
    expect(screen.getByText('Second report')).toBeInTheDocument();
    expect(screen.queryByText(/earlier|later/i)).not.toBeInTheDocument();
  });

  it('labels an appointment in progress as the current Patient', async () => {
    const now = Date.now();
    mocks.dashboard.mockResolvedValue({
      doctor: {
        id: '33333333-3333-3333-3333-333333333333',
        displayName: 'Dr. Arafat Hossain',
        professionalTitle: 'Consultant Physician',
        specialization: 'Internal Medicine',
        currentOrganization: 'Dhaka Central Medical Centre',
        currentPosition: 'Consultant',
      },
      profileCompletion: 90,
      todayCount: 1,
      upcomingCount: 1,
      sharedReportsForUpcomingCare: 0,
      availableSlotCount: 2,
      nextAvailableAt: new Date(now + 86_400_000).toISOString(),
      nextAppointment: {
        ...firstAppointment,
        scheduledStart: new Date(now - 60_000).toISOString(),
        scheduledEnd: new Date(now + 60_000).toISOString(),
      },
      today: [],
    });

    render(
      <MemoryRouter>
        <DoctorDashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Current patient')).toBeInTheDocument();
    expect(screen.queryByText('Next patient')).not.toBeInTheDocument();
  });

  it('keeps the Doctor dashboard free of basic automated accessibility violations', async () => {
    mocks.dashboard.mockResolvedValue({
      doctor: {
        id: '33333333-3333-3333-3333-333333333333',
        displayName: 'Dr. Arafat Hossain',
        professionalTitle: 'Consultant Physician',
        specialization: 'Internal Medicine',
        currentOrganization: 'Dhaka Central Medical Centre',
        currentPosition: 'Consultant',
      },
      profileCompletion: 90,
      todayCount: 0,
      upcomingCount: 0,
      sharedReportsForUpcomingCare: 0,
      availableSlotCount: 0,
      nextAvailableAt: null,
      nextAppointment: null,
      today: [],
    });

    const { container } = render(
      <MemoryRouter>
        <DoctorDashboardPage />
      </MemoryRouter>,
    );
    await screen.findByText(/Good to see you/i);

    expect(await axe(container)).toHaveNoViolations();
  });
});
