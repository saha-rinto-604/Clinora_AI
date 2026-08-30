import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from '../../features/auth/protected-route';
import { useAuthStore } from '../../features/auth/auth-store';
import { PatientLayout } from '../../features/patient/patient-layout';
import type { PatientDashboard, PatientProfile } from '../../features/patient/patient-types';
import { PatientDashboardPage } from './patient-dashboard-page';
import { PatientProfilePage } from './patient-profile-page';

const mocks = vi.hoisted(() => ({ dashboard: vi.fn(), profile: vi.fn(), updateProfile: vi.fn(), logout: vi.fn() }));
vi.mock('../../features/patient/patient-api', () => ({
  patientApi: { dashboard: mocks.dashboard, profile: mocks.profile, updateProfile: mocks.updateProfile },
  patientErrorMessage: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
}));
vi.mock('../../features/auth/auth-api', async () => {
  const actual = await vi.importActual<typeof import('../../features/auth/auth-api')>('../../features/auth/auth-api');
  return { ...actual, authApi: { ...actual.authApi, logout: mocks.logout } };
});

const patientUser = {
  id: '11111111-1111-1111-1111-111111111111',
  firstName: 'Pia',
  lastName: 'Patient',
  email: 'pia@example.test',
  role: 'PATIENT',
  accountStatus: 'ACTIVE',
  emailVerified: true,
};
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
  address: 'Dhaka, Bangladesh',
  heightCm: 165,
  weightKg: 60,
  familyMedicalHistory: 'Family history of hypertension',
  lifestyleInformation: 'Exercises regularly',
  emergencyContact: { name: 'Rina Patient', phone: '+8801800000000', relationship: 'Sibling', configured: true },
  allergies: ['Penicillin'],
  chronicConditions: ['Asthma'],
  currentMedications: ['Inhaler'],
  completenessPercent: 100,
  missingProfileFields: [],
  updatedAt: '2026-08-26T12:00:00Z',
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
  profileUpdatedAt: '2026-08-26T12:00:00Z',
  activeReportCount: 0,
  latestReport: null,
};
const newProfile: PatientProfile = {
  ...profile,
  id: null,
  profileCreated: false,
  dateOfBirth: null,
  gender: null,
  bloodGroup: null,
  phone: null,
  address: null,
  heightCm: null,
  weightKg: null,
  familyMedicalHistory: null,
  lifestyleInformation: null,
  emergencyContact: { name: null, phone: null, relationship: null, configured: false },
  allergies: [],
  chronicConditions: [],
  currentMedications: [],
  completenessPercent: 0,
  updatedAt: null,
};

