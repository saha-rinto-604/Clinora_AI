import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DoctorAppointmentDetail, DoctorDashboard, DoctorReportReview } from '../../features/doctor/doctor-api';
import { DoctorAppointmentPage } from './doctor-appointment-page';
import { DoctorDashboardPage } from './doctor-dashboard-page';
import { DoctorReportReviewPage } from './doctor-report-review-page';

const mocks = vi.hoisted(() => ({
  dashboard: vi.fn(),
  appointment: vi.fn(),
  appointments: vi.fn(),
  cancelAppointment: vi.fn(),
  rescheduleAppointment: vi.fn(),
  reportReview: vi.fn(),
  compareReports: vi.fn(),
  reviewObservation: vi.fn(),
  reportContent: vi.fn(),
  downloadReport: vi.fn(),
  availability: vi.fn(),
}));

vi.mock('../../features/doctor/doctor-api', () => ({
  doctorApi: {
    dashboard: mocks.dashboard,
    appointment: mocks.appointment,
    appointments: mocks.appointments,
    cancelAppointment: mocks.cancelAppointment,
    rescheduleAppointment: mocks.rescheduleAppointment,
    reportReview: mocks.reportReview,
    compareReports: mocks.compareReports,
    reviewObservation: mocks.reviewObservation,
    reportContent: mocks.reportContent,
    downloadReport: mocks.downloadReport,
  },
  doctorError: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
}));

vi.mock('../../features/appointments/appointment-api', () => ({
  doctorAvailabilityApi: { list: mocks.availability },
  appointmentError: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
}));

const appointment: DoctorAppointmentDetail = {
  id: '11111111-1111-1111-1111-111111111111',
  status: 'BOOKED',
  reason: 'Review recent fatigue and blood tests',
  scheduledStart: new Date(Date.now() + 3_600_000).toISOString(),
  scheduledEnd: new Date(Date.now() + 5_400_000).toISOString(),
  timezone: 'Asia/Dhaka',
  canModify: true,
  reportAccessActive: true,
  patient: {
    id: '22222222-2222-2222-2222-222222222222',
    displayName: 'Rumana Akter',
    dateOfBirth: '1992-04-18',
    gender: 'FEMALE',
    bloodGroup: 'B_POSITIVE',
    allergies: ['Penicillin'],
    chronicConditions: ['Iron-deficiency anaemia'],
    currentMedications: ['Ferrous sulfate'],
  },
  sharedReports: [],
};

const dashboard: DoctorDashboard = {
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
  upcomingCount: 2,
  sharedReportsForUpcomingCare: 1,
  availableSlotCount: 4,
  nextAvailableAt: '2026-09-11T08:00:00Z',
  nextAppointment: {
    id: appointment.id,
    patientId: appointment.patient.id,
    patientName: appointment.patient.displayName,
    scheduledStart: appointment.scheduledStart,
    scheduledEnd: appointment.scheduledEnd,
    timezone: appointment.timezone,
    status: 'BOOKED',
    reason: appointment.reason,
    sharedReportCount: 0,
  },
  today: [],
};

const reportReview: DoctorReportReview = {
  appointmentId: appointment.id,
  reportId: '44444444-4444-4444-4444-444444444444',
  displayName: 'Complete Blood Count',
  reportType: 'LAB_RESULTS',
  reportDate: '2026-08-23',
  providerLaboratory: 'Dhaka Central Diagnostic Laboratory',
  mimeType: 'application/pdf',
  extractionReviewStatus: 'VERIFIED',
  sharedAt: '2026-09-09T20:00:00Z',
  observations: [
    {
      id: '55555555-5555-5555-5555-555555555555',
      label: 'Hemoglobin',
      valueType: 'NUMERIC',
      displayValue: '11.2',
      comparator: null,
      unit: 'g/dL',
      referenceRange: '12.0 - 15.0',
      sourceFlag: 'L',
      derivedRangeFlag: 'BELOW_REPORTED_RANGE',
      pageNumber: 1,
      patientVerification: 'PATIENT_CONFIRMED',
      doctorDecision: null,
      doctorComment: null,
      resultStatus: 'OUTSIDE_RANGE',
    },
  ],
};

