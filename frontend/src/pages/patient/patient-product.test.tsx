import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../../features/auth/auth-store';
import type { PatientDashboard, PatientProfile } from '../../features/patient/patient-types';
import type { HealthRecord, TimelineEvent } from '../../features/patient-record/patient-record-api';
import { PatientAppointmentsPage } from './patient-appointments-page';
import { PatientPortalPage } from './patient-portal-page';

const mocks = vi.hoisted(() => ({
  dashboard: vi.fn(),
  profile: vi.fn(),
  portal: vi.fn(),
  appointments: vi.fn(),
  timeline: vi.fn(),
  history: vi.fn(),
}));

vi.mock('../../features/patient/patient-api', () => ({
  patientApi: { dashboard: mocks.dashboard, profile: mocks.profile },
  patientErrorMessage: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
}));
vi.mock('../../features/patient/patient-portal-api', () => ({
  patientPortalApi: { summary: mocks.portal },
}));
vi.mock('../../features/appointments/appointment-api', () => ({
  appointmentApi: { list: mocks.appointments },
  appointmentError: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
}));
vi.mock('../../features/patient-record/patient-record-api', () => ({
  patientRecordApi: { timeline: mocks.timeline, history: mocks.history },
}));
vi.mock('../../features/patient-reports/patient-report-upload-dialog', () => ({
  PatientReportUploadDialog: () => null,
}));

const profile: PatientProfile = {
  id: '22222222-2222-2222-2222-222222222222',
  profileCreated: true,
  firstName: 'Pia',
  lastName: 'Patient',
  email: 'pia@example.test',
  dateOfBirth: '1998-05-10',
  gender: 'FEMALE',
  bloodGroup: 'O_POSITIVE',
  phone: '+8801700000000',
  address: 'Dhaka',
  heightCm: 165,
  weightKg: 60,
  familyMedicalHistory: 'Family history of hypertension',
  lifestyleInformation: 'Exercises regularly',
  emergencyContact: { name: 'Rina Patient', phone: '+8801800000000', relationship: 'Sibling', configured: true },
  allergies: ['Penicillin'],
  chronicConditions: ['Asthma'],
  currentMedications: ['Salbutamol'],
  completenessPercent: 100,
  missingProfileFields: [],
  updatedAt: '2026-08-30T12:00:00Z',
};

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
  profileUpdatedAt: '2026-08-30T12:00:00Z',
  activeReportCount: 2,
  latestReport: {
    id: '33333333-3333-3333-3333-333333333333',
    reportName: 'Annual blood panel',
    reportType: 'LAB_RESULTS',
    reportDate: '2026-08-25',
    providerLaboratory: 'City Diagnostic Centre',
    uploadedAt: '2026-08-30T08:00:00Z',
  },
};

const record: HealthRecord = {
  profile,
  clinicalEssentials: {
    allergies: [{ name: 'Penicillin', sourceType: 'PATIENT_PROFILE' }],
    conditions: [{ name: 'Asthma', sourceType: 'PATIENT_PROFILE' }],
    medications: [{ name: 'Salbutamol', sourceType: 'PATIENT_PROFILE' }],
  },
  currentMeasurements: {
    bloodGroup: 'O_POSITIVE',
    heightCm: 165,
    weightKg: 60,
    bmi: 22,
    sourceType: 'PATIENT_PROFILE',
  },
  recentReports: [],
  care: { nextAppointment: null, recentAppointments: [] },
  background: {
    familyMedicalHistory: profile.familyMedicalHistory,
    lifestyleInformation: profile.lifestyleInformation,
    sourceType: 'PATIENT_PROFILE',
  },
  lastUpdatedAt: '2026-08-30T12:00:00Z',
};

const timeline: TimelineEvent[] = [
  {
    id: '44444444-4444-4444-4444-444444444444',
    eventType: 'REPORT_UPLOADED',
    category: 'REPORTS',
    sourceType: 'PATIENT_REPORT',
    sourceId: dashboard.latestReport!.id,
    title: 'Medical report uploaded',
    detail: 'Annual blood panel',
    occurredAt: '2026-08-30T08:00:00Z',
  },
];

const appointment = {
  id: '55555555-5555-5555-5555-555555555555',
  status: 'BOOKED' as const,
  reasonForVisit: 'Follow-up',
  scheduledStart: '2026-09-01T04:30:00Z',
  scheduledEnd: '2026-09-01T05:00:00Z',
  bookingTimezone: 'Asia/Dhaka',
  bookedAt: '2026-08-30T09:00:00Z',
  cancelledAt: null,
  doctorId: '66666666-6666-6666-6666-666666666666',
  doctorName: 'Anika Rahman',
  specialization: 'Cardiology',
  sharedReportCount: 2,
};

