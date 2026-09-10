import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientDoctorDetailPage } from './patient-doctor-detail-page';
import type { PatientReport } from '../../features/patient-reports/patient-report-types';

const mocks = vi.hoisted(() => ({
  doctor: vi.fn(),
  book: vi.fn(),
  profile: vi.fn(),
  reportDetail: vi.fn(),
}));

vi.mock('../../features/appointments/appointment-api', () => ({
  appointmentApi: {
    doctor: mocks.doctor,
    book: mocks.book,
  },
  appointmentError: (error: unknown, fallback: string) => {
    const response = (error as { response?: { data?: { message?: string } } })?.response;
    return response?.data?.message ?? fallback;
  },
  appointmentErrorCode: (error: unknown) => {
    const response = (error as { response?: { data?: { errorCode?: string } } })?.response;
    return response?.data?.errorCode ?? null;
  },
}));

vi.mock('../../features/doctor/doctor-profile-api', () => ({
  patientFacingDoctorProfile: mocks.profile,
}));

vi.mock('../../features/patient-reports/patient-report-api', () => ({
  patientReportApi: {
    detail: mocks.reportDetail,
  },
}));

const selectedReport: PatientReport = {
  id: '33333333-3333-3333-3333-333333333333',
  reportName: 'Thyroid follow-up',
  reportType: 'LAB_RESULTS',
  reportDate: '2026-08-18',
  providerLaboratory: 'Square Hospital',
  originalFilename: 'thyroid-results.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 4096,
  archived: false,
  archivedAt: null,
  createdAt: '2026-08-19T08:00:00Z',
  updatedAt: '2026-08-19T08:00:00Z',
};

vi.mock('../../features/patient-reports/patient-report-picker', () => ({
  PatientReportPicker: ({
    selectedReports,
    onChange,
  }: {
    selectedReports: PatientReport[];
    onChange: (reports: PatientReport[]) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onChange([selectedReport])}>
        Select thyroid report
      </button>
      <span>{selectedReports.map((report) => report.reportName).join(', ')}</span>
    </div>
  ),
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

const slot = {
  id: '22222222-2222-2222-2222-222222222222',
  doctorId: doctor.id,
  startsAt: '2026-09-12T09:00:00Z',
  endsAt: '2026-09-12T09:30:00Z',
  timezone: 'Asia/Dhaka',
  status: 'AVAILABLE' as const,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/patient/doctors/${doctor.id}`]}>
      <Routes>
        <Route path="/patient/doctors/:doctorId" element={<PatientDoctorDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Patient Doctor booking R2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.doctor.mockResolvedValue({ doctor, availability: [slot] });
    mocks.profile.mockResolvedValue({
      doctorId: doctor.id,
      displayName: doctor.displayName,
      displayTitle: 'Senior Consultant Physician',
      specialization: doctor.specialization,
      yearsExperience: doctor.yearsExperience,
      currentOrganization: doctor.currentOrganization,
      currentPosition: doctor.currentPosition,
      professionalBio: 'Adult internal medicine with a focus on longitudinal care.',
      professionalProfileUrl: null,
      preferredTimezone: 'Asia/Dhaka',
      defaultConsultationMinutes: 30,
      nextAvailableAt: doctor.nextAvailableAt,
      clinoraVerified: true,
    });
    mocks.reportDetail.mockResolvedValue(selectedReport);
  });

  it('shows concrete slot duration and keeps confirm unavailable until the Patient chooses a time', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: doctor.displayName })).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: 'Confirm appointment' });
    expect(confirm).toBeDisabled();

    const time = screen.getByRole('button', { name: /30 min · ends/i });
    fireEvent.click(time);

    expect(screen.getAllByText('30 minutes').length).toBeGreaterThan(0);
    expect(confirm).toBeEnabled();
  });

  it('preserves the Patient note and report choices when the selected slot is taken concurrently', async () => {
    mocks.doctor
      .mockResolvedValueOnce({ doctor, availability: [slot] })
      .mockResolvedValueOnce({ doctor: { ...doctor, nextAvailableAt: null }, availability: [] });
    mocks.book.mockRejectedValue({
      response: {
        data: {
          errorCode: 'APPOINTMENT_SLOT_UNAVAILABLE',
          message: 'That appointment time is no longer available.',
        },
      },
    });
    renderPage();

    await screen.findByRole('heading', { name: doctor.displayName });
    fireEvent.click(screen.getByRole('button', { name: /30 min · ends/i }));
    fireEvent.change(screen.getByPlaceholderText(/recurring headaches/i), {
      target: { value: 'Review my recurring headaches and thyroid report' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Select thyroid report' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm appointment' }));

    expect(await screen.findByText(/time was just taken/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/recurring headaches/i)).toHaveValue(
      'Review my recurring headaches and thyroid report',
    );
    expect(screen.getAllByText('Thyroid follow-up').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Confirm appointment' })).toBeDisabled();
    expect(mocks.book).toHaveBeenCalledWith(
      expect.objectContaining({
        slotId: slot.id,
        reportIds: [selectedReport.id],
        reasonForVisit: 'Review my recurring headaches and thyroid report',
      }),
      expect.any(String),
    );
  });

  it('removes a report only when the server confirms it has been archived and preserves the chosen time', async () => {
    mocks.book.mockRejectedValue({
      response: {
        data: {
          errorCode: 'REPORT_NOT_SHAREABLE',
          message: 'Choose an active medical report from your own report library.',
        },
      },
    });
    mocks.reportDetail.mockResolvedValue({ ...selectedReport, archived: true, archivedAt: '2026-09-10T10:00:00Z' });
    renderPage();

    await screen.findByRole('heading', { name: doctor.displayName });
    fireEvent.click(screen.getByRole('button', { name: /30 min · ends/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Select thyroid report' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm appointment' }));

    expect(await screen.findByText(/no longer active/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Thyroid follow-up')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Confirm appointment' })).toBeEnabled();
  });
});
