import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from './auth-store';
import { ProtectedRoute } from './protected-route';

const adminUser = {
  id: '00000000-0000-0000-0000-000000000001',
  firstName: 'Clinora',
  lastName: 'Admin',
  email: 'admin@example.com',
  role: 'SYSTEM_ADMIN',
  accountStatus: 'ACTIVE',
  emailVerified: true,
};

function renderAdminRoute() {
  return render(
    <MemoryRouter initialEntries={['/admin/access-reviews']}>
      <Routes>
        <Route element={<ProtectedRoute allowedRoles={['SYSTEM_ADMIN']} />}>
          <Route path="/admin/access-reviews" element={<div>Access reviews</div>} />
        </Route>
        <Route path="/account" element={<div>Account security</div>} />
        <Route path="/login" element={<div>Login</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderAccountRoute() {
  return render(
    <MemoryRouter initialEntries={['/account']}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/account" element={<div>Account security</div>} />
        </Route>
        <Route path="/login" element={<div>Login</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute role enforcement', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'anonymous', accessToken: null, user: null });
  });

  it('allows an authenticated System Admin through a System Admin-only boundary', () => {
    useAuthStore.setState({ status: 'authenticated', accessToken: 'token', user: adminUser });

    renderAdminRoute();

    expect(screen.getByText('Access reviews')).toBeInTheDocument();
  });

  it.each(['PATIENT', 'DOCTOR', 'RESEARCHER'])(
    'redirects an authenticated %s user away from a System Admin-only boundary',
    (role) => {
      useAuthStore.setState({
        status: 'authenticated',
        accessToken: 'token',
        user: { ...adminUser, role, email: `${role.toLowerCase()}@example.com` },
      });

      renderAdminRoute();

      expect(screen.getByText('Account security')).toBeInTheDocument();
      expect(screen.queryByText('Access reviews')).not.toBeInTheDocument();
    },
  );

  it('does not expose protected content while restoring authentication state', () => {
    useAuthStore.setState({ status: 'unknown', accessToken: null, user: null });

    renderAdminRoute();

    expect(screen.getByRole('status')).toHaveTextContent('Restoring secure session...');
    expect(screen.queryByText('Access reviews')).not.toBeInTheDocument();
  });

  it('still redirects anonymous users to the common login route', () => {
    renderAdminRoute();

    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  it('keeps ordinary authenticated account routes available without a role allow-list', () => {
    useAuthStore.setState({ status: 'authenticated', accessToken: 'token', user: adminUser });

    renderAccountRoute();

    expect(screen.getByText('Account security')).toBeInTheDocument();
  });
});
