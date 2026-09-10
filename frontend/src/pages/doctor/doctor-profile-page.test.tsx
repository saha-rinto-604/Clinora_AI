import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DoctorProfessionalProfile } from '../../features/doctor/doctor-profile-api';
import { DoctorProfilePage } from './doctor-profile-page';

const mocks = vi.hoisted(() => ({
  profile: vi.fn(),
  update: vi.fn(),
  credentialContent: vi.fn(),
  credentialDownload: vi.fn(),
}));

vi.mock('../../features/profile/profile-image', () => ({
  ProfileImageEditor: ({ name }: { name: string }) => <div aria-label="profile-photo-editor">Photo for {name}</div>,
  ProfileAvatar: ({ name }: { name: string }) => <div aria-label={`${name} profile photo`}>{name}</div>,
}));

vi.mock('../../features/doctor/doctor-profile-api', () => ({
  doctorProfileApi: {
    profile: mocks.profile,
    update: mocks.update,
    credentialContent: mocks.credentialContent,
    credentialDownload: mocks.credentialDownload,
  },
  doctorProfileError: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
}));

const profile: DoctorProfessionalProfile = {
  doctorId: '11111111-1111-1111-1111-111111111111',
  displayName: 'Dr. Arafat Hossain',
  verifiedFirstName: 'Arafat',
  verifiedLastName: 'Hossain',
  specialization: 'Internal Medicine',
  approvedYearsExperience: 9,
  editable: {
    professionalBio: 'Consultant physician focused on adult internal medicine.',
    professionalProfileUrl: 'https://clinora.test/doctors/arafat-hossain',
    displayTitle: 'Consultant Physician',
    currentOrganization: 'Dhaka Central Medical Centre',
    currentPosition: 'Consultant',
    preferredTimezone: 'Asia/Dhaka',
    defaultConsultationMinutes: 30,
  },
  credentials: {
    verifiedProfessionalTitle: 'Consultant Physician',
    verifiedCurrentOrganization: 'Dhaka Central Medical Centre',
    verifiedCurrentPosition: 'Consultant',
    registrationJurisdiction: 'Bangladesh',
    registrationAuthority: 'Bangladesh Medical and Dental Council',
    registrationNumber: 'SYNTHETIC-1001',
    registrationType: 'Full registration',
    registrationIssuedAt: '2024-01-01',
    registrationValidUntil: '2029-01-01',
    qualifications: [
      {
        id: '22222222-2222-2222-2222-222222222222',
        qualificationName: 'FCPS (Medicine)',
        institution: 'Bangladesh College of Physicians and Surgeons',
        countryCode: 'Bangladesh',
        completionYear: 2018,
      },
    ],
    documents: [
      {
        id: '33333333-3333-3333-3333-333333333333',
        documentType: 'MEDICAL_LICENSE',
        originalFilename: 'medical-license.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        uploadedAt: '2026-05-01T08:00:00Z',
      },
    ],
  },
  readiness: { percent: 100, completedItems: 6, totalItems: 6, missingItems: [] },
  version: 3,
  updatedAt: '2026-09-10T08:00:00Z',
};

describe('Doctor professional profile R1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.profile.mockResolvedValue(profile);
    mocks.update.mockImplementation(async (input) => ({ ...profile, editable: input, version: profile.version + 1 }));
  });

  it('separates editable presentation fields from read-only verified credentials', async () => {
    render(<MemoryRouter><DoctorProfilePage /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Dr. Arafat Hossain' })).toBeInTheDocument();
    expect(screen.getByText('Verified credentials')).toBeInTheDocument();
    expect(screen.getByText('medical-license.pdf')).toBeInTheDocument();
    expect(screen.getByText('SYNTHETIC-1001')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /replace.*license|delete.*license|edit.*registration/i })).not.toBeInTheDocument();
  });


  it('keeps unsaved profile edits visible when a save request fails', async () => {
    const user = userEvent.setup();
    mocks.update.mockRejectedValueOnce(new Error('Profile changed in another session. Reload before saving.'));
    render(<MemoryRouter><DoctorProfilePage /></MemoryRouter>);

    const title = await screen.findByLabelText('Display title');
    await user.clear(title);
    await user.type(title, 'Senior Consultant');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Profile changed in another session');
    expect(screen.getByLabelText('Display title')).toHaveValue('Senior Consultant');
    expect(screen.getByRole('button', { name: 'Save profile' })).toBeEnabled();
  });

  it('sends only profile presentation and operational fields through normal save', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><DoctorProfilePage /></MemoryRouter>);

    const title = await screen.findByLabelText('Display title');
    await user.clear(title);
    await user.type(title, 'Senior Consultant');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      version: 3,
      displayTitle: 'Senior Consultant',
      preferredTimezone: 'Asia/Dhaka',
      defaultConsultationMinutes: 30,
    }));
    const sent = mocks.update.mock.calls[0][0];
    expect(sent).not.toHaveProperty('registrationNumber');
    expect(sent).not.toHaveProperty('qualifications');
    expect(sent).not.toHaveProperty('documents');
  });
});
