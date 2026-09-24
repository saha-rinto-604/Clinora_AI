import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, expect, it, vi } from 'vitest';
import { DoctorAvailabilityWorkspacePage } from './doctor-availability-r3-page';
import type { AvailabilitySlot, WeeklyRoutine } from '../../features/appointments/appointment-api';
import { dateKey } from '../../features/appointments/weekly-availability';
const mocks = vi.hoisted(() => ({ weekly: vi.fn(), list: vi.fn(), saveWeekly: vi.fn(), saveMeetingRoom: vi.fn() }));
vi.mock('../../features/appointments/appointment-api', async () => {
  const actual = await vi.importActual<typeof import('../../features/appointments/appointment-api')>(
    '../../features/appointments/appointment-api',
  );
  return { ...actual, doctorAvailabilityApi: mocks };
});
const routine: WeeklyRoutine = {
  version: 3,
  slotMinutes: 35,
  timezone: 'America/New_York',
  defaultMeetingUrl: null,
  blocks: [{ weekday: 1, start: '10:00', end: '13:00', consultationMode: 'IN_PERSON', enabled: true }],
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.weekly.mockResolvedValue(routine);
  mocks.list.mockResolvedValue([]);
  mocks.saveWeekly.mockImplementation(async (input) => ({ ...input, version: 4, defaultMeetingUrl: null }));
});
const load = async () => {
  render(<DoctorAvailabilityWorkspacePage />);
  await screen.findByLabelText('Timezone');
};
const field = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

