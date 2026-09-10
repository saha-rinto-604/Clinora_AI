import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../App';
import { useAuthStore } from '../../features/auth/auth-store';

const mocks = vi.hoisted(() => ({
  appointment: vi.fn(),
  appointments: vi.fn(),
  availability: vi.fn(),
  compareReports: vi.fn(),
  dashboard: vi.fn(),
  reportContent: vi.fn(),
  reportReview: vi.fn(),
  sessions: vi.fn(),
}));

vi.mock('../../features/auth/auth-api', () => ({
  apiClient: {},
  apiErrorMessage: (_error: unknown, fallback: string) => fallback,
  authApi: {
    bootstrap: vi.fn(),
    changePassword: vi.fn(),
    logout: vi.fn(),
    revokeOtherSessions: vi.fn(),
    revokeSession: vi.fn(),
    sessions: mocks.sessions,
  },
}));

vi.mock('../../features/doctor/doctor-api', () => ({
  doctorApi: {
    appointment: mocks.appointment,
    appointments: mocks.appointments,
    compareReports: mocks.compareReports,
    dashboard: mocks.dashboard,
    downloadReport: vi.fn(),
    reportContent: mocks.reportContent,
    reportReview: mocks.reportReview,
    reviewObservation: vi.fn(),
  },
  doctorError: (_error: unknown, fallback: string) => fallback,
}));

vi.mock('../../features/appointments/appointment-api', () => ({
  appointmentError: (_error: unknown, fallback: string) => fallback,
  doctorAvailabilityApi: {
    create: vi.fn(),
    list: mocks.availability,
    remove: vi.fn(),
  },
}));

const appointment = {
  id: '11111111-1111-1111-1111-111111111111',
  status: 'BOOKED' as const,
  reason: 'Review recent blood tests',
  scheduledStart: '2026-09-12T08:00:00Z',
  scheduledEnd: '2026-09-12T08:30:00Z',
  timezone: 'Asia/Dhaka',
  canModify: true,
  reportAccessActive: true,
  patient: {
    id: '22222222-2222-2222-2222-222222222222',
    displayName: 'Rumana Akter',
    dateOfBirth: '1992-04-18',
    gender: 'FEMALE',
    bloodGroup: 'B_POSITIVE',
    allergies: [],
    chronicConditions: [],
    currentMedications: [],
  },
  sharedReports: [],
};

const report = (id: string, name: string) => ({
  appointmentId: appointment.id,
  reportId: id,
  displayName: name,
  reportType: 'LAB_RESULTS',
  reportDate: '2026-09-01',
  providerLaboratory: 'Clinora Laboratory',
  mimeType: 'application/pdf',
  extractionReviewStatus: 'VERIFIED' as const,
  sharedAt: '2026-09-09T10:00:00Z',
  observations: [],
});

const doctor = {
  id: '33333333-3333-3333-3333-333333333333',
  firstName: 'Arafat',
  lastName: 'Hossain',
  email: 'arafat.hossain.doctor@clinora.test',
  role: 'DOCTOR',
  accountStatus: 'ACTIVE',
  emailVerified: true,
};

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('Doctor route integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ status: 'authenticated', accessToken: 'token', user: doctor });
    mocks.appointments.mockResolvedValue({ items: [], limit: 20, offset: 0, hasMore: false });
    mocks.availability.mockResolvedValue([]);
    mocks.appointment.mockResolvedValue(appointment);
    mocks.dashboard.mockResolvedValue({
      doctor: {
        id: doctor.id,
        displayName: 'Dr. Arafat Hossain',
        professionalTitle: 'Consultant Physician',
        specialization: 'Internal Medicine',
        currentOrganization: 'Clinora Medical Centre',
        currentPosition: 'Consultant',
      },
      profileCompletion: 60,
      todayCount: 0,
      upcomingCount: 0,
      sharedReportsForUpcomingCare: 0,
      availableSlotCount: 0,
      nextAvailableAt: null,
      nextAppointment: null,
      today: [],
    });
    mocks.reportReview.mockResolvedValue(report('44444444-4444-4444-4444-444444444444', 'Complete Blood Count'));
    mocks.compareReports.mockResolvedValue({
      left: report('44444444-4444-4444-4444-444444444444', 'Complete Blood Count'),
      right: report('55555555-5555-5555-5555-555555555555', 'Metabolic Profile'),
    });
    mocks.reportContent.mockResolvedValue({
      blob: new Blob(['%PDF-1.4\n%%EOF'], { type: 'application/pdf' }),
      contentType: 'application/pdf',
    });
    mocks.sessions.mockResolvedValue([]);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:doctor-shared-report'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  });

  it('renders the Doctor dashboard at /doctor inside one Doctor shell', async () => {
    renderRoute('/doctor');
    expect(await screen.findByRole('heading', { name: 'Good to see you, Arafat Hossain' })).toBeInTheDocument();
    expect(screen.getAllByRole('navigation', { name: 'Doctor navigation' })).toHaveLength(1);
    expect(screen.getAllByRole('navigation', { name: 'Doctor mobile navigation' })).toHaveLength(1);
  });

  it.each([
    ['/doctor/schedule', 'Appointments'],
    ['/doctor/availability', 'Booking times'],
    [`/doctor/appointments/${appointment.id}`, 'Rumana Akter'],
    [`/doctor/appointments/${appointment.id}/reports/44444444-4444-4444-4444-444444444444`, 'Complete Blood Count'],
    [
      `/doctor/appointments/${appointment.id}/reports/compare?left=44444444-4444-4444-4444-444444444444&right=55555555-5555-5555-5555-555555555555`,
      'Compare structured results',
    ],
  ])('renders %s through the Doctor route tree', async (path, heading) => {
    renderRoute(path);
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getAllByRole('navigation', { name: 'Doctor navigation' })).toHaveLength(1);
  });

  it('keeps Account & Security reachable inside exactly one Doctor shell', async () => {
    renderRoute('/account');
    expect(await screen.findByRole('heading', { name: 'Account & Security' })).toBeInTheDocument();
    expect(screen.getAllByRole('navigation', { name: 'Doctor navigation' })).toHaveLength(1);
    expect(screen.getAllByRole('navigation', { name: 'Doctor mobile navigation' })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: 'Home' })).toHaveLength(2);
    screen.getAllByRole('link', { name: 'Home' }).forEach((link) => expect(link).toHaveAttribute('href', '/doctor'));
  });
});
