import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DoctorNotificationBell } from './doctor-notification-bell';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  unreadCount: vi.fn(),
  read: vi.fn(),
  readAll: vi.fn(),
  connect: vi.fn(() => () => undefined),
}));

vi.mock('./doctor-notification-api', () => ({
  doctorNotificationApi: {
    list: mocks.list,
    unreadCount: mocks.unreadCount,
    read: mocks.read,
    readAll: mocks.readAll,
  },
}));

vi.mock('./doctor-notification-stream', () => ({
  connectDoctorNotificationStream: mocks.connect,
}));

describe('DoctorNotificationBell', () => {
  beforeEach(() => {
    mocks.unreadCount.mockResolvedValue(3);
    mocks.list.mockResolvedValue({
      items: [
        {
          id: 'notification-1',
          type: 'DOCTOR_APPOINTMENT_BOOKED',
          category: 'APPOINTMENTS',
          title: 'New appointment booked',
          body: 'A Patient booked an appointment in your schedule.',
          targetType: 'APPOINTMENT',
          targetId: 'appointment-1',
          createdAt: '2026-09-24T08:00:00Z',
          readAt: null,
        },
      ],
      unreadCount: 3,
      hasMore: false,
      nextBefore: null,
      nextBeforeId: null,
    });
    mocks.read.mockResolvedValue({});
  });

  it('renders the unread badge and opens the authorized Doctor appointment target', async () => {
    render(
      <MemoryRouter initialEntries={['/doctor']}>
        <Routes>
          <Route path="/doctor" element={<DoctorNotificationBell />} />
          <Route path="/doctor/appointments/:appointmentId" element={<h1>Doctor appointment</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    const bell = await screen.findByRole('button', { name: 'Notifications, 3 unread' });
    await userEvent.click(bell);
    await userEvent.click(await screen.findByRole('button', { name: /New appointment booked/ }));

    expect(mocks.read).toHaveBeenCalledWith('notification-1');
    expect(await screen.findByRole('heading', { name: 'Doctor appointment' })).toBeInTheDocument();
  });
});