function setPatientAuth() {
  useAuthStore.setState({ status: 'authenticated', accessToken: 'token', user: patientUser });
}
function renderPatientRoute(path: string = '/patient') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute allowedRoles={['PATIENT']} />}>
          <Route element={<PatientLayout />}>
            <Route path="/patient" element={<PatientDashboardPage />} />
            <Route path="/patient/profile" element={<PatientProfilePage />} />
          </Route>
        </Route>
        <Route path="/account" element={<div>Account security</div>} />
        <Route path="/login" element={<div>Login</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Phase 5A Patient experience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'scrollTo', { value: vi.fn(), writable: true });
    setPatientAuth();
    mocks.dashboard.mockResolvedValue(dashboard);
    mocks.profile.mockResolvedValue(profile);
    mocks.updateProfile.mockResolvedValue(profile);
    mocks.logout.mockResolvedValue(undefined);
  });

  it('shows only the approved Patient shell navigation', async () => {
    renderPatientRoute();
    await screen.findByRole('heading', { name: /good (morning|afternoon|evening), pia/i });
    const navs = screen.getAllByRole('navigation', { name: /patient/i });
    expect(navs.some((nav) => within(nav).getAllByText('Home').length > 0)).toBe(true);
    expect(screen.getAllByText('Health Profile').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Security/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Reports/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Appointments')).not.toBeInTheDocument();
  });

  it('gives a new Patient the final one-owner Home architecture without implementation copy', async () => {
    mocks.profile.mockResolvedValueOnce(newProfile);
    const { container } = renderPatientRoute();

    expect(await screen.findByRole('heading', { name: 'Medical reports' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Patient record' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Upcoming care' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Health insights' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent health activity' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Privacy & sharing' })).toBeInTheDocument();
    expect(Array.from(container.querySelectorAll('main h2')).map((heading) => heading.textContent)).toEqual([
      'Medical reports',
      'Patient record',
      'Upcoming care',
      'Health insights',
      'Recent health activity',
      'Privacy & sharing',
    ]);

    expect(screen.getByText('0 of 4 complete')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start with personal details/i })).toHaveAttribute(
      'href',
      '/patient/profile?section=personal',
    );
    expect(container.querySelectorAll('[data-surface-variant="hero"]')).toHaveLength(1);
    expect(container.querySelector('[data-bio-record-stage]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-bio-record-static-fallback]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-clinical-ambient-visual="patient-report"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-clinical-backdrop="true"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-clinical-motif="hematology"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-clinical-motif="biomarker"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-clinical-motif="document-scan"]')).toHaveLength(0);
    expect(container.querySelector('[data-health-insight-visual="biomarker-trend"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-motif-motion="parallax-drift"]')).toHaveLength(1);
    expect(container.querySelector('[data-clinical-motif="radiology"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-clinical-motif="neural"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-clinical-motif="molecular"]')).not.toBeInTheDocument();
    container.querySelectorAll('[data-clinical-ambient-visual], [data-clinical-motif]').forEach((visual) => {
      expect(visual).toHaveAttribute('aria-hidden', 'true');
      expect(visual).toHaveClass('pointer-events-none');
    });
    const reportsHero = screen.getByRole('heading', { name: 'Medical reports' }).closest('section')!;
    expect(reportsHero).toHaveAttribute('data-surface-variant', 'hero');
    expect(reportsHero.querySelector('canvas')).not.toBeInTheDocument();
    expect(reportsHero.querySelector('[data-medical-reports-visual="clinical-ambient"]')).toBeInTheDocument();
    expect(reportsHero.querySelector('[data-clinical-ambient-visual="patient-report"]')).toBeInTheDocument();
    expect(reportsHero.querySelectorAll('[data-depth-plane]')).toHaveLength(3);
    expect(reportsHero.querySelector('[data-biomedical-neuron="model-derived"]')).toBeInTheDocument();
    expect(reportsHero.querySelector('img[src*="bio-record"], [data-bio-record-stage]')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Care overview' })).not.toBeInTheDocument();
    expect(screen.queryByText(/needs attention/i)).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Choose a report' })).toBeEnabled();
    expect(screen.queryByRole('link', { name: /view all reports/i })).not.toBeInTheDocument();
    expect(screen.getByText('Add your first report')).toBeInTheDocument();
    expect(screen.getByText(/start with a pdf or image from a laboratory, clinic, or hospital/i)).toBeInTheDocument();
    expect(
      screen.getByText(/health trends will appear here once clinora has comparable measurements/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Patient account verified')).toBeInTheDocument();
    expect(screen.queryByText('Health profile updated')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /add basic health/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/uploaded|extracted|analysed|reviewed/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/phase 5a|ui-ready|backend|not connected|service unavailable|ocr api/i),
    ).not.toBeInTheDocument();
  });

  it('keeps partial profile progress and its only next action inside Patient record', async () => {
    mocks.profile.mockResolvedValueOnce({
      ...profile,
      familyMedicalHistory: null,
      lifestyleInformation: null,
      emergencyContact: { ...profile.emergencyContact, configured: false },
    });
    renderPatientRoute();

    await screen.findByRole('heading', { name: 'Patient record' });
    expect(screen.getByText('2 of 4 complete')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Health insights' })).toBeInTheDocument();

    const nextAction = screen.getByRole('link', { name: /start with medical history/i });
    expect(nextAction).toHaveAttribute('href', '/patient/profile?section=medical');
    expect(screen.getAllByRole('link', { name: /start with|continue profile|complete health profile/i })).toHaveLength(
      1,
    );
    expect(screen.queryByText(/needs attention/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /complete your health profile/i })).not.toBeInTheDocument();
  });

  it('collapses a complete Patient record and shows only real baseline and activity data', async () => {
    renderPatientRoute();

    const recordHeading = await screen.findByRole('heading', { name: 'Patient record' });
    const recordSection = recordHeading.closest('section')!;
    expect(within(recordSection).getByText('Complete')).toBeInTheDocument();
    expect(within(recordSection).getByRole('link', { name: /view profile/i })).toHaveAttribute(
      'href',
      '/patient/profile?section=review',
    );
    expect(within(recordSection).queryByText('4 of 4 complete')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Health insights' })).toBeInTheDocument();
    expect(screen.getByText('165 cm')).toBeInTheDocument();
    expect(screen.getByText('60 kg')).toBeInTheDocument();
    expect(screen.getByText('22.0')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent health activity' })).toBeInTheDocument();
    expect(screen.getByText(/health profile updated/i)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Choose a report' })).toBeEnabled();
    expect(screen.getAllByText('No appointments scheduled.')).toHaveLength(1);
    expect(screen.queryByRole('link', { name: /find a doctor/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/hemoglobin|glucose|blood pressure|cholesterol|prescription/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Complete your health profile' })).not.toBeInTheDocument();
    expect(screen.getAllByText(/clinical access is granted only through authorized clinora workflows/i)).toHaveLength(
      1,
    );
    expect(screen.queryByText(/private by design/i)).not.toBeInTheDocument();
  });

  it('turns the Home report hero into a concise real-data summary after upload', async () => {
    mocks.dashboard.mockResolvedValueOnce({
      ...dashboard,
      activeReportCount: 2,
      latestReport: {
        id: '33333333-3333-3333-3333-333333333333',
        reportName: 'Annual blood panel',
        reportType: 'LAB_RESULTS',
        reportDate: '2026-08-25',
        providerLaboratory: 'City Diagnostic Centre',
        uploadedAt: '2026-08-30T08:00:00Z',
      },
    });
    renderPatientRoute();

    expect(await screen.findByText('Annual blood panel')).toBeInTheDocument();
    expect(screen.getByText('2 current')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload report' })).toBeEnabled();
    expect(screen.getByRole('link', { name: /view all reports/i })).toHaveAttribute('href', '/patient/reports');
  });

  it('renders the Patient Home without automated accessibility violations', async () => {
    const { container } = renderPatientRoute();
    await screen.findByRole('heading', { name: 'Medical reports' });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('switches profile steps and manages structured medical lists', async () => {
    const user = userEvent.setup();
    renderPatientRoute('/patient/profile');
    await user.click(await screen.findByRole('button', { name: /medical history/i }));
    expect(await screen.findByRole('heading', { name: 'Medical history', level: 2 })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add allergy' }));
    await user.type(screen.getByRole('textbox', { name: 'Allergy' }), 'Latex');
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    expect(screen.getByText('Latex')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove Latex' }));
    await waitFor(() => expect(screen.queryByText('Latex')).not.toBeInTheDocument());
  });

  it('uses an in-app confirmation before discarding unsaved changes', async () => {
    const user = userEvent.setup();
    renderPatientRoute('/patient/profile');
    const phone = await screen.findByLabelText('Phone');
    await user.clear(phone);
    await user.type(phone, '+8801999999999');
    await user.click(screen.getByRole('button', { name: /basic health/i }));
    expect(screen.getByRole('dialog', { name: 'Leave without saving?' })).toBeInTheDocument();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByRole('heading', { name: 'Personal details' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /basic health/i }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Discard changes' }));
    expect(await screen.findByRole('heading', { name: 'Basic health' })).toBeInTheDocument();
  });

  it('saves through the existing contract, preserves values after failure, and supports save-and-continue', async () => {
    const user = userEvent.setup();
    mocks.updateProfile.mockRejectedValueOnce(new Error('Save unavailable.'));
    renderPatientRoute('/patient/profile');
    const address = await screen.findByLabelText('Address');
    await user.clear(address);
    await user.type(address, 'Chattogram, Bangladesh');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Save unavailable.')).toBeInTheDocument();
    expect(address).toHaveValue('Chattogram, Bangladesh');
    mocks.updateProfile.mockResolvedValueOnce({ ...profile, address: 'Chattogram, Bangladesh' });
    await user.click(screen.getByRole('button', { name: 'Save & continue' }));
    await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalledTimes(2));
    expect(mocks.updateProfile).toHaveBeenLastCalledWith(
      expect.objectContaining({ address: 'Chattogram, Bangladesh', allergies: ['Penicillin'] }),
    );
    expect(await screen.findByRole('heading', { name: 'Basic health' })).toBeInTheDocument();
  });

  it('provides a final saved-profile review with edit actions', async () => {
    const user = userEvent.setup();
    renderPatientRoute('/patient/profile?section=review');
    expect(await screen.findByRole('heading', { name: 'Review your health profile' })).toBeInTheDocument();
    expect(screen.getByText('Rina Patient')).toBeInTheDocument();
    const medicalSection = screen.getByRole('heading', { name: 'Medical history' }).closest('section')!;
    await user.click(within(medicalSection).getByRole('button', { name: 'Edit' }));
    expect(await screen.findByRole('heading', { name: 'Medical history', level: 2 })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Add allergy' })).toBeInTheDocument();
  });
});
