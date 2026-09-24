import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientAppointmentsPage } from './patient-appointments-page';
import { PatientDoctorsPage } from './patient-doctors-page';
import { PatientAppointmentDetailPage } from './patient-appointment-detail-page';

const api = vi.hoisted(() => ({
  list: vi.fn(),
  doctors: vi.fn(),
  detail: vi.fn(),
  shares: vi.fn(),
  availability: vi.fn(),
  reschedule: vi.fn(),
  cancel: vi.fn(),
  share: vi.fn(),
  revokeShare: vi.fn(),
  joinStatus: vi.fn(),
  join: vi.fn(),
}));
const reports = vi.hoisted(() => vi.fn());
vi.mock('../../features/appointments/appointment-api', () => ({
  appointmentApi: api,
  appointmentError: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
}));
vi.mock('../../features/patient-reports/patient-report-api', () => ({ patientReportApi: { list: reports } }));
vi.mock('../../components/patient/patient-consultation-summary', () => ({ PatientConsultationSummary: () => null }));
vi.mock('../../features/profile/profile-image', () => ({
  ProfileAvatar: ({ name }: { name: string }) => <span aria-label={`${name} profile photo`} />,
}));

const appointment = {
  id: 'booking-1',
  doctorId: 'doctor-1',
  doctorName: 'Dr. Test One',
  specialization: 'Test specialty',
  status: 'BOOKED',
  scheduledStart: '2099-09-20T09:00:00Z',
  scheduledEnd: '2099-09-20T09:30:00Z',
  bookingTimezone: 'UTC',
  bookedAt: '2099-09-01T08:00:00Z',
  reasonForVisit: 'A follow-up visit',
  consultationMode: 'ONLINE',
  sharedReportCount: 1,
  meetingUrl: 'https://private-room.example.test/never-render',
};
const doctor = {
  id: 'doctor-1',
  displayName: 'Dr. Test One',
  specialization: 'Test specialty',
  professionalTitle: 'Consultant',
  yearsExperience: 8,
  currentPosition: null,
  currentOrganization: 'Test practice',
  nextAvailableAt: '2099-09-20T09:00:00Z',
};
const slots = [
  { id: 'slot-1', startsAt: '2099-09-21T09:00:00Z', status: 'AVAILABLE', consultationMode: 'BOTH' },
  { id: 'slot-2', startsAt: '2099-09-22T10:00:00Z', status: 'AVAILABLE', consultationMode: 'IN_PERSON' },
  { id: 'blocked', startsAt: '2099-09-21T11:00:00Z', status: 'BLOCKED', consultationMode: 'BOTH' },
];
const share = {
  reportId: 'report-1',
  reportName: 'Actual lab report',
  sharedAt: '2099-09-01T08:00:00Z',
  revokedAt: null,
};

function detail() {
  return render(
    <MemoryRouter initialEntries={['/patient/appointments/booking-1']}>
      <Routes>
        <Route path="/patient/appointments/:appointmentId" element={<PatientAppointmentDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  api.list.mockResolvedValue([appointment]);
  api.doctors.mockResolvedValue([
    doctor,
    { ...doctor, id: 'doctor-2', displayName: 'Dr. Another', nextAvailableAt: null },
  ]);
  api.detail.mockResolvedValue(appointment);
  api.shares.mockResolvedValue([share]);
  api.availability.mockResolvedValue(slots);
  api.joinStatus.mockResolvedValue({
    roomReady: true,
    canJoin: false,
    state: 'TOO_EARLY',
    opensAt: '2099-09-20T08:45:00Z',
  });
  reports.mockResolvedValue({ items: [{ id: 'report-2', reportName: 'Another actual report' }] });
});

describe('Patient care overview and discovery', () => {
  it('derives counts from the requested collection, sorts rows and preserves navigation', async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValueOnce([
      appointment,
      { ...appointment, id: 'booking-2', doctorName: 'Dr. Later', scheduledStart: '2099-09-23T09:00:00Z' },
    ]);
    render(
      <MemoryRouter>
        <PatientAppointmentsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('button', { name: 'Upcoming (2)' })).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(api.list).toHaveBeenCalledWith('UPCOMING');
    expect(screen.getAllByRole('article')[0]).toHaveTextContent('Dr. Test One');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'latest');
    expect(screen.getAllByRole('article')[0]).toHaveTextContent('Dr. Later');
    expect(screen.getAllByRole('link', { name: /View details/ })[0]).toHaveAttribute(
      'href',
      '/patient/appointments/booking-2',
    );
    expect(screen.getAllByRole('link', { name: /Find a Doctor/ })[0]).toHaveAttribute('href', '/patient/doctors');
    api.list.mockResolvedValueOnce([]);
    await user.click(screen.getByRole('button', { name: 'Past' }));
    expect(await screen.findByRole('heading', { name: 'No past appointments yet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Past (0)' })).toHaveAttribute('aria-pressed', 'true');
    expect(api.list).toHaveBeenLastCalledWith('PAST');
  });

  it('filters real availability, sorts shown Doctors and forwards search and specialty to the API', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <PatientDoctorsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('No future time published')).toBeInTheDocument();
    expect(screen.getAllByRole('article')[0]).toHaveTextContent('Dr. Test One');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort shown Doctors' }), 'name');
    expect(screen.getAllByRole('article')[0]).toHaveTextContent('Dr. Another');
    await user.click(screen.getByRole('checkbox', { name: 'Has availability' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.queryByText('No future time published')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View profile/ })).toHaveAttribute('href', '/patient/doctors/doctor-1');
    expect(screen.getByRole('link', { name: /My appointments/ })).toHaveAttribute('href', '/patient/appointments');
    await user.selectOptions(screen.getByLabelText('Specialty'), 'Test specialty');
    await waitFor(() =>
      expect(api.doctors).toHaveBeenLastCalledWith({ query: undefined, specialty: 'Test specialty', limit: 30 }),
    );
    await user.type(screen.getByLabelText('Search by Doctor name or specialty'), 'Test');
    await waitFor(() =>
      expect(api.doctors).toHaveBeenLastCalledWith({ query: 'Test', specialty: 'Test specialty', limit: 30 }),
    );
  });

  it('does not display stale Doctor rows when a new search fails', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <PatientDoctorsPage />
      </MemoryRouter>,
    );
    await screen.findByText('Dr. Test One');
    api.doctors.mockRejectedValue(new Error('Search unavailable'));
    await user.type(screen.getByLabelText('Search by Doctor name or specialty'), 'unmatched');
    expect(await screen.findByText('Search unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.queryByText('2 shown')).not.toBeInTheDocument();
  });
});

