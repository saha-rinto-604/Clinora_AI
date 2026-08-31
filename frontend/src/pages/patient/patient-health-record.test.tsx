import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HealthRecord, HealthTrends, TimelineEvent } from '../../features/patient-record/patient-record-api';
import type { PatientProfile } from '../../features/patient/patient-types';
import { PatientHealthRecordPage } from './patient-health-record-page';
import { PatientProfilePage } from './patient-profile-page';
import { PatientTimelinePage } from './patient-timeline-page';

const mocks = vi.hoisted(() => ({
  profile: vi.fn(),
  updateProfile: vi.fn(),
  history: vi.fn(),
  healthTrends: vi.fn(),
  timeline: vi.fn(),
}));

vi.mock('../../features/patient/patient-api', () => ({
  patientApi: { profile: mocks.profile, updateProfile: mocks.updateProfile },
  patientErrorMessage: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
}));
vi.mock('../../features/patient-record/patient-record-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../features/patient-record/patient-record-api')>();
  return {
    ...actual,
    patientRecordApi: { history: mocks.history, healthTrends: mocks.healthTrends, timeline: mocks.timeline },
    patientRecordError: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
  };
});

const profile: PatientProfile = {
  id: '22222222-2222-2222-2222-222222222222',
  profileCreated: true,
  firstName: 'Pia',
  lastName: 'Patient',
  email: 'pia@example.test',
  dateOfBirth: '1991-04-12',
  gender: 'FEMALE',
  bloodGroup: 'A_POSITIVE',
  phone: '+8801700000000',
  address: 'Dhaka',
  heightCm: 165,
  weightKg: 63,
  familyMedicalHistory: 'Family history of hypertension',
  lifestyleInformation: 'Walks regularly',
  emergencyContact: { name: 'Rina Patient', phone: '+8801800000000', relationship: 'Sibling', configured: true },
  allergies: ['Grass pollen'],
  chronicConditions: ['Asthma'],
  currentMedications: [],
  completenessPercent: 100,
  missingProfileFields: [],
  updatedAt: '2026-08-30T12:00:00Z',
};

const record: HealthRecord = {
  profile,
  clinicalEssentials: {
    allergies: [{ name: 'Grass pollen', sourceType: 'PATIENT_PROFILE' }],
    conditions: [{ name: 'Asthma', sourceType: 'PATIENT_PROFILE' }],
    medications: [],
  },
  currentMeasurements: {
    bloodGroup: 'A_POSITIVE',
    heightCm: 165,
    weightKg: 63,
    bmi: 23.1,
    sourceType: 'PATIENT_PROFILE',
  },
  recentReports: [
    {
      id: '33333333-3333-3333-3333-333333333333',
      reportName: 'Complete blood count',
      reportType: 'LAB_RESULTS',
      reportDate: '2026-08-29',
      providerLaboratory: 'Clinora Lab',
      uploadedAt: '2026-08-29T08:00:00Z',
      sourceType: 'MEDICAL_REPORT',
    },
  ],
  care: {
    nextAppointment: {
      id: '44444444-4444-4444-4444-444444444444',
      status: 'BOOKED',
      scheduledStart: '2026-09-01T04:30:00Z',
      scheduledEnd: '2026-09-01T05:00:00Z',
      doctorName: 'Anika Rahman',
      specialization: 'Internal Medicine',
      sourceType: 'APPOINTMENT',
    },
    recentAppointments: [],
  },
  background: {
    familyMedicalHistory: profile.familyMedicalHistory,
    lifestyleInformation: profile.lifestyleInformation,
    sourceType: 'PATIENT_PROFILE',
  },
  lastUpdatedAt: '2026-08-30T12:00:00Z',
};

const emptyTrends: HealthTrends = { points: [] };
const firstPoint = {
  id: '55555555-5555-5555-5555-555555555555',
  heightCm: 165,
  weightKg: 64,
  bmi: 23.5,
  recordedAt: '2026-08-29T08:00:00Z',
  sourceType: 'PATIENT_PROFILE' as const,
};
const secondPoint = {
  ...firstPoint,
  id: '66666666-6666-6666-6666-666666666666',
  weightKg: 63,
  bmi: 23.1,
  recordedAt: '2026-08-30T08:00:00Z',
};

function renderPage(page: React.ReactNode, route = '/patient/history') {
  return render(<MemoryRouter initialEntries={[route]}>{page}</MemoryRouter>);
}

