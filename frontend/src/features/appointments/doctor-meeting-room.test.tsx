import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { DoctorMeetingRoom } from './doctor-meeting-room';
const save = vi.hoisted(() => vi.fn());
vi.mock('./appointment-api', () => ({
  doctorAvailabilityApi: { saveMeetingRoom: save },
  appointmentError: (_e: unknown, fallback: string) => fallback,
}));
beforeEach(() => vi.clearAllMocks());
it('shows the configured room, provider guidance and saves a replacement HTTPS room', async () => {
  const user = userEvent.setup(),
    changed = vi.fn();
  save.mockResolvedValue({ defaultMeetingUrl: 'https://meet.example.test/new', updatedAppointments: 2 });
  render(<DoctorMeetingRoom currentUrl="https://meet.example.test/old" onSaved={changed} />);
  expect(screen.getByLabelText('Default meeting room')).toHaveValue('https://meet.example.test/old');
  expect(screen.getByText(/Meeting admission is controlled by your meeting provider/)).toBeInTheDocument();
  await user.clear(screen.getByLabelText('Default meeting room'));
  await user.type(screen.getByLabelText('Default meeting room'), 'https://meet.example.test/new');
  await user.click(screen.getByRole('button', { name: 'Change meeting URL' }));
  await waitFor(() => expect(changed).toHaveBeenCalledWith('https://meet.example.test/new'));
  expect(screen.getByRole('status')).toHaveTextContent('2 future online appointments updated');
});
it.each(['http://meet.example.test/room', 'javascript:alert(1)', 'https://user:pass@meet.example.test'])(
  'rejects unsafe room %s',
  async (url) => {
    const user = userEvent.setup();
    render(<DoctorMeetingRoom currentUrl={null} onSaved={vi.fn()} />);
    await user.type(screen.getByLabelText('Default meeting room'), url);
    await user.click(screen.getByRole('button', { name: 'Save meeting URL' }));
    expect(screen.getByRole('alert')).toHaveTextContent('valid HTTPS');
    expect(save).not.toHaveBeenCalled();
  },
);