it('loads persisted values and all seven weekdays, with off days hiding inputs', async () => {
  await load();
  expect(screen.getByLabelText('Timezone')).toHaveValue('America/New_York');
  expect(screen.getByLabelText('Appointment duration')).toHaveValue('35');
  expect(screen.getAllByRole('switch')).toHaveLength(7);
  expect(screen.getByRole('switch', { name: 'Monday availability' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByLabelText('Monday block 1 start')).toHaveValue('10:00');
  const friday = within(screen.getByRole('region', { name: 'Friday' }));
  expect(friday.getByText('Unavailable')).toBeInTheDocument();
  expect(friday.queryByRole('combobox')).not.toBeInTheDocument();
  expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save weekly routine' })).toBeDisabled();
});

it('enables an empty local block, toggles without saving, and restores its draft', async () => {
  const user = userEvent.setup();
  await load();
  await user.click(screen.getByRole('switch', { name: 'Tuesday availability' }));
  expect(screen.getByLabelText('Tuesday block 1 start')).toHaveValue('');
  expect(screen.getByText('Choose a start and end time.')).toBeInTheDocument();
  field('Tuesday block 1 start', '16:00');
  field('Tuesday block 1 end', '18:00');
  await user.click(screen.getByRole('switch', { name: 'Tuesday availability' }));
  expect(screen.queryByLabelText('Tuesday block 1 start')).not.toBeInTheDocument();
  await user.click(screen.getByRole('switch', { name: 'Tuesday availability' }));
  expect(screen.getByLabelText('Tuesday block 1 start')).toHaveValue('16:00');
  expect(mocks.saveWeekly).not.toHaveBeenCalled();
});

it('adds and removes multiple blocks, changes settings, and saves only enabled rules', async () => {
  const user = userEvent.setup();
  await load();
  await user.click(screen.getByRole('button', { name: 'Add time block for Monday' }));
  field('Monday block 2 start', '16:00');
  field('Monday block 2 end', '18:00');
  await user.click(screen.getByRole('button', { name: 'Remove Monday block 1' }));
  expect(screen.getByLabelText('Monday block 1 start')).toHaveValue('16:00');
  await user.click(screen.getByRole('switch', { name: 'Tuesday availability' }));
  await user.click(screen.getByRole('switch', { name: 'Tuesday availability' }));
  await user.selectOptions(screen.getByLabelText('Appointment duration'), '45');
  field('Timezone', 'Europe/London');
  expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Save weekly routine' }));
  expect(await screen.findByRole('button', { name: 'Saved' })).toBeDisabled();
  expect(mocks.saveWeekly).toHaveBeenCalledWith({
    version: 3,
    slotMinutes: 45,
    timezone: 'Europe/London',
    blocks: [{ weekday: 1, start: '16:00', end: '18:00', consultationMode: 'IN_PERSON', enabled: true }],
  });
  expect(mocks.list).toHaveBeenCalledTimes(2);
});

it('loads multiple persisted blocks and shows friendly consultation labels', async () => {
  mocks.weekly.mockResolvedValue({
    ...routine,
    defaultMeetingUrl: 'https://meet.example.test/room',
    blocks: [routine.blocks[0], { weekday: 1, start: '16:00', end: '18:00', consultationMode: 'BOTH', enabled: true }],
  });
  await load();
  expect(screen.getByLabelText('Monday block 2 start')).toHaveValue('16:00');
  const mode = within(screen.getByLabelText('Monday block 2 consultation mode'));
  for (const label of ['Online', 'In-person', 'Online + In-person'])
    expect(mode.getByRole('option', { name: label })).toBeInTheDocument();
});

it.each(['ONLINE', 'BOTH'])('requires a saved room for %s and permits it after the room API succeeds', async (mode) => {
  const user = userEvent.setup();
  await load();
  await user.selectOptions(screen.getByLabelText('Monday block 1 consultation mode'), mode);
  expect(screen.getByText(/Save your default meeting room before/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save weekly routine' })).toBeDisabled();
  mocks.saveMeetingRoom.mockResolvedValue({
    defaultMeetingUrl: 'https://meet.example.test/room',
    updatedAppointments: 0,
  });
  await user.type(screen.getByLabelText('Default meeting room'), 'https://meet.example.test/room');
  // Typing a URL alone cannot enable publishing online availability.
  expect(screen.getByRole('button', { name: 'Save weekly routine' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Save meeting URL' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save weekly routine' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: 'Save weekly routine' }));
  expect(mocks.saveWeekly).toHaveBeenCalledWith(
    expect.objectContaining({ blocks: [expect.objectContaining({ consultationMode: mode })] }),
  );
});

it('validates reversed times, short blocks, overlaps and timezone beside the fields', async () => {
  const user = userEvent.setup();
  await load();
  field('Monday block 1 end', '09:00');
  expect(screen.getByText('End time must be after start time.')).toBeInTheDocument();
  field('Monday block 1 end', '10:15');
  expect(screen.getByText('This block must fit at least one appointment.')).toBeInTheDocument();
  field('Monday block 1 end', '13:00');
  await user.click(screen.getByRole('button', { name: 'Add time block for Monday' }));
  field('Monday block 2 start', '12:00');
  field('Monday block 2 end', '14:00');
  expect(screen.getAllByText('Time blocks on this day must not overlap.')).toHaveLength(2);
  field('Timezone', 'Not/AZone');
  expect(screen.getByText('Choose a valid timezone.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save weekly routine' })).toBeDisabled();
});

it('allows adjacent blocks when persisted times include seconds', async () => {
  mocks.weekly.mockResolvedValue({
    ...routine,
    blocks: [{ ...routine.blocks[0], start: '10:00:00', end: '13:00:00' }],
  });
  const user = userEvent.setup();
  await load();
  await user.click(screen.getByRole('button', { name: 'Add time block for Monday' }));
  field('Monday block 2 start', '13:00');
  field('Monday block 2 end', '14:00');
  expect(screen.queryByText('Time blocks on this day must not overlap.')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save weekly routine' })).toBeEnabled();
});

it('keeps unsaved edits and backend validation on save failure', async () => {
  mocks.saveWeekly.mockRejectedValue({
    isAxiosError: true,
    response: { data: { message: 'Your weekly routine changed. Reload before saving.' } },
  });
  const user = userEvent.setup();
  await load();
  field('Monday block 1 start', '11:00');
  await user.click(screen.getByRole('button', { name: 'Save weekly routine' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Your weekly routine changed. Reload before saving.');
  expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  expect(screen.getByLabelText('Monday block 1 start')).toHaveValue('11:00');
  expect(screen.queryByRole('button', { name: 'Saved' })).not.toBeInTheDocument();
});

it('does not call a successful save a failure when only the preview refresh fails', async () => {
  const user = userEvent.setup();
  await load();
  mocks.list.mockRejectedValueOnce(new Error());
  field('Monday block 1 start', '11:00');
  await user.click(screen.getByRole('button', { name: 'Save weekly routine' }));
  expect(await screen.findByRole('button', { name: 'Saved' })).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('preview could not refresh');
  expect(screen.queryByText('No availability')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Retry preview' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});

it('shows saving until the routine API resolves', async () => {
  let finish!: (value: WeeklyRoutine) => void;
  mocks.saveWeekly.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const user = userEvent.setup();
  await load();
  field('Monday block 1 start', '11:00');
  await user.click(screen.getByRole('button', { name: 'Save weekly routine' }));
  expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  finish({ ...routine, version: 4 });
  await screen.findByRole('button', { name: 'Saved' });
});

it('renders backend slots, preserves a booked item in the preview, expands and navigates both weeks', async () => {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(12, 0, 0, 0);
  const inventory: AvailabilitySlot[] = Array.from({ length: 6 }, (_, i) => ({
    id: `slot-${i}`,
    doctorId: 'doctor',
    startsAt: new Date(tomorrow.getTime() + i * 3600000).toISOString(),
    endsAt: new Date(tomorrow.getTime() + i * 3600000 + 1800000).toISOString(),
    timezone: routine.timezone,
    status: i === 5 ? 'BOOKED' : 'AVAILABLE',
    consultationMode: 'BOTH',
  }));
  const nextWeek = {
    ...inventory[0],
    id: 'week-2',
    startsAt: new Date(tomorrow.getTime() + 7 * 86400000).toISOString(),
    endsAt: new Date(tomorrow.getTime() + 7 * 86400000 + 1800000).toISOString(),
  };
  mocks.list.mockResolvedValue([...inventory, nextWeek, { ...inventory[0], id: 'blocked', status: 'BLOCKED' }]);
  const user = userEvent.setup();
  await load();
  expect(screen.getAllByText('Available')).toHaveLength(2);
  expect(screen.getByText('Booked')).toBeInTheDocument();
  expect(screen.getAllByText('No availability')).toHaveLength(6);
  const booked = screen.getByText('Booked').closest('li')!;
  expect(within(booked).queryByRole('button')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /Show 3 more slots/ }));
  expect(screen.getAllByText('Available')).toHaveLength(5);
  await user.click(screen.getByRole('button', { name: 'Next week' }));
  expect(screen.getAllByText('Available')).toHaveLength(1);
  expect(screen.queryByText('Booked')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Next week' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Previous week' }));
  expect(screen.getByText('Booked')).toBeInTheDocument();
  expect(mocks.list).toHaveBeenCalledWith(
    expect.objectContaining({ from: expect.any(String), until: expect.any(String) }),
  );
});

it('does not shift the published calendar when the timezone draft changes', async () => {
  await load();
  field('Timezone', 'Asia/Tokyo');
  expect(screen.getByText('Times shown in America/New_York')).toBeInTheDocument();
});

it('does not replace missing backend timezone with a browser default', async () => {
  mocks.weekly.mockResolvedValue({ ...routine, timezone: null });
  await load();
  expect(screen.getByLabelText('Timezone')).toHaveValue('');
  expect(screen.getByText('Save your timezone to preview upcoming availability.')).toBeInTheDocument();
});

it('groups instants on their actual local date across midnight and DST', () => {
  expect(dateKey(new Date('2026-03-08T04:30:00Z'), 'America/New_York')).toBe('2026-03-07');
  expect(dateKey(new Date('2026-03-08T07:30:00Z'), 'America/New_York')).toBe('2026-03-08');
  expect(dateKey(new Date('2026-09-24T23:30:00Z'), 'Asia/Tokyo')).toBe('2026-09-25');
});

it('exposes accessible names and labelled switches without automated accessibility violations', async () => {
  const { container } = render(<DoctorAvailabilityWorkspacePage />);
  await screen.findByLabelText('Timezone');
  expect(await axe(container)).toHaveNoViolations();
});
