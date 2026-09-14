import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './login-page';

const mocks = vi.hoisted(() => ({ login: vi.fn() }));

vi.mock('../../features/auth/auth-api', () => ({
  authApi: { login: mocks.login },
  apiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

const userFor = (role: string) => ({
  accessToken: 'token',
  accessTokenExpiresAt: '2026-09-10T12:00:00Z',
  user: {
    id: '11111111-1111-1111-1111-111111111111',
    firstName: 'Clinora',
    lastName: role,
    email: `${role.toLowerCase()}@clinora.test`,
    role,
    accountStatus: 'ACTIVE',
    emailVerified: true,
  },
});

function renderLogin(role: string, from?: string) {
  mocks.login.mockResolvedValue(userFor(role));
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state: from ? { from } : null }]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/doctor" element={<div>Doctor dashboard destination</div>} />
        <Route path="/patient" element={<div>Patient dashboard destination</div>} />
        <Route path="/account" element={<div>Account destination</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function submitLogin() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), 'person@clinora.test');
  await user.type(screen.getByLabelText('Password'), 'LocalPassword1!');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('role-aware login navigation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lands a Doctor on the Doctor dashboard', async () => {
    renderLogin('DOCTOR');
    await submitLogin();
    expect(await screen.findByText('Doctor dashboard destination')).toBeInTheDocument();
  });

  it('lands a Patient on the Patient dashboard', async () => {
    renderLogin('PATIENT');
    await submitLogin();
    expect(await screen.findByText('Patient dashboard destination')).toBeInTheDocument();
  });

  it('ignores stale Account & Security redirect state for a Doctor', async () => {
    renderLogin('DOCTOR', '/account');
    await submitLogin();
    expect(await screen.findByText('Doctor dashboard destination')).toBeInTheDocument();
    expect(screen.queryByText('Account destination')).not.toBeInTheDocument();
  });

  it.each(['SYSTEM_ADMIN', 'RESEARCHER'])('preserves the %s account landing', async (role) => {
    renderLogin(role);
    await submitLogin();
    expect(await screen.findByText('Account destination')).toBeInTheDocument();
  });
});
