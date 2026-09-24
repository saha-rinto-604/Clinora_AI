import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { DoctorAvailabilityWorkspacePage } from './doctor-availability-r3-page';
const mocks = vi.hoisted(() => ({ weekly: vi.fn(), list: vi.fn(), saveWeekly: vi.fn() }));
vi.mock('../../features/appointments/appointment-api', async () => {
  const actual = await vi.importActual<typeof import('../../features/appointments/appointment-api')>(
    '../../features/appointments/appointment-api',
  );
  return { ...actual, doctorAvailabilityApi: mocks };
});
const routine = {
  version: 3,
  slotMinutes: 30,
  timezone: 'Asia/Dhaka',
  defaultMeetingUrl: null,
  blocks: [{ weekday: 1, start: '10:00', end: '13:00', consultationMode: 'IN_PERSON', enabled: true }],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.weekly.mockResolvedValue(routine);
  mocks.list.mockResolvedValue([]);
  mocks.saveWeekly.mockImplementation(async (input) => ({ ...input, version: 4, defaultMeetingUrl: null }));
});
it('loads persisted routine, adds/removes a block and saves duration and weekday edits', async () => {
  const user = userEvent.setup();
  render(<DoctorAvailabilityWorkspacePage />);
  expect(await screen.findByLabelText('Timezone')).toHaveValue('Asia/Dhaka');
  const monday = within(screen.getByRole('region', { name: 'Monday' }));
  expect(monday.getByLabelText('From')).toHaveValue('10:00');
  await user.click(screen.getByRole('button', { name: /Add block for Tuesday/ }));
  const tuesday = within(screen.getByRole('region', { name: 'Tuesday' }));
  expect(tuesday.getByLabelText('From')).toHaveValue('');
  await user.click(tuesday.getByRole('button', { name: /Remove Tuesday/ }));
  await user.selectOptions(screen.getByLabelText('Appointment duration'), '45');
  await user.click(screen.getByRole('button', { name: 'Save weekly routine' }));
  expect(await screen.findByText(/Weekly routine saved/)).toBeInTheDocument();
  expect(mocks.saveWeekly).toHaveBeenCalledWith({
    version: 3,
    slotMinutes: 45,
    timezone: 'Asia/Dhaka',
    blocks: routine.blocks,
  });
});
it.each(['ONLINE', 'BOTH'])('blocks publishing %s without a configured room', async (mode) => {
  const user = userEvent.setup();
  render(<DoctorAvailabilityWorkspacePage />);
  await screen.findByLabelText('Timezone');
  await user.selectOptions(screen.getByLabelText('Mode'), mode);
  expect(
    screen.getByText('Add your online consultation room before enabling Online availability.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save weekly routine' })).toBeDisabled();
  expect(mocks.saveWeekly).not.toHaveBeenCalled();
});

it.each(['ONLINE', 'BOTH'])('saves %s with a persisted room and displays published inventory', async (mode) => {
  mocks.weekly.mockResolvedValue({ ...routine, defaultMeetingUrl: 'https://meet.example.test/room' });
  mocks.list.mockResolvedValue([
    {
      id: 'slot',
      startsAt: '2099-10-01T09:00:00Z',
      endsAt: '2099-10-01T09:30:00Z',
      timezone: 'Asia/Dhaka',
      consultationMode: 'BOTH',
      status: 'AVAILABLE',
    },
  ]);
  const user = userEvent.setup();
  render(<DoctorAvailabilityWorkspacePage />);
  await screen.findByLabelText('Timezone');
  expect(screen.getByRole('heading', { name: 'Weekly availability' })).toBeInTheDocument();
  expect(screen.getByText(/Online \+ In-person.*available/)).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText('Mode'), mode);
  await user.click(screen.getByRole('button', { name: 'Save weekly routine' }));
  expect(await screen.findByText(/Weekly routine saved/)).toBeInTheDocument();
  expect(mocks.saveWeekly).toHaveBeenCalledWith(
    expect.objectContaining({ blocks: [expect.objectContaining({ consultationMode: mode })] }),
  );
});