function renderHome() {
  return render(
    <MemoryRouter>
      <PatientPortalPage />
    </MemoryRouter>,
  );
}

describe('Phase 5 Patient Home hybrid evolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'token',
      user: {
        id: '11111111-1111-1111-1111-111111111111',
        firstName: 'Pia',
        lastName: 'Patient',
        email: 'pia@example.test',
        role: 'PATIENT',
        accountStatus: 'ACTIVE',
        emailVerified: true,
      },
    });
    mocks.dashboard.mockResolvedValue(dashboard);
    mocks.profile.mockResolvedValue(profile);
    mocks.appointments.mockResolvedValue([]);
    mocks.timeline.mockResolvedValue({ items: timeline, hasMore: false, nextBefore: null, nextBeforeId: null });
    mocks.history.mockResolvedValue(record);
    mocks.portal.mockResolvedValue({
      care: { nextAppointment: null, activeReportShareCount: 0, doctorCount: 0 },
      recentHealthActivity: [],
      unreadNotifications: 0,
    });
  });

  it('renders the real greeting, verification state, approved hero, and exact biomedical visual', async () => {
    const { container } = renderHome();

    expect(await screen.findByRole('heading', { name: /good (morning|afternoon|evening), pia/i })).toBeInTheDocument();
    expect(screen.getByText('Verified Patient')).toBeInTheDocument();
    expect(screen.queryByText(/Anika(?!.+Rahman)/)).not.toBeInTheDocument();
    const reportsHero = screen.getByRole('heading', { name: 'Medical reports' }).closest('section')!;
    expect(reportsHero).toHaveAttribute('data-surface-variant', 'hero');
    expect(reportsHero.querySelector('[data-clinical-ambient-visual="patient-report"]')).toBeInTheDocument();
    expect(reportsHero.querySelectorAll('[data-depth-plane]')).toHaveLength(3);
    expect(container.querySelector('[data-health-insight-visual="biomarker-trend"]')).not.toBeInTheDocument();
  });

  it('renders real report data and the report routes inside the dominant hero', async () => {
    renderHome();

    expect((await screen.findAllByText('Annual blood panel')).length).toBeGreaterThan(0);
    expect(screen.getByText('2 active reports')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload report' })).toBeEnabled();
    expect(screen.getByRole('link', { name: /View all reports/i })).toHaveAttribute('href', '/patient/reports');
    expect(screen.queryByText(/checksum|object key|minio|mime/i)).not.toBeInTheDocument();
  });

  it('renders a truthful empty Reports hero without treating zero reports as an error', async () => {
    mocks.dashboard.mockResolvedValueOnce({ ...dashboard, activeReportCount: 0, latestReport: null });
    renderHome();

    expect(
      await screen.findByText(/Upload your first medical report to begin building your health record/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload report' })).toBeEnabled();
    expect(screen.queryByRole('link', { name: /View all reports/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('localizes a Reports failure while keeping the rest of Home useful', async () => {
    mocks.dashboard.mockRejectedValueOnce(new Error('Report summary unavailable.'));
    renderHome();

    expect(await screen.findByText('Report summary unavailable.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your Health Profile' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Upcoming care' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent health activity' })).toBeInTheDocument();
  });

  it('uses real four-part Health Profile completion and keeps it distinct from Health Record', async () => {
    mocks.profile.mockResolvedValueOnce({
      ...profile,
      familyMedicalHistory: null,
      lifestyleInformation: null,
      emergencyContact: { ...profile.emergencyContact, configured: false },
    });
    renderHome();

    const heading = await screen.findByRole('heading', { name: 'Your Health Profile' });
    const section = heading.closest('section')!;
    expect(within(section).getByText('2 of 4 complete')).toBeInTheDocument();
    expect(within(section).getByText('Medical background')).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: /Continue profile/i })).toHaveAttribute(
      'href',
      '/patient/profile?section=medical',
    );
    expect(screen.getByRole('heading', { name: 'Your current clinical essentials' })).toBeInTheDocument();
  });

  it('shows real height, weight, and calculated BMI without a fabricated trend', async () => {
    const { container } = renderHome();

    expect(await screen.findByText('165 cm')).toBeInTheDocument();
    expect(screen.getByText('60 kg')).toBeInTheDocument();
    expect(screen.getByText('22.0')).toBeInTheDocument();
    expect(screen.getByText(/Trends will appear as Clinora records trustworthy measurements/i)).toBeInTheDocument();
    expect(container.querySelector('[data-health-insight-visual]')).not.toBeInTheDocument();
    expect(screen.queryByText(/blood pressure|heart rate|health score/i)).not.toBeInTheDocument();
  });

  it('renders the next real appointment and its focused action', async () => {
    mocks.appointments.mockResolvedValueOnce([appointment]);
    renderHome();

    expect(await screen.findByText('Dr. Anika Rahman')).toBeInTheDocument();
    expect(screen.getByText('Cardiology')).toBeInTheDocument();
    expect(screen.getByText('2 reports shared')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View appointment/i })).toHaveAttribute(
      'href',
      `/patient/appointments/${appointment.id}`,
    );
  });

  it('renders an intentional empty Upcoming Care state and Doctor route', async () => {
    renderHome();

    expect(await screen.findByText('No appointments scheduled.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Find a Doctor' })).toHaveAttribute('href', '/patient/doctors');
  });

  it('localizes appointment failure without breaking reports, profile, activity, or record', async () => {
    mocks.appointments.mockRejectedValueOnce(new Error('Care service is unavailable.'));
    renderHome();

    expect(await screen.findByText('Care service is unavailable.')).toBeInTheDocument();
    expect(screen.getAllByText('Annual blood panel').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Your Health Profile' })).toBeInTheDocument();
    expect(screen.getByText('Medical report uploaded')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your current clinical essentials' })).toBeInTheDocument();
    expect(screen.queryByText('Your workspace is temporarily unavailable')).not.toBeInTheDocument();
  });

  it('renders real timeline activity and localizes empty and failed states', async () => {
    const { unmount } = renderHome();
    expect(await screen.findByText('Medical report uploaded')).toBeInTheDocument();
    expect(screen.getAllByText('Annual blood panel').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /View timeline/i })).toHaveAttribute('href', '/patient/timeline');
    unmount();

    mocks.timeline.mockResolvedValueOnce({ items: [], hasMore: false, nextBefore: null, nextBeforeId: null });
    const empty = renderHome();
    expect(await screen.findByText(/recent health activity will appear here/i)).toBeInTheDocument();
    empty.unmount();

    mocks.timeline.mockRejectedValueOnce(new Error('Timeline unavailable.'));
    renderHome();
    expect(await screen.findByText('Timeline unavailable.')).toBeInTheDocument();
    expect(screen.getAllByText('Annual blood panel').length).toBeGreaterThan(0);
  });

  it('renders a compact Health Record Snapshot and its truthful empty state', async () => {
    const { unmount } = renderHome();
    const heading = await screen.findByRole('heading', { name: 'Your current clinical essentials' });
    const section = heading.closest('section')!;
    expect(within(section).getByText('Penicillin')).toBeInTheDocument();
    expect(within(section).getByText('Asthma')).toBeInTheDocument();
    expect(within(section).getByText('Salbutamol')).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: /View Health Record/i })).toHaveAttribute(
      'href',
      '/patient/history',
    );
    unmount();

    mocks.history.mockResolvedValueOnce({
      ...record,
      profile: { ...profile, allergies: [], chronicConditions: [], currentMedications: [] },
    });
    renderHome();
    expect((await screen.findAllByText('None recorded')).length).toBe(3);
  });

  it('shows only active sharing and gracefully degrades an aggregate notification/sharing failure', async () => {
    mocks.portal.mockResolvedValueOnce({
      care: { nextAppointment: appointment, activeReportShareCount: 2, doctorCount: 1 },
      recentHealthActivity: timeline,
      unreadNotifications: 3,
    });
    const { unmount } = renderHome();
    expect(
      await screen.findByText('2 medical reports are currently shared with 1 Clinora Doctor.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Manage sharing/i })).toHaveAttribute('href', '/patient/appointments');
    unmount();

    mocks.portal.mockRejectedValueOnce(new Error('Notification service unavailable.'));
    renderHome();
    expect(await screen.findByText(/Your information remains private/i)).toBeInTheDocument();
    expect(screen.getAllByText('Annual blood panel').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Upcoming care' })).toBeInTheDocument();
  });
});

describe('Phase 5 Patient appointment states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.appointments.mockResolvedValue([]);
  });

  it('retries only the appointment collection after a localized error', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <PatientAppointmentsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'No upcoming appointments' })).toBeInTheDocument();
    mocks.appointments.mockRejectedValueOnce(new Error('Appointment refresh failed.'));
    await user.click(screen.getByRole('button', { name: 'Past' }));
    expect(await screen.findByText(/Appointment refresh failed/)).toBeInTheDocument();
    mocks.appointments.mockResolvedValueOnce([]);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'No past appointments yet' })).toBeInTheDocument());
  });
});