describe('Phase 6A–6C Doctor workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dashboard.mockResolvedValue(dashboard);
    mocks.appointment.mockResolvedValue(appointment);
    mocks.availability.mockResolvedValue([]);
    mocks.reportReview.mockResolvedValue(reportReview);
    mocks.downloadReport.mockResolvedValue(new Blob(['%PDF-1.4\n%%EOF'], { type: 'application/pdf' }));
    mocks.reportContent.mockResolvedValue({
      blob: new Blob(['%PDF-1.4\n%%EOF'], { type: 'application/pdf' }),
      contentType: 'application/pdf',
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:doctor-shared-report'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  });

  it('makes the next Patient the primary Doctor dashboard task instead of fake clinical alerts', async () => {
    render(
      <MemoryRouter>
        <DoctorDashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Rumana Akter')).toBeInTheDocument();
    expect(screen.getByText('Next patient')).toBeInTheDocument();
    expect(screen.getByText(/professional approval is already complete/i)).toBeInTheDocument();
    expect(screen.queryByText(/critical patient|risk score|health score/i)).not.toBeInTheDocument();
  });

  it('treats no report sharing as a valid consultation state and still shows minimized clinical context', async () => {
    render(
      <MemoryRouter initialEntries={[`/doctor/appointments/${appointment.id}`]}>
        <Routes>
          <Route path="/doctor/appointments/:appointmentId" element={<DoctorAppointmentPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Rumana Akter' })).toBeInTheDocument();
    expect(screen.getByText('Penicillin')).toBeInTheDocument();
    expect(screen.getByText('Ferrous sulfate')).toBeInTheDocument();
    expect(screen.getByText('No reports have been shared')).toBeInTheDocument();
    expect(screen.getByText(/continue the consultation without uploaded files/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Phone$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Address$/i)).not.toBeInTheDocument();
  });

  it('closes source-report navigation when the appointment is no longer active', async () => {
    mocks.appointment.mockResolvedValue({
      ...appointment,
      status: 'COMPLETED',
      canModify: false,
      reportAccessActive: false,
      sharedReports: [],
    });

    render(
      <MemoryRouter initialEntries={[`/doctor/appointments/${appointment.id}`]}>
        <Routes>
          <Route path="/doctor/appointments/:appointmentId" element={<DoctorAppointmentPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Source report access is closed')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /review/i })).not.toBeInTheDocument();
  });

  it('downloads only through the authorized Doctor report endpoint', async () => {
    const user = userEvent.setup();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(
      <MemoryRouter initialEntries={[`/doctor/appointments/${appointment.id}/reports/${reportReview.reportId}`]}>
        <Routes>
          <Route path="/doctor/appointments/:appointmentId/reports/:reportId" element={<DoctorReportReviewPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Complete Blood Count' });
    await user.click(screen.getByRole('button', { name: 'Download' }));

    expect(mocks.downloadReport).toHaveBeenCalledWith(appointment.id, reportReview.reportId);
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it('keeps the original shared report authoritative and never presents Clinora AI in the 6C review surface', async () => {
    render(
      <MemoryRouter initialEntries={[`/doctor/appointments/${appointment.id}/reports/${reportReview.reportId}`]}>
        <Routes>
          <Route path="/doctor/appointments/:appointmentId/reports/:reportId" element={<DoctorReportReviewPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Complete Blood Count' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Original report' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Structured results' })).toBeInTheDocument();
    expect(screen.getByText(/original report as the clinical source/i)).toBeInTheDocument();
    expect(screen.getByText('Hemoglobin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Looks correct' })).toBeInTheDocument();
    expect(screen.queryByText(/Clinora AI clinical reasoning|possible condition|AI insight/i)).not.toBeInTheDocument();
  });
});
