import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../../features/auth/auth-store';
import { parseUserAgent } from '../../features/auth/session-display';
import { PatientShell } from '../../features/patient/patient-layout';
import { AccountPage } from './account-page';

const mocks = vi.hoisted(() => ({
  sessions: vi.fn(),
  changePassword: vi.fn(),
  revokeSession: vi.fn(),
  revokeOtherSessions: vi.fn(),
  logout: vi.fn(),
}));
vi.mock('../../features/auth/auth-api', () => ({
  authApi: {
    sessions: mocks.sessions,
    changePassword: mocks.changePassword,
    revokeSession: mocks.revokeSession,
    revokeOtherSessions: mocks.revokeOtherSessions,
    logout: mocks.logout,
  },
  apiErrorMessage: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
}));

const patient = {
  id: '1',
  firstName: 'Pia',
  lastName: 'Patient',
  email: 'pia@example.test',
  role: 'PATIENT',
  accountStatus: 'ACTIVE',
  emailVerified: true,
};
const sessions = [
  {
    id: 'other',
    createdAt: '2026-08-20T10:00:00Z',
    lastUsedAt: '2026-08-25T10:00:00Z',
    expiresAt: '2026-09-20T10:00:00Z',
    userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36',
    ipAddress: '203.0.113.2',
    current: false,
  },
  {
    id: 'current',
    createdAt: '2026-08-26T10:00:00Z',
    lastUsedAt: '2026-08-26T12:00:00Z',
    expiresAt: '2026-09-26T10:00:00Z',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
    ipAddress: '203.0.113.1',
    current: true,
  },
];

describe('Account & Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ status: 'authenticated', accessToken: 'token', user: patient });
    mocks.sessions.mockResolvedValue(sessions);
    mocks.changePassword.mockResolvedValue({});
    mocks.revokeSession.mockResolvedValue({});
    mocks.revokeOtherSessions.mockResolvedValue({});
    mocks.logout.mockResolvedValue(undefined);
  });

  it('uses a focused settings workspace instead of stacking every account section', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Account' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Password' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Password' }));
    expect(screen.getByRole('heading', { name: 'Password' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Account' })).not.toBeInTheDocument();
  });

  it('validates password confirmation and shows live backend-aligned requirements', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );
    await screen.findByText('2 active');
    await user.click(screen.getByRole('button', { name: 'Password' }));
    await user.type(screen.getByLabelText('Current password'), 'OldPassword1!');
    await user.type(screen.getByLabelText('New password'), 'NewPassword1!');
    const requirements = screen.getByLabelText('Password requirements');
    expect(within(requirements).getByText('At least 8 characters')).toBeInTheDocument();
    expect(within(requirements).getAllByText('met')).toHaveLength(5);
    await user.type(screen.getByLabelText('Confirm new password'), 'Mismatch1!');
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(mocks.changePassword).not.toHaveBeenCalled();
  });

  it('uses human-readable session labels and reveals technical details on request', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );
    await screen.findByText('2 active');
    await user.click(screen.getByRole('button', { name: 'Sessions' }));
    expect(await screen.findByText('Chrome on Windows')).toBeInTheDocument();
    expect(screen.getByText('Chrome on Android')).toBeInTheDocument();
    expect(screen.getAllByText('Current device').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Active now').length).toBeGreaterThan(0);
    const currentSession = screen.getByText('Chrome on Windows').closest('article')!;
    await user.click(within(currentSession).getByText('View technical details'));
    expect(within(currentSession).getByText('203.0.113.1')).toBeInTheDocument();
    expect(within(currentSession).getByText('Chrome 131.0.0.0')).toBeInTheDocument();
  });

  it('requires confirmation before signing out other devices', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );
    await screen.findByText('2 active');
    await user.click(screen.getByRole('button', { name: 'Sessions' }));
    await user.click(screen.getByRole('button', { name: 'Sign out other devices' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(mocks.revokeOtherSessions).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sign out other devices' }));
    await waitFor(() => expect(mocks.revokeOtherSessions).toHaveBeenCalledTimes(1));
  });

  it('renders the Patient account inside the Patient shell while non-Patient account remains standalone', async () => {
    const { unmount } = render(
      <MemoryRouter>
        <PatientShell>
          <AccountPage embedded />
        </PatientShell>
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Account & Security' });
    expect(screen.getAllByRole('navigation', { name: /patient/i }).length).toBeGreaterThan(0);
    unmount();
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'token',
      user: { ...patient, role: 'SYSTEM_ADMIN' },
    });
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Account & Security' });
    expect(screen.queryByRole('navigation', { name: /patient/i })).not.toBeInTheDocument();
    expect(screen.getByText('System Admin')).toBeInTheDocument();
  });
});

describe('parseUserAgent', () => {
  it('handles Safari, Firefox, and unknown devices', () => {
    expect(
      parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1')
        .label,
    ).toBe('Safari on iPhone');
    expect(parseUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0').label).toBe(
      'Firefox on Linux',
    );
    expect(parseUserAgent(null).label).toBe('Unknown browser/device');
  });
});
