import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../../App';
import { useAuthStore } from '../../features/auth/auth-store';

describe('Phase 4B auth routes', () => {
  it('renders Patient registration without a role selector', () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /create your clinora account/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create patient account/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/role/i)).not.toBeInTheDocument();
  });

  it('redirects an anonymous account request to login', async () => {
    useAuthStore.setState({ status: 'anonymous', accessToken: null, user: null });

    render(
      <MemoryRouter initialEntries={['/account']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: /sign in to clinora/i })).toBeInTheDocument();
  });
});