describe('Patient appointment details', () => {
  it('renders actual metadata, report links, booking record and a server-restricted join', async () => {
    const { container } = detail();
    expect(await screen.findByRole('heading', { level: 1, name: appointment.doctorName })).toBeInTheDocument();
    expect(screen.getByText('A follow-up visit')).toBeInTheDocument();
    expect(screen.getByText('UTC')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Actual lab report' })).toHaveAttribute(
      'href',
      '/patient/reports/report-1',
    );
    expect(screen.getByRole('heading', { name: 'Booking record' })).toBeInTheDocument();
    expect(await screen.findByText('Meeting room ready')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join consultation' })).toBeDisabled();
    expect(document.body).not.toHaveTextContent(appointment.meetingUrl);
    expect(api.join).not.toHaveBeenCalled();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('groups available times by date and requires a compatible consultation mode before rescheduling', async () => {
    const user = userEvent.setup();
    detail();
    const date = await screen.findByRole('combobox', { name: /Appointment date/ });
    expect(within(screen.getByRole('group', { name: 'Available times' })).getAllByRole('button')).toHaveLength(1);
    await user.click(within(screen.getByRole('group', { name: 'Available times' })).getByRole('button'));
    expect(screen.getByRole('button', { name: 'Reschedule appointment' })).toBeEnabled();
    await user.selectOptions(date, '2099-09-22');
    expect(screen.getByRole('button', { name: 'Reschedule appointment' })).toBeDisabled();
    await user.click(within(screen.getByRole('group', { name: 'Available times' })).getByRole('button'));
    expect(screen.getByRole('button', { name: 'Reschedule appointment' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'In-person' }));
    const updated = { ...appointment, consultationMode: 'IN_PERSON', scheduledStart: slots[1].startsAt };
    api.reschedule.mockResolvedValue(updated);
    api.detail.mockResolvedValue(updated);
    await user.click(screen.getByRole('button', { name: 'Reschedule appointment' }));
    await waitFor(() => expect(api.reschedule).toHaveBeenCalledWith('booking-1', 'slot-2', 'UTC', 'IN_PERSON'));
    expect(await screen.findByRole('heading', { name: 'In-person consultation' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Join consultation' })).not.toBeInTheDocument();
  });

  it('preserves Patient-controlled sharing and revocation', async () => {
    const user = userEvent.setup();
    detail();
    await screen.findByText('Actual lab report');
    api.shares.mockResolvedValue([]);
    await user.click(screen.getByRole('button', { name: 'Stop sharing' }));
    await waitFor(() => expect(api.revokeShare).toHaveBeenCalledWith('booking-1', 'report-1'));
    expect(await screen.findByRole('heading', { name: 'No reports shared' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Share another report'), 'report-2');
    api.shares.mockResolvedValue([{ ...share, reportId: 'report-2', reportName: 'Another actual report' }]);
    await user.click(screen.getByRole('button', { name: 'Share report' }));
    await waitFor(() => expect(api.share).toHaveBeenCalledWith('booking-1', 'report-2'));
    expect(await screen.findByRole('link', { name: 'Another actual report' })).toBeInTheDocument();
  });

  it('requires the existing confirmation dialog to cancel and removes management after cancellation', async () => {
    const user = userEvent.setup();
    detail();
    await user.click(await screen.findByRole('button', { name: 'Cancel appointment' }));
    expect(api.cancel).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Reason (optional)'), 'Plans changed');
    const cancelled = { ...appointment, status: 'CANCELLED', sharedReportCount: 0 };
    api.cancel.mockResolvedValue(cancelled);
    api.detail.mockResolvedValue(cancelled);
    api.shares.mockResolvedValue([]);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel appointment' }));
    await waitFor(() => expect(api.cancel).toHaveBeenCalledWith('booking-1', 'Plans changed'));
    expect(await screen.findByText(/This appointment is cancelled/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reschedule appointment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Join consultation' })).not.toBeInTheDocument();
  });
});
