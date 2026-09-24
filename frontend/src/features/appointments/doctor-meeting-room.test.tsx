import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { DoctorMeetingRoom } from './doctor-meeting-room';
const save = vi.hoisted(() => vi.fn());
vi.mock('./appointment-api', async () => {
  const actual = await vi.importActual<typeof import('./appointment-api')>('./appointment-api');
  return { ...actual, doctorAvailabilityApi: { saveMeetingRoom: save } };
});
beforeEach(() => vi.resetAllMocks());
function Room({ initial = null }: { initial?: string | null }) {
  const [url, setUrl] = useState(initial);
  return <DoctorMeetingRoom currentUrl={url} onSaved={setUrl} />;
}
it('shows saved URL, security guidance and updates the test link only after a successful save', async () => {
  const user = userEvent.setup();
  save.mockResolvedValue({ defaultMeetingUrl: 'https://meet.example.test/new', updatedAppointments: 2 });
  render(<Room initial="https://meet.example.test/old" />);
  expect(screen.getByLabelText('Default meeting room')).toHaveValue('https://meet.example.test/old');
  expect(screen.getByText(/Meeting access is controlled by your provider/)).toBeInTheDocument();
  await user.clear(screen.getByLabelText('Default meeting room'));
  await user.type(screen.getByLabelText('Default meeting room'), 'https://meet.example.test/new');
  expect(screen.getByRole('link', { name: 'Test your meeting room' })).toHaveAttribute(
    'href',
    'https://meet.example.test/old',
  );
  await user.click(screen.getByRole('button', { name: 'Change meeting URL' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('2 future online appointments updated'));
  expect(screen.getByRole('link', { name: 'Test your meeting room' })).toHaveAttribute(
    'href',
    'https://meet.example.test/new',
  );
  expect(screen.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer');
});
it.each(['http://meet.example.test/room', 'javascript:alert(1)', 'https://user:pass@meet.example.test'])(
  'surfaces the authoritative backend HTTPS validation for %s',
  async (url) => {
    save.mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: 'Use a valid HTTPS meeting URL without embedded credentials.' } },
    });
    const user = userEvent.setup();
    render(<Room />);
    await user.type(screen.getByLabelText('Default meeting room'), url);
    await user.click(screen.getByRole('button', { name: 'Save meeting URL' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('valid HTTPS');
    expect(save).toHaveBeenCalledWith(url);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  },
);
it('starts empty and shows saving until backend success, then the saved URL', async () => {
  let finish!: (value: { defaultMeetingUrl: string; updatedAppointments: number }) => void;
  save.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const user = userEvent.setup();
  render(<Room />);
  expect(screen.getByLabelText('Default meeting room')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Save meeting URL' })).toBeDisabled();
  await user.type(screen.getByLabelText('Default meeting room'), 'https://meet.example.test/new');
  await user.click(screen.getByRole('button', { name: 'Save meeting URL' }));
  expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  finish({ defaultMeetingUrl: 'https://meet.example.test/new', updatedAppointments: 0 });
  expect(await screen.findByRole('status')).toHaveTextContent('Meeting room saved.');
  expect(screen.getByRole('button', { name: 'Change meeting URL' })).toBeDisabled();
});
it('keeps the persisted link when changing the room fails', async () => {
  save.mockRejectedValue(new Error());
  const user = userEvent.setup();
  render(<Room initial="https://meet.example.test/old" />);
  await user.clear(screen.getByLabelText('Default meeting room'));
  await user.type(screen.getByLabelText('Default meeting room'), 'https://meet.example.test/new');
  await user.click(screen.getByRole('button', { name: 'Change meeting URL' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('We could not save your meeting room.');
  expect(screen.getByRole('link')).toHaveAttribute('href', 'https://meet.example.test/old');
  expect(screen.getByLabelText('Default meeting room')).toHaveValue('https://meet.example.test/new');
});