describe('Health Profile and Health Record architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.profile.mockResolvedValue(profile);
    mocks.updateProfile.mockResolvedValue(profile);
    mocks.history.mockResolvedValue(record);
    mocks.healthTrends.mockResolvedValue(emptyTrends);
    mocks.timeline.mockResolvedValue({ items: [], hasMore: false, nextBefore: null, nextBeforeId: null });
  });

  it('presents Health Profile as a four-section editor with account-owned identity and deliberate save state', async () => {
    const user = userEvent.setup();
    renderPage(<PatientProfilePage />, '/patient/profile?section=basic');
    expect(await screen.findByRole('heading', { name: 'Health Profile' })).toBeInTheDocument();
    expect(screen.getByText(/changes to your health information are reflected/i)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Health Profile sections' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Basic health', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('23.1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /personal details/i }));
    expect((await screen.findAllByText('Managed through your Clinora account.')).length).toBe(2);
    expect(screen.queryByLabelText('Full name')).not.toBeInTheDocument();
    const phone = screen.getByLabelText('Phone');
    await user.clear(phone);
    await user.type(phone, '+8801999999999');
    expect(screen.getByText('You have unsaved changes.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(phone).toHaveValue(profile.phone);
  });

  it('renders Health Record as a read-only aggregate with provenance, reports, care, and no Profile controls', async () => {
    renderPage(<PatientHealthRecordPage />);
    expect(await screen.findByRole('heading', { name: 'Health Record' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Timeline' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /important health information currently recorded/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Grass pollen')).toBeInTheDocument();
    expect(screen.getAllByText('From your Health Profile').length).toBeGreaterThan(1);
    expect(screen.getByText('Complete blood count')).toBeInTheDocument();
    expect(screen.getByText('Dr. Anika Rahman')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Context you have recorded' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText('Emergency contact')).not.toBeInTheDocument();
  });

  it('keeps the Profile editor and Health Record overview free of automated accessibility violations', async () => {
    const profileView = renderPage(<PatientProfilePage />, '/patient/profile');
    await screen.findByRole('heading', { name: 'Personal details' });
    expect(await axe(profileView.container)).toHaveNoViolations();
    profileView.unmount();

    const recordView = renderPage(<PatientHealthRecordPage />);
    await screen.findByRole('heading', { name: 'Health Record' });
    expect(await axe(recordView.container)).toHaveNoViolations();
  });

  it('does not draw a graph with zero or one trustworthy observation', async () => {
    const { unmount } = renderPage(<PatientHealthRecordPage />);
    expect(await screen.findByRole('heading', { name: 'No historical measurements yet' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /trend with/i })).not.toBeInTheDocument();

    unmount();
    mocks.healthTrends.mockResolvedValue({ points: [firstPoint] });
    renderPage(<PatientHealthRecordPage />);
    expect(await screen.findByText(/one measurement recorded/i)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /trend with/i })).not.toBeInTheDocument();
  });

  it('draws truthful Weight and BMI trends only from persisted points and supplies a table alternative', async () => {
    const user = userEvent.setup();
    mocks.healthTrends.mockResolvedValue({ points: [firstPoint, secondPoint] });
    renderPage(<PatientHealthRecordPage />);
    expect(await screen.findByRole('img', { name: /weight trend with 2 recorded measurements/i })).toBeInTheDocument();
    expect(screen.getByText('−1.0 kg since', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText(/improved|worsened|better/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'BMI' }));
    expect(screen.getByRole('img', { name: /bmi trend with 2 recorded measurements/i })).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Date' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Weight' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'BMI' })).toBeInTheDocument();
  });

  it('keeps the Record available when only Health Trends fails', async () => {
    mocks.healthTrends.mockRejectedValue(new Error('Trend service unavailable.'));
    renderPage(<PatientHealthRecordPage />);
    expect(await screen.findByText('Grass pollen')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/rest of your Health Record is still available/i);
    expect(screen.getByText('Complete blood count')).toBeInTheDocument();
  });

  it('uses one calm onboarding state for a brand-new Patient Record', async () => {
    mocks.history.mockResolvedValue({ ...record, profile: { ...profile, profileCreated: false } });
    renderPage(<PatientHealthRecordPage />);
    expect(await screen.findByRole('heading', { name: 'Your Health Record starts with you' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Complete Health Profile' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Health Trends' })).not.toBeInTheDocument();
  });

  it('renders Timeline as the chronological second Health Record view with Patient language and provenance', async () => {
    const user = userEvent.setup();
    const event: TimelineEvent = {
      id: '77777777-7777-7777-7777-777777777777',
      eventType: 'ALLERGY_ADDED',
      category: 'CONDITIONS_MEDICATIONS',
      sourceType: 'ALLERGY',
      sourceId: null,
      title: 'Allergy added',
      detail: 'Tree pollen',
      occurredAt: '2026-08-30T08:00:00Z',
    };
    mocks.timeline.mockResolvedValue({ items: [event], hasMore: false, nextBefore: null, nextBeforeId: null });
    renderPage(<PatientTimelinePage />, '/patient/timeline');
    expect(await screen.findByText('Allergy added')).toBeInTheDocument();
    expect(screen.getByText('Tree pollen')).toBeInTheDocument();
    expect(screen.getByText('From your Health Profile')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.queryByText('CONDITIONS_MEDICATIONS')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Profile' }));
    await waitFor(() => expect(mocks.timeline).toHaveBeenLastCalledWith({ category: 'PROFILE', limit: 30 }));
  });
});
