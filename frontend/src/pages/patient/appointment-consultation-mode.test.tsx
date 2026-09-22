import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientAppointmentDetailPage } from './patient-appointment-detail-page';
import { PatientDoctorDetailPage } from './patient-doctor-detail-r3-page';

const mocks = vi.hoisted(() => ({
  doctor: vi.fn(),
  book: vi.fn(),
  detail: vi.fn(),
  shares: vi.fn(),
  availability: vi.fn(),
  profile: vi.fn(),
  reports: vi.fn(),
}));

vi.mock('../../features/appointments/appointment-api', () => ({
  appointmentApi: {
    doctor: mocks.doctor,
    book: mocks.book,
    detail: mocks.detail,
    shares: mocks.shares,
    availability: mocks.availability,
  },
  appointmentError: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
  appointmentErrorCode: () => null,
}));

vi.mock('../../features/doctor/doctor-profile-api', () => ({ patientFacingDoctorProfile: mocks.profile }));
vi.mock('../../features/patient-reports/patient-report-api', () => ({
  patientReportApi: { list: mocks.reports, detail: vi.fn() },
}));
vi.mock('../../features/patient-reports/patient-report-picker-r3', () => ({
  PatientReportPicker: () => <div>Report picker remains available</div>,
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
  currentOrganization: 'Clinora Test Clinic',
  currentPosition: 'Consultant',
  practiceLocation: 'House 10, Road 4, Dhanmondi, Dhaka',
  registrationJurisdiction: 'Bangladesh',
  registrationAuthority: 'BMDC',
  registrationType: 'Full',
  registrationValidUntil: '2029-01-01',
  nextAvailableAt: '2099-09-20T09:00:00Z',
};

const slot = {
  id: '22222222-2222-2222-2222-222222222222',
  doctorId: doctor.id,
  startsAt: '2099-09-20T09:00:00Z',
  endsAt: '2099-09-20T09:30:00Z',
  timezone: 'Asia/Dhaka',
  status: 'AVAILABLE' as const,
  consultationMode: 'BOTH' as const,
};

const appointment = {
  id: '33333333-3333-3333-3333-333333333333',
  status: 'BOOKED' as const,
  reasonForVisit: 'Follow-up',
  scheduledStart: slot.startsAt,
  scheduledEnd: slot.endsAt,
  bookingTimezone: 'Asia/Dhaka',
  bookedAt: '2099-09-01T08:00:00Z',
  cancelledAt: null,
  consultationMode: 'ONLINE' as const,
  meetingUrl: null,
  meetingLinkUpdatedAt: null,
  visitLocation: null,
  doctorId: doctor.id,
  doctorName: doctor.displayName,
  specialization: doctor.specialization,
  sharedReportCount: 0,
};

describe('appointment consultation modes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.profile.mockResolvedValue(null);
    mocks.reports.mockResolvedValue({ items: [] });
    mocks.shares.mockResolvedValue([]);
    mocks.availability.mockResolvedValue([]);
  });

  it('requires a Patient choice for a BOTH slot and preserves it after a booking error', async () => {
    mocks.doctor.mockResolvedValue({ doctor, availability: [slot] });
    mocks.book.mockRejectedValue(new Error('Booking failed safely'));
    render(
      <MemoryRouter initialEntries={[`/patient/doctors/${doctor.id}`]}>
        <Routes><Route path="/patient/doctors/:doctorId" element={<PatientDoctorDetailPage />} /></Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: doctor.displayName });
    expect(screen.getByRole('button', { name: 'Confirm appointment' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Online consultation/i }));
    expect(screen.getByRole('button', { name: 'Confirm appointment' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /30 min/i }));
    expect(screen.getByRole('button', { name: 'Confirm appointment' })).toBeEnabled();
    fireEvent.change(screen.getByPlaceholderText(/recurring headaches/i), { target: { value: 'Keep this note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm appointment' }));

    expect(await screen.findByText('Booking failed safely')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Online consultation/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByPlaceholderText(/recurring headaches/i)).toHaveValue('Keep this note');
    expect(screen.getByText('Report picker remains available')).toBeInTheDocument();
    expect(mocks.book).toHaveBeenCalledWith(expect.objectContaining({ consultationMode: 'ONLINE' }), expect.any(String));
  });

  it('disables incompatible modes and shows only compatible availability after explicit mode selection', async () => {
    mocks.doctor.mockResolvedValue({ doctor, availability: [{ ...slot, consultationMode: 'IN_PERSON' }] });
    render(
      <MemoryRouter initialEntries={[`/patient/doctors/${doctor.id}`]}>
        <Routes><Route path="/patient/doctors/:doctorId" element={<PatientDoctorDetailPage />} /></Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: doctor.displayName });
    expect(screen.getByRole('button', { name: /Online consultation/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /In-person consultation/i }));
    fireEvent.click(screen.getByRole('button', { name: /30 min/i }));
    expect(screen.getByRole('button', { name: /In-person consultation/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Confirm appointment' })).toBeEnabled();
  });

  it('filters ONLINE and IN_PERSON around one BOTH slot without duplicating it', async () => {
    const onlineSlot = { ...slot, id: 'online', consultationMode: 'ONLINE' as const };
    const bothSlot = { ...slot, id: 'both', startsAt: '2099-09-20T10:00:00Z', endsAt: '2099-09-20T10:30:00Z' };
    const inPersonSlot = {
      ...slot,
      id: 'in-person',
      startsAt: '2099-09-20T11:00:00Z',
      endsAt: '2099-09-20T11:30:00Z',
      consultationMode: 'IN_PERSON' as const,
    };
    mocks.doctor.mockResolvedValue({ doctor, availability: [onlineSlot, bothSlot, inPersonSlot] });
    render(
      <MemoryRouter initialEntries={[`/patient/doctors/${doctor.id}`]}>
        <Routes><Route path="/patient/doctors/:doctorId" element={<PatientDoctorDetailPage />} /></Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: doctor.displayName });
    fireEvent.click(screen.getByRole('button', { name: /Online consultation/i }));
    expect(screen.getByText('2 available')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /30 min/i })).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /In-person consultation/i }));
    expect(screen.getByText('2 available')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /30 min/i })).toHaveLength(2);
  });

  it('shows pending and active online states, but never a Join action for in-person care', async () => {
    mocks.detail.mockResolvedValueOnce(appointment);
    const first = renderDetail();
    expect(await screen.findByText('Meeting link will be provided by the Doctor.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Join consultation/i })).not.toBeInTheDocument();
    first.unmount();

    mocks.detail.mockResolvedValueOnce({ ...appointment, meetingUrl: 'https://meet.example.test/room' });
    const second = renderDetail();
    expect(await screen.findByRole('link', { name: /Join consultation/i })).toHaveAttribute(
      'href',
      'https://meet.example.test/room',
    );
    second.unmount();

    mocks.detail.mockResolvedValueOnce({ ...appointment, consultationMode: 'IN_PERSON', meetingUrl: null });
    renderDetail();
    expect(await screen.findByText('In-person consultation')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('link', { name: /Join consultation/i })).not.toBeInTheDocument());
  });
});

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={[`/patient/appointments/${appointment.id}`]}>
      <Routes><Route path="/patient/appointments/:appointmentId" element={<PatientAppointmentDetailPage />} /></Routes>
    </MemoryRouter>,
  );
}
