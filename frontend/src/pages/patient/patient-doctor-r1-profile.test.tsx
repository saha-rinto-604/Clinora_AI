import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientDoctorDetailPage } from './patient-doctor-detail-page';
import { PatientDoctorsPage } from './patient-doctors-page';

const mocks = vi.hoisted(() => ({
  doctors: vi.fn(),
  doctor: vi.fn(),
  professionalProfile: vi.fn(),
  reports: vi.fn(),
}));

vi.mock('../../features/appointments/appointment-api', () => ({
  appointmentApi: {
    doctors: mocks.doctors,
    doctor: mocks.doctor,
    book: vi.fn(),
  },
  appointmentError: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
  appointmentErrorCode: () => null,
}));

vi.mock('../../features/doctor/doctor-profile-api', () => ({
  patientFacingDoctorProfile: mocks.professionalProfile,
}));

vi.mock('../../features/patient-reports/patient-report-api', () => ({
  patientReportApi: { list: mocks.reports, content: vi.fn(), update: vi.fn(), detail: vi.fn() },
  patientReportErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

vi.mock('../../features/profile/profile-image', () => ({
  ProfileAvatar: ({ name }: { name: string }) => <div aria-label={`${name} profile photo`} />,
}));

const doctor = {
  id: '11111111-1111-1111-1111-111111111111',
  displayName: 'Dr. Arafat Hossain',
  professionalTitle: 'Consultant Physician',
  specialization: 'Internal Medicine',
  yearsExperience: 9,
  currentOrganization: 'Dhaka Central Medical Centre',
  currentPosition: 'Consultant',
  registrationJurisdiction: 'Bangladesh',
  registrationAuthority: 'Bangladesh Medical and Dental Council',
  registrationType: 'Full registration',
  registrationValidUntil: '2029-01-01',
  nextAvailableAt: '2026-09-12T09:00:00Z',
};

describe('Patient-facing Doctor profile R1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.doctors.mockResolvedValue([doctor]);
    mocks.doctor.mockResolvedValue({ doctor, availability: [] });
    mocks.professionalProfile.mockResolvedValue({
      doctorId: doctor.id,
      displayName: doctor.displayName,
      displayTitle: 'Senior Consultant Physician',
      specialization: doctor.specialization,
      yearsExperience: doctor.yearsExperience,
      currentOrganization: doctor.currentOrganization,
      currentPosition: doctor.currentPosition,
      professionalBio: 'Adult internal medicine with a focus on longitudinal care.',
      professionalProfileUrl: 'https://example.test/arafat',
      preferredTimezone: 'Asia/Dhaka',
      defaultConsultationMinutes: 30,
      nextAvailableAt: doctor.nextAvailableAt,
      clinoraVerified: true,
    });
    mocks.reports.mockResolvedValue({
      items: [],
      page: 1,
      size: 20,
      totalItems: 0,
      totalPages: 0,
      hasPrevious: false,
      hasNext: false,
      activeCount: 0,
      archivedCount: 0,
    });
  });

  it('uses the real Doctor photo surface in discovery instead of a generic identity icon', async () => {
    render(<MemoryRouter><PatientDoctorsPage /></MemoryRouter>);

    expect(await screen.findByText('Dr. Arafat Hossain')).toBeInTheDocument();
    expect(screen.getByLabelText('Dr. Arafat Hossain profile photo')).toBeInTheDocument();
    expect(screen.getByText('Clinora verified')).toBeInTheDocument();
  });


  it('keeps core booking identity usable when optional professional enrichment cannot load', async () => {
    mocks.professionalProfile.mockRejectedValueOnce(new Error('temporarily unavailable'));
    render(
      <MemoryRouter initialEntries={[`/patient/doctors/${doctor.id}`]}>
        <Routes>
          <Route path="/patient/doctors/:doctorId" element={<PatientDoctorDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Dr. Arafat Hossain' })).toBeInTheDocument();
    expect(screen.getAllByText('Internal Medicine').length).toBeGreaterThan(0);
    expect(screen.getByText('What would you like to discuss?')).toBeInTheDocument();
  });

  it('shows professional presentation data without exposing credential documents', async () => {
    render(
      <MemoryRouter initialEntries={[`/patient/doctors/${doctor.id}`]}>
        <Routes>
          <Route path="/patient/doctors/:doctorId" element={<PatientDoctorDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Senior Consultant Physician')).toBeInTheDocument();
    expect(screen.getByText('Adult internal medicine with a focus on longitudinal care.')).toBeInTheDocument();
    expect(screen.getByText('30 min consultation')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Professional profile' })).toHaveAttribute('href', 'https://example.test/arafat');
    expect(screen.queryByText(/medical-license\.pdf/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/registration number/i)).not.toBeInTheDocument();
  });
});
